import AuditLog from '../models/AuditLog.js';
import Location from '../models/Location.js';
import User from '../models/User.js';

export async function getAdminSummary(_request, response) {
  const [
    users,
    locations,
    publishedLocations,
    draftLocations,
    archivedLocations,
    admins,
    moderators,
    recentActivity,
  ] = await Promise.all([
    User.countDocuments({}),
    Location.countDocuments({}),
    Location.countDocuments({ status: 'published', deletedAt: null }),
    Location.countDocuments({ status: 'draft', deletedAt: null }),
    Location.countDocuments({ status: 'archived' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'moderator' }),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(6),
  ]);

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
      generatedAt: new Date().toISOString(),
    },
  });
}
