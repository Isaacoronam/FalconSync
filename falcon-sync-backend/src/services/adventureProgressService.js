import AdventureStop from '../models/AdventureStop.js';
import CheckIn from '../models/CheckIn.js';

const PUBLIC_LOCATION_FIELDS =
  'title slug category description location images conservationStatus checkInRadiusMeters';

/**
 * Calcula el progreso de una aventura a partir de los check-in globales del
 * usuario. Solo cuentan las paradas cuyo POI sigue publicado y sin archivar.
 */
export async function buildAdventureProgress(adventure, userId) {
  const stops = await AdventureStop.find({ adventure: adventure._id })
    .sort({ order: 1 })
    .populate({
      path: 'location',
      select: PUBLIC_LOCATION_FIELDS,
      match: { status: 'published', deletedAt: null },
    });

  const activeStops = stops.filter((stop) => stop.location);
  const locationIds = activeStops.map((stop) => stop.location._id);

  const checkIns =
    locationIds.length === 0
      ? []
      : await CheckIn.find({
          user: userId,
          location: { $in: locationIds },
        }).sort({ createdAt: 1 });

  const checkInsByLocation = new Map(
    checkIns.map((checkIn) => [checkIn.location.toString(), checkIn]),
  );

  const stopViews = activeStops.map((stop) => {
    const checkIn = checkInsByLocation.get(stop.location._id.toString());

    return {
      id: stop._id.toString(),
      order: stop.order,
      didacticText: stop.didacticText,
      instructions: stop.instructions,
      visited: Boolean(checkIn),
      checkInAt: checkIn?.createdAt ?? null,
      location: stop.location.toJSON(),
    };
  });

  const visitedStops = stopViews.filter((stop) => stop.visited).length;
  const totalStops = stopViews.length;
  const completed = totalStops > 0 && visitedStops === totalStops;
  const nextStop = stopViews.find((stop) => !stop.visited) ?? null;

  let completedAt = null;

  if (completed) {
    completedAt = checkIns.reduce(
      (latest, checkIn) =>
        !latest || checkIn.createdAt > latest ? checkIn.createdAt : latest,
      null,
    );
  }

  return {
    adventure: adventure.toJSON(),
    stops: stopViews,
    totalStops,
    visitedStops,
    remainingStops: totalStops - visitedStops,
    percentage:
      totalStops === 0 ? 0 : Math.round((visitedStops / totalStops) * 100),
    nextStop,
    completed,
    completedAt,
  };
}
