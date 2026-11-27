import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import DomainEvent from '../databases/models/DomainEvent.js';
import HeritageAsset from '../databases/models/HeritageAsset.js';
import Inspection from '../databases/models/Inspection.js';
import Intervention from '../databases/models/Intervention.js';
import Location from '../databases/models/Location.js';
import Report from '../databases/models/Report.js';
import User from '../databases/models/User.js';
import { hasCapability } from './authorizationService.js';
import { notifyReportStateSafely } from './telegram/notifications.js';
import { HttpError } from '../helpers/HttpError.js';

function fail(status, code, message, details) {
  throw new HttpError(status, code, message, details);
}

function idOf(value) {
  return value == null ? null : value.toString();
}

function requireVersion(version) {
  if (!Number.isInteger(version) || version < 0) {
    fail(428, 'VERSION_REQUIRED', 'Debes enviar la versión actual en If-Match');
  }
}

function parseVersion(header) {
  if (typeof header !== 'string') {
    return null;
  }

  const match = header.trim().match(/^"?(\d+)"?$/);
  return match ? Number(match[1]) : null;
}

function transactionUnavailable(error) {
  return (
    error?.code === 20 ||
    /Transaction numbers are only allowed|replica set|mongos/i.test(
      error?.message ?? '',
    )
  );
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
    if (transactionUnavailable(error)) {
      fail(
        503,
        'TRANSACTIONS_REQUIRED',
        'La conservación requiere MongoDB configurado como replica set',
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
  fromState,
  toState,
  reason,
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
        fromState,
        toState,
        reason,
        payload,
        correlationId,
      },
    ],
    { session },
  );
}

function publicReport(report) {
  const result = report.toJSON();
  delete result.triage?.notes;
  // La clave de idempotencia es interna del canal y no debe salir por la API.
  delete result.sourceActionKey;
  return result;
}

function auditReport(report) {
  const result = report.toJSON();
  return {
    id: result.id,
    heritageAssetId: result.heritageAssetId,
    locationId: result.locationId,
    category: result.category,
    state: result.state,
    sourceChannel: result.sourceChannel,
    triage: result.triage
      ? {
          decision: result.triage.decision,
          triagedBy: result.triage.triagedBy,
          triagedAt: result.triage.triagedAt,
        }
      : undefined,
    inspectionId: result.inspectionId,
    version: result.version,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

function auditInspection(inspection) {
  const result = inspection.toJSON();
  return {
    id: result.id,
    assetId: result.assetId,
    reportId: result.reportId,
    inspectorId: result.inspectorId,
    reviewerId: result.reviewerId,
    type: result.type,
    state: result.state,
    scheduledAt: result.scheduledAt,
    startedAt: result.startedAt,
    submittedAt: result.submittedAt,
    reviewedAt: result.reviewedAt,
    closedAt: result.closedAt,
    version: result.version,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

function auditHistory(history) {
  return history.map(({ eventType, actorId, occurredAt, fromState, toState }) => ({
    eventType,
    actorId,
    occurredAt,
    fromState,
    toState,
  }));
}

export function expectedVersionFromHeader(header) {
  return parseVersion(header);
}

export async function listActiveHeritageAssets() {
  const assets = await HeritageAsset.find({
    status: 'active',
    deletedAt: null,
  })
    .select('-notes')
    .sort({ name: 1 })
    .limit(200);
  return assets.map((asset) => asset.toJSON());
}

export async function createHeritageAsset(input, actorId, correlationId) {
  return inTransaction(async (session) => {
    const asset = new HeritageAsset({
      ...input,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await asset.save({ session });
    await appendEvent(session, {
      aggregateType: 'HeritageAsset',
      aggregateId: asset._id,
      eventType: 'heritage_asset.created',
      actorId,
      toState: asset.status,
      correlationId,
    });

    return asset.toJSON();
  });
}

async function validateReportTarget(input, session) {
  const assetId = input.heritageAssetId;
  const locationId = input.locationId;

  if (!assetId && !locationId) {
    fail(400, 'VALIDATION_ERROR', 'Selecciona un activo patrimonial o un POI');
  }

  let asset = null;
  let location = null;

  if (assetId) {
    asset = await HeritageAsset.findOne({
      _id: assetId,
      status: 'active',
      deletedAt: null,
    }).session(session);

    if (!asset) {
      fail(404, 'NOT_FOUND', 'No se encontró el activo patrimonial');
    }
  }

  if (locationId) {
    location = await Location.findOne({
      _id: locationId,
      status: 'published',
      deletedAt: null,
    }).session(session);

    if (!location) {
      fail(404, 'NOT_FOUND', 'No se encontró el punto de interés');
    }
  }

  if (asset && location && idOf(asset.locationId) !== idOf(location._id)) {
    fail(
      400,
      'VALIDATION_ERROR',
      'El activo patrimonial no corresponde al punto de interés seleccionado',
    );
  }

  return { asset, location };
}

export async function createReport(input, actorId, correlationId) {
  try {
    return await inTransaction(async (session) => {
      await validateReportTarget(input, session);

      const report = new Report({
        reporterId: actorId,
        heritageAssetId: input.heritageAssetId ?? null,
        locationId: input.locationId ?? null,
        category: input.category,
        description: input.description,
        capturedAt: input.capturedAt ?? new Date(),
        gps: input.gps ?? undefined,
        accuracyMeters: input.accuracyMeters,
        sourceChannel: input.sourceChannel ?? 'web',
        ...(input.sourceActionKey
          ? { sourceActionKey: input.sourceActionKey }
          : {}),
      });

      await report.save({ session });
      await appendEvent(session, {
        aggregateType: 'Report',
        aggregateId: report._id,
        eventType: 'report.created',
        actorId,
        toState: report.state,
        correlationId,
        payload: {
          category: report.category,
          sourceChannel: report.sourceChannel,
        },
      });

      return publicReport(report);
    });
  } catch (error) {
    // Un reintento del mismo canal no puede duplicar el reporte.
    if (error?.code === 11000 && input.sourceActionKey) {
      const existing = await Report.findOne({
        sourceActionKey: input.sourceActionKey,
      });
      if (existing) {
        return publicReport(existing);
      }
    }

    throw error;
  }
}

export async function listOwnReports(actorId, { page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Math.min(Number(page) || 1, 100000));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const filter = { reporterId: actorId };
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Report.countDocuments(filter),
  ]);

  return {
    data: reports.map(publicReport),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    },
  };
}

export async function listReportsForTriage(
  { state, page = 1, limit = 20 } = {},
) {
  const safePage = Math.max(1, Math.min(Number(page) || 1, 100000));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const allowedStates = ['received', 'triaged', 'accepted'];
  const filter = {
    state: allowedStates.includes(state) ? state : { $in: allowedStates },
  };
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Report.countDocuments(filter),
  ]);

  return {
    data: reports.map(publicReport),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    },
  };
}

export async function listActiveInspectors() {
  const inspectors = await User.find({ role: 'inspector', isActive: true })
    .select('name')
    .sort({ name: 1 })
    .limit(100);
  return inspectors.map((inspector) => ({
    id: idOf(inspector._id),
    name: inspector.name,
  }));
}

export async function getReport(reportId, actor) {
  const report = await Report.findById(reportId);
  const isOwner = report && idOf(report.reporterId) === idOf(actor._id);
  const canReadAll = hasCapability(actor, 'report.read.all');
  const canAudit = hasCapability(actor, 'audit.read');

  if (!report || (!isOwner && !canReadAll && !canAudit)) {
    fail(404, 'NOT_FOUND', 'No se encontró el reporte');
  }

  const events = await DomainEvent.find({
    aggregateType: 'Report',
    aggregateId: report._id,
  })
    .sort({ occurredAt: 1 })
    .select('eventType actorId occurredAt fromState toState reason');

  const history = events.map((event) => event.toJSON());
  if (!isOwner && !canReadAll) {
    return { ...auditReport(report), history: auditHistory(history) };
  }

  return { ...publicReport(report), history };
}

export async function triageReport(
  reportId,
  input,
  actor,
  expectedVersion,
  correlationId,
) {
  requireVersion(expectedVersion);

  let notification = null;
  const result = await inTransaction(async (session) => {
    const report = await Report.findById(reportId).session(session);

    if (!report) {
      fail(404, 'NOT_FOUND', 'No se encontró el reporte');
    }

    if (idOf(actor._id) === idOf(report.reporterId)) {
      fail(403, 'FORBIDDEN', 'No puedes tramitar tu propio reporte');
    }

    if (report.version !== expectedVersion) {
      fail(409, 'VERSION_CONFLICT', 'El reporte cambió; vuelve a cargarlo');
    }

    const now = new Date();
    if (report.state === 'received') {
      const previous = report.state;
      report.state = 'triaged';
      report.triage.triagedBy = actor._id;
      report.triage.triagedAt = now;
      report.triage.notes = input.notes;
      report.version += 1;
      await report.save({ session });
      await appendEvent(session, {
        aggregateType: 'Report',
        aggregateId: report._id,
        eventType: 'report.triaged',
        actorId: actor._id,
        fromState: previous,
        toState: report.state,
        correlationId,
      });
    } else if (report.state !== 'triaged') {
      fail(409, 'INVALID_TRANSITION', 'El reporte no admite más triaje');
    }

    if (!input.decision) {
      return publicReport(report);
    }

    if (!['accept', 'reject', 'close'].includes(input.decision)) {
      fail(400, 'VALIDATION_ERROR', 'La decisión de triaje no es válida');
    }

    if (input.decision !== 'accept' && !input.reason?.trim()) {
      fail(400, 'VALIDATION_ERROR', 'Debes indicar el motivo de la decisión');
    }

    const stateByDecision = {
      accept: 'accepted',
      reject: 'rejected',
      close: 'closed',
    };
    const fromState = report.state;
    report.state = stateByDecision[input.decision];
    report.triage.decision = input.decision;
    report.rejectionReason =
      input.decision === 'accept' ? undefined : input.reason.trim();
    report.version += 1;
    await report.save({ session });
    await appendEvent(session, {
      aggregateType: 'Report',
      aggregateId: report._id,
      eventType: `report.${report.state}`,
      actorId: actor._id,
      fromState,
      toState: report.state,
      reason: input.reason,
      correlationId,
    });

    notification = publicReport(report);
    return notification;
  });

  if (notification) {
    notifyReportStateSafely(notification);
  }

  return result;
}

export async function convertReport(
  reportId,
  input,
  actor,
  expectedVersion,
  correlationId,
) {
  requireVersion(expectedVersion);

  let notification = null;
  const result = await inTransaction(async (session) => {
    const report = await Report.findById(reportId).session(session);

    if (!report) {
      fail(404, 'NOT_FOUND', 'No se encontró el reporte');
    }

    if (report.version !== expectedVersion) {
      fail(409, 'VERSION_CONFLICT', 'El reporte cambió; vuelve a cargarlo');
    }

    if (report.state !== 'accepted') {
      fail(409, 'REPORT_NOT_ACCEPTED', 'Solo se convierte un reporte aceptado');
    }

    if (!report.heritageAssetId && !input.assetId) {
      fail(
        409,
        'HERITAGE_ASSET_REQUIRED',
        'El reporte debe vincularse a un activo antes de crear una inspección',
      );
    }

    if (input.assetId && !mongoose.isValidObjectId(input.assetId)) {
      fail(400, 'VALIDATION_ERROR', 'El activo indicado no es válido');
    }

    if (
      report.heritageAssetId &&
      input.assetId &&
      idOf(report.heritageAssetId) !== idOf(input.assetId)
    ) {
      fail(
        400,
        'VALIDATION_ERROR',
        'El reporte ya está vinculado a otro activo patrimonial',
      );
    }

    const assetId = report.heritageAssetId ?? input.assetId;
    const asset = await HeritageAsset.findOne({
      _id: assetId,
      status: 'active',
      deletedAt: null,
    }).session(session);

    if (!asset) {
      fail(409, 'INVALID_TRANSITION', 'El activo no está disponible para inspección');
    }

    if (
      report.locationId &&
      idOf(asset.locationId ?? null) !== idOf(report.locationId)
    ) {
      fail(
        400,
        'VALIDATION_ERROR',
        'El activo patrimonial no corresponde al punto de interés del reporte',
      );
    }

    if (!report.heritageAssetId) {
      report.heritageAssetId = asset._id;
    }

    const inspection = new Inspection({
      assetId: asset._id,
      reportId: report._id,
      inspectorId: input.inspectorId ?? actor._id,
      reviewerId: input.reviewerId,
      type: input.type ?? 'follow_up',
      state: 'planned',
      scope: input.scope,
      scheduledAt: input.scheduledAt,
      createdBy: actor._id,
      history: [],
    });

    if (!input.reviewerId) {
      fail(400, 'VALIDATION_ERROR', 'Debes asignar un revisor activo');
    }

    const assignedInspector = await User.findOne({
      _id: inspection.inspectorId,
      role: 'inspector',
      isActive: true,
    }).session(session);
    if (!assignedInspector) {
      fail(400, 'VALIDATION_ERROR', 'La inspección debe asignarse a un inspector activo');
    }

    const assignedReviewer = await User.findOne({
      _id: inspection.reviewerId,
      role: 'inspector',
      isActive: true,
    }).session(session);
    if (
      !assignedReviewer ||
      idOf(inspection.reviewerId) === idOf(inspection.inspectorId)
    ) {
      fail(
        400,
        'VALIDATION_ERROR',
        'La revisión debe asignarse a otro inspector activo',
      );
    }

    await inspection.save({ session });
    const previousState = report.state;
    report.state = 'converted';
    report.inspectionId = inspection._id;
    report.version += 1;
    await report.save({ session });

    await appendEvent(session, {
      aggregateType: 'Report',
      aggregateId: report._id,
      eventType: 'report.converted',
      actorId: actor._id,
      fromState: previousState,
      toState: report.state,
      correlationId,
      payload: { inspectionId: idOf(inspection._id) },
    });
    await appendEvent(session, {
      aggregateType: 'Inspection',
      aggregateId: inspection._id,
      eventType: 'inspection.created',
      actorId: actor._id,
      toState: inspection.state,
      correlationId,
      payload: { reportId: idOf(report._id) },
    });

    notification = publicReport(report);
    return {
      report: notification,
      inspection: inspection.toJSON(),
    };
  });

  if (notification) {
    notifyReportStateSafely(notification);
  }

  return result;
}

export async function createInspection(input, actor, correlationId) {
  return inTransaction(async (session) => {
    const asset = await HeritageAsset.findOne({
      _id: input.assetId,
      status: 'active',
      deletedAt: null,
    }).session(session);

    if (!asset) {
      fail(404, 'NOT_FOUND', 'No se encontró el activo patrimonial');
    }

    const inspectorId = input.inspectorId ?? actor._id;
    const reviewerId = input.reviewerId;
    if (!reviewerId) {
      fail(400, 'VALIDATION_ERROR', 'Debes asignar un revisor activo');
    }

    const inspector = await User.findOne({
      _id: inspectorId,
      role: 'inspector',
      isActive: true,
    }).session(session);

    if (!inspector) {
      fail(400, 'VALIDATION_ERROR', 'La inspección debe asignarse a un inspector activo');
    }

    const reviewer = await User.findOne({
      _id: reviewerId,
      role: 'inspector',
      isActive: true,
    }).session(session);
    if (!reviewer || idOf(reviewerId) === idOf(inspectorId)) {
      fail(
        400,
        'VALIDATION_ERROR',
        'La revisión debe asignarse a otro inspector activo',
      );
    }

    const inspection = new Inspection({
      assetId: asset._id,
      inspectorId,
      reviewerId,
      type: input.type,
      scope: input.scope,
      scheduledAt: input.scheduledAt,
      createdBy: actor._id,
    });
    await inspection.save({ session });
    await appendEvent(session, {
      aggregateType: 'Inspection',
      aggregateId: inspection._id,
      eventType: 'inspection.created',
      actorId: actor._id,
      toState: inspection.state,
      correlationId,
    });
    return inspection.toJSON();
  });
}

export async function listInspections(actor, { state } = {}) {
  const canAudit = hasCapability(actor, 'inspection.read.audit');
  const canReadAssigned = hasCapability(actor, 'inspection.read.assigned');
  if (!canAudit && !canReadAssigned) {
    fail(403, 'FORBIDDEN', 'No tienes permisos para consultar inspecciones');
  }

  const filter = canAudit
    ? {}
    : {
        $or: [{ inspectorId: actor._id }, { reviewerId: actor._id }],
      };
  if (state && ['planned', 'in_progress', 'submitted', 'returned', 'reviewed', 'closed', 'cancelled'].includes(state)) {
    filter.state = state;
  }

  const inspections = await Inspection.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100);
  return inspections.map((inspection) =>
    canAudit ? auditInspection(inspection) : inspection.toJSON(),
  );
}

export async function getInspection(inspectionId, actor) {
  const inspection = await Inspection.findById(inspectionId);
  const isAssigned =
    inspection &&
    (idOf(inspection.inspectorId) === idOf(actor._id) ||
      idOf(inspection.reviewerId) === idOf(actor._id));
  const canReadAssigned =
    isAssigned && hasCapability(actor, 'inspection.read.assigned');
  const canAudit = hasCapability(actor, 'inspection.read.audit');

  if (!inspection || (!canReadAssigned && !canAudit)) {
    fail(404, 'NOT_FOUND', 'No se encontró la inspección');
  }

  const events = await DomainEvent.find({
    aggregateType: 'Inspection',
    aggregateId: inspection._id,
  })
    .sort({ occurredAt: 1 })
    .select('eventType actorId occurredAt fromState toState reason');
  const history = events.map((event) => event.toJSON());

  if (canAudit && !canReadAssigned) {
    return { ...auditInspection(inspection), history: auditHistory(history) };
  }

  const interventions = await Intervention.find({
    inspectionId: inspection._id,
  }).sort({ createdAt: 1 });
  return {
    ...inspection.toJSON(),
    history,
    interventions: interventions.map((item) => item.toJSON()),
  };
}

async function updateInspection(
  inspectionId,
  expectedVersion,
  actor,
  correlationId,
  action,
) {
  requireVersion(expectedVersion);

  return inTransaction(async (session) => {
    const inspection = await Inspection.findById(inspectionId).session(session);

    if (!inspection) {
      fail(404, 'NOT_FOUND', 'No se encontró la inspección');
    }

    if (inspection.version !== expectedVersion) {
      fail(409, 'VERSION_CONFLICT', 'La inspección cambió; vuelve a cargarla');
    }

    const fromState = inspection.state;
    const eventType = await action(inspection, session);
    inspection.version += 1;
    inspection.updatedBy = actor._id;
    await inspection.save({ session });
    await appendEvent(session, {
      aggregateType: 'Inspection',
      aggregateId: inspection._id,
      eventType,
      actorId: actor._id,
      fromState,
      toState: inspection.state,
      reason: inspection.reviewNotes ?? inspection.closureJustification,
      correlationId,
    });

    return inspection.toJSON();
  });
}

export async function startInspection(id, version, actor, correlationId) {
  return updateInspection(id, version, actor, correlationId, async (inspection) => {
    if (idOf(inspection.inspectorId) !== idOf(actor._id)) {
      fail(404, 'NOT_FOUND', 'No se encontró la inspección');
    }
    if (inspection.state !== 'planned') {
      fail(409, 'INVALID_TRANSITION', 'La inspección no está planificada');
    }
    inspection.state = 'in_progress';
    inspection.startedAt = new Date();
    return 'inspection.started';
  });
}

export async function resumeInspection(id, version, actor, correlationId) {
  return updateInspection(id, version, actor, correlationId, async (inspection) => {
    if (idOf(inspection.inspectorId) !== idOf(actor._id)) {
      fail(404, 'NOT_FOUND', 'No se encontró la inspección');
    }
    if (inspection.state !== 'returned') {
      fail(409, 'INVALID_TRANSITION', 'La inspección no está devuelta para corrección');
    }
    inspection.state = 'in_progress';
    return 'inspection.resumed';
  });
}

export async function addFinding(id, input, version, actor, correlationId) {
  return updateInspection(id, version, actor, correlationId, async (inspection) => {
    if (
      idOf(inspection.inspectorId) !== idOf(actor._id) ||
      inspection.state !== 'in_progress'
    ) {
      fail(409, 'INVALID_TRANSITION', 'No puedes añadir hallazgos ahora');
    }

    const finding = {
      findingId: randomUUID(),
      category: input.category,
      description: input.description,
      severityProposed: input.severityProposed,
      requiresIntervention: Boolean(input.requiresIntervention),
      proposedBy: actor._id,
    };
    inspection.findings.push(finding);
    inspection.noFindingsDeclared = false;
    return 'finding.proposed';
  });
}

export async function submitInspection(id, input, version, actor, correlationId) {
  return updateInspection(id, version, actor, correlationId, async (inspection) => {
    if (
      idOf(inspection.inspectorId) !== idOf(actor._id) ||
      inspection.state !== 'in_progress'
    ) {
      fail(409, 'INVALID_TRANSITION', 'La inspección no puede enviarse a revisión');
    }

    if (inspection.findings.length === 0 && input.noFindingsDeclared !== true) {
      fail(
        409,
        'INSPECTION_EMPTY',
        'Registra hallazgos o declara explícitamente que no se encontraron daños',
      );
    }

    inspection.noFindingsDeclared =
      inspection.findings.length === 0 && input.noFindingsDeclared === true;
    inspection.state = 'submitted';
    inspection.submittedAt = new Date();
    return 'inspection.submitted';
  });
}

export async function reviewInspection(
  id,
  input,
  version,
  actor,
  correlationId,
) {
  return updateInspection(id, version, actor, correlationId, async (inspection) => {
    if (inspection.state !== 'submitted') {
      fail(409, 'INVALID_TRANSITION', 'La inspección no está enviada a revisión');
    }
    if (idOf(inspection.inspectorId) === idOf(actor._id)) {
      fail(403, 'SELF_REVIEW_FORBIDDEN', 'No puedes revisar tu propia inspección');
    }
    if (idOf(inspection.reviewerId) !== idOf(actor._id)) {
      fail(
        403,
        'INSPECTION_REVIEWER_REQUIRED',
        'La inspección está asignada a otro revisor',
      );
    }

    if (input.decision === 'return') {
      if (!input.notes?.trim()) {
        fail(400, 'VALIDATION_ERROR', 'Debes indicar los cambios solicitados');
      }
      inspection.state = 'returned';
      inspection.returnedAt = new Date();
      inspection.reviewNotes = input.notes.trim();
      return 'inspection.returned';
    }

    if (input.decision !== 'approve' || !['good', 'fair', 'poor'].includes(input.result)) {
      fail(400, 'VALIDATION_ERROR', 'La decisión o resultado de revisión no es válido');
    }

    const severities = input.findings ?? {};
    for (const finding of inspection.findings) {
      if (finding.state !== 'proposed') {
        continue;
      }
      const severity = severities[finding.findingId];
      if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
        fail(
          400,
          'VALIDATION_ERROR',
          `Falta confirmar la severidad de ${finding.findingId}`,
        );
      }
      finding.severityConfirmed = severity;
      finding.confirmedBy = actor._id;
      finding.confirmedAt = new Date();
      finding.state = 'confirmed';
    }

    inspection.state = 'reviewed';
    inspection.reviewerId = actor._id;
    inspection.reviewedAt = new Date();
    inspection.result = input.result;
    inspection.reviewNotes = input.notes?.trim() ?? '';
    return 'inspection.reviewed';
  });
}

export async function closeInspection(
  id,
  input,
  version,
  actor,
  correlationId,
) {
  return inTransaction(async (session) => {
    const inspection = await Inspection.findById(id).session(session);
    if (!inspection) {
      fail(404, 'NOT_FOUND', 'No se encontró la inspección');
    }
    if (inspection.version !== version) {
      fail(409, 'VERSION_CONFLICT', 'La inspección cambió; vuelve a cargarla');
    }
    if (
      inspection.state !== 'reviewed' ||
      idOf(inspection.reviewerId) !== idOf(actor._id)
    ) {
      fail(409, 'INVALID_TRANSITION', 'Solo el revisor puede cerrar la inspección');
    }

    const requiredFindings = inspection.findings.filter(
      (finding) =>
        finding.requiresIntervention &&
        finding.state !== 'discarded' &&
        finding.state !== 'resolved',
    );
    if (requiredFindings.length > 0) {
      const verified = await Intervention.find({
        inspectionId: inspection._id,
        state: 'verified',
        findingIds: { $all: requiredFindings.map((item) => item.findingId) },
      })
        .session(session)
        .select('findingIds');
      const covered = new Set(verified.flatMap((item) => item.findingIds));
      if (requiredFindings.some((finding) => !covered.has(finding.findingId))) {
        fail(
          409,
          'CLOSURE_REQUIRES_VERIFIED_INTERVENTION',
          'Todos los hallazgos que requieren intervención deben tener una intervención verificada',
        );
      }
    }

    const unresolvedWithoutIntervention = inspection.findings.some(
      (finding) =>
        !finding.requiresIntervention &&
        finding.state !== 'discarded' &&
        finding.state !== 'resolved',
    );
    if (unresolvedWithoutIntervention && !input.justification?.trim()) {
      fail(
        400,
        'VALIDATION_ERROR',
        'Debes justificar el cierre de hallazgos sin intervención',
      );
    }

    const fromState = inspection.state;
    inspection.state = 'closed';
    inspection.closedAt = new Date();
    inspection.closureJustification = input.justification?.trim() ?? '';
    inspection.version += 1;
    inspection.updatedBy = actor._id;
    await inspection.save({ session });

    await appendEvent(session, {
      aggregateType: 'Inspection',
      aggregateId: inspection._id,
      eventType: 'inspection.closed',
      actorId: actor._id,
      fromState,
      toState: inspection.state,
      reason: inspection.closureJustification,
      correlationId,
    });

    const asset = await HeritageAsset.findById(inspection.assetId).session(session);
    if (asset?.locationId) {
      await Location.updateOne(
        { _id: asset.locationId },
        {
          $set: {
            conservationStatus: inspection.result,
            conservationVerifiedAt: inspection.closedAt,
            lastInspectionId: inspection._id,
          },
        },
        { session },
      );
    }

    return inspection.toJSON();
  });
}

export async function proposeIntervention(
  inspectionId,
  input,
  actor,
  correlationId,
) {
  return inTransaction(async (session) => {
    const inspection = await Inspection.findById(inspectionId).session(session);
    if (
      !inspection ||
      !['inspector', 'reviewer'].some(
        (key) => idOf(inspection[`${key}Id`]) === idOf(actor._id),
      )
    ) {
      fail(404, 'NOT_FOUND', 'No se encontró la inspección');
    }
    if (!['reviewed', 'closed'].includes(inspection.state)) {
      fail(409, 'INVALID_TRANSITION', 'La inspección debe estar revisada');
    }
    if (
      !Array.isArray(input.findingIds) ||
      input.findingIds.length === 0 ||
      input.findingIds.some(
        (findingId) =>
          !inspection.findings.some((finding) => finding.findingId === findingId),
      )
    ) {
      fail(400, 'VALIDATION_ERROR', 'La intervención debe referenciar hallazgos válidos');
    }

    const intervention = new Intervention({
      inspectionId,
      findingIds: input.findingIds,
      type: input.type,
      description: input.description,
      proposedBy: actor._id,
    });
    await intervention.save({ session });
    await appendEvent(session, {
      aggregateType: 'Intervention',
      aggregateId: intervention._id,
      eventType: 'intervention.proposed',
      actorId: actor._id,
      toState: intervention.state,
      correlationId,
    });
    return intervention.toJSON();
  });
}

export async function transitionIntervention(
  id,
  input,
  version,
  actor,
  correlationId,
) {
  requireVersion(version);
  return inTransaction(async (session) => {
    const intervention = await Intervention.findById(id).session(session);
    if (!intervention) {
      fail(404, 'NOT_FOUND', 'No se encontró la intervención');
    }
    if (intervention.version !== version) {
      fail(409, 'VERSION_CONFLICT', 'La intervención cambió; vuelve a cargarla');
    }

    const inspection = await Inspection.findById(intervention.inspectionId)
      .session(session)
      .select('inspectorId reviewerId');
    const isAssigned =
      inspection &&
      [idOf(inspection.inspectorId), idOf(inspection.reviewerId)].includes(
        idOf(actor._id),
      );
    if (!isAssigned) {
      fail(404, 'NOT_FOUND', 'No se encontró la intervención');
    }

    const fromState = intervention.state;
    let eventType;
    if (input.action === 'approve' && fromState === 'proposed') {
      if (idOf(intervention.proposedBy) === idOf(actor._id)) {
        fail(403, 'SELF_APPROVAL_FORBIDDEN', 'Otra persona debe aprobar la intervención');
      }
      intervention.state = 'approved';
      intervention.approvedBy = actor._id;
      intervention.approvedAt = new Date();
      eventType = 'intervention.approved';
    } else if (input.action === 'reject' && ['proposed', 'approved'].includes(fromState)) {
      if (!input.reason?.trim()) {
        fail(400, 'VALIDATION_ERROR', 'Debes indicar el motivo del rechazo');
      }
      intervention.state = 'rejected';
      intervention.rejectionReason = input.reason.trim();
      eventType = 'intervention.rejected';
    } else if (input.action === 'start' && fromState === 'approved') {
      if (idOf(inspection.inspectorId) !== idOf(actor._id)) {
        fail(403, 'INSPECTOR_ASSIGNMENT_REQUIRED', 'Solo el inspector asignado puede ejecutar');
      }
      intervention.state = 'in_progress';
      intervention.executorId = actor._id;
      intervention.startedAt = new Date();
      eventType = 'intervention.started';
    } else if (input.action === 'complete' && fromState === 'in_progress') {
      if (idOf(intervention.executorId) !== idOf(actor._id)) {
        fail(403, 'INTERVENTION_EXECUTOR_REQUIRED', 'Solo el ejecutor puede completar');
      }
      if (intervention.evidenceIds.length === 0) {
        fail(409, 'EVIDENCE_REQUIRED', 'Se requiere evidencia antes de completar');
      }
      intervention.state = 'completed';
      intervention.completedAt = new Date();
      eventType = 'intervention.completed';
    } else if (input.action === 'verify' && fromState === 'completed') {
      if (idOf(intervention.executorId) === idOf(actor._id)) {
        fail(403, 'SELF_VERIFY_FORBIDDEN', 'El ejecutor no puede verificar su intervención');
      }
      if (intervention.evidenceIds.length === 0) {
        fail(409, 'EVIDENCE_REQUIRED', 'Se requiere evidencia para verificar');
      }
      intervention.state = 'verified';
      intervention.verifierId = actor._id;
      intervention.verifiedAt = new Date();
      eventType = 'intervention.verified';
    } else {
      fail(409, 'INVALID_TRANSITION', 'La transición de intervención no es válida');
    }

    intervention.version += 1;
    await intervention.save({ session });
    await appendEvent(session, {
      aggregateType: 'Intervention',
      aggregateId: intervention._id,
      eventType,
      actorId: actor._id,
      fromState,
      toState: intervention.state,
      reason: input.reason,
      correlationId,
    });

    return intervention.toJSON();
  });
}
