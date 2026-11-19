import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../helpers/env.js';
import DomainEvent from '../databases/models/DomainEvent.js';
import Evidence from '../databases/models/Evidence.js';
import EvidenceAccessLog from '../databases/models/EvidenceAccessLog.js';
import Inspection from '../databases/models/Inspection.js';
import Intervention from '../databases/models/Intervention.js';
import Report from '../databases/models/Report.js';
import { storageAdapter } from './storage/index.js';
import { hasCapability } from './authorizationService.js';
import { HttpError } from '../helpers/HttpError.js';
import { processEvidenceContent } from './evidence/evidenceContent.js';

const OWNER_TYPES = new Set(['Report', 'Inspection', 'Intervention']);
const PURPOSE_MAX = 300;

function fail(status, code, message, details) {
  throw new HttpError(status, code, message, details);
}

function idOf(value) {
  return value == null ? null : value.toString();
}

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizePurpose(value) {
  if (typeof value !== 'string' || value.trim().length < 3) {
    fail(400, 'VALIDATION_ERROR', 'Debes indicar el motivo de la evidencia');
  }

  const purpose = value.trim();

  if (purpose.length > PURPOSE_MAX) {
    fail(400, 'VALIDATION_ERROR', 'El motivo de la evidencia es demasiado largo');
  }

  return purpose;
}

function parseDate(value, field) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail(400, 'VALIDATION_ERROR', `${field} no es una fecha válida`);
  }

  if (date.getTime() > Date.now() + 5 * 60_000) {
    fail(400, 'VALIDATION_ERROR', `${field} no puede ser futura`);
  }

  return date;
}

function parseNumber(value, field, { min, max } = {}) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    fail(400, 'VALIDATION_ERROR', `${field} debe ser numérico`);
  }

  if (min !== undefined && number < min) {
    fail(400, 'VALIDATION_ERROR', `${field} está fuera del rango permitido`);
  }

  if (max !== undefined && number > max) {
    fail(400, 'VALIDATION_ERROR', `${field} está fuera del rango permitido`);
  }

  return number;
}

async function inTransaction(work) {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (
      error?.code === 20 ||
      /Transaction numbers are only allowed|replica set|mongos/i.test(
        error?.message ?? '',
      )
    ) {
      fail(
        503,
        'TRANSACTIONS_REQUIRED',
        'La evidencia requiere MongoDB configurado como replica set',
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

async function appendEvent(session, {
  aggregateType,
  aggregateId,
  eventType,
  actorId,
  payload = {},
  correlationId,
}) {
  await DomainEvent.create(
    [
      {
        eventId: randomUUID(),
        aggregateType,
        aggregateId,
        eventType,
        actorId,
        payload,
        correlationId,
      },
    ],
    session ? { session } : undefined,
  );
}

function auditOnly(actor) {
  return (
    hasCapability(actor, 'evidence.read.audit') &&
    !hasCapability(actor, 'evidence.read.assigned') &&
    !hasCapability(actor, 'report.read.all')
  );
}

async function loadOwner(ownerType, ownerId, actor, { forUpload, findingId, session }) {
  const scoped = (query) => (session ? query.session(session) : query);

  if (ownerType === 'Report') {
    const report = await scoped(Report.findById(ownerId));
    const isOwner = report && idOf(report.reporterId) === idOf(actor._id);
    const canRead = isOwner || hasCapability(actor, 'report.read.all');

    if (!report || (!isOwner && !canRead)) {
      fail(404, 'NOT_FOUND', 'No se encontró el reporte');
    }

    if (forUpload && !isOwner) {
      fail(404, 'NOT_FOUND', 'No se encontró el reporte');
    }

    if (
      forUpload &&
      ['rejected', 'closed'].includes(report.state)
    ) {
      fail(409, 'INVALID_TRANSITION', 'El reporte ya no admite evidencia');
    }

    return { owner: report, canRead };
  }

  if (ownerType === 'Inspection') {
    const inspection = await scoped(Inspection.findById(ownerId));
    const isInspector = idOf(inspection?.inspectorId) === idOf(actor._id);
    const isReviewer = idOf(inspection?.reviewerId) === idOf(actor._id);
    const assigned = Boolean(inspection && (isInspector || isReviewer));
    const canRead =
      assigned && hasCapability(actor, 'evidence.read.assigned');

    if (!inspection || !assigned) {
      fail(404, 'NOT_FOUND', 'No se encontró la inspección');
    }

    if (forUpload) {
      if (!hasCapability(actor, 'evidence.upload')) {
        fail(403, 'FORBIDDEN', 'No tienes permisos para subir evidencia');
      }

      if (['closed', 'cancelled'].includes(inspection.state)) {
        fail(409, 'INVALID_TRANSITION', 'La inspección ya no admite evidencia');
      }

      if (isInspector && !['planned', 'in_progress', 'returned'].includes(inspection.state)) {
        fail(
          409,
          'INVALID_TRANSITION',
          'El inspector no puede añadir evidencia en este estado',
        );
      }

      if (
        findingId &&
        !inspection.findings.some((finding) => finding.findingId === findingId)
      ) {
        fail(400, 'VALIDATION_ERROR', 'El hallazgo indicado no existe');
      }
    }

    return { owner: inspection, canRead, findingId };
  }

  const intervention = await scoped(Intervention.findById(ownerId));

  if (!intervention) {
    fail(404, 'NOT_FOUND', 'No se encontró la intervención');
  }

  const inspection = await scoped(
    Inspection.findById(intervention.inspectionId),
  );
  const assigned =
    inspection &&
    [
      idOf(inspection.inspectorId),
      idOf(inspection.reviewerId),
      idOf(intervention.executorId),
      idOf(intervention.verifierId),
    ].includes(idOf(actor._id));
  const canRead =
    Boolean(assigned) && hasCapability(actor, 'evidence.read.assigned');

  if (!inspection || !assigned) {
    fail(404, 'NOT_FOUND', 'No se encontró la intervención');
  }

  if (forUpload) {
    if (!hasCapability(actor, 'evidence.upload')) {
      fail(403, 'FORBIDDEN', 'No tienes permisos para subir evidencia');
    }

    if (['verified', 'rejected'].includes(intervention.state)) {
      fail(409, 'INVALID_TRANSITION', 'La intervención ya no admite evidencia');
    }
  }

  return { owner: intervention, canRead, inspection };
}

async function attachEvidence(ownerType, ownerId, evidenceId, findingId, session) {
  if (ownerType === 'Report') {
    await Report.updateOne(
      { _id: ownerId },
      { $push: { evidenceIds: evidenceId }, $inc: { version: 1 } },
      { session },
    );
    return;
  }

  if (ownerType === 'Inspection') {
    if (findingId) {
      await Inspection.updateOne(
        { _id: ownerId },
        {
          $push: {
            evidenceIds: evidenceId,
            'findings.$[finding].evidenceIds': evidenceId,
          },
          $inc: { version: 1 },
        },
        {
          session,
          arrayFilters: [{ 'finding.findingId': findingId }],
        },
      );
      return;
    }

    await Inspection.updateOne(
      { _id: ownerId },
      { $push: { evidenceIds: evidenceId }, $inc: { version: 1 } },
      { session },
    );
    return;
  }

  await Intervention.updateOne(
    { _id: ownerId },
    { $push: { evidenceIds: evidenceId }, $inc: { version: 1 } },
    { session },
  );
}

function idempotencyHash(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length < 8 || value.length > 128) {
    fail(
      400,
      'VALIDATION_ERROR',
      'La clave de idempotencia debe tener entre 8 y 128 caracteres',
    );
  }

  return sha256(value.trim());
}

export async function uploadEvidence(
  input,
  actor,
  { ip, userAgent, correlationId } = {},
) {
  if (!input.file?.buffer?.length) {
    fail(400, 'VALIDATION_ERROR', 'Debes adjuntar un archivo de evidencia');
  }

  if (!OWNER_TYPES.has(input.ownerType)) {
    fail(400, 'VALIDATION_ERROR', 'El tipo de propietario no es válido');
  }

  if (!isObjectId(input.ownerId)) {
    fail(400, 'VALIDATION_ERROR', 'El propietario de la evidencia no es válido');
  }

  if (input.findingId && !/^[a-f0-9-]{36}$/i.test(input.findingId)) {
    fail(400, 'VALIDATION_ERROR', 'El hallazgo indicado no es válido');
  }

  if (config.evidence.scanRequired && !config.evidence.allowUnscanned) {
    fail(
      503,
      'EVIDENCE_SCAN_UNAVAILABLE',
      'La subida de evidencia está desactivada hasta habilitar el análisis antimalware',
    );
  }

  if (input.file.size > config.evidence.maxBytes) {
    fail(
      413,
      'EVIDENCE_TOO_LARGE',
      'La evidencia supera el tamaño máximo permitido',
    );
  }

  const purpose = normalizePurpose(input.purpose);
  const processed = await processEvidenceContent(
    input.file.buffer,
    input.file.mimetype,
  );
  const checksum = sha256(processed.buffer);
  const keyHash = idempotencyHash(input.idempotencyKey);

  if (keyHash) {
    const existing = await Evidence.findOne({
      uploadedBy: actor._id,
      idempotencyKey: keyHash,
    });

    if (existing) {
      if (
        existing.sha256 !== checksum ||
        existing.ownerType !== input.ownerType ||
        idOf(existing.ownerId) !== idOf(input.ownerId)
      ) {
        fail(
          409,
          'IDEMPOTENCY_CONFLICT',
          'La clave de idempotencia ya se usó con otra evidencia',
        );
      }

      return { evidence: existing.toJSON(), created: false };
    }
  }

  const capturedAt =
    parseDate(input.capturedAt, 'capturedAt') ?? processed.hints?.capturedAt ?? null;
  const latitude = parseNumber(input.latitude, 'latitude', {
    min: -90,
    max: 90,
  });
  const longitude = parseNumber(input.longitude, 'longitude', {
    min: -180,
    max: 180,
  });

  if ((latitude === undefined) !== (longitude === undefined)) {
    fail(
      400,
      'VALIDATION_ERROR',
      'Debes enviar latitud y longitud juntas',
    );
  }

  const gps =
    latitude !== undefined && longitude !== undefined
      ? { latitude, longitude }
      : processed.hints?.gps ?? null;
  const accuracyMeters = parseNumber(input.accuracyMeters, 'accuracyMeters', {
    min: 0,
    max: 10000,
  });
  const stored = await storageAdapter.saveEvidence({
    buffer: processed.buffer,
    mimeType: processed.mimeType,
  });

  try {
    const evidence = await inTransaction(async (session) => {
      await loadOwner(input.ownerType, input.ownerId, actor, {
        forUpload: true,
        findingId: input.findingId,
        session,
      });

      const document = new Evidence({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        findingId: input.findingId ?? null,
        storageKey: stored.storageKey,
        mimeType: processed.mimeType,
        bytes: processed.bytes,
        width: processed.width,
        height: processed.height,
        sha256: checksum,
        capturedAt,
        gps: gps
          ? {
              type: 'Point',
              coordinates: [gps.longitude, gps.latitude],
            }
          : undefined,
        accuracyMeters: accuracyMeters ?? null,
        uploadedBy: actor._id,
        purpose,
        scanStatus: 'available',
        exifStripped: processed.exifStripped,
        retentionUntil: new Date(
          Date.now() + config.evidence.retentionDays * 86_400_000,
        ),
        idempotencyKey: keyHash,
      });

      await document.save({ session });
      await attachEvidence(
        input.ownerType,
        input.ownerId,
        document._id,
        input.findingId,
        session,
      );
      await appendEvent(session, {
        aggregateType: input.ownerType,
        aggregateId: input.ownerId,
        eventType: 'evidence.uploaded',
        actorId: actor._id,
        correlationId,
        payload: {
          evidenceId: idOf(document._id),
          findingId: input.findingId ?? null,
          mimeType: document.mimeType,
          sha256: document.sha256,
        },
      });

      return document;
    });

    return { evidence: evidence.toJSON(), created: true };
  } catch (error) {
    await storageAdapter.removeEvidence(stored.storageKey).catch(() => {});
    throw error;
  }
}

export async function downloadEvidence(
  id,
  actor,
  { purpose, ip, userAgent } = {},
) {
  if (!isObjectId(id)) {
    fail(404, 'NOT_FOUND', 'No se encontró la evidencia');
  }

  const evidence = await Evidence.findById(id);

  if (!evidence) {
    fail(404, 'NOT_FOUND', 'No se encontró la evidencia');
  }

  if (auditOnly(actor)) {
    fail(
      403,
      'EVIDENCE_AUDIT_ONLY',
      'El rol de auditoría solo puede consultar metadatos y accesos',
    );
  }

  const access = await loadOwner(
    evidence.ownerType,
    evidence.ownerId,
    actor,
    { forUpload: false },
  );

  if (!access.canRead) {
    fail(404, 'NOT_FOUND', 'No se encontró la evidencia');
  }

  if (evidence.scanStatus === 'quarantined') {
    fail(409, 'EVIDENCE_QUARANTINED', 'La evidencia está en cuarentena');
  }

  if (evidence.scanStatus !== 'available') {
    fail(
      409,
      'EVIDENCE_NOT_AVAILABLE',
      'La evidencia aún no está disponible para consulta',
    );
  }

  const normalizedPurpose = normalizePurpose(purpose);
  let buffer;

  try {
    buffer = await storageAdapter.readEvidence(evidence.storageKey);
  } catch {
    fail(
      409,
      'EVIDENCE_INTEGRITY_FAILED',
      'No se pudo leer la evidencia almacenada',
    );
  }

  const checksum = sha256(buffer);

  if (checksum !== evidence.sha256) {
    await Evidence.updateOne(
      { _id: evidence._id },
      { $set: { scanStatus: 'quarantined' } },
    );
    await appendEvent(
      { session: null },
      {
        aggregateType: evidence.ownerType,
        aggregateId: evidence.ownerId,
        eventType: 'evidence.integrity_failed',
        actorId: actor._id,
        payload: { evidenceId: idOf(evidence._id) },
      },
    ).catch(() => {});
    fail(
      409,
      'EVIDENCE_INTEGRITY_FAILED',
      'La evidencia no superó la verificación de integridad',
    );
  }

  try {
    await EvidenceAccessLog.create({
      evidenceId: evidence._id,
      actorId: actor._id,
      action: 'download',
      ip: ip ?? null,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      purpose: normalizedPurpose,
    });
  } catch {
    fail(
      503,
      'AUDIT_REQUIRED',
      'No se pudo registrar el acceso a la evidencia',
    );
  }

  return {
    evidence: evidence.toJSON(),
    buffer,
  };
}

export async function listEvidence(
  { ownerType, ownerId, findingId } = {},
  actor,
  { page = 1, limit = 20 } = {},
) {
  if (!OWNER_TYPES.has(ownerType)) {
    fail(400, 'VALIDATION_ERROR', 'El tipo de propietario no es válido');
  }

  if (!isObjectId(ownerId)) {
    fail(400, 'VALIDATION_ERROR', 'El propietario de la evidencia no es válido');
  }

  const access = await loadOwner(ownerType, ownerId, actor, {
    forUpload: false,
  });

  if (!access.canRead) {
    fail(404, 'NOT_FOUND', 'No se encontró la evidencia');
  }

  const safePage = Math.max(1, Math.min(Number(page) || 1, 100000));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const filter = { ownerType, ownerId };

  if (findingId) {
    filter.findingId = findingId;
  }

  const [items, total] = await Promise.all([
    Evidence.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Evidence.countDocuments(filter),
  ]);

  return {
    data: items.map((item) => item.toJSON()),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    },
  };
}

export async function listEvidenceAccessLog(
  evidenceId,
  actor,
  { page = 1, limit = 20 } = {},
) {
  if (!hasCapability(actor, 'audit.read')) {
    fail(403, 'FORBIDDEN', 'No tienes permisos para consultar accesos');
  }

  if (!isObjectId(evidenceId)) {
    fail(404, 'NOT_FOUND', 'No se encontró la evidencia');
  }

  const evidence = await Evidence.findById(evidenceId);

  if (!evidence) {
    fail(404, 'NOT_FOUND', 'No se encontró la evidencia');
  }

  const safePage = Math.max(1, Math.min(Number(page) || 1, 100000));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const filter = { evidenceId: evidence._id };
  const [logs, total] = await Promise.all([
    EvidenceAccessLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('actorId', 'name email'),
    EvidenceAccessLog.countDocuments(filter),
  ]);

  return {
    data: logs.map((log) => {
      const result = log.toJSON();
      const actorDocument = log.actorId;

      result.actor = actorDocument
        ? {
            id: idOf(actorDocument._id),
            name: actorDocument.name,
            email: actorDocument.email,
          }
        : null;
      delete result.actorId;

      return result;
    }),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    },
  };
}
