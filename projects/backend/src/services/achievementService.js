import Adventure from '../models/Adventure.js';
import CheckIn from '../models/CheckIn.js';
import Location from '../models/Location.js';
import UserAchievement from '../models/UserAchievement.js';

const LOCATION_DESCRIPTION =
  'Sello de visita al patrimonio de Santa Ana de Coro.';

let indexReady = null;

/**
 * El índice único es la garantía de idempotencia. Se construye una sola vez
 * por proceso antes del primer otorgamiento.
 */
async function ensureIndexes() {
  if (!indexReady) {
    indexReady = UserAchievement.init().catch((error) => {
      indexReady = null;
      throw error;
    });
  }

  return indexReady;
}

function locationDocument({ userId, location, checkInId }) {
  return {
    user: userId,
    type: 'location',
    sourceId: location._id,
    sourceSlug: location.slug,
    name: location.title,
    description: LOCATION_DESCRIPTION,
    image: null,
    category: location.category ?? null,
    awardedAt: new Date(),
    sourceCheckIn: checkInId ?? null,
  };
}

/**
 * Inserta la insignia solo si no existe. Devuelve el documento creado o null
 * cuando ya estaba otorgada. El filtro y el índice único son la misma clave.
 */
async function insertOnce({ document, dryRun = false }) {
  const filter = {
    user: document.user,
    type: document.type,
    sourceId: document.sourceId,
  };

  if (dryRun) {
    const exists = await UserAchievement.exists(filter);

    if (exists) {
      return null;
    }

    return {
      ...document,
      id: null,
      awardedAt: document.awardedAt ?? new Date(),
      dryRun: true,
    };
  }

  await ensureIndexes();

  try {
    const result = await UserAchievement.updateOne(
      filter,
      { $setOnInsert: document },
      { upsert: true },
    );

    if (result.upsertedCount === 0) {
      return null;
    }
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }

    throw error;
  }

  return UserAchievement.findOne(filter);
}

export async function awardLocationAchievement({
  userId,
  location,
  checkInId = null,
  dryRun = false,
}) {
  return insertOnce({
    document: locationDocument({ userId, location, checkInId }),
    dryRun,
  });
}

/**
 * Otorga una sola insignia por el lugar visitado. Los recorridos heredados no
 * generan nuevas recompensas durante los check-ins.
 */
export async function reconcileAchievementsForLocation({
  userId,
  location,
  checkInId = null,
  dryRun = false,
}) {
  const awards = [];
  const locationAward = await awardLocationAchievement({
    userId,
    location,
    checkInId,
    dryRun,
  });

  if (locationAward) {
    awards.push(locationAward);
  }

  return awards;
}

/**
 * Reconstruye las insignias de lugares de un usuario desde sus check-ins.
 * Los logros históricos de recorridos ya existentes se conservan sin crear
 * otros nuevos. La operación es idempotente.
 */
export async function reconcileUserAchievements(
  userId,
  { dryRun = false } = {},
) {
  const checkIns = await CheckIn.find({ user: userId })
    .sort({ createdAt: 1 })
    .populate({
      path: 'location',
      select: 'title slug category',
    });

  const locationAwards = [];

  for (const checkIn of checkIns) {
    if (!checkIn.location) {
      continue;
    }

    const award = await awardLocationAchievement({
      userId,
      location: checkIn.location,
      checkInId: checkIn._id,
      dryRun,
    });

    if (award) {
      locationAwards.push(award);
    }
  }

  return { locationAwards, adventureAwards: [] };
}

/**
 * Devuelve las insignias del usuario con una marca de vigencia del origen.
 * La instantánea se conserva aunque el lugar o el recorrido se archiven.
 */
export async function listUserAchievements(userId) {
  const achievements = await UserAchievement.find({ user: userId }).sort({
    awardedAt: -1,
    _id: -1,
  });

  const locationIds = achievements
    .filter((achievement) => achievement.type === 'location')
    .map((achievement) => achievement.sourceId);
  const adventureIds = achievements
    .filter((achievement) => achievement.type === 'adventure')
    .map((achievement) => achievement.sourceId);

  const [activeLocations, activeAdventures] = await Promise.all([
    locationIds.length === 0
      ? []
      : Location.find({
          _id: { $in: locationIds },
          status: 'published',
          deletedAt: null,
          isProvisional: { $ne: true },
          isCatalogVisible: { $ne: false },
        }).select('_id'),
    adventureIds.length === 0
      ? []
      : Adventure.find({
          _id: { $in: adventureIds },
          status: 'published',
          deletedAt: null,
        }).select('_id'),
  ]);

  const activeKeys = new Set([
    ...activeLocations.map(
      (location) => `location:${location._id.toString()}`,
    ),
    ...activeAdventures.map(
      (adventure) => `adventure:${adventure._id.toString()}`,
    ),
  ]);

  return achievements.map((achievement) => ({
    ...achievement.toJSON(),
    sourceActive: activeKeys.has(
      `${achievement.type}:${achievement.sourceId.toString()}`,
    ),
  }));
}
