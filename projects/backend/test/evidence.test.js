import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27018/falconsync_evidence_test?replicaSet=falconsyncTest';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';

const { default: app } = await import('../index.js');
const { config } = await import('../helpers/env.js');
const { connectDB, disconnectDB } = await import('../databases/db.js');
const { default: DomainEvent } = await import('../databases/models/DomainEvent.js');
const { default: Evidence } = await import('../databases/models/Evidence.js');
const { default: EvidenceAccessLog } = await import(
  '../databases/models/EvidenceAccessLog.js'
);
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

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function ifMatch(version) {
  return `"${version}"`;
}

async function clearTestData() {
  await Promise.all([
    User.deleteMany({}),
    RefreshSession.deleteMany({}),
    HeritageAsset.deleteMany({}),
    Inspection.deleteMany({}),
    Intervention.deleteMany({}),
    Location.deleteMany({}),
    Report.deleteMany({}),
    Evidence.deleteMany({}),
    EvidenceAccessLog.collection.deleteMany({}),
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
      code: `ASSET-${Date.now()}`,
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

async function createReport(authorization, assetId) {
  const response = await request(app)
    .post('/api/reports')
    .set('Authorization', authorization)
    .send({
      heritageAssetId: assetId,
      category: 'cracks',
      description: 'Se observan fisuras en el muro norte del inmueble.',
    });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data;
}

async function makeJpeg(background = '#ff0000', exif = true) {
  let pipeline = sharp({
    create: { width: 12, height: 8, channels: 3, background },
  }).jpeg({ quality: 90 });

  if (exif) {
    pipeline = pipeline.withExif({
      IFD0: {
        Copyright: 'FalconSync evidence test',
        Software: 'FalconSyncTest',
      },
    });
  }

  return pipeline.toBuffer();
}

async function uploadEvidenceRequest({
  authorization,
  ownerType,
  ownerId,
  findingId,
  buffer,
  purpose = 'Documentar el estado observado',
  idempotencyKey,
}) {
  let pending = request(app)
    .post('/api/evidence')
    .set('Authorization', authorization)
    .field('ownerType', ownerType)
    .field('ownerId', ownerId)
    .field('purpose', purpose)
    .attach('file', buffer, {
      filename: 'evidencia.jpg',
      contentType: 'image/jpeg',
    });

  if (findingId) {
    pending = pending.field('findingId', findingId);
  }

  if (idempotencyKey) {
    pending = pending.set('Idempotency-Key', idempotencyKey);
  }

  return pending;
}

function binaryParser(response, callback) {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Evidencia privada de conservación', () => {
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
      Evidence.init(),
      EvidenceAccessLog.init(),
      DomainEvent.init(),
    ]);
  });

  beforeEach(clearTestData);

  after(async () => {
    await clearTestData();
    await disconnectDB();
  });

  it('carga, protege, verifica y audita la evidencia de un reporte', async () => {
    const reporter = await createUser('reporter@evidence.local');
    const outsider = await createUser('outsider@evidence.local');
    const inspector = await createUser('inspector@evidence.local', 'inspector');
    const admin = await createUser('admin@evidence.local', 'admin');
    const reporterAuthorization = await authorizationFor(reporter.email);
    const outsiderAuthorization = await authorizationFor(outsider.email);
    const inspectorAuthorization = await authorizationFor(inspector.email);
    const adminAuthorization = await authorizationFor(admin.email);
    const asset = await createAsset(inspectorAuthorization);
    const report = await createReport(reporterAuthorization, asset.id);
    const jpeg = await makeJpeg();

    const uploaded = await uploadEvidenceRequest({
      authorization: reporterAuthorization,
      ownerType: 'Report',
      ownerId: report.id,
      buffer: jpeg,
      idempotencyKey: 'report-evidence-0001',
    });

    assert.equal(uploaded.status, 202, JSON.stringify(uploaded.body));
    const evidence = uploaded.body.data;
    assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
    assert.equal(evidence.mimeType, 'image/jpeg');
    assert.equal(evidence.scanStatus, 'available');
    assert.equal(evidence.exifStripped, true);
    assert.equal(evidence.bytes > 0, true);
    assert.equal(evidence.width, 12);
    assert.equal(evidence.height, 8);
    assert.equal(evidence.storageKey, undefined);
    assert.equal(evidence.idempotencyKey, undefined);
    assert.equal(
      new Date(evidence.retentionUntil).getTime() > Date.now() + 300 * 86_400_000,
      true,
    );

    const storedReport = await Report.findById(report.id);
    assert.equal(
      storedReport.evidenceIds.map(String).includes(evidence.id),
      true,
    );
    assert.equal(storedReport.version, 1);

    const repeated = await uploadEvidenceRequest({
      authorization: reporterAuthorization,
      ownerType: 'Report',
      ownerId: report.id,
      buffer: jpeg,
      idempotencyKey: 'report-evidence-0001',
    });
    assert.equal(repeated.status, 202);
    assert.equal(repeated.body.data.id, evidence.id);

    const conflict = await uploadEvidenceRequest({
      authorization: reporterAuthorization,
      ownerType: 'Report',
      ownerId: report.id,
      buffer: await makeJpeg('#00ff00'),
      idempotencyKey: 'report-evidence-0001',
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, 'IDEMPOTENCY_CONFLICT');

    const outsiderUpload = await uploadEvidenceRequest({
      authorization: outsiderAuthorization,
      ownerType: 'Report',
      ownerId: report.id,
      buffer: jpeg,
    });
    assert.equal(outsiderUpload.status, 404);

    const downloaded = await request(app)
      .get(`/api/evidence/${evidence.id}?purpose=Revisi%C3%B3n%20del%20reporte`)
      .set('Authorization', reporterAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers['cache-control'], 'private, no-store');
    assert.equal(downloaded.headers['x-content-type-options'], 'nosniff');
    assert.equal(Buffer.isBuffer(downloaded.body), true);
    assert.equal(sha256(downloaded.body), evidence.sha256);

    const storedFile = await Evidence.findById(evidence.id);
    assert.equal(storedFile.sha256, sha256(downloaded.body));

    const metadata = await sharp(downloaded.body).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.width, 12);
    assert.equal(metadata.height, 8);

    const outsiderDownload = await request(app)
      .get(`/api/evidence/${evidence.id}?purpose=Intento%20ajeno`)
      .set('Authorization', outsiderAuthorization);
    assert.equal(outsiderDownload.status, 404);

    const adminDownload = await request(app)
      .get(`/api/evidence/${evidence.id}?purpose=Auditor%C3%ADa`)
      .set('Authorization', adminAuthorization);
    assert.equal(adminDownload.status, 403);
    assert.equal(adminDownload.body.error.code, 'EVIDENCE_AUDIT_ONLY');

    const accessLog = await request(app)
      .get(`/api/admin/evidence/${evidence.id}/access-log`)
      .set('Authorization', adminAuthorization);
    assert.equal(accessLog.status, 200, JSON.stringify(accessLog.body));
    assert.equal(accessLog.body.data.length, 1);
    assert.equal(accessLog.body.data[0].action, 'download');
    assert.equal(accessLog.body.data[0].purpose, 'Revisión del reporte');
    assert.equal(accessLog.body.data[0].actor.email, reporter.email);

    const listed = await request(app)
      .get('/api/evidence')
      .query({ ownerType: 'Report', ownerId: report.id })
      .set('Authorization', reporterAuthorization);
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].id, evidence.id);
    assert.equal(listed.body.data[0].sha256, evidence.sha256);
    assert.equal(listed.body.data[0].storageKey, undefined);

    const outsiderList = await request(app)
      .get('/api/evidence')
      .query({ ownerType: 'Report', ownerId: report.id })
      .set('Authorization', outsiderAuthorization);
    assert.equal(outsiderList.status, 404);

    const adminList = await request(app)
      .get('/api/evidence')
      .query({ ownerType: 'Report', ownerId: report.id })
      .set('Authorization', adminAuthorization);
    assert.equal(adminList.status, 403);

    const events = await DomainEvent.find({
      aggregateType: 'Report',
      eventType: 'evidence.uploaded',
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].payload.mimeType, 'image/jpeg');

    const spoofed = await request(app)
      .post('/api/evidence')
      .set('Authorization', reporterAuthorization)
      .field('ownerType', 'Report')
      .field('ownerId', report.id)
      .field('purpose', 'Archivo que no es una imagen')
      .attach('file', Buffer.from('esto no es una imagen'), {
        filename: 'falsa.png',
        contentType: 'image/png',
      });
    assert.equal(spoofed.status, 415);
    assert.equal(spoofed.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');

    const corrupt = await request(app)
      .post('/api/evidence')
      .set('Authorization', reporterAuthorization)
      .field('ownerType', 'Report')
      .field('ownerId', report.id)
      .field('purpose', 'Imagen truncada')
      .attach(
        'file',
        Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          Buffer.alloc(100),
        ]),
        { filename: 'truncada.jpg', contentType: 'image/jpeg' },
      );
    assert.equal(corrupt.status, 422);
    assert.equal(corrupt.body.error.code, 'INVALID_EVIDENCE_CONTENT');

    const previousScanRequired = config.evidence.scanRequired;
    const previousAllowUnscanned = config.evidence.allowUnscanned;
    config.evidence.scanRequired = true;
    config.evidence.allowUnscanned = false;

    try {
      const blocked = await uploadEvidenceRequest({
        authorization: reporterAuthorization,
        ownerType: 'Report',
        ownerId: report.id,
        buffer: jpeg,
      });
      assert.equal(blocked.status, 503);
      assert.equal(blocked.body.error.code, 'EVIDENCE_SCAN_UNAVAILABLE');
    } finally {
      config.evidence.scanRequired = previousScanRequired;
      config.evidence.allowUnscanned = previousAllowUnscanned;
    }
  });

  it('vincula evidencia a hallazgos e intervenciones hasta el cierre', async () => {
    const inspector = await createUser('assigned@evidence.local', 'inspector');
    const reviewer = await createUser('reviewer@evidence.local', 'inspector');
    const outsider = await createUser('outsider2@evidence.local', 'inspector');
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

    const outsiderUpload = await uploadEvidenceRequest({
      authorization: outsiderAuthorization,
      ownerType: 'Inspection',
      ownerId: inspectionId,
      findingId,
      buffer: await makeJpeg(),
    });
    assert.equal(outsiderUpload.status, 404);

    const inspectionEvidence = await uploadEvidenceRequest({
      authorization: inspectorAuthorization,
      ownerType: 'Inspection',
      ownerId: inspectionId,
      findingId,
      buffer: await makeJpeg('#aa0000'),
      purpose: 'Documentar la fisura antes de la intervención',
    });
    assert.equal(
      inspectionEvidence.status,
      202,
      JSON.stringify(inspectionEvidence.body),
    );

    const inspectionAfterEvidence = await Inspection.findById(inspectionId);
    assert.equal(inspectionAfterEvidence.version, 3);
    assert.equal(
      inspectionAfterEvidence.findings[0].evidenceIds.map(String).includes(
        inspectionEvidence.body.data.id,
      ),
      true,
    );
    assert.equal(
      inspectionAfterEvidence.evidenceIds.map(String).includes(
        inspectionEvidence.body.data.id,
      ),
      true,
    );

    const submitted = await request(app)
      .post(`/api/inspections/${inspectionId}/submit`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(3))
      .send({});
    assert.equal(submitted.status, 200);

    const reviewed = await request(app)
      .post(`/api/inspections/${inspectionId}/review`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(4))
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
    assert.equal(intervention.status, 201, JSON.stringify(intervention.body));
    const interventionId = intervention.body.data.id;

    const approved = await request(app)
      .patch(`/api/interventions/${interventionId}`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ action: 'approve' });
    assert.equal(approved.status, 200);

    const interventionStarted = await request(app)
      .patch(`/api/interventions/${interventionId}`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(1))
      .send({ action: 'start' });
    assert.equal(interventionStarted.status, 200);

    const executionEvidence = await uploadEvidenceRequest({
      authorization: inspectorAuthorization,
      ownerType: 'Intervention',
      ownerId: interventionId,
      buffer: await makeJpeg('#008800'),
      purpose: 'Registrar la intervención ejecutada',
    });
    assert.equal(executionEvidence.status, 202);

    const completed = await request(app)
      .patch(`/api/interventions/${interventionId}`)
      .set('Authorization', inspectorAuthorization)
      .set('If-Match', ifMatch(3))
      .send({ action: 'complete' });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));

    const verificationEvidence = await uploadEvidenceRequest({
      authorization: reviewerAuthorization,
      ownerType: 'Intervention',
      ownerId: interventionId,
      buffer: await makeJpeg('#000088'),
      purpose: 'Verificar el resultado de la intervención',
    });
    assert.equal(verificationEvidence.status, 202);

    const verified = await request(app)
      .patch(`/api/interventions/${interventionId}`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(5))
      .send({ action: 'verify' });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.data.state, 'verified');

    const closed = await request(app)
      .post(`/api/inspections/${inspectionId}/close`)
      .set('Authorization', reviewerAuthorization)
      .set('If-Match', ifMatch(5))
      .send({});
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.data.state, 'closed');

    const interventionAfter = await Intervention.findById(interventionId);
    assert.equal(interventionAfter.evidenceIds.length, 2);
  });
});
