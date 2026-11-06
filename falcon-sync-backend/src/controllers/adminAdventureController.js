import mongoose from 'mongoose';
import Adventure, {
  ADVENTURE_DIFFICULTIES,
  ADVENTURE_STATUSES,
} from '../models/Adventure.js';
import AdventureStop from '../models/AdventureStop.js';
import Location from '../models/Location.js';
import { recordAudit } from '../services/auditService.js';
import { HttpError } from '../utils/HttpError.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_URL_PATTERN =
  /^(?:https?:\/\/[^\s]+|\/api\/uploads\/locations\/[A-Za-z0-9._-]+|\/images\/locations\/[A-Za-z0-9._-]+)$/i;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validationError(details) {
  return new HttpError(
    400,
    'VALIDATION_ERROR',
    'Los datos enviados no son válidos',
    details,
  );
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function readText(body, key, issues, { required = false, min = 0, max = 5000 } = {}) {
  if (!hasOwn(body, key) || body[key] === undefined || body[key] === null) {
    if (required) {
      issues.push(`El campo ${key} es obligatorio`);
    }
    return undefined;
  }

  if (typeof body[key] !== 'string') {
    issues.push(`El campo ${key} debe ser texto`);
    return undefined;
  }

  const value = body[key].trim();

  if (required && value.length === 0) {
    issues.push(`El campo ${key} es obligatorio`);
    return undefined;
  }

  if (value.length > 0 && value.length < min) {
    issues.push(`El campo ${key} debe tener al menos ${min} caracteres`);
  }

  if (value.length > max) {
    issues.push(`El campo ${key} no puede superar ${max} caracteres`);
  }

  return value;
}

function readSlug(body, issues) {
  if (!hasOwn(body, 'slug')) {
    return undefined;
  }

  if (typeof body.slug !== 'string' || body.slug.trim().length === 0) {
    issues.push('El slug debe ser texto y no puede estar vacío');
    return undefined;
  }

  const slug = body.slug.trim().toLowerCase();

  if (!SLUG_PATTERN.test(slug) || slug.length > 100) {
    issues.push('El slug solo admite minúsculas, números y guiones');
    return undefined;
  }

  return slug;
}

function readAssetUrl(body, key, issues) {
  const value = readText(body, key, issues, { max: 500 });

  if (value === undefined || value === '') {
    return value;
  }

  if (!ASSET_URL_PATTERN.test(value)) {
    issues.push(
      `El campo ${key} debe ser una URL http(s) o una ruta local permitida`,
    );
  }

  return value;
}

function readBadge(body, issues) {
  if (!hasOwn(body, 'badge')) {
    return undefined;
  }

  if (body.badge === null) {
    return null;
  }

  if (typeof body.badge !== 'object' || Array.isArray(body.badge)) {
    issues.push('La insignia debe ser un objeto o null');
    return undefined;
  }

  const name = readText(body.badge, 'name', issues, {
    required: true,
    min: 2,
    max: 80,
  });
  const description = readText(body.badge, 'description', issues, {
    max: 280,
  });
  const image = readAssetUrl(body.badge, 'image', issues);

  if (name === undefined) {
    return undefined;
  }

  return {
    name,
    ...(description !== undefined ? { description } : {}),
    ...(image !== undefined ? { image } : {}),
  };
}

function buildPayload(body, { partial = false } = {}) {
  const issues = [];
  const payload = {};

  const title = readText(body, 'title', issues, {
    required: !partial,
    min: 3,
    max: 140,
  });

  if (title !== undefined) {
    payload.title = title;
  }

  if (!partial && !hasOwn(body, 'slug')) {
    payload.slug = slugify(title ?? '');

    if (!payload.slug) {
      issues.push('No se pudo generar un slug a partir del título');
    }
  } else {
    const slug = readSlug(body, issues);

    if (slug !== undefined) {
      payload.slug = slug;
    }
  }

  const summary = readText(body, 'summary', issues, {
    required: !partial,
    min: 10,
    max: 280,
  });

  if (summary !== undefined) {
    payload.summary = summary;
  }

  const description = readText(body, 'description', issues, {
    required: !partial,
    min: 20,
    max: 10000,
  });

  if (description !== undefined) {
    payload.description = description;
  }

  if (!partial || hasOwn(body, 'difficulty')) {
    const difficulty = hasOwn(body, 'difficulty') ? body.difficulty : 'easy';

    if (!ADVENTURE_DIFFICULTIES.includes(difficulty)) {
      issues.push(
        `La dificultad debe ser una de: ${ADVENTURE_DIFFICULTIES.join(', ')}`,
      );
    } else {
      payload.difficulty = difficulty;
    }
  }

  if (!partial || hasOwn(body, 'estimatedMinutes')) {
    const minutes = hasOwn(body, 'estimatedMinutes')
      ? Number(body.estimatedMinutes)
      : 60;

    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      issues.push('La duración estimada debe ser un entero entre 1 y 1440 minutos');
    } else {
      payload.estimatedMinutes = minutes;
    }
  }

  const coverImage = readAssetUrl(body, 'coverImage', issues);

  if (coverImage !== undefined) {
    payload.coverImage = coverImage;
  }

  const badge = readBadge(body, issues);

  if (badge !== undefined) {
    payload.badge = badge;
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return payload;
}

async function findAdventureOrFail(id) {
  const adventure = await Adventure.findById(id);

  if (!adventure) {
    throw new HttpError(
      404,
      'ADVENTURE_NOT_FOUND',
      'No se encontró la aventura',
    );
  }

  return adventure;
}

function ensureEditable(adventure) {
  if (adventure.deletedAt || adventure.status === 'archived') {
    throw new HttpError(
      409,
      'ADVENTURE_ARCHIVED',
      'La aventura está archivada. Restáurala antes de editarla',
    );
  }
}

async function findStopOrFail(adventure, stopId) {
  const stop = await AdventureStop.findOne({
    _id: stopId,
    adventure: adventure._id,
  });

  if (!stop) {
    throw new HttpError(
      404,
      'STOP_NOT_FOUND',
      'No se encontró la parada en esta aventura',
    );
  }

  return stop;
}

async function readPublishedLocation(locationId) {
  if (
    typeof locationId !== 'string' ||
    !mongoose.isValidObjectId(locationId)
  ) {
    throw validationError(['locationId debe ser un identificador válido']);
  }

  const location = await Location.findOne({
    _id: locationId,
    status: 'published',
    deletedAt: null,
  });

  if (!location) {
    throw new HttpError(
      409,
      'LOCATION_NOT_PUBLISHED',
      'La parada solo puede apuntar a un punto de interés publicado',
    );
  }

  return location;
}

async function ensureAdventureCanPublish(adventure) {
  const stops = await AdventureStop.find({ adventure: adventure._id });

  if (stops.length === 0) {
    throw new HttpError(
      409,
      'ADVENTURE_WITHOUT_STOPS',
      'La aventura necesita al menos una parada para publicarse',
    );
  }

  const locationIds = stops.map((stop) => stop.location);
  const publishedLocations = await Location.find({
    _id: { $in: locationIds },
    status: 'published',
    deletedAt: null,
  }).select('_id');
  const publishedIds = new Set(
    publishedLocations.map((location) => location._id.toString()),
  );
  const invalidStops = stops.filter(
    (stop) => !publishedIds.has(stop.location.toString()),
  );

  if (invalidStops.length > 0) {
    throw new HttpError(
      409,
      'ADVENTURE_HAS_INVALID_STOPS',
      'Todas las paradas deben apuntar a puntos de interés publicados antes de publicar la aventura',
      {
        stopIds: invalidStops.map((stop) => stop._id.toString()),
      },
    );
  }
}

function serializeStopWithLocation(stop) {
  return {
    ...stop.toJSON(),
    location: stop.location ? stop.location.toJSON() : null,
  };
}

export async function listAdminAdventures(request, response) {
  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const filter = {};

  if (request.query.status && request.query.status !== 'all') {
    if (!ADVENTURE_STATUSES.includes(request.query.status)) {
      throw validationError([
        `El estado debe ser all o uno de: ${ADVENTURE_STATUSES.join(', ')}`,
      ]);
    }

    filter.status = request.query.status;
  }

  if (request.query.q) {
    const search = String(request.query.q).trim().slice(0, 120);

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { slug: { $regex: escaped, $options: 'i' } },
      ];
    }
  }

  const [adventures, total] = await Promise.all([
    Adventure.find(filter)
      .sort({ updatedAt: -1, title: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Adventure.countDocuments(filter),
  ]);

  response.json({
    data: adventures,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getAdminAdventure(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);
  const stops = await AdventureStop.find({ adventure: adventure._id })
    .sort({ order: 1 })
    .populate('location');

  response.json({
    data: {
      ...adventure.toJSON(),
      stops: stops.map((stop) => serializeStopWithLocation(stop)),
    },
  });
}

export async function createAdminAdventure(request, response) {
  const payload = buildPayload(request.body);

  const existing = await Adventure.findOne({ slug: payload.slug });

  if (existing) {
    throw new HttpError(
      409,
      'DUPLICATE_SLUG',
      'Ya existe una aventura con ese slug',
    );
  }

  const adventure = await Adventure.create({
    ...payload,
    status: 'draft',
    createdBy: request.user._id,
    updatedBy: request.user._id,
  });

  await recordAudit({
    request,
    action: 'adventure.created',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Creó la aventura «${adventure.title}»`,
    metadata: { slug: adventure.slug, status: adventure.status },
  });

  response.status(201).json({ data: adventure });
}

export async function updateAdminAdventure(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);
  ensureEditable(adventure);

  const payload = buildPayload(request.body, { partial: true });

  if (Object.keys(payload).length === 0) {
    throw validationError(['No se envió ningún campo editable']);
  }

  if (payload.slug && payload.slug !== adventure.slug) {
    const duplicate = await Adventure.findOne({
      slug: payload.slug,
      _id: { $ne: adventure._id },
    });

    if (duplicate) {
      throw new HttpError(
        409,
        'DUPLICATE_SLUG',
        'Ya existe una aventura con ese slug',
      );
    }
  }

  const changedFields = Object.keys(payload);
  Object.assign(adventure, payload, { updatedBy: request.user._id });
  await adventure.save();

  await recordAudit({
    request,
    action: 'adventure.updated',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Actualizó la aventura «${adventure.title}»`,
    metadata: { changedFields },
  });

  response.json({ data: adventure });
}

export async function publishAdminAdventure(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);
  ensureEditable(adventure);

  if (adventure.status === 'published') {
    throw new HttpError(
      409,
      'ADVENTURE_ALREADY_PUBLISHED',
      'La aventura ya está publicada',
    );
  }

  await ensureAdventureCanPublish(adventure);

  adventure.status = 'published';
  adventure.updatedBy = request.user._id;
  await adventure.save();

  await recordAudit({
    request,
    action: 'adventure.published',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Publicó la aventura «${adventure.title}»`,
    metadata: { slug: adventure.slug },
  });

  response.json({ data: adventure });
}

export async function archiveAdminAdventure(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);

  if (adventure.deletedAt || adventure.status === 'archived') {
    throw new HttpError(
      409,
      'ADVENTURE_ALREADY_ARCHIVED',
      'La aventura ya está archivada',
    );
  }

  adventure.status = 'archived';
  adventure.deletedAt = new Date();
  adventure.deletedBy = request.user._id;
  adventure.updatedBy = request.user._id;
  await adventure.save();

  await recordAudit({
    request,
    action: 'adventure.archived',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Archivó la aventura «${adventure.title}»`,
    metadata: { slug: adventure.slug },
  });

  response.json({ data: adventure });
}

export async function restoreAdminAdventure(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);

  if (!adventure.deletedAt) {
    throw new HttpError(
      409,
      'ADVENTURE_NOT_ARCHIVED',
      'La aventura no está archivada',
    );
  }

  adventure.status = 'draft';
  adventure.deletedAt = null;
  adventure.deletedBy = null;
  adventure.updatedBy = request.user._id;
  await adventure.save();

  await recordAudit({
    request,
    action: 'adventure.restored',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Restauró la aventura «${adventure.title}»`,
    metadata: { slug: adventure.slug },
  });

  response.json({ data: adventure });
}

export async function addAdminAdventureStop(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);
  ensureEditable(adventure);

  const location = await readPublishedLocation(request.body?.locationId);
  const issues = [];
  const didacticText = readText(request.body ?? {}, 'didacticText', issues, {
    max: 2000,
  });
  const instructions = readText(request.body ?? {}, 'instructions', issues, {
    max: 2000,
  });

  if (issues.length > 0) {
    throw validationError(issues);
  }

  const duplicate = await AdventureStop.findOne({
    adventure: adventure._id,
    location: location._id,
  });

  if (duplicate) {
    throw new HttpError(
      409,
      'STOP_ALREADY_EXISTS',
      'El punto de interés ya es una parada de esta aventura',
    );
  }

  let order;

  if (hasOwn(request.body ?? {}, 'order')) {
    order = Number(request.body.order);

    if (!Number.isInteger(order) || order < 1) {
      throw validationError(['El orden debe ser un entero mayor o igual a 1']);
    }

    const occupied = await AdventureStop.exists({
      adventure: adventure._id,
      order,
    });

    if (occupied) {
      throw new HttpError(
        409,
        'STOP_ORDER_CONFLICT',
        'Ya existe una parada con ese orden en la aventura',
      );
    }
  } else {
    const lastStop = await AdventureStop.findOne({
      adventure: adventure._id,
    }).sort({ order: -1 });
    order = (lastStop?.order ?? 0) + 1;
  }

  let stop;

  try {
    stop = await AdventureStop.create({
      adventure: adventure._id,
      location: location._id,
      order,
      ...(didacticText !== undefined ? { didacticText } : {}),
      ...(instructions !== undefined ? { instructions } : {}),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const code = error.keyPattern?.order
        ? 'STOP_ORDER_CONFLICT'
        : 'STOP_ALREADY_EXISTS';
      throw new HttpError(
        409,
        code,
        code === 'STOP_ORDER_CONFLICT'
          ? 'Ya existe una parada con ese orden en la aventura'
          : 'El punto de interés ya es una parada de esta aventura',
      );
    }

    throw error;
  }

  await recordAudit({
    request,
    action: 'adventure.stop.added',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Añadió la parada «${location.title}» a la aventura «${adventure.title}»`,
    metadata: {
      stopId: stop._id.toString(),
      locationId: location._id.toString(),
      order: stop.order,
    },
  });

  response.status(201).json({ data: stop });
}

export async function updateAdminAdventureStop(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);
  ensureEditable(adventure);

  const stop = await findStopOrFail(adventure, request.params.stopId);
  const body = request.body ?? {};
  const issues = [];

  if (hasOwn(body, 'order')) {
    issues.push('Usa el endpoint de reordenamiento para cambiar el orden');
  }

  const payload = {};

  if (hasOwn(body, 'locationId')) {
    const location = await readPublishedLocation(body.locationId);
    const duplicate = await AdventureStop.findOne({
      adventure: adventure._id,
      location: location._id,
      _id: { $ne: stop._id },
    });

    if (duplicate) {
      throw new HttpError(
        409,
        'STOP_ALREADY_EXISTS',
        'El punto de interés ya es una parada de esta aventura',
      );
    }

    payload.location = location._id;
  }

  const didacticText = readText(body, 'didacticText', issues, { max: 2000 });
  const instructions = readText(body, 'instructions', issues, { max: 2000 });

  if (didacticText !== undefined) {
    payload.didacticText = didacticText;
  }

  if (instructions !== undefined) {
    payload.instructions = instructions;
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  if (Object.keys(payload).length === 0) {
    throw validationError(['No se envió ningún campo editable']);
  }

  const changedFields = Object.keys(payload);
  Object.assign(stop, payload);

  try {
    await stop.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new HttpError(
        409,
        'STOP_ALREADY_EXISTS',
        'El punto de interés ya es una parada de esta aventura',
      );
    }

    throw error;
  }

  await recordAudit({
    request,
    action: 'adventure.stop.updated',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Actualizó una parada de la aventura «${adventure.title}»`,
    metadata: { stopId: stop._id.toString(), changedFields },
  });

  response.json({ data: stop });
}

export async function deleteAdminAdventureStop(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);
  ensureEditable(adventure);

  const stop = await findStopOrFail(adventure, request.params.stopId);

  if (adventure.status === 'published') {
    const totalStops = await AdventureStop.countDocuments({
      adventure: adventure._id,
    });

    if (totalStops <= 1) {
      throw new HttpError(
        409,
        'ADVENTURE_REQUIRES_STOPS',
        'Una aventura publicada no puede quedarse sin paradas',
      );
    }
  }

  await stop.deleteOne();

  await recordAudit({
    request,
    action: 'adventure.stop.removed',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Eliminó una parada de la aventura «${adventure.title}»`,
    metadata: {
      stopId: stop._id.toString(),
      locationId: stop.location.toString(),
    },
  });

  response.json({ data: { id: stop._id.toString() } });
}

export async function reorderAdminAdventureStops(request, response) {
  const adventure = await findAdventureOrFail(request.params.id);
  ensureEditable(adventure);

  const order = request.body?.order;

  if (!Array.isArray(order)) {
    throw validationError(['order debe ser una lista de identificadores de parada']);
  }

  const stops = await AdventureStop.find({ adventure: adventure._id }).select(
    '_id order',
  );

  if (order.length !== stops.length) {
    throw validationError([
      'Debes incluir todas las paradas de la aventura exactamente una vez',
    ]);
  }

  const requestedIds = order.map((id) => String(id));
  const uniqueIds = new Set(requestedIds);
  const existingIds = new Set(stops.map((stop) => stop._id.toString()));

  if (
    uniqueIds.size !== requestedIds.length ||
    uniqueIds.size !== existingIds.size ||
    requestedIds.some((id) => !existingIds.has(id))
  ) {
    throw validationError([
      'Debes incluir todas las paradas de la aventura exactamente una vez',
    ]);
  }

  const previousOrder = new Map(
    stops.map((stop) => [stop._id.toString(), stop.order]),
  );
  const temporaryOperations = requestedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, adventure: adventure._id },
      update: { $set: { order: -(index + 1) } },
    },
  }));
  const finalOperations = requestedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, adventure: adventure._id },
      update: { $set: { order: index + 1 } },
    },
  }));

  try {
    await AdventureStop.bulkWrite(temporaryOperations);
    await AdventureStop.bulkWrite(finalOperations);
  } catch (error) {
    await AdventureStop.bulkWrite(
      [...previousOrder.entries()].map(([id, previous]) => ({
        updateOne: {
          filter: { _id: id, adventure: adventure._id },
          update: { $set: { order: previous } },
        },
      })),
    ).catch(() => undefined);
    throw error;
  }

  await recordAudit({
    request,
    action: 'adventure.stops.reordered',
    entityType: 'Adventure',
    entityId: adventure._id,
    summary: `Reordenó las paradas de la aventura «${adventure.title}»`,
    metadata: { stopIds: requestedIds },
  });

  const updated = await AdventureStop.find({ adventure: adventure._id }).sort({
    order: 1,
  });

  response.json({ data: updated });
}
