import {
  approvePanorama,
  archivePanorama,
  createPanorama,
  getAdminPanorama,
  getPublicPanorama,
  listAdminPanoramas,
  listPublicPanoramas,
  publishPanorama,
  streamAdminPanorama,
  streamPublicPanorama,
  updatePanorama,
} from '../../microservices/panorama/panoramaService.js';
import { recordAudit } from '../../microservices/auditService.js';
import { HttpError } from '../../helpers/HttpError.js';

const UPDATE_FIELDS = [
  'title',
  'description',
  'locationId',
  'assetId',
  'visibility',
  'capturedAt',
  'license',
  'licenseUrl',
  'author',
  'credit',
  'rightsDocumented',
  'permitDocumented',
  'rightsNotes',
  'peopleBlurred',
  'consentDocumented',
  'consentNotes',
  'fallbackAlt',
  'fallbackDescription',
  'transcript',
  'hotspots',
];

function pick(value, fields) {
  const result = {};

  for (const field of fields) {
    if (value?.[field] !== undefined) {
      result[field] = value[field];
    }
  }

  return result;
}

function expectedVersion(request) {
  const header = request.get('if-match');
  const match = header?.trim().match(/^"?(\d+)"?$/);

  if (!match) {
    throw new HttpError(
      428,
      'VERSION_REQUIRED',
      'Debes enviar la versión actual en la cabecera If-Match',
    );
  }

  return Number.parseInt(match[1], 10);
}

function setVersion(response, panorama) {
  response.set('ETag', `"${panorama.version}"`);
}

function serializeAuditMetadata(panorama) {
  return {
    status: panorama.status,
    visibility: panorama.visibility,
    locationId: panorama.locationId ?? null,
    assetId: panorama.assetId ?? null,
  };
}

function sendImage(response, result, { privateCache }) {
  response.set({
    'Cache-Control': privateCache ? 'private, no-store' : 'public, max-age=86400',
    'Content-Type': result.mimeType,
    'Content-Length': String(result.buffer.length),
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ETag: `"${result.checksum}"`,
  });
  response.send(result.buffer);
}

export async function listPublicPanoramasController(request, response) {
  response.json(await listPublicPanoramas(request.query));
}

export async function getPublicPanoramaController(request, response) {
  const panorama = await getPublicPanorama(request.params.id);
  response.json({ data: panorama });
}

export async function publicPanoramaImageController(request, response) {
  const result = await streamPublicPanorama(request.params.id, 'image');
  sendImage(response, result, { privateCache: false });
}

export async function publicPanoramaThumbnailController(request, response) {
  const result = await streamPublicPanorama(request.params.id, 'thumbnail');
  sendImage(response, result, { privateCache: false });
}

export async function listAdminPanoramasController(request, response) {
  response.json(await listAdminPanoramas(request.query, request.user));
}

export async function getAdminPanoramaController(request, response) {
  const panorama = await getAdminPanorama(request.params.id, request.user);
  setVersion(response, panorama);
  response.json({ data: panorama });
}

export async function createPanoramaController(request, response) {
  const panorama = await createPanorama(
    { file: request.file, fields: request.body },
    request.user,
  );

  await recordAudit({
    request,
    action: 'panorama.created',
    entityType: 'Panorama',
    entityId: panorama.id,
    summary: `Panorama «${panorama.title}» creado`,
    metadata: serializeAuditMetadata(panorama),
    required: true,
  });

  setVersion(response, panorama);
  response.status(201).json({ data: panorama });
}

export async function updatePanoramaController(request, response) {
  const panorama = await updatePanorama(
    request.params.id,
    pick(request.body, UPDATE_FIELDS),
    request.user,
    expectedVersion(request),
  );

  await recordAudit({
    request,
    action: 'panorama.updated',
    entityType: 'Panorama',
    entityId: panorama.id,
    summary: `Panorama «${panorama.title}» actualizado`,
    metadata: serializeAuditMetadata(panorama),
    required: true,
  });

  setVersion(response, panorama);
  response.json({ data: panorama });
}

export async function approvePanoramaController(request, response) {
  const panorama = await approvePanorama(
    request.params.id,
    expectedVersion(request),
    request.user,
  );

  await recordAudit({
    request,
    action: 'panorama.approved',
    entityType: 'Panorama',
    entityId: panorama.id,
    summary: `Panorama «${panorama.title}» aprobado`,
    metadata: serializeAuditMetadata(panorama),
    required: true,
  });

  setVersion(response, panorama);
  response.json({ data: panorama });
}

export async function publishPanoramaController(request, response) {
  const panorama = await publishPanorama(
    request.params.id,
    expectedVersion(request),
    request.user,
  );

  await recordAudit({
    request,
    action: 'panorama.published',
    entityType: 'Panorama',
    entityId: panorama.id,
    summary: `Panorama «${panorama.title}» publicado`,
    metadata: serializeAuditMetadata(panorama),
    required: true,
  });

  setVersion(response, panorama);
  response.json({ data: panorama });
}

export async function archivePanoramaController(request, response) {
  const panorama = await archivePanorama(
    request.params.id,
    expectedVersion(request),
    request.user,
  );

  await recordAudit({
    request,
    action: 'panorama.archived',
    entityType: 'Panorama',
    entityId: panorama.id,
    summary: `Panorama «${panorama.title}» archivado`,
    metadata: serializeAuditMetadata(panorama),
    required: true,
  });

  setVersion(response, panorama);
  response.json({ data: panorama });
}

export async function adminPanoramaImageController(request, response) {
  const result = await streamAdminPanorama(
    request.params.id,
    'image',
    request.user,
  );
  sendImage(response, result, { privateCache: true });
}

export async function adminPanoramaThumbnailController(request, response) {
  const result = await streamAdminPanorama(
    request.params.id,
    'thumbnail',
    request.user,
  );
  sendImage(response, result, { privateCache: true });
}
