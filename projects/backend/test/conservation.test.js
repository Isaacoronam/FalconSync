import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27018/falconsync_conservation_test?replicaSet=falconsyncTest';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';

const { default: app } = await import('../index.js');
const { connectDB, disconnectDB } = await import('../databases/db.js');
const { default: DomainEvent } = await import('../databases/models/DomainEvent.js');
const { default: HeritageAsset } = await import(
  '../databases/models/HeritageAsset.js'
);
const { default: Inspection } = await import('../databases/models/Inspection.js');
const { default: Intervention } = await import(
  '../databases/models/Intervention.js'
);
const { default: Location } = await import('../databases/models/Location.js');
const { default: RefreshSession } = await import(
  '../databases/models/RefreshSession.js'
);
const { default: Report } = await import('../databases/models/Report.js');
const { default: User } = await import('../databases/models/User.js');
const { hashPassword } = await import('../microservices/authService.js');

const PASSWORD = 'UsuarioSegura123';

async function clearTestData() {
  await Promise.all([
    User.deleteMany({}),
    RefreshSession.deleteMany({}),
    HeritageAsset.deleteMany({}),
    Inspection.deleteMany({}),
    Intervention.deleteMany({}),
    Location.deleteMany({}),
    Report.deleteMany({}),
    DomainEvent.collection.deleteMany({}),
  ]);
}

async function createUser(email, role = 'user') {
  return User.create({
    name: 'Usuario de prueba',
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
    mustChangePassword: false,
  });
}

async function authorizationFor(email) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });

  assert.equal(
    response.status,
    200,
    `No se pudo iniciar sesión con ${email}: ${JSON.stringify(response.body)}`,
  );
  return `Bearer ${response.body.data.accessToken}`;
}

async function createAsset(authorization) {
  const response = await request(app)
    .post('/api/heritage-assets')
    .set('Authorization', authorization)
    .send({
      code: 'ASSET-001',
      name: 'Activo de prueba',
      type: 'building',
      status: 'active',
      geometry: {
        type: 'Point',
        coordinates: [-69.6778, 11.4075],
      },
    });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data;
}

function ifMatch(version) {
  return `"${version}"`;
}

describe('Flujo de conservación', () => {
  before(async () => {
    await connectDB();
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      HeritageAsset.init(),
      Inspection.init(),
      Intervention.init(),
      Location.init(),
      Report.init(),
      DomainEvent.init(),
    ]);
  });

  beforeEach(clearTestData);

  after(async () => {
    await clearTestData();
    await disconnectDB();
  });

  it('limita el reporte al propietario e inspector y cierra una inspección revisada', async () => {
    const reporter = await createUser('reporter@conservation.local');
    const otherUser = await createUser('other@conservation.local');
    const inspector = await createUser('inspector@conservation.local', 'inspector');
    const reviewer = await createUser('reviewer@conservation.local', 'inspector');
    const unassignedInspector = await createUser(
      'unassigned@conservation.local',
      'inspector',
    );
    const admin = await createUser('admin@conservation.local', 'admin');
    const reporterAuthorization = await authorizationFor(reporter.email);
    const otherAuthorization = await authorizationFor(otherUser.email);
    const inspectorAuthorization = await authorizationFor(inspector.email);
    const reviewerAuthorization = await authorizationFor(reviewer.email);
    const unassignedAuthorization = await authorizationFor(
      unassignedInspector.email,
    );
    const adminAuthorization = await authorizationFor(admin.email);
    const asset = await createAsset(inspectorAuthorization);

    const reportResponse = await request(app)
      .post('/api/reports')
      .set('Authorization', reporterAuthorization)
      .send({
        heritageAssetId: asset.id,
        category: 'cracks',
        description: 'Se observan fisuras en el muro norte del inmueble.',
      });
    assert.equal(reportResponse.status, 201, JSON.stringify(reportResponse.body));
    const reportId = reportResponse.body.data.id;

    const ownReport = await request(app)
      .get(`/api/reports/${reportId}`)
      .set('Authorization', reporterAuthorization);
    assert.equal(ownReport.status, 200);

    const otherReport = await request(app)
      .get(`/api/reports/${reportId}`)
      .set('Authorization', otherAuthorization);
    assert.equal(otherReport.status, 404);

    const userCannotCreateInspection = await request(app)
      .post('/api/inspections')
      .set('Authorization', otherAuthorization)
      .send({});
    assert.equal(userCannotCreateInspection.status, 403);

    const inspectorReport = await request(app)
      .get(`/api/reports/${reportId}`)
      .set('Authorization', inspectorAuthorization);
    assert.equal(inspectorReport.status, 200);

    const adminReport = await request(app)
      .get(`/api/reports/${reportId}`)
      .set('Authorization', adminAuthorization);
    assert.equal(adminReport.status, 200);
    assert.equal(adminReport.body.data.description, undefined);
    assert.equal(adminReport.body.data.reporterId, undefined);

    const triaged = await request(app)
      .patch(`/api/reports/${reportId}/triage`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ decision: 'accept' });
    assert.equal(triaged.status, 200, JSON.stringify(triaged.body));
    assert.equal(triaged.body.data.state, 'accepted');
    assert.equal(triaged.body.data.version, 2);

    const missingReviewer = await request(app)
      .post(`/api/reports/${reportId}/convert`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(2))
      .send({
        inspectorId: inspector.id,
        type: 'follow_up',
        scope: 'Inspeccionar el muro norte y registrar los hallazgos observables.',
      });
    assert.equal(missingReviewer.status, 400);
    assert.equal(missingReviewer.body.error.code, 'VALIDATION_ERROR');

    const sameInspectorAndReviewer = await request(app)
      .post(`/api/reports/${reportId}/convert`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(2))
      .send({
        inspectorId: inspector.id,
        reviewerId: inspector.id,
        type: 'follow_up',
        scope: 'Inspeccionar el muro norte y registrar los hallazgos observables.',
      });
    assert.equal(sameInspectorAndReviewer.status, 400);
    assert.equal(
      sameInspectorAndReviewer.body.error.code,
      'VALIDATION_ERROR',
    );

    const converted = await request(app)
      .post(`/api/reports/${reportId}/convert`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(2))
      .send({
        inspectorId: inspector.id,
        reviewerId: reviewer.id,
        type: 'follow_up',
        scope: 'Inspeccionar el muro norte y registrar los hallazgos observables.',
      });
    assert.equal(converted.status, 201, JSON.stringify(converted.body));
    const inspectionId = converted.body.data.inspection.id;

    const unassignedInspection = await request(app)
      .get(`/api/inspections/${inspectionId}`)
      .set('Authorization', unassignedAuthorization);
    assert.equal(unassignedInspection.status, 404);

    const reviewerInspections = await request(app)
      .get('/api/inspections')
      .set('Authorization', reviewerAuthorization);
    assert.equal(reviewerInspections.status, 200);
    assert.equal(reviewerInspections.body.data.length, 1);

    const adminInspection = await request(app)
      .get(`/api/inspections/${inspectionId}`)
      .set('Authorization', adminAuthorization);
    assert.equal(adminInspection.status, 200);
    assert.equal(adminInspection.body.data.scope, undefined);
    assert.equal(adminInspection.body.data.findings, undefined);
    assert.equal(adminInspection.body.data.history[0].reason, undefined);

    const adminInspections = await request(app)
      .get('/api/inspections')
      .set('Authorization', adminAuthorization);
    assert.equal(adminInspections.status, 200);
    assert.equal(adminInspections.body.data.length, 1);
    assert.equal(adminInspections.body.data[0].scope, undefined);

    const adminCannotExecute = await request(app)
      .post(`/api/inspections/${inspectionId}/start`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(0));
    assert.equal(adminCannotExecute.status, 403);

    const started = await request(app)
      .post(`/api/inspections/${inspectionId}/start`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(0));
    assert.equal(started.status, 200);

    const submitted = await request(app)
      .post(`/api/inspections/${inspectionId}/submit`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(1))
      .send({ noFindingsDeclared: true });
    assert.equal(submitted.status, 200);

    const deniedReview = await request(app)
      .post(`/api/inspections/${inspectionId}/review`)
      .set('Authorization', unassignedAuthorization)
      .set('If-Match', ifMatch(2))
      .send({ decision: 'approve', result: 'good', findings: {} });
    assert.equal(deniedReview.status, 403);
    assert.equal(
      deniedReview.body.error.code,
      'INSPECTION_REVIEWER_REQUIRED',
    );

    const reviewed = await request(app)
      .post(`/api/inspections/${inspectionId}/review`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(2))
      .send({ decision: 'approve', result: 'good', findings: {} });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));

    const closed = await request(app)
      .post(`/api/inspections/${inspectionId}/close`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(3))
      .send({});
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.data.state, 'closed');

    const events = await DomainEvent.find({
      aggregateType: 'Inspection',
      aggregateId: inspectionId,
    }).sort({ occurredAt: 1 });
    assert.deepEqual(
      events.map((event) => event.eventType),
      [
        'inspection.created',
        'inspection.started',
        'inspection.submitted',
        'inspection.reviewed',
        'inspection.closed',
      ],
    );
  });

  it('permite varios reportes e inspecciones sin vínculo entre sí', async () => {
    const reporter = await createUser('multi-reporter@conservation.local');
    const inspector = await createUser(
      'multi-inspector@conservation.local',
      'inspector',
    );
    const reviewer = await createUser(
      'multi-reviewer@conservation.local',
      'inspector',
    );
    const reporterAuthorization = await authorizationFor(reporter.email);
    const inspectorAuthorization = await authorizationFor(inspector.email);
    const asset = await createAsset(inspectorAuthorization);

    for (let index = 1; index <= 2; index += 1) {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', reporterAuthorization)
        .send({
          heritageAssetId: asset.id,
          category: 'moisture',
          description: `Humedad detectada en la fachada ${index} del inmueble.`,
        });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.data.inspectionId, null);
    }

    assert.equal(
      await Report.countDocuments({ inspectionId: { $exists: false } }),
      2,
    );

    for (let index = 1; index <= 2; index += 1) {
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', inspectorAuthorization)
        .send({
          assetId: asset.id,
          inspectorId: inspector.id,
          reviewerId: reviewer.id,
          type: 'routine',
          scope: `Inspección rutinaria ${index} del inmueble.`,
        });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.data.reportId, null);
    }

    assert.equal(
      await Inspection.countDocuments({ reportId: { $exists: false } }),
      2,
    );
  });

  it('expone la cola de triaje, vincula activo al convertir y reanuda una inspección devuelta', async () => {
    const reporter = await createUser('queue-reporter@conservation.local');
    const inspector = await createUser('queue-inspector@conservation.local', 'inspector');
    const reviewer = await createUser('queue-reviewer@conservation.local', 'inspector');
    const otherUser = await createUser('queue-other@conservation.local');
    const reporterAuthorization = await authorizationFor(reporter.email);
    const inspectorAuthorization = await authorizationFor(inspector.email);
    const reviewerAuthorization = await authorizationFor(reviewer.email);
    const otherAuthorization = await authorizationFor(otherUser.email);

    const location = await Location.create({
      title: 'Inmueble de prueba',
      slug: `inmueble-${Date.now()}`,
      category: 'architecture',
      description: 'Inmueble usado para probar la cola de triaje y la conversión.',
      location: { type: 'Point', coordinates: [-69.6778, 11.4075] },
      status: 'published',
      coordinateVerifiedAt: new Date(),
    });

    const asset = await request(app)
      .post('/api/heritage-assets')
      .set('Authorization', inspectorAuthorization)
      .send({
        code: `ASSET-QUEUE-${Date.now()}`,
        name: 'Activo vinculado al POI',
        type: 'building',
        status: 'active',
        locationId: location.id,
        geometry: { type: 'Point', coordinates: [-69.6778, 11.4075] },
      });
    assert.equal(asset.status, 201, JSON.stringify(asset.body));

    const otherAsset = await request(app)
      .post('/api/heritage-assets')
      .set('Authorization', inspectorAuthorization)
      .send({
        code: `ASSET-OTHER-${Date.now()}`,
        name: 'Activo de otro inmueble',
        type: 'building',
        status: 'active',
        geometry: { type: 'Point', coordinates: [-69.68, 11.41] },
      });
    assert.equal(otherAsset.status, 201, JSON.stringify(otherAsset.body));

    const report = await request(app)
      .post('/api/reports')
      .set('Authorization', reporterAuthorization)
      .send({
        locationId: location.id,
        category: 'moisture',
        description: 'Humedad visible en la fachada del inmueble de prueba.',
      });
    assert.equal(report.status, 201, JSON.stringify(report.body));

    const userQueue = await request(app)
      .get('/api/reports/queue')
      .set('Authorization', otherAuthorization);
    assert.equal(userQueue.status, 403);

    const queue = await request(app)
      .get('/api/reports/queue')
      .set('Authorization', inspectorAuthorization);
    assert.equal(queue.status, 200, JSON.stringify(queue.body));
    assert.equal(queue.body.data.length, 1);
    assert.equal(queue.body.data[0].id, report.body.data.id);

    const userInspectors = await request(app)
      .get('/api/inspectors')
      .set('Authorization', otherAuthorization);
    assert.equal(userInspectors.status, 403);

    const inspectors = await request(app)
      .get('/api/inspectors')
      .set('Authorization', inspectorAuthorization);
    assert.equal(inspectors.status, 200, JSON.stringify(inspectors.body));
    assert.equal(
      inspectors.body.data.some((item) => item.id === reviewer.id),
      true,
    );
    assert.equal(
      inspectors.body.data.some((item) => item.email !== undefined),
      false,
    );

    const triaged = await request(app)
      .patch(`/api/reports/${report.body.data.id}/triage`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ decision: 'accept' });
    assert.equal(triaged.status, 200, JSON.stringify(triaged.body));

    const mismatched = await request(app)
      .post(`/api/reports/${report.body.data.id}/convert`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(2))
      .send({
        assetId: otherAsset.body.data.id,
        inspectorId: inspector.id,
        reviewerId: reviewer.id,
        type: 'follow_up',
        scope: 'Revisar la humedad y documentar el estado del inmueble.',
      });
    assert.equal(mismatched.status, 400, JSON.stringify(mismatched.body));

    const converted = await request(app)
      .post(`/api/reports/${report.body.data.id}/convert`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(2))
      .send({
        assetId: asset.body.data.id,
        inspectorId: inspector.id,
        reviewerId: reviewer.id,
        type: 'follow_up',
        scope: 'Revisar la humedad y documentar el estado del inmueble.',
      });
    assert.equal(converted.status, 201, JSON.stringify(converted.body));
    assert.equal(
      converted.body.data.report.heritageAssetId,
      asset.body.data.id,
    );
    const inspectionId = converted.body.data.inspection.id;

    const started = await request(app)
      .post(`/api/inspections/${inspectionId}/start`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(0));
    assert.equal(started.status, 200);

    const submitted = await request(app)
      .post(`/api/inspections/${inspectionId}/submit`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(1))
      .send({ noFindingsDeclared: true });
    assert.equal(submitted.status, 200);

    const returned = await request(app)
      .post(`/api/inspections/${inspectionId}/review`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(2))
      .send({ decision: 'return', notes: 'Añade una foto general del inmueble.' });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.data.state, 'returned');

    const resumed = await request(app)
      .post(`/api/inspections/${inspectionId}/resume`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(3));
    assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
    assert.equal(resumed.body.data.state, 'in_progress');

    const resubmitted = await request(app)
      .post(`/api/inspections/${inspectionId}/submit`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(4))
      .send({ noFindingsDeclared: true });
    assert.equal(resubmitted.status, 200);

    const reviewed = await request(app)
      .post(`/api/inspections/${inspectionId}/review`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(5))
      .send({ decision: 'approve', result: 'fair', findings: {} });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));

    const closed = await request(app)
      .post(`/api/inspections/${inspectionId}/close`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(6))
      .send({});
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.data.state, 'closed');
  });

  it('exige evidencia verificada antes de cerrar hallazgos que requieren intervención', async () => {
    const inspector = await createUser('assigned@conservation.local', 'inspector');
    const reviewer = await createUser('reviewer2@conservation.local', 'inspector');
    const outsider = await createUser('outsider@conservation.local', 'inspector');
    const inspectorAuthorization = await authorizationFor(inspector.email);
    const reviewerAuthorization = await authorizationFor(reviewer.email);
    const outsiderAuthorization = await authorizationFor(outsider.email);
    const asset = await createAsset(inspectorAuthorization);

    const created = await request(app)
      .post('/api/inspections')
      .set('Authorization', inspectorAuthorization)
      .send({
        assetId: asset.id,
        inspectorId: inspector.id,
        reviewerId: reviewer.id,
        type: 'routine',
        scope: 'Revisar el revestimiento exterior del inmueble.',
      });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const inspectionId = created.body.data.id;

    const started = await request(app)
      .post(`/api/inspections/${inspectionId}/start`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(0));
    assert.equal(started.status, 200);

    const findingResponse = await request(app)
      .post(`/api/inspections/${inspectionId}/findings`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(1))
      .send({
        category: 'cracks',
        description: 'Fisuras visibles en el revestimiento del muro exterior.',
        severityProposed: 'medium',
        requiresIntervention: true,
      });
    assert.equal(findingResponse.status, 201);
    const findingId = findingResponse.body.data.findings[0].findingId;

    const submitted = await request(app)
      .post(`/api/inspections/${inspectionId}/submit`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(2))
      .send({});
    assert.equal(submitted.status, 200);

    const reviewed = await request(app)
      .post(`/api/inspections/${inspectionId}/review`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(3))
      .send({
        decision: 'approve',
        result: 'fair',
        findings: { [findingId]: 'medium' },
      });
    assert.equal(reviewed.status, 200);

    const intervention = await request(app)
      .post(`/api/inspections/${inspectionId}/interventions`)
      .set('Authorization', inspectorAuthorization)
      .send({
        findingIds: [findingId],
        type: 'stabilization',
        description: 'Estabilizar el revestimiento y documentar el resultado.',
      });
    assert.equal(intervention.status, 201);

    const inspectionBeforeApproval = await request(app)
      .get(`/api/inspections/${inspectionId}`)
      .set('Authorization', reviewerAuthorization);
    assert.equal(
      inspectionBeforeApproval.status,
      200,
      JSON.stringify(inspectionBeforeApproval.body),
    );
    assert.equal(
      inspectionBeforeApproval.body.data.interventions[0].state,
      'proposed',
    );
    const inspectionEtag = inspectionBeforeApproval.headers.etag;
    assert.ok(inspectionEtag);

    const outsiderTransition = await request(app)
      .patch(`/api/interventions/${intervention.body.data.id}`)
      .set('Authorization', outsiderAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ action: 'approve' });
    assert.equal(outsiderTransition.status, 404);

    const approved = await request(app)
      .patch(`/api/interventions/${intervention.body.data.id}`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ action: 'approve' });
    assert.equal(approved.status, 200);

    const inspectionAfterApproval = await request(app)
      .get(`/api/inspections/${inspectionId}`)
      .set('Authorization', reviewerAuthorization)
      .set('If-None-Match', inspectionEtag);
    assert.equal(
      inspectionAfterApproval.status,
      200,
      JSON.stringify(inspectionAfterApproval.body),
    );
    assert.equal(
      inspectionAfterApproval.body.data.interventions[0].state,
      'approved',
    );

    const reviewerCannotExecute = await request(app)
      .patch(`/api/interventions/${intervention.body.data.id}`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(1))
      .send({ action: 'start' });
    assert.equal(reviewerCannotExecute.status, 403);
    assert.equal(
      reviewerCannotExecute.body.error.code,
      'INSPECTOR_ASSIGNMENT_REQUIRED',
    );

    const startedIntervention = await request(app)
      .patch(`/api/interventions/${intervention.body.data.id}`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(1))
      .send({ action: 'start' });
    assert.equal(startedIntervention.status, 200);

    const reviewerCannotComplete = await request(app)
      .patch(`/api/interventions/${intervention.body.data.id}`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(2))
      .send({ action: 'complete' });
    assert.equal(reviewerCannotComplete.status, 403);
    assert.equal(
      reviewerCannotComplete.body.error.code,
      'INTERVENTION_EXECUTOR_REQUIRED',
    );

    const completedWithoutEvidence = await request(app)
      .patch(`/api/interventions/${intervention.body.data.id}`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(2))
      .send({ action: 'complete' });
    assert.equal(completedWithoutEvidence.status, 409);
    assert.equal(
      completedWithoutEvidence.body.error.code,
      'EVIDENCE_REQUIRED',
    );

    const closeAttempt = await request(app)
      .post(`/api/inspections/${inspectionId}/close`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(4))
      .send({});
    assert.equal(closeAttempt.status, 409);
    assert.equal(
      closeAttempt.body.error.code,
      'CLOSURE_REQUIRES_VERIFIED_INTERVENTION',
    );
  });
});
