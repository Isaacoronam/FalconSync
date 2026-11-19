import { randomUUID } from 'node:crypto';
import {
  addFinding,
  closeInspection,
  convertReport,
  createHeritageAsset,
  createInspection,
  createReport,
  expectedVersionFromHeader,
  getInspection,
  getReport,
  listActiveHeritageAssets,
  listActiveInspectors,
  listInspections,
  listOwnReports,
  listReportsForTriage,
  proposeIntervention,
  resumeInspection,
  reviewInspection,
  startInspection,
  submitInspection,
  transitionIntervention,
  triageReport,
} from '../../microservices/conservationService.js';
import { HttpError } from '../../helpers/HttpError.js';

function correlationId(request) {
  const supplied = request.get('x-correlation-id');
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function requireVersion(request) {
  const version = expectedVersionFromHeader(request.get('if-match'));

  if (version === null) {
    throw new HttpError(
      428,
      'VERSION_REQUIRED',
      'Debes enviar la versión actual en la cabecera If-Match',
    );
  }

  return version;
}

function setVersion(response, resource) {
  response.set('ETag', `"${resource.version}"`);
}

function pick(value, fields) {
  const result = {};
  for (const field of fields) {
    if (value?.[field] !== undefined) {
      result[field] = value[field];
    }
  }
  return result;
}

export async function listPublicHeritageAssets(_request, response) {
  response.json({ data: await listActiveHeritageAssets() });
}

export async function createHeritageAssetController(request, response) {
  const input = pick(request.body, [
    'code',
    'name',
    'type',
    'locationId',
    'unescoStatus',
    'protectionLevel',
    'address',
    'geometry',
    'description',
    'sourceRefs',
    'notes',
    'status',
  ]);
  const asset = await createHeritageAsset(
    input,
    request.user._id,
    correlationId(request),
  );
  response.status(201).json({ data: asset });
}

export async function createReportController(request, response) {
  const input = pick(request.body, [
    'heritageAssetId',
    'locationId',
    'category',
    'description',
    'capturedAt',
    'gps',
    'accuracyMeters',
  ]);
  const report = await createReport(
    input,
    request.user._id,
    correlationId(request),
  );
  setVersion(response, report);
  response.status(201).json({ data: report });
}

export async function listOwnReportsController(request, response) {
  const result = await listOwnReports(request.user._id, request.query);
  response.json(result);
}

export async function listReportsForTriageController(request, response) {
  const result = await listReportsForTriage(request.query);
  response.json(result);
}

export async function listActiveInspectorsController(_request, response) {
  response.json({ data: await listActiveInspectors() });
}

export async function getReportController(request, response) {
  const report = await getReport(request.params.id, request.user);
  setVersion(response, report);
  response.json({ data: report });
}

export async function triageReportController(request, response) {
  const report = await triageReport(
    request.params.id,
    pick(request.body, ['decision', 'reason', 'notes']),
    request.user,
    requireVersion(request),
    correlationId(request),
  );
  setVersion(response, report);
  response.json({ data: report });
}

export async function convertReportController(request, response) {
  const result = await convertReport(
    request.params.id,
    pick(request.body, [
      'inspectorId',
      'reviewerId',
      'assetId',
      'type',
      'scope',
      'scheduledAt',
    ]),
    request.user,
    requireVersion(request),
    correlationId(request),
  );
  setVersion(response, result.report);
  response.status(201).json({ data: result });
}

export async function listInspectionsController(request, response) {
  response.json({
    data: await listInspections(request.user, request.query),
  });
}

export async function createInspectionController(request, response) {
  const inspection = await createInspection(
    pick(request.body, [
      'assetId',
      'inspectorId',
      'reviewerId',
      'type',
      'scope',
      'scheduledAt',
    ]),
    request.user,
    correlationId(request),
  );
  setVersion(response, inspection);
  response.status(201).json({ data: inspection });
}

export async function getInspectionController(request, response) {
  const inspection = await getInspection(request.params.id, request.user);
  // La inspección incluye intervenciones y su evidencia, que cambian sin
  // incrementar `inspection.version`. Dejamos que Express calcule el ETag
  // sobre el cuerpo completo para no servir un 304 con datos obsoletos.
  response.json({ data: inspection });
}

export async function startInspectionController(request, response) {
  const inspection = await startInspection(
    request.params.id,
    requireVersion(request),
    request.user,
    correlationId(request),
  );
  setVersion(response, inspection);
  response.json({ data: inspection });
}

export async function resumeInspectionController(request, response) {
  const inspection = await resumeInspection(
    request.params.id,
    requireVersion(request),
    request.user,
    correlationId(request),
  );
  setVersion(response, inspection);
  response.json({ data: inspection });
}

export async function addFindingController(request, response) {
  const inspection = await addFinding(
    request.params.id,
    pick(request.body, [
      'category',
      'description',
      'severityProposed',
      'requiresIntervention',
    ]),
    requireVersion(request),
    request.user,
    correlationId(request),
  );
  setVersion(response, inspection);
  response.status(201).json({ data: inspection });
}

export async function submitInspectionController(request, response) {
  const inspection = await submitInspection(
    request.params.id,
    pick(request.body, ['noFindingsDeclared']),
    requireVersion(request),
    request.user,
    correlationId(request),
  );
  setVersion(response, inspection);
  response.json({ data: inspection });
}

export async function reviewInspectionController(request, response) {
  const inspection = await reviewInspection(
    request.params.id,
    pick(request.body, ['decision', 'result', 'findings', 'notes']),
    requireVersion(request),
    request.user,
    correlationId(request),
  );
  setVersion(response, inspection);
  response.json({ data: inspection });
}

export async function closeInspectionController(request, response) {
  const inspection = await closeInspection(
    request.params.id,
    pick(request.body, ['justification']),
    requireVersion(request),
    request.user,
    correlationId(request),
  );
  setVersion(response, inspection);
  response.json({ data: inspection });
}

export async function proposeInterventionController(request, response) {
  const intervention = await proposeIntervention(
    request.params.id,
    pick(request.body, ['findingIds', 'type', 'description']),
    request.user,
    correlationId(request),
  );
  setVersion(response, intervention);
  response.status(201).json({ data: intervention });
}

export async function transitionInterventionController(request, response) {
  const intervention = await transitionIntervention(
    request.params.id,
    pick(request.body, ['action', 'reason']),
    requireVersion(request),
    request.user,
    correlationId(request),
  );
  setVersion(response, intervention);
  response.json({ data: intervention });
}
