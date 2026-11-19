import { randomUUID } from 'node:crypto';
import {
  downloadEvidence,
  listEvidence,
  listEvidenceAccessLog,
  uploadEvidence,
} from '../../microservices/evidenceService.js';

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function correlationId(request) {
  const supplied = request.get('x-correlation-id');
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
    ? supplied
    : randomUUID();
}

export async function uploadEvidenceController(request, response) {
  const result = await uploadEvidence(
    {
      file: request.file,
      ownerType: request.body.ownerType,
      ownerId: request.body.ownerId,
      findingId: request.body.findingId,
      purpose: request.body.purpose,
      capturedAt: request.body.capturedAt,
      latitude: request.body.latitude,
      longitude: request.body.longitude,
      accuracyMeters: request.body.accuracyMeters,
      idempotencyKey: request.get('idempotency-key'),
    },
    request.user,
    {
      ip: request.ip,
      userAgent: request.get('user-agent'),
      correlationId: correlationId(request),
    },
  );

  response.status(202).json({ data: result.evidence });
}

export async function downloadEvidenceController(request, response) {
  const result = await downloadEvidence(request.params.id, request.user, {
    purpose: request.query.purpose,
    ip: request.ip,
    userAgent: request.get('user-agent'),
  });

  const extension = EXTENSIONS[result.evidence.mimeType] ?? 'bin';
  const filename = `evidencia-${result.evidence.id}.${extension}`;

  response.set({
    'Cache-Control': 'private, no-store',
    'Content-Type': result.evidence.mimeType,
    'Content-Length': String(result.buffer.length),
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Content-Type-Options': 'nosniff',
  });
  response.send(result.buffer);
}

export async function listEvidenceController(request, response) {
  const result = await listEvidence(
    {
      ownerType: request.query.ownerType,
      ownerId: request.query.ownerId,
      findingId: request.query.findingId,
    },
    request.user,
    request.query,
  );
  response.json(result);
}

export async function listEvidenceAccessLogController(request, response) {
  const result = await listEvidenceAccessLog(
    request.params.id,
    request.user,
    request.query,
  );
  response.json(result);
}
