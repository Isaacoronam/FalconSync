import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import HeritageAsset from '../../databases/models/HeritageAsset.js';
import Location from '../../databases/models/Location.js';
import Panorama, {
  HOTSPOT_TYPES,
  PANORAMA_VISIBILITY,
} from '../../databases/models/Panorama.js';
import { HttpError } from '../../helpers/HttpError.js';
import { hasCapability } from '../authorizationService.js';
import { processPanoramaContent } from './panoramaContent.js';
import {
  deletePanoramaFiles,
  readPanoramaFile,
  savePanoramaFiles,
} from './panoramaStorage.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_HOTSPOTS = 40;

function fail(status, code, message, details) {
  throw new HttpError(status, code, message, details);
}

function requiredText(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(422, 'VALIDATION_ERROR', `El campo ${field} es obligatorio`);
  }

  const text = value.trim();

  if (text.length > max) {
    fail(422, 'VALIDATION_ERROR', `El campo ${field} no puede superar ${max} caracteres`);
  }

  return text;
}

function optionalText(value, field, max) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    fail(422, 'VALIDATION_ERROR', `El campo ${field} debe ser texto`);
  }

  const text = value.trim();

  if (text.length > max) {
    fail(422, 'VALIDATION_ERROR', `El campo ${field} no puede superar ${max} caracteres`);
  }

  return text || null;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1' || value === 'on') {
    return true;
  }

  if (value === 'false' || value === '0' || value === 'off') {
    return false;
  }

  fail(422, 'VALIDATION_ERROR', 'Un campo booleano tiene un valor no válido');
}

function parseObjectId(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (!mongoose.isValidObjectId(value)) {
    fail(422, 'VALIDATION_ERROR', `El campo ${field} no es un identificador válido`);
  }

  return new mongoose.Types.ObjectId(String(value));
}

function parseDate(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail(422, 'VALIDATION_ERROR', `El campo ${field} no contiene una fecha válida`);
  }

  if (date.getTime() > Date.now() + 5 * 60_000) {
    fail(422, 'VALIDATION_ERROR', `El campo ${field} no puede estar en el futuro`);
  }

  return date;
}

function parseVisibility(value, fallback = 'public') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (!PANORAMA_VISIBILITY.includes(value)) {
    fail(422, 'VALIDATION_ERROR', 'La visibilidad debe ser public o inspection');
  }

  return value;
}

function readHotspotArray(value) {
  if (value === undefined) {
    return undefined;
  }

  let parsed = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      fail(422, 'VALIDATION_ERROR', 'Los hotspots deben enviarse como JSON válido');
    }
  }

  if (!Array.isArray(parsed)) {
    fail(422, 'VALIDATION_ERROR', 'Los hotspots deben ser una lista');
  }

  if (parsed.length > MAX_HOTSPOTS) {
    fail(422, 'VALIDATION_ERROR', `No se admiten más de ${MAX_HOTSPOTS} hotspots`);
  }

  const ids = new Set();
  const hotspots = parsed.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      fail(422, 'VALIDATION_ERROR', `El hotspot ${index + 1} no es válido`);
    }

    const label = requiredText(raw.label, `label del hotspot ${index + 1}`, 80);
    const ariaLabel = requiredText(
      raw.ariaLabel,
      `ariaLabel del hotspot ${index + 1}`,
      120,
    );

    if (!HOTSPOT_TYPES.includes(raw.type)) {
      fail(
        422,
        'VALIDATION_ERROR',
        `El hotspot ${index + 1} debe ser de tipo scene, location o info`,
      );
    }

    const yaw = Number(raw.yaw);
    const pitch = Number(raw.pitch);

    if (!Number.isFinite(yaw) || yaw < -180 || yaw > 180) {
      fail(422, 'VALIDATION_ERROR', `El yaw del hotspot ${index + 1} no es válido`);
    }

    if (!Number.isFinite(pitch) || pitch < -90 || pitch > 90) {
      fail(422, 'VALIDATION_ERROR', `El pitch del hotspot ${index + 1} no es válido`);
    }

    const hotspotId =
      raw.hotspotId === undefined || raw.hotspotId === null || raw.hotspotId === ''
        ? randomUUID()
        : String(raw.hotspotId);

    if (!UUID_PATTERN.test(hotspotId)) {
      fail(
        422,
        'VALIDATION_ERROR',
        `El hotspot ${index + 1} debe tener un hotspotId UUID`,
      );
    }

    if (ids.has(hotspotId)) {
      fail(422, 'VALIDATION_ERROR', 'Los identificadores de hotspot no pueden repetirse');
    }

    ids.add(hotspotId);

    const targetPanoramaId = parseObjectId(
      raw.targetPanoramaId,
      `targetPanoramaId del hotspot ${index + 1}`,
    );
    const targetLocationId = parseObjectId(
      raw.targetLocationId,
      `targetLocationId del hotspot ${index + 1}`,
    );
    let targetUrl = optionalText(raw.targetUrl, 'targetUrl', 500);

    if (raw.type === 'scene' && !targetPanoramaId) {
      fail(
        422,
        'VALIDATION_ERROR',
        `El hotspot de escena ${index + 1} necesita targetPanoramaId`,
      );
    }

    if (raw.type === 'location' && !targetLocationId) {
      fail(
        422,
        'VALIDATION_ERROR',
        `El hotspot de lugar ${index + 1} necesita targetLocationId`,
      );
    }

    if (raw.type === 'info') {
      if (!targetUrl || !targetUrl.startsWith('/') || targetUrl.startsWith('//')) {
        fail(
          422,
          'VALIDATION_ERROR',
          'Un hotspot de información solo admite rutas internas que empiecen por /',
        );
      }
    } else {
      targetUrl = null;
    }

    return {
      hotspotId,
      label,
      type: raw.type,
      yaw,
      pitch,
      targetPanoramaId: raw.type === 'scene' ? targetPanoramaId : null,
      targetLocationId: raw.type === 'location' ? targetLocationId : null,
      targetUrl,
      ariaLabel,
    };
  });

  return hotspots;
}

async function assertHotspotTargets(hotspots, panoramaId) {
  if (!hotspots?.length) {
    return;
  }

  const sceneIds = hotspots
    .filter((hotspot) => hotspot.type === 'scene')
    .map((hotspot) => hotspot.targetPanoramaId);
  const locationIds = hotspots
    .filter((hotspot) => hotspot.type === 'location')
    .map((hotspot) => hotspot.targetLocationId);

  if (panoramaId && sceneIds.some((id) => id.equals(panoramaId))) {
    fail(422, 'INVALID_HOTSPOT', 'Un panorama no puede enlazarse a sí mismo');
  }

  if (sceneIds.length) {
    const targets = await Panorama.find({
      _id: { $in: sceneIds },
      status: 'published',
      visibility: 'public',
    }).select('_id');

    const found = new Set(targets.map((target) => target._id.toString()));

    for (const id of sceneIds) {
      if (!found.has(id.toString())) {
        fail(
          422,
          'INVALID_HOTSPOT',
          'Un hotspot de escena apunta a un panorama que no está publicado',
        );
      }
    }
  }

  if (locationIds.length) {
    const targets = await Location.find({
      _id: { $in: locationIds },
      status: 'published',
      deletedAt: null,
    }).select('_id');
    const found = new Set(targets.map((target) => target._id.toString()));

    for (const id of locationIds) {
      if (!found.has(id.toString())) {
        fail(
          422,
          'INVALID_HOTSPOT',
          'Un hotspot de lugar apunta a un POI que no está publicado',
        );
      }
    }
  }
}

async function assertDestinations({ locationId, assetId, visibility, published }) {
  if (!locationId && !assetId) {
    fail(
      422,
      'VALIDATION_ERROR',
      'El panorama debe asociarse al menos a un POI o activo patrimonial',
    );
  }

  if (locationId) {
    const location = await Location.findOne({
      _id: locationId,
      deletedAt: null,
    }).select('_id status isProvisional');

    if (!location) {
      fail(422, 'VALIDATION_ERROR', 'El POI indicado no existe');
    }

    if (published && visibility === 'public' && location.status !== 'published') {
      fail(
        409,
        'PANORAMA_NOT_READY',
        'No se publica un panorama público asociado a un POI no publicado',
      );
    }
  }

  if (assetId) {
    const asset = await HeritageAsset.findById(assetId).select('_id status');

    if (!asset) {
      fail(422, 'VALIDATION_ERROR', 'El activo patrimonial indicado no existe');
    }

    if (published && visibility === 'public' && asset.status !== 'active') {
      fail(
        409,
        'PANORAMA_NOT_READY',
        'No se publica un panorama público asociado a un activo no activo',
      );
    }
  }
}

function rightsIssues(panorama) {
  const issues = [];

  if (!panorama.author?.trim()) {
    issues.push('Falta la autoría');
  }

  if (!panorama.license?.trim()) {
    issues.push('Falta la licencia');
  }

  if (!panorama.credit?.trim()) {
    issues.push('Falta el crédito visible');
  }

  if (!panorama.rightsDocumented) {
    issues.push('Los derechos no están documentados');
  }

  if (
    panorama.consent?.peopleBlurred !== true &&
    panorama.consent?.consentDocumented !== true
  ) {
    issues.push('No se confirmó el difuminado de personas ni el consentimiento');
  }

  if (!panorama.licenseUrl && !panorama.rightsNotes) {
    issues.push('Falta el enlace o la referencia documental de la licencia');
  }

  return issues;
}

function publishIssues(panorama) {
  const issues = rightsIssues(panorama);

  if (!panorama.fallback?.alt?.trim()) {
    issues.push('El fallback no tiene texto alternativo');
  }

  if (!panorama.fallback?.description?.trim()) {
    issues.push('El fallback no tiene descripción');
  }

  if (
    !panorama.derivativeKey ||
    !panorama.derivativeChecksum ||
    !panorama.thumbnailKey ||
    !panorama.thumbnailChecksum
  ) {
    issues.push('Faltan derivados íntegros de la panorámica');
  }

  return issues;
}

function requireVersion(version) {
  if (!Number.isInteger(version) || version < 0) {
    fail(428, 'VERSION_REQUIRED', 'Debes enviar la versión actual en If-Match');
  }
}

function idOf(value) {
  if (!value) {
    return null;
  }

  if (value._id) {
    return value._id.toString();
  }

  return String(value);
}

function refLocation(panorama, { publicOnly = false } = {}) {
  const location = panorama.locationId;

  if (!location?._id || !location.title) {
    return null;
  }

  if (publicOnly && (location.status !== 'published' || location.deletedAt)) {
    return null;
  }

  return {
    id: location._id.toString(),
    title: location.title,
    slug: location.slug ?? null,
    status: location.status ?? null,
  };
}

function refAsset(panorama) {
  const asset = panorama.assetId;

  if (!asset?._id || (!asset.code && !asset.name)) {
    return null;
  }

  return {
    id: asset._id.toString(),
    code: asset.code ?? null,
    name: asset.name ?? null,
    status: asset.status ?? null,
  };
}

function serializeHotspot(hotspot) {
  return {
    hotspotId: hotspot.hotspotId,
    label: hotspot.label,
    type: hotspot.type,
    yaw: hotspot.yaw,
    pitch: hotspot.pitch,
    targetPanoramaId: idOf(hotspot.targetPanoramaId),
    targetPanoramaTitle: hotspot.targetPanoramaId?.title ?? null,
    targetLocationId: idOf(hotspot.targetLocationId),
    targetLocationSlug: hotspot.targetLocationId?.slug ?? null,
    targetUrl: hotspot.targetUrl ?? null,
    ariaLabel: hotspot.ariaLabel,
  };
}

function publicSummary(panorama) {
  const id = panorama._id.toString();

  return {
    id,
    title: panorama.title,
    locationId: idOf(panorama.locationId),
    assetId: idOf(panorama.assetId),
    thumbnailUrl: `/api/panoramas/${id}/thumbnail`,
    projection: panorama.projection,
    capturedAt: panorama.capturedAt,
    credits: panorama.credit,
    width: panorama.width,
    height: panorama.height,
    location: refLocation(panorama, { publicOnly: true }),
    asset: refAsset(panorama),
  };
}

function publicDetail(panorama) {
  const id = panorama._id.toString();
  const fallbackAlt =
    panorama.fallback?.alt?.trim() || `Vista panorámica de ${panorama.title}`;
  const fallbackDescription =
    panorama.fallback?.description?.trim() || panorama.description || '';

  return {
    ...publicSummary(panorama),
    description: panorama.description,
    imageUrl: `/api/panoramas/${id}/image`,
    hotspots: panorama.hotspots.map(serializeHotspot),
    fallback: {
      imageUrl: `/api/panoramas/${id}/image`,
      alt: fallbackAlt,
      description: fallbackDescription,
      transcript: panorama.fallback?.transcript ?? null,
    },
    license: panorama.license,
    licenseUrl: panorama.licenseUrl ?? null,
    author: panorama.author,
    status: 'published',
    visibility: 'public',
  };
}

function adminSummary(panorama) {
  const id = panorama._id.toString();

  return {
    id,
    title: panorama.title,
    locationId: idOf(panorama.locationId),
    assetId: idOf(panorama.assetId),
    thumbnailUrl: panorama.thumbnailChecksum
      ? `/api/admin/panoramas/${id}/thumbnail`
      : null,
    projection: panorama.projection,
    capturedAt: panorama.capturedAt,
    credits: panorama.credit,
    width: panorama.width,
    height: panorama.height,
    status: panorama.status,
    visibility: panorama.visibility,
    version: panorama.version,
    hasDerivative: Boolean(panorama.derivativeChecksum),
    createdAt: panorama.createdAt,
    updatedAt: panorama.updatedAt,
    location: refLocation(panorama),
    asset: refAsset(panorama),
  };
}

function adminDetail(panorama) {
  const id = panorama._id.toString();

  return {
    ...adminSummary(panorama),
    description: panorama.description,
    imageUrl: panorama.derivativeChecksum
      ? `/api/admin/panoramas/${id}/image`
      : null,
    hotspots: panorama.hotspots.map(serializeHotspot),
    fallbackAlt:
      panorama.fallback?.alt?.trim() || `Vista panorámica de ${panorama.title}`,
    fallbackDescription:
      panorama.fallback?.description?.trim() || panorama.description || '',
    transcript: panorama.fallback?.transcript ?? null,
    license: panorama.license,
    licenseUrl: panorama.licenseUrl ?? null,
    author: panorama.author,
    credit: panorama.credit,
    rightsDocumented: panorama.rightsDocumented === true,
    permitDocumented: panorama.permitDocumented === true,
    rightsNotes: panorama.rightsNotes ?? null,
    peopleBlurred: panorama.consent?.peopleBlurred === true,
    consentDocumented: panorama.consent?.consentDocumented === true,
    consentNotes: panorama.consent?.notes ?? null,
    checksum: panorama.checksum,
    derivativeChecksum: panorama.derivativeChecksum ?? null,
    thumbnailChecksum: panorama.thumbnailChecksum ?? null,
    bytes: panorama.bytes,
    derivativeBytes: panorama.derivativeBytes ?? null,
    approvedAt: panorama.approvedAt,
    publishedAt: panorama.publishedAt,
    archivedAt: panorama.archivedAt,
    createdBy: idOf(panorama.createdBy),
    updatedBy: idOf(panorama.updatedBy),
  };
}

function pagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));

  return { page, limit, skip: (page - 1) * limit };
}

function meta(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function populatePanorama(query, { hotspots = false } = {}) {
  if (hotspots) {
    query = query
      .populate('hotspots.targetPanoramaId', 'title')
      .populate('hotspots.targetLocationId', 'title slug');
  }

  return query
    .populate('locationId', 'title slug status deletedAt')
    .populate('assetId', 'code name status');
}

async function populatePanoramaTargets(panorama) {
  if (panorama.hotspots?.length) {
    await panorama.populate([
      { path: 'hotspots.targetPanoramaId', select: 'title' },
      { path: 'hotspots.targetLocationId', select: 'title slug' },
    ]);
  }
}

async function populateAdminResponse(panorama) {
  await panorama.populate([
    { path: 'locationId', select: 'title slug status deletedAt' },
    { path: 'assetId', select: 'code name status' },
  ]);
  await populatePanoramaTargets(panorama);
  return panorama;
}

export async function listPublicPanoramas(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = { status: 'published', visibility: 'public' };

  if (query.locationId) {
    filter.locationId = parseObjectId(query.locationId, 'locationId');
  }

  if (query.assetId) {
    filter.assetId = parseObjectId(query.assetId, 'assetId');
  }

  const [panoramas, total] = await Promise.all([
    populatePanorama(Panorama.find(filter))
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Panorama.countDocuments(filter),
  ]);

  return {
    data: panoramas.map(publicSummary),
    meta: meta(total, page, limit),
  };
}

export async function getPublicPanorama(id) {
  if (!mongoose.isValidObjectId(id)) {
    fail(404, 'NOT_FOUND', 'La visita 360° no existe o no está publicada');
  }

  const panorama = await populatePanorama(
    Panorama.findOne({
      _id: id,
      status: 'published',
      visibility: 'public',
    }),
    { hotspots: true },
  );

  if (!panorama) {
    fail(404, 'NOT_FOUND', 'La visita 360° no existe o no está publicada');
  }

  return publicDetail(panorama);
}

export async function streamPublicPanorama(id, variant) {
  return streamPanorama(id, variant, { admin: false });
}

async function streamPanorama(id, variant, { admin, actor } = {}) {
  if (!mongoose.isValidObjectId(id)) {
    fail(404, 'NOT_FOUND', 'La visita 360° no existe o no está publicada');
  }

  const filter = admin ? { _id: id } : { _id: id, status: 'published', visibility: 'public' };
  const panorama = await Panorama.findOne(filter).select(
    '+derivativeKey +thumbnailKey',
  );

  if (!panorama) {
    fail(404, 'NOT_FOUND', 'La visita 360° no existe o no está publicada');
  }

  if (admin && actor && !hasCapability(actor, 'panorama.manage') && panorama.visibility !== 'public') {
    fail(404, 'NOT_FOUND', 'El panorama no está disponible');
  }

  const key = variant === 'thumbnail' ? panorama.thumbnailKey : panorama.derivativeKey;
  const expectedChecksum =
    variant === 'thumbnail'
      ? panorama.thumbnailChecksum
      : panorama.derivativeChecksum;

  if (!key || !expectedChecksum) {
    fail(
      503,
      'PANORAMA_INTEGRITY_ERROR',
      'La imagen de la visita 360° no está disponible temporalmente',
    );
  }

  const buffer = await readPanoramaFile(key);
  const checksum = createHash('sha256').update(buffer).digest('hex');

  if (checksum !== expectedChecksum) {
    fail(
      503,
      'PANORAMA_INTEGRITY_ERROR',
      'La imagen de la visita 360° no superó la verificación de integridad',
    );
  }

  return {
    buffer,
    checksum,
    mimeType: 'image/webp',
  };
}

export async function streamAdminPanorama(id, variant, actor) {
  return streamPanorama(id, variant, { admin: true, actor });
}

export async function listAdminPanoramas(query = {}, actor) {
  const { page, limit, skip } = pagination(query);
  const filter = {};

  if (query.status) {
    if (!['draft', 'approved', 'published', 'archived'].includes(query.status)) {
      fail(422, 'VALIDATION_ERROR', 'Estado de panorama no válido');
    }

    filter.status = query.status;
  }

  if (query.visibility) {
    filter.visibility = parseVisibility(query.visibility);
  }

  if (query.locationId) {
    filter.locationId = parseObjectId(query.locationId, 'locationId');
  }

  if (query.q && typeof query.q === 'string') {
    const escaped = query.q.trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (escaped) {
      filter.title = new RegExp(escaped, 'i');
    }
  }

  if (!hasCapability(actor, 'panorama.manage')) {
    filter.visibility = 'public';
  }

  const [panoramas, total] = await Promise.all([
    populatePanorama(Panorama.find(filter))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Panorama.countDocuments(filter),
  ]);

  return {
    data: panoramas.map(adminSummary),
    meta: meta(total, page, limit),
  };
}

export async function getAdminPanorama(id, actor) {
  if (!mongoose.isValidObjectId(id)) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  const panorama = await populatePanorama(Panorama.findById(id), {
    hotspots: true,
  });

  if (!panorama) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  if (
    !hasCapability(actor, 'panorama.manage') &&
    panorama.visibility !== 'public'
  ) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  return adminDetail(panorama);
}

export async function createPanorama({ file, fields }, actor) {
  if (!file?.buffer) {
    fail(400, 'PANORAMA_FILE_REQUIRED', 'Debes adjuntar la imagen de la panorámica');
  }

  const title = requiredText(fields.title, 'título', 160);
  const description = optionalText(fields.description, 'descripción', 2000) ?? '';
  const author = requiredText(fields.author, 'autoría', 160);
  const license = requiredText(fields.license, 'licencia', 200);
  const credit = requiredText(fields.credit, 'crédito', 300);
  const licenseUrl = optionalText(fields.licenseUrl, 'enlace de licencia', 500);

  if (licenseUrl && !/^https?:\/\/[^\s]+$/i.test(licenseUrl)) {
    fail(422, 'VALIDATION_ERROR', 'El enlace de la licencia debe ser http(s)');
  }

  const locationId = parseObjectId(fields.locationId, 'locationId');
  const assetId = parseObjectId(fields.assetId, 'assetId');
  const visibility = parseVisibility(fields.visibility);
  const capturedAt = parseDate(fields.capturedAt, 'capturedAt');
  const rightsDocumented = parseBoolean(fields.rightsDocumented, false);
  const permitDocumented = parseBoolean(fields.permitDocumented, false);
  const rightsNotes = optionalText(fields.rightsNotes, 'notas de derechos', 500);
  const peopleBlurred = parseBoolean(fields.peopleBlurred, false);
  const consentDocumented = parseBoolean(fields.consentDocumented, false);
  const consentNotes = optionalText(fields.consentNotes, 'notas de consentimiento', 500);
  const fallbackAlt =
    optionalText(fields.fallbackAlt, 'texto alternativo', 200) ||
    `Vista panorámica de ${title}`;
  const fallbackDescription =
    optionalText(fields.fallbackDescription, 'descripción del fallback', 2000) ??
    description;
  const transcript = optionalText(fields.transcript, 'transcripción', 10000);
  const hotspots = readHotspotArray(fields.hotspots) ?? [];

  await assertDestinations({
    locationId,
    assetId,
    visibility,
    published: false,
  });
  await assertHotspotTargets(hotspots, null);

  const content = await processPanoramaContent(file.buffer, file.mimetype);
  const id = new mongoose.Types.ObjectId();
  const keys = await savePanoramaFiles(id.toString(), content);

  try {
    const panorama = await Panorama.create({
      _id: id,
      assetId,
      locationId,
      title,
      description,
      imageKey: keys.imageKey,
      derivativeKey: keys.derivativeKey,
      thumbnailKey: keys.thumbnailKey,
      projection: 'equirectangular',
      width: content.derivative.width,
      height: content.derivative.height,
      checksum: content.original.checksum,
      derivativeChecksum: content.derivative.checksum,
      thumbnailChecksum: content.thumbnail.checksum,
      bytes: content.original.bytes,
      derivativeBytes: content.derivative.bytes,
      thumbnailBytes: content.thumbnail.bytes,
      license,
      licenseUrl,
      author,
      credit,
      capturedAt,
      status: 'draft',
      visibility,
      hotspots,
      fallback: {
        alt: fallbackAlt,
        description: fallbackDescription,
        transcript,
      },
      rightsDocumented,
      permitDocumented,
      rightsNotes,
      consent: {
        peopleBlurred,
        consentDocumented,
        notes: consentNotes,
      },
      createdBy: actor._id,
      version: 0,
    });

    await panorama.populate([
      { path: 'locationId', select: 'title slug status deletedAt' },
      { path: 'assetId', select: 'code name status' },
    ]);
    await populatePanoramaTargets(panorama);

    return adminDetail(panorama);
  } catch (error) {
    await deletePanoramaFiles(id);
    throw error;
  }
}

export async function updatePanorama(id, fields, actor, expectedVersion) {
  requireVersion(expectedVersion);

  if (!mongoose.isValidObjectId(id)) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  const panorama = await Panorama.findById(id);

  if (!panorama) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  if (panorama.version !== expectedVersion) {
    fail(409, 'VERSION_CONFLICT', 'El panorama cambió; vuelve a cargarlo');
  }

  if (panorama.status === 'archived') {
    fail(409, 'PANORAMA_ARCHIVED', 'Un panorama archivado no se puede editar');
  }

  if (fields.title !== undefined) {
    panorama.title = requiredText(fields.title, 'título', 160);
  }

  if (fields.description !== undefined) {
    panorama.description = optionalText(fields.description, 'descripción', 2000) ?? '';
  }

  if (fields.locationId !== undefined) {
    panorama.locationId = parseObjectId(fields.locationId, 'locationId');
  }

  if (fields.assetId !== undefined) {
    panorama.assetId = parseObjectId(fields.assetId, 'assetId');
  }

  if (fields.visibility !== undefined) {
    panorama.visibility = parseVisibility(fields.visibility);
  }

  if (fields.capturedAt !== undefined) {
    panorama.capturedAt = parseDate(fields.capturedAt, 'capturedAt');
  }

  if (fields.license !== undefined) {
    panorama.license = requiredText(fields.license, 'licencia', 200);
  }

  if (fields.licenseUrl !== undefined) {
    panorama.licenseUrl = optionalText(fields.licenseUrl, 'enlace de licencia', 500);

    if (panorama.licenseUrl && !/^https?:\/\/[^\s]+$/i.test(panorama.licenseUrl)) {
      fail(422, 'VALIDATION_ERROR', 'El enlace de la licencia debe ser http(s)');
    }
  }

  if (fields.author !== undefined) {
    panorama.author = requiredText(fields.author, 'autoría', 160);
  }

  if (fields.credit !== undefined) {
    panorama.credit = requiredText(fields.credit, 'crédito', 300);
  }

  if (fields.rightsDocumented !== undefined) {
    panorama.rightsDocumented = parseBoolean(fields.rightsDocumented, false);
  }

  if (fields.permitDocumented !== undefined) {
    panorama.permitDocumented = parseBoolean(fields.permitDocumented, false);
  }

  if (fields.rightsNotes !== undefined) {
    panorama.rightsNotes = optionalText(fields.rightsNotes, 'notas de derechos', 500);
  }

  if (fields.fallbackAlt !== undefined) {
    panorama.fallback.alt =
      optionalText(fields.fallbackAlt, 'texto alternativo', 200) ||
      `Vista panorámica de ${panorama.title}`;
  }

  if (fields.fallbackDescription !== undefined) {
    panorama.fallback.description =
      optionalText(fields.fallbackDescription, 'descripción del fallback', 2000) ?? '';
  } else if (fields.description !== undefined) {
    panorama.fallback.description = panorama.description;
  }

  if (fields.transcript !== undefined) {
    panorama.fallback.transcript = optionalText(fields.transcript, 'transcripción', 10000);
  }

  if (fields.peopleBlurred !== undefined) {
    panorama.consent.peopleBlurred = parseBoolean(fields.peopleBlurred, false);
  }

  if (fields.consentDocumented !== undefined) {
    panorama.consent.consentDocumented = parseBoolean(fields.consentDocumented, false);
  }

  if (fields.consentNotes !== undefined) {
    panorama.consent.notes = optionalText(fields.consentNotes, 'notas de consentimiento', 500);
  }

  if (fields.hotspots !== undefined) {
    const hotspots = readHotspotArray(fields.hotspots);

    await assertHotspotTargets(hotspots, panorama._id);
    panorama.hotspots = hotspots;
  }

  await assertDestinations({
    locationId: panorama.locationId,
    assetId: panorama.assetId,
    visibility: panorama.visibility,
    published: panorama.status === 'published',
  });

  panorama.updatedBy = actor._id;
  panorama.version += 1;
  await panorama.save();
  await panorama.populate([
    { path: 'locationId', select: 'title slug status deletedAt' },
    { path: 'assetId', select: 'code name status' },
  ]);
  await populatePanoramaTargets(panorama);

  return adminDetail(panorama);
}

async function loadForTransition(id, expectedVersion, actor) {
  requireVersion(expectedVersion);

  if (!mongoose.isValidObjectId(id)) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  const panorama = await Panorama.findById(id).select(
    '+derivativeKey +thumbnailKey',
  );

  if (!panorama) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  if (panorama.version !== expectedVersion) {
    fail(409, 'VERSION_CONFLICT', 'El panorama cambió; vuelve a cargarlo');
  }

  if (
    !hasCapability(actor, 'panorama.manage') &&
    panorama.visibility !== 'public'
  ) {
    fail(404, 'NOT_FOUND', 'El panorama no existe');
  }

  // La configuración técnica de inspección la gobierna administración; la
  // publicación turística es editorial y corresponde al historiador.
  const requiredCapability =
    panorama.visibility === 'inspection' ? 'panorama.manage' : 'panorama.publish';

  if (!hasCapability(actor, requiredCapability)) {
    fail(
      403,
      'FORBIDDEN',
      panorama.visibility === 'inspection'
        ? 'Solo administración puede gestionar panoramas de inspección'
        : 'Solo el equipo editorial puede aprobar o publicar visitas turísticas',
    );
  }

  return panorama;
}

export async function approvePanorama(id, expectedVersion, actor) {
  const panorama = await loadForTransition(id, expectedVersion, actor);

  if (panorama.status !== 'draft') {
    fail(409, 'INVALID_STATUS_TRANSITION', 'Solo se aprueba un panorama en borrador');
  }

  const issues = rightsIssues(panorama);

  if (issues.length) {
    fail(409, 'RIGHTS_INCOMPLETE', 'Faltan derechos para aprobar el panorama', issues);
  }

  panorama.status = 'approved';
  panorama.approvedAt = new Date();
  panorama.approvedBy = actor._id;
  panorama.updatedBy = actor._id;
  panorama.version += 1;
  await panorama.save();
  await populateAdminResponse(panorama);

  return adminDetail(panorama);
}

export async function publishPanorama(id, expectedVersion, actor) {
  const panorama = await loadForTransition(id, expectedVersion, actor);

  if (panorama.status !== 'approved') {
    fail(
      409,
      'INVALID_STATUS_TRANSITION',
      'Solo se publica un panorama aprobado',
    );
  }

  const issues = publishIssues(panorama);

  if (issues.length) {
    fail(409, 'PANORAMA_NOT_READY', 'El panorama no está listo para publicarse', issues);
  }

  await assertDestinations({
    locationId: panorama.locationId,
    assetId: panorama.assetId,
    visibility: panorama.visibility,
    published: true,
  });

  panorama.status = 'published';
  panorama.publishedAt = new Date();
  panorama.publishedBy = actor._id;
  panorama.updatedBy = actor._id;
  panorama.version += 1;
  await panorama.save();
  await populateAdminResponse(panorama);

  return adminDetail(panorama);
}

export async function archivePanorama(id, expectedVersion, actor) {
  const panorama = await loadForTransition(id, expectedVersion, actor);

  if (panorama.status === 'archived') {
    fail(409, 'INVALID_STATUS_TRANSITION', 'El panorama ya está archivado');
  }

  panorama.status = 'archived';
  panorama.archivedAt = new Date();
  panorama.updatedBy = actor._id;
  panorama.version += 1;
  await panorama.save();
  await populateAdminResponse(panorama);

  return adminDetail(panorama);
}
