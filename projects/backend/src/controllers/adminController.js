import AuditLog from '../models/AuditLog.js';
import Adventure from '../models/Adventure.js';
import CheckIn from '../models/CheckIn.js';
import Location from '../models/Location.js';
import User from '../models/User.js';

export async function getAdminSummary(_request, response) {
  const generatedAt = new Date();
  const startDate = new Date(generatedAt);
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - 29);

  const [
    users,
    locations,
    publishedLocations,
    draftLocations,
    archivedLocations,
    admins,
    moderators,
    recentActivity,
    totalCheckIns,
    checkInAnalytics,
    provisionalLocations,
    unverifiedLocations,
    publishedAdventures,
    draftAdventures,
  ] = await Promise.all([
    User.countDocuments({}),
    Location.countDocuments({}),
    Location.countDocuments({ status: 'published', deletedAt: null }),
    Location.countDocuments({ status: 'draft', deletedAt: null }),
    Location.countDocuments({ status: 'archived' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'moderator' }),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(6),
    CheckIn.countDocuments({}),
    CheckIn.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $facet: {
          visitsByDay: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: 'UTC',
                  },
                },
                visits: { $sum: 1 },
              },
            },
          ],
          visitors: [{ $group: { _id: '$user' } }, { $count: 'total' }],
          topLocations: [
            { $group: { _id: '$location', visits: { $sum: 1 } } },
            {
              $lookup: {
                from: Location.collection.name,
                localField: '_id',
                foreignField: '_id',
                as: 'location',
              },
            },
            { $unwind: '$location' },
            {
              $match: {
                'location.status': 'published',
                'location.deletedAt': null,
                'location.isProvisional': { $ne: true },
                'location.isCatalogVisible': { $ne: false },
              },
            },
            { $sort: { visits: -1, 'location.title': 1 } },
            { $limit: 5 },
            {
              $project: {
                _id: { $toString: '$location._id' },
                title: '$location.title',
                slug: '$location.slug',
                visits: 1,
              },
            },
          ],
        },
      },
    ]),
    Location.countDocuments({ deletedAt: null, isProvisional: true }),
    Location.countDocuments({
      status: 'published',
      deletedAt: null,
      verificationLevel: { $in: ['unverified', null] },
    }),
    Adventure.countDocuments({ status: 'published', deletedAt: null }),
    Adventure.countDocuments({ status: 'draft', deletedAt: null }),
  ]);

  const dailyVisits = new Map(
    (checkInAnalytics[0]?.visitsByDay ?? []).map(({ _id, visits }) => [
      _id,
      visits,
    ]),
  );
  const visitsByDay = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);

    return { date: key, visits: dailyVisits.get(key) ?? 0 };
  });

  response.json({
    data: {
      users,
      locations,
      locationsByStatus: {
        published: publishedLocations,
        draft: draftLocations,
        archived: archivedLocations,
      },
      byRole: {
        admin: admins,
        moderator: moderators,
        user: users - admins - moderators,
      },
      recentActivity: recentActivity.map((entry) => entry.toJSON()),
      tourism: {
        totalCheckIns,
        checkInsLast30Days: visitsByDay.reduce(
          (total, day) => total + day.visits,
          0,
        ),
        uniqueVisitorsLast30Days: checkInAnalytics[0]?.visitors[0]?.total ?? 0,
        visitsByDay,
        topLocationsLast30Days: checkInAnalytics[0]?.topLocations ?? [],
      },
      contentReview: {
        draftLocations,
        provisionalLocations,
        unverifiedLocations,
        draftAdventures,
      },
      adventures: {
        published: publishedAdventures,
        draft: draftAdventures,
      },
      generatedAt: generatedAt.toISOString(),
    },
  });
}
