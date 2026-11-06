import { isInsideFalcon } from '../config/falcon.js';
import Adventure from '../models/Adventure.js';
import AdventureStop from '../models/AdventureStop.js';
import AuditLog from '../models/AuditLog.js';
import Location, {
  CONSERVATION_STATUSES,
  LOCATION_CATEGORIES,
  LOCATION_STATUSES,
} from '../models/Location.js';
import { recordAudit } from '../services/auditService.js';
import {
  createCheckInToken,
  hashCheckInToken,
} from '../services/checkInTokenService.js';
import { QR_FORMATS, renderCheckInQr } from '../services/qrService.js';
import { storageAdapter } from '../services/storage/index.js';
import { HttpError } from '../utils/HttpError.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_IMAGES = 8;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UPLOADED_IMAGE_PATTERN =
  /^(?:\/api\/uploads\/locations\/|\/images\/locations\/)[A-Za-z0-9._-]+$/;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

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

  return value.length === 0 ? '' : value;
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

function readCoordinates(body, issues, { required }) {
  const hasLatitude = hasOwn(body, 'latitude');
  const hasLongitude = hasOwn(body, 'longitude');
  const nested = body.location?.coordinates;

  if (!hasLatitude && !hasLongitude) {
    if (Array.isArray(nested)) {
      return readCoordinatePair(nested, issues);
    }

    if (required) {
      issues.push('La latitud y la longitud son obligatorias');
    }

    return undefined;
  }

  if (!hasLatitude || !hasLongitude) {
    issues.push('Debes indicar latitud y longitud juntas');
    return undefined;
  }

  return readCoordinatePair([Number(body.longitude), Number(body.latitude)], issues);
}

function readCoordinatePair(coordinates, issues) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    issues.push('Las coordenadas deben ser [longitud, latitud]');
    return undefined;
  }

  const [longitude, latitude] = coordinates.map(Number);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    issues.push('Las coordenadas deben ser números válidos');
    return undefined;
  }

  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    issues.push('Las coordenadas están fuera de los rangos permitidos');
    return undefined;
  }

  if (!isInsideFalcon(longitude, latitude)) {
    issues.push('Las coordenadas deben estar dentro del estado Falcón');
    return undefined;
  }

  return [longitude, latitude];
}

function readImages(body, issues) {
  if (!hasOwn(body, 'images')) {
    return undefined;
  }

  if (!Array.isArray(body.images)) {
    issues.push('Las imágenes deben enviarse como una lista');
    return undefined;
  }

  if (body.images.length > MAX_IMAGES) {
    issues.push(`No se pueden asociar más de ${MAX_IMAGES} imágenes`);
    return undefined;
  }

  const images = [];

  for (const image of body.images) {
    if (typeof image !== 'string' || !UPLOADED_IMAGE_PATTERN.test(image)) {
      issues.push('Una de las imágenes no tiene una ruta permitida');
      continue;
    }

    if (!images.includes(image)) {
      images.push(image);
    }
  }

  return images;
}

function readStatus(body, issues, { allowArchived = false } = {}) {
  if (!hasOwn(body, 'status')) {
    return undefined;
  }

  const allowed = allowArchived
    ? LOCATION_STATUSES
    : LOCATION_STATUSES.filter((status) => status !== 'archived');

  if (!allowed.includes(body.status)) {
    issues.push(`El estado debe ser uno de: ${allowed.join(', ')}`);
    return undefined;
  }

  return body.status;
}

function readCheckInRadius(body, issues) {
  if (!hasOwn(body, 'checkInRadiusMeters')) {
    return undefined;
  }

  const value = Number(body.checkInRadiusMeters);

  if (!Number.isInteger(value) || value < 10 || value > 500) {
    issues.push('El radio de check-in debe ser un entero entre 10 y 500 metros');
    return undefined;
  }

  return value;
}

function readHttpUrl(body, key, issues) {
  const value = readText(body, key, issues, { max: 500 });

  if (value === undefined || value === '') {
    return value;
  }

  if (!HTTP_URL_PATTERN.test(value)) {
    issues.push(`El campo ${key} debe ser una URL http o https`);
  }

  return value;
}

function buildPayload(body, { partial = false } = {}) {
  const issues = [];
  const payload = {};

  const title = readText(body, 'title', issues, {
    required: !partial,
    min: 3,
    max: 120,
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

  if (!partial || hasOwn(body, 'category')) {
    if (!LOCATION_CATEGORIES.includes(body.category)) {
      issues.push(`La categoría debe ser una de: ${LOCATION_CATEGORIES.join(', ')}`);
    } else {
      payload.category = body.category;
    }
  }

  const description = readText(body, 'description', issues, {
    required: !partial,
    min: 10,
    max: 5000,
  });

  if (description !== undefined) {
    payload.description = description;
  }

  const historicalPeriod = readText(body, 'historicalPeriod', issues, {
    max: 120,
  });

  if (historicalPeriod !== undefined) {
    payload.historicalPeriod = historicalPeriod;
  }

  const coordinates = readCoordinates(body, issues, { required: !partial });

  if (coordinates) {
    payload.location = { type: 'Point', coordinates };
  }

  if (!partial || hasOwn(body, 'conservationStatus')) {
    if (!CONSERVATION_STATUSES.includes(body.conservationStatus)) {
      issues.push(
        `El estado de conservación debe ser uno de: ${CONSERVATION_STATUSES.join(', ')}`,
      );
    } else {
      payload.conservationStatus = body.conservationStatus;
    }
  }

  const sourceUrl = readHttpUrl(body, 'sourceUrl', issues);

  if (sourceUrl !== undefined) {
    payload.sourceUrl = sourceUrl;
  }

  const audioGuideUrl = readHttpUrl(body, 'audioGuideUrl', issues);

  if (audioGuideUrl !== undefined) {
    payload.audioGuideUrl = audioGuideUrl;
  }

  const images = readImages(body, issues);

  if (images !== undefined) {
    payload.images = images;
  }

  if (!partial || hasOwn(body, 'isProvisional')) {
    if (typeof body.isProvisional !== 'boolean') {
      issues.push('isProvisional debe ser verdadero o falso');
    } else {
      payload.isProvisional = body.isProvisional;
    }
  }

  const status = readStatus(body, issues);

  if (status !== undefined) {
    payload.status = status;
  }

  const checkInRadiusMeters = readCheckInRadius(body, issues);

  if (checkInRadiusMeters !== undefined) {
    payload.checkInRadiusMeters = checkInRadiusMeters;
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return payload;
}

async function findLocationOrFail(id) {
  const location = await Location.findById(id);

  if (!location) {
    throw new HttpError(
      404,
      'LOCATION_NOT_FOUND',
      'No se encontró el punto de interés',
    );
  }

  return location;
}

function ensureEditable(location) {
  if (location.deletedAt) {
    throw new HttpError(
      409,
      'LOCATION_ARCHIVED',
      'El punto de interés está archivado. Restáuralo antes de editarlo',
    );
  }
}

async function ensureLocationNotInUse(location) {
  const publishedAdventureIds = await Adventure.distinct('_id', {
    status: 'published',
    deletedAt: null,
  });

  if (publishedAdventureIds.length === 0) {
    return;
  }

  const stop = await AdventureStop.exists({
    location: location._id,
    adventure: { $in: publishedAdventureIds },
  });

  if (stop) {
    throw new HttpError(
      409,
      'LOCATION_IN_USE',
      'El punto de interés es parada de una aventura publicada. Retíralo o sustitúyelo antes de archivarlo o retirarlo de publicación',
    );
  }
}

export async function listAdminLocations(request, response) {
  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const filter = {};

  if (request.query.status && request.query.status !== 'all') {
    if (!LOCATION_STATUSES.includes(request.query.status)) {
      throw validationError([
        `El estado debe ser all o uno de: ${LOCATION_STATUSES.join(', ')}`,
      ]);
    }

    filter.status = request.query.status;
  }

  if (request.query.category && request.query.category !== 'all') {
    if (!LOCATION_CATEGORIES.includes(request.query.category)) {
      throw validationError([
        `La categoría debe ser all o una de: ${LOCATION_CATEGORIES.join(', ')}`,
      ]);
    }

    filter.category = request.query.category;
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

  const [locations, total] = await Promise.all([
    Location.find(filter)
      .sort({ updatedAt: -1, title: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Location.countDocuments(filter),
  ]);

  response.json({
    data: locations,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getAdminLocation(request, response) {
  const location = await findLocationOrFail(request.params.id);
  response.json({ data: location });
}

export async function createAdminLocation(request, response) {
  const payload = buildPayload(request.body);

  const existing = await Location.findOne({ slug: payload.slug });

  if (existing) {
    throw new HttpError(
      409,
      'DUPLICATE_SLUG',
      'Ya existe un punto de interés con ese slug',
    );
  }

  const location = await Location.create({
    ...payload,
    status: payload.status ?? 'draft',
    createdBy: request.user._id,
    updatedBy: request.user._id,
  });

  await recordAudit({
    request,
    action: 'location.created',
    entityId: location._id,
    summary: `Creó el POI «${location.title}»`,
    metadata: { slug: location.slug, status: location.status },
  });

  response.status(201).json({ data: location });
}

export async function updateAdminLocation(request, response) {
  const location = await findLocationOrFail(request.params.id);
  ensureEditable(location);

  const payload = buildPayload(request.body, { partial: true });

  if (Object.keys(payload).length === 0) {
    throw validationError(['No se envió ningún campo editable']);
  }

  if (payload.slug && payload.slug !== location.slug) {
    const duplicate = await Location.findOne({
      slug: payload.slug,
      _id: { $ne: location._id },
    });

    if (duplicate) {
      throw new HttpError(
        409,
        'DUPLICATE_SLUG',
        'Ya existe un punto de interés con ese slug',
      );
    }
  }

  if (
    payload.status !== undefined &&
    payload.status !== 'published' &&
    location.status === 'published'
  ) {
    await ensureLocationNotInUse(location);
  }

  const changedFields = Object.keys(payload);
  Object.assign(location, payload, { updatedBy: request.user._id });
  await location.save();

  await recordAudit({
    request,
    action: 'location.updated',
    entityId: location._id,
    summary: `Actualizó el POI «${location.title}»`,
    metadata: { changedFields },
  });

  response.json({ data: location });
}

export async function deleteAdminLocation(request, response) {
  const location = await findLocationOrFail(request.params.id);

  if (location.deletedAt) {
    throw new HttpError(
      409,
      'LOCATION_ALREADY_ARCHIVED',
      'El punto de interés ya está archivado',
    );
  }

  await ensureLocationNotInUse(location);

  location.status = 'archived';
  location.deletedAt = new Date();
  location.deletedBy = request.user._id;
  location.updatedBy = request.user._id;
  await location.save();

  await recordAudit({
    request,
    action: 'location.deleted',
    entityId: location._id,
    summary: `Archivó el POI «${location.title}»`,
    metadata: { slug: location.slug },
  });

  response.json({ data: location });
}

export async function restoreAdminLocation(request, response) {
  const location = await findLocationOrFail(request.params.id);

  if (!location.deletedAt) {
    throw new HttpError(
      409,
      'LOCATION_NOT_ARCHIVED',
      'El punto de interés no está archivado',
    );
  }

  location.status = 'draft';
  location.deletedAt = null;
  location.deletedBy = null;
  location.updatedBy = request.user._id;
  await location.save();

  await recordAudit({
    request,
    action: 'location.restored',
    entityId: location._id,
    summary: `Restauró el POI «${location.title}»`,
    metadata: { slug: location.slug },
  });

  response.json({ data: location });
}

export async function uploadAdminLocationImage(request, response) {
  const location = await findLocationOrFail(request.params.id);
  ensureEditable(location);

  if (!request.file) {
    throw validationError(['Debes adjuntar una imagen en el campo image']);
  }

  if (location.images.length >= MAX_IMAGES) {
    throw new HttpError(
      409,
      'IMAGE_LIMIT_REACHED',
      `No se pueden asociar más de ${MAX_IMAGES} imágenes`,
    );
  }

  const stored = await storageAdapter.saveLocationImage({
    buffer: request.file.buffer,
    originalName: request.file.originalname,
  });

  try {
    location.images.push(stored.url);
    location.updatedBy = request.user._id;
    await location.save();
  } catch (error) {
    await storageAdapter.removeByUrl(stored.url).catch(() => undefined);
    throw error;
  }

  await recordAudit({
    request,
    action: 'location.image.uploaded',
    entityId: location._id,
    summary: `Añadió una imagen al POI «${location.title}»`,
    metadata: { url: stored.url, mimeType: stored.mimeType, size: stored.size },
  });

  response.status(201).json({ data: location, image: stored });
}

export async function deleteAdminLocationImage(request, response) {
  const location = await findLocationOrFail(request.params.id);
  ensureEditable(location);

  const url = request.body?.url;

  if (typeof url !== 'string' || !location.images.includes(url)) {
    throw new HttpError(
      404,
      'IMAGE_NOT_FOUND',
      'La imagen no está asociada a este punto de interés',
    );
  }

  location.images.pull(url);
  location.updatedBy = request.user._id;
  await location.save();

  await storageAdapter.removeByUrl(url).catch((error) => {
    console.error('[FalconSync] No se pudo borrar el archivo de imagen:', error);
  });

  await recordAudit({
    request,
    action: 'location.image.removed',
    entityId: location._id,
    summary: `Eliminó una imagen del POI «${location.title}»`,
    metadata: { url },
  });

  response.json({ data: location });
}

export async function rotateLocationCheckInToken(request, response) {
  const location = await findLocationOrFail(request.params.id);
  ensureEditable(location);

  const format =
    typeof request.query.format === 'string'
      ? request.query.format.toLowerCase()
      : 'svg';

  if (!QR_FORMATS.includes(format)) {
    throw new HttpError(
      400,
      'INVALID_QR_FORMAT',
      `El formato del QR debe ser uno de: ${QR_FORMATS.join(', ')}`,
    );
  }

  const token = createCheckInToken();
  const rotatedAt = new Date();

  location.checkInTokenHash = hashCheckInToken(token);
  location.checkInTokenVersion = (location.checkInTokenVersion ?? 0) + 1;
  location.checkInTokenRotatedAt = rotatedAt;
  location.updatedBy = request.user._id;
  await location.save();

  const qr = await renderCheckInQr({
    locationId: location._id,
    token,
    format,
  });

  await recordAudit({
    request,
    action: 'location.qr.rotated',
    entityType: 'Location',
    entityId: location._id,
    summary: `Rotó el QR de check-in del POI «${location.title}»`,
    metadata: {
      slug: location.slug,
      tokenVersion: location.checkInTokenVersion,
      format,
    },
  });

  response.set('Cache-Control', 'no-store');
  response.json({
    data: {
      location: location.toJSON(),
      token,
      tokenVersion: location.checkInTokenVersion,
      rotatedAt,
      format,
      qrDataUrl: qr.dataUrl,
    },
  });
}

export async function listAuditLog(request, response) {
  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const filter = {};

  if (request.query.action) {
    filter.action = request.query.action;
  }

  if (request.query.entityId) {
    filter.entityId = request.query.entityId;
  }

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  response.json({
    data: entries,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
