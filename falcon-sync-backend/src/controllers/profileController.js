import mongoose from 'mongoose';
import Adventure from '../models/Adventure.js';
import AdventureStop from '../models/AdventureStop.js';
import CheckIn from '../models/CheckIn.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { storageAdapter } from '../services/storage/index.js';
import { generateUniqueUsername } from '../services/usernameService.js';
import { HttpError } from '../utils/HttpError.js';
import {
  normalizeUsername,
  validateName,
  validateUsername,
} from '../utils/validation.js';

const PROFILE_FIELDS =
  'name username email bio role isActive mustChangePassword lastLoginAt createdAt updatedAt +avatarFilename +avatarMimeType +avatarSize +avatarUpdatedAt';
const RECENT_CHECKINS_LIMIT = 8;

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function validationError(details) {
  return new HttpError(
    400,
    'VALIDATION_ERROR',
    'Los datos enviados no son válidos',
    details,
  );
}

function serializeProfile(user) {
  const avatarVersion = user.avatarUpdatedAt ?? user.updatedAt;
  const hasAvatar = Boolean(user.avatarFilename);

  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username ?? null,
    email: user.email,
    bio: user.bio ?? '',
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    hasAvatar,
    avatarUrl: hasAvatar
      ? `/api/profile/avatar?v=${new Date(avatarVersion).getTime()}`
      : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeRecentCheckIn(checkIn) {
  return {
    id: checkIn._id.toString(),
    createdAt: checkIn.createdAt,
    distanceMeters: Math.round(checkIn.distanceMeters),
    photoAvailable: Boolean(checkIn.photo?.filename),
    photoUrl: checkIn.photo?.filename
      ? `/api/profile/check-ins/${checkIn._id.toString()}/photo`
      : null,
    location: {
      id: checkIn.location._id.toString(),
      title: checkIn.location.title,
      slug: checkIn.location.slug,
      images: checkIn.location.images ?? [],
      coordinates: checkIn.location.location?.coordinates ?? null,
    },
  };
}

async function buildAdventureOverview(userId) {
  const adventures = await Adventure.find({
    status: 'published',
    deletedAt: null,
  })
    .select('title slug summary difficulty estimatedMinutes coverImage badge')
    .sort({ title: 1 });

  if (adventures.length === 0) {
    return {
      adventures: [],
      stats: {
        totalAdventures: 0,
        startedAdventures: 0,
        completedAdventures: 0,
        totalStops: 0,
        visitedStops: 0,
      },
    };
  }

  const stops = await AdventureStop.find({
    adventure: { $in: adventures.map((adventure) => adventure._id) },
  }).select('adventure location order');

  const locationIds = [
    ...new Set(stops.map((stop) => stop.location.toString())),
  ];

  const [publishedLocations, checkIns] = await Promise.all([
    locationIds.length === 0
      ? []
      : Location.find({
          _id: { $in: locationIds },
          status: 'published',
          deletedAt: null,
          isProvisional: { $ne: true },
          isCatalogVisible: { $ne: false },
        }).select('_id'),
    locationIds.length === 0
      ? []
      : CheckIn.find({
          user: userId,
          location: { $in: locationIds },
        }).select('location createdAt'),
  ]);

  const publishedIds = new Set(
    publishedLocations.map((location) => location._id.toString()),
  );
  const checkInByLocation = new Map(
    checkIns.map((checkIn) => [checkIn.location.toString(), checkIn.createdAt]),
  );
  const stopsByAdventure = new Map();

  for (const stop of stops) {
    const locationId = stop.location.toString();

    if (!publishedIds.has(locationId)) {
      continue;
    }

    const list = stopsByAdventure.get(stop.adventure.toString()) ?? [];
    list.push(stop);
    stopsByAdventure.set(stop.adventure.toString(), list);
  }

  const summaries = adventures.map((adventure) => {
    const adventureStops =
      stopsByAdventure.get(adventure._id.toString()) ?? [];
    const visitedDates = adventureStops
      .map((stop) => checkInByLocation.get(stop.location.toString()))
      .filter(Boolean);
    const totalStops = adventureStops.length;
    const visitedStops = visitedDates.length;
    const completed = totalStops > 0 && visitedStops === totalStops;
    const lastVisitAt =
      visitedDates.length === 0
        ? null
        : visitedDates.reduce((latest, date) =>
            date > latest ? date : latest,
          );

    return {
      ...adventure.toJSON(),
      totalStops,
      visitedStops,
      percentage:
        totalStops === 0 ? 0 : Math.round((visitedStops / totalStops) * 100),
      completed,
      lastVisitAt,
    };
  });

  return {
    adventures: summaries,
    stats: {
      totalAdventures: summaries.length,
      startedAdventures: summaries.filter(
        (adventure) => adventure.visitedStops > 0,
      ).length,
      completedAdventures: summaries.filter(
        (adventure) => adventure.completed,
      ).length,
      totalStops: summaries.reduce(
        (total, adventure) => total + adventure.totalStops,
        0,
      ),
      visitedStops: summaries.reduce(
        (total, adventure) => total + adventure.visitedStops,
        0,
      ),
    },
  };
}

async function loadProfileUser(userId, selectedFields = PROFILE_FIELDS) {
  const user = await User.findById(userId).select(selectedFields);

  if (!user || !user.isActive) {
    throw new HttpError(
      401,
      'ACCOUNT_UNAVAILABLE',
      'La cuenta no existe o está desactivada',
    );
  }

  return user;
}

export async function getMyProfile(request, response) {
  const user = await loadProfileUser(request.user._id);

  const [totalCheckIns, overview, recentCheckIns] = await Promise.all([
    CheckIn.countDocuments({ user: user._id }),
    buildAdventureOverview(user._id),
    CheckIn.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(RECENT_CHECKINS_LIMIT)
      .populate({
        path: 'location',
        select: 'title slug images location',
      }),
  ]);

  response.json({
    data: {
      profile: serializeProfile(user),
      stats: {
        totalCheckIns,
        uniqueLocations: totalCheckIns,
        ...overview.stats,
      },
      adventures: overview.adventures,
      recentCheckIns: recentCheckIns
        .filter((checkIn) => checkIn.location)
        .map((checkIn) => serializeRecentCheckIn(checkIn)),
    },
  });
}

export async function updateMyProfile(request, response) {
  const body = request.body ?? {};
  const user = await loadProfileUser(request.user._id);
  const issues = [];
  let changed = false;

  if (hasOwn(body, 'name')) {
    if (typeof body.name !== 'string') {
      issues.push('El nombre debe ser texto');
    } else {
      issues.push(...validateName(body.name));

      if (issues.length === 0) {
        user.name = body.name.trim();
        changed = true;
      }
    }
  }

  if (hasOwn(body, 'username')) {
    if (typeof body.username !== 'string') {
      issues.push('El nombre de usuario debe ser texto');
    } else {
      const username = normalizeUsername(body.username);
      issues.push(...validateUsername(username));

      if (!issues.length && username !== user.username) {
        const duplicate = await User.exists({
          username,
          _id: { $ne: user._id },
        });

        if (duplicate) {
          throw new HttpError(
            409,
            'USERNAME_IN_USE',
            'Ese nombre de usuario ya está en uso',
          );
        }

        user.username = username;
        changed = true;
      }
    }
  }

  if (hasOwn(body, 'bio')) {
    if (typeof body.bio !== 'string') {
      issues.push('La biografía debe ser texto');
    } else {
      const bio = body.bio.trim();

      if (bio.length > 280) {
        issues.push('La biografía no puede superar 280 caracteres');
      } else {
        user.bio = bio;
        changed = true;
      }
    }
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  if (!changed && user.username) {
    throw validationError(['No se envió ningún campo editable']);
  }

  if (!user.username) {
    user.username = await generateUniqueUsername({
      name: user.name,
      email: user.email,
      excludeUserId: user._id,
    });
  }

  await user.save();

  response.json({ data: { profile: serializeProfile(user) } });
}

export async function uploadMyAvatar(request, response) {
  if (!request.file) {
    throw new HttpError(
      400,
      'IMAGE_REQUIRED',
      'Selecciona una imagen para tu avatar',
    );
  }

  const user = await loadProfileUser(request.user._id);
  const saved = await storageAdapter.saveImage({
    buffer: request.file.buffer,
    folder: 'avatars',
  });
  const previousFilename = user.avatarFilename;

  user.avatarFilename = saved.filename;
  user.avatarMimeType = saved.mimeType;
  user.avatarSize = saved.size;
  user.avatarUpdatedAt = new Date();

  try {
    await user.save();
  } catch (error) {
    await storageAdapter
      .removeByFilename('avatars', saved.filename)
      .catch(() => undefined);
    throw error;
  }

  if (previousFilename && previousFilename !== saved.filename) {
    await storageAdapter
      .removeByFilename('avatars', previousFilename)
      .catch(() => undefined);
  }

  response.json({ data: { profile: serializeProfile(user) } });
}

export async function deleteMyAvatar(request, response) {
  const user = await loadProfileUser(request.user._id);
  const previousFilename = user.avatarFilename;

  if (previousFilename) {
    user.avatarFilename = null;
    user.avatarMimeType = null;
    user.avatarSize = null;
    user.avatarUpdatedAt = null;
    await user.save();

    await storageAdapter
      .removeByFilename('avatars', previousFilename)
      .catch(() => undefined);
  }

  response.json({ data: { profile: serializeProfile(user) } });
}

export async function getMyAvatar(request, response) {
  const user = await loadProfileUser(
    request.user._id,
    '+avatarFilename +avatarMimeType',
  );

  if (!user.avatarFilename) {
    throw new HttpError(404, 'AVATAR_NOT_FOUND', 'No hay un avatar guardado');
  }

  const absolutePath = storageAdapter.resolveImagePath(
    'avatars',
    user.avatarFilename,
  );

  response.set('Cache-Control', 'private, max-age=300, must-revalidate');
  response.type(user.avatarMimeType ?? 'application/octet-stream');
  response.sendFile(absolutePath);
}

export async function getMyCheckInPhoto(request, response) {
  const { checkInId } = request.params;

  if (!mongoose.isValidObjectId(checkInId)) {
    throw new HttpError(
      404,
      'CHECK_IN_PHOTO_NOT_FOUND',
      'No se encontró la foto del check-in',
    );
  }

  const checkIn = await CheckIn.findOne({
    _id: checkInId,
    user: request.user._id,
  }).select('photo');

  if (!checkIn?.photo?.filename) {
    throw new HttpError(
      404,
      'CHECK_IN_PHOTO_NOT_FOUND',
      'No se encontró la foto del check-in',
    );
  }

  const absolutePath = storageAdapter.resolveImagePath(
    'check-ins',
    checkIn.photo.filename,
  );

  response.set('Cache-Control', 'private, max-age=300, must-revalidate');
  response.type(checkIn.photo.mimeType);
  response.sendFile(absolutePath);
}
