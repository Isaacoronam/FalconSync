import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27018/falconsync_panorama_test?replicaSet=falconsyncTest';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';

const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'falconsync-panorama-test-'),
);
process.env.UPLOAD_DIR = path.join(temporaryRoot, 'images');
process.env.UPLOAD_PRIVATE_DIR = path.join(temporaryRoot, 'documents');

const { default: app } = await import('../index.js');
const { config } = await import('../helpers/env.js');
const { connectDB, disconnectDB } = await import('../databases/db.js');
const { default: AuditLog } = await import('../databases/models/AuditLog.js');
const { default: Location } = await import('../databases/models/Location.js');
const { default: Panorama } = await import('../databases/models/Panorama.js');
const { default: RefreshSession } = await import(
  '../databases/models/RefreshSession.js'
);
const { default: User } = await import('../databases/models/User.js');
const { hashPassword } = await import('../microservices/authService.js');

const PASSWORD = 'UsuarioSegura123';

async function clearTestData() {
  await Promise.all([
    User.deleteMany({}),
    RefreshSession.deleteMany({}),
    Location.deleteMany({}),
    Panorama.deleteMany({}),
    AuditLog.deleteMany({}),
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

async function createLocation(overrides = {}) {
  return Location.create({
    title: 'Plaza Bolívar de Coro',
    slug: `plaza-bolivar-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    category: 'urban',
    description: 'Plaza histórica de Santa Ana de Coro.',
    location: { type: 'Point', coordinates: [-69.6778, 11.4075] },
    status: 'published',
    coordinateVerifiedAt: new Date(),
    ...overrides,
  });
}

async function makePanoramaImage({ width = 2048, height = 1024, exif = false } = {}) {
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 25, g: 70, b: 110 },
    },
  });

  if (exif) {
    pipeline = pipeline.withMetadata({
      exif: {
        IFD0: {
          Copyright: 'FalconSync test',
          Software: 'sharp test fixture',
        },
      },
    });
  }

  return pipeline.jpeg({ quality: 90 }).toBuffer();
}

function baseFields(locationId, overrides = {}) {
  return {
    title: 'Plaza Bolívar 360',
    description: 'Vista completa de la plaza desde el centro.',
    locationId,
    author: 'Equipo FalconSync',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    credit: 'Equipo FalconSync · CC BY-SA 4.0',
    rightsDocumented: true,
    peopleBlurred: true,
    ...overrides,
  };
}

async function createPanoramaRequest(authorization, fields, imageBuffer) {
  let pending = request(app)
    .post('/api/admin/panoramas')
    .set('Authorization', authorization);

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }

    if (key === 'hotspots') {
      pending = pending.field('hotspots', JSON.stringify(value));
    } else {
      pending = pending.field(key, String(value));
    }
  }

  return pending.attach('image', imageBuffer, {
    filename: 'panorama.jpg',
    contentType: 'image/jpeg',
  });
}

async function createDraft(authorization, locationId, overrides = {}, image) {
  const imageBuffer = image ?? (await makePanoramaImage());
  return createPanoramaRequest(
    authorization,
    baseFields(locationId, overrides),
    imageBuffer,
  );
}

function ifMatch(version) {
  return `"${version}"`;
}

async function approveAndPublish(authorization, panorama) {
  const approved = await request(app)
    .post(`/api/admin/panoramas/${panorama.id}/approve`)
    .set('Authorization', authorization)
    .set('If-Match', ifMatch(panorama.version));

  assert.equal(approved.status, 200, JSON.stringify(approved.body));

  const published = await request(app)
    .post(`/api/admin/panoramas/${panorama.id}/publish`)
    .set('Authorization', authorization)
    .set('If-Match', ifMatch(approved.body.data.version));

  assert.equal(published.status, 200, JSON.stringify(published.body));
  return published.body.data;
}

function panoramaFilePath(id, file) {
  return path.join(config.uploads.privateDir, 'panoramas', id, file);
}

describe('Visita 360°', () => {
  before(async () => {
    await connectDB();
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      Location.init(),
      Panorama.init(),
      AuditLog.init(),
    ]);
  });

  beforeEach(async () => {
    await clearTestData();
  });

  after(async () => {
    await clearTestData();
    await disconnectDB();

    try {
      fs.rmSync(temporaryRoot, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    } catch {
      // Windows puede conservar un handle temporal de libvips; el directorio
      // vive en %TEMP% y no afecta al resultado de las pruebas.
    }
  });

  it('publica una escena solo tras derechos, aprobación y publicación', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const historian = await createUser('historian@panorama.local', 'historian');
    const user = await createUser('user@panorama.local', 'user');
    const adminAuthorization = await authorizationFor(admin.email);
    const historianAuthorization = await authorizationFor(historian.email);
    const userAuthorization = await authorizationFor(user.email);
    const location = await createLocation();

    const created = await createDraft(adminAuthorization, location.id);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const panorama = created.body.data;
    assert.equal(panorama.status, 'draft');
    assert.equal(panorama.visibility, 'public');
    assert.equal(panorama.version, 0);
    assert.equal(panorama.width, 2048);
    assert.equal(panorama.height, 1024);
    assert.match(panorama.checksum, /^[a-f0-9]{64}$/);
    assert.match(panorama.derivativeChecksum, /^[a-f0-9]{64}$/);
    assert.ok(panorama.thumbnailUrl);
    assert.equal(panorama.location.title, location.title);

    const publicBefore = await request(app).get('/api/panoramas');
    assert.equal(publicBefore.status, 200);
    assert.equal(publicBefore.body.data.length, 0);

    const adminList = await request(app)
      .get('/api/admin/panoramas')
      .set('Authorization', historianAuthorization);
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.data.length, 1);

    const approved = await request(app)
      .post(`/api/admin/panoramas/${panorama.id}/approve`)
      .set('Authorization', historianAuthorization)
      .set('If-Match', ifMatch(0));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.data.status, 'approved');
    assert.equal(approved.body.data.version, 1);
    assert.ok(approved.body.data.approvedAt);

    const published = await request(app)
      .post(`/api/admin/panoramas/${panorama.id}/publish`)
      .set('Authorization', historianAuthorization)
      .set('If-Match', ifMatch(1));
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.data.status, 'published');
    assert.equal(published.body.data.version, 2);
    assert.ok(published.body.data.publishedAt);

    const publicList = await request(app)
      .get('/api/panoramas')
      .query({ locationId: location.id });
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.data.length, 1);
    assert.equal(publicList.body.data[0].id, panorama.id);
    assert.equal(
      publicList.body.data[0].thumbnailUrl,
      `/api/panoramas/${panorama.id}/thumbnail`,
    );
    assert.equal(
      publicList.body.data[0].credits,
      'Equipo FalconSync · CC BY-SA 4.0',
    );

    const detail = await request(app).get(`/api/panoramas/${panorama.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.status, 'published');
    assert.equal(detail.body.data.visibility, 'public');
    assert.equal(detail.body.data.hotspots.length, 0);
    assert.equal(detail.body.data.author, 'Equipo FalconSync');
    assert.equal(detail.body.data.license, 'CC BY-SA 4.0');
    assert.equal(
      detail.body.data.fallback.description,
      'Vista completa de la plaza desde el centro.',
    );

    const image = await request(app).get(`/api/panoramas/${panorama.id}/image`);
    assert.equal(image.status, 200);
    assert.match(image.headers['content-type'], /^image\/webp/);
    assert.ok(image.body.length > 1000);
    assert.equal(
      image.headers.etag,
      `"${panorama.derivativeChecksum}"`,
    );

    const thumbnail = await request(app).get(
      `/api/panoramas/${panorama.id}/thumbnail`,
    );
    assert.equal(thumbnail.status, 200);
    assert.match(thumbnail.headers['content-type'], /^image\/webp/);

    const forbiddenList = await request(app)
      .get('/api/admin/panoramas')
      .set('Authorization', userAuthorization);
    assert.equal(forbiddenList.status, 403);

    const forbiddenCreate = await createPanoramaRequest(
      userAuthorization,
      baseFields(location.id),
      await makePanoramaImage(),
    );
    assert.equal(forbiddenCreate.status, 403);

    const adminCannotPublish = await request(app)
      .post(`/api/admin/panoramas/${panorama.id}/archive`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(2));
    assert.equal(adminCannotPublish.status, 403);

    const auditActions = await AuditLog.find({
      entityType: 'Panorama',
      entityId: panorama.id,
    }).distinct('action');
    assert.ok(auditActions.includes('panorama.created'));
    assert.ok(auditActions.includes('panorama.approved'));
    assert.ok(auditActions.includes('panorama.published'));
  });

  it('rechaza archivos corruptos, imágenes no equirectangulares y demasiado pequeñas', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const adminAuthorization = await authorizationFor(admin.email);
    const location = await createLocation();

    const corrupt = await createPanoramaRequest(
      adminAuthorization,
      baseFields(location.id),
      Buffer.from('esto no es una imagen'),
    );
    assert.equal(corrupt.status, 415);
    assert.equal(corrupt.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');

    const wrongRatio = await createPanoramaRequest(
      adminAuthorization,
      baseFields(location.id),
      await makePanoramaImage({ width: 2000, height: 800 }),
    );
    assert.equal(wrongRatio.status, 422);
    assert.match(wrongRatio.body.error.message, /relación 2:1/);

    const tooSmall = await createPanoramaRequest(
      adminAuthorization,
      baseFields(location.id),
      await makePanoramaImage({ width: 512, height: 256 }),
    );
    assert.equal(tooSmall.status, 422);
    assert.match(tooSmall.body.error.message, /al menos 1024/);

    assert.equal(await Panorama.countDocuments({}), 0);
  });

  it('bloquea la aprobación mientras falten derechos y permite completarlos', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const historian = await createUser('historian@panorama.local', 'historian');
    const adminAuthorization = await authorizationFor(admin.email);
    const historianAuthorization = await authorizationFor(historian.email);
    const location = await createLocation();

    const created = await createDraft(adminAuthorization, location.id, {
      rightsDocumented: false,
      peopleBlurred: false,
      consentDocumented: false,
      licenseUrl: '',
      rightsNotes: '',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const panorama = created.body.data;
    assert.equal(panorama.rightsDocumented, false);

    const blocked = await request(app)
      .post(`/api/admin/panoramas/${panorama.id}/approve`)
      .set('Authorization', historianAuthorization)
      .set('If-Match', ifMatch(0));
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'RIGHTS_INCOMPLETE');
    assert.ok(Array.isArray(blocked.body.error.details));
    assert.ok(blocked.body.error.details.length >= 3);

    const updated = await request(app)
      .patch(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(0))
      .send({
        rightsDocumented: true,
        peopleBlurred: true,
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.data.version, 1);
    assert.equal(updated.body.data.rightsDocumented, true);

    const approved = await request(app)
      .post(`/api/admin/panoramas/${panorama.id}/approve`)
      .set('Authorization', historianAuthorization)
      .set('If-Match', ifMatch(1));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.data.status, 'approved');
  });

  it('separa panoramas de inspección y no los expone por la API turística', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const historian = await createUser('historian@panorama.local', 'historian');
    const adminAuthorization = await authorizationFor(admin.email);
    const historianAuthorization = await authorizationFor(historian.email);
    const location = await createLocation();

    const created = await createDraft(adminAuthorization, location.id, {
      visibility: 'inspection',
      title: 'Inspección del techo',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const panorama = created.body.data;

    const approved = await request(app)
      .post(`/api/admin/panoramas/${panorama.id}/approve`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(0));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));

    const published = await request(app)
      .post(`/api/admin/panoramas/${panorama.id}/publish`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(1));
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.data.visibility, 'inspection');

    const publicList = await request(app).get('/api/panoramas');
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.data.length, 0);

    assert.equal(
      (await request(app).get(`/api/panoramas/${panorama.id}`)).status,
      404,
    );
    assert.equal(
      (await request(app).get(`/api/panoramas/${panorama.id}/image`)).status,
      404,
    );

    const historianDetail = await request(app)
      .get(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', historianAuthorization);
    assert.equal(historianDetail.status, 404);

    const historianList = await request(app)
      .get('/api/admin/panoramas')
      .set('Authorization', historianAuthorization);
    assert.equal(historianList.status, 200);
    assert.equal(historianList.body.data.length, 0);

    const adminDetail = await request(app)
      .get(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', adminAuthorization);
    assert.equal(adminDetail.status, 200);
    assert.equal(adminDetail.body.data.visibility, 'inspection');

    const adminImage = await request(app)
      .get(`/api/admin/panoramas/${panorama.id}/image`)
      .set('Authorization', adminAuthorization);
    assert.equal(adminImage.status, 200);
    assert.match(adminImage.headers['cache-control'], /no-store/);
  });

  it('valida destinos de hotspots y solo permite enlaces internos', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const historian = await createUser('historian@panorama.local', 'historian');
    const adminAuthorization = await authorizationFor(admin.email);
    const historianAuthorization = await authorizationFor(historian.email);
    const location = await createLocation();

    const targetCreated = await createDraft(adminAuthorization, location.id, {
      title: 'Escena publicada',
    });
    const target = await approveAndPublish(
      historianAuthorization,
      targetCreated.body.data,
    );

    const sourceCreated = await createDraft(adminAuthorization, location.id, {
      title: 'Escena de origen',
    });
    const source = sourceCreated.body.data;

    const validHotspots = [
      {
        label: 'Ir a la escena publicada',
        type: 'scene',
        yaw: 20,
        pitch: -5,
        targetPanoramaId: target.id,
        ariaLabel: 'Ir a la escena publicada, panorama',
      },
      {
        label: 'Volver al POI',
        type: 'location',
        yaw: -30,
        pitch: 0,
        targetLocationId: location.id,
        ariaLabel: 'Volver a la ficha de la Plaza Bolívar',
      },
      {
        label: 'Más información',
        type: 'info',
        yaw: 0,
        pitch: 10,
        targetUrl: '/lugares/plaza-bolivar',
        ariaLabel: 'Abrir más información sobre la plaza',
      },
    ];

    const updated = await request(app)
      .patch(`/api/admin/panoramas/${source.id}`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ hotspots: validHotspots });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.data.hotspots.length, 3);
    assert.ok(updated.body.data.hotspots.every((hotspot) => hotspot.hotspotId));

    const draftTargetCreated = await createDraft(adminAuthorization, location.id, {
      title: 'Escena en borrador',
    });
    const draftTarget = draftTargetCreated.body.data;

    const unpublished = await request(app)
      .patch(`/api/admin/panoramas/${source.id}`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(1))
      .send({
        hotspots: [
          {
            label: 'Escena no publicada',
            type: 'scene',
            yaw: 0,
            pitch: 0,
            targetPanoramaId: draftTarget.id,
            ariaLabel: 'Ir a una escena no publicada',
          },
        ],
      });
    assert.equal(unpublished.status, 422);
    assert.equal(unpublished.body.error.code, 'INVALID_HOTSPOT');

    const external = await request(app)
      .patch(`/api/admin/panoramas/${source.id}`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(1))
      .send({
        hotspots: [
          {
            label: 'Enlace externo',
            type: 'info',
            yaw: 0,
            pitch: 0,
            targetUrl: 'https://example.com',
            ariaLabel: 'Abrir un enlace externo',
          },
        ],
      });
    assert.equal(external.status, 422);
    assert.match(external.body.error.message, /rutas internas/);

    const publishedSource = await approveAndPublish(historianAuthorization, {
      ...source,
      version: 1,
    });
    const detail = await request(app).get(`/api/panoramas/${publishedSource.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.hotspots.length, 3);
    assert.equal(detail.body.data.hotspots[0].targetPanoramaId, target.id);
    assert.equal(detail.body.data.hotspots[1].targetLocationId, location.id);
  });

  it('no sirve un derivado cuyo checksum no coincide', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const historian = await createUser('historian@panorama.local', 'historian');
    const adminAuthorization = await authorizationFor(admin.email);
    const historianAuthorization = await authorizationFor(historian.email);
    const location = await createLocation();

    const created = await createDraft(adminAuthorization, location.id);
    const published = await approveAndPublish(
      historianAuthorization,
      created.body.data,
    );

    fs.appendFileSync(
      panoramaFilePath(published.id, 'derivative.webp'),
      Buffer.from('alterado'),
    );

    const image = await request(app).get(
      `/api/panoramas/${published.id}/image`,
    );
    assert.equal(image.status, 503);
    assert.equal(image.body.error.code, 'PANORAMA_INTEGRITY_ERROR');

    const thumbnail = await request(app).get(
      `/api/panoramas/${published.id}/thumbnail`,
    );
    assert.equal(thumbnail.status, 200);

    fs.rmSync(panoramaFilePath(published.id, 'derivative.webp'));
    const missing = await request(app).get(
      `/api/panoramas/${published.id}/image`,
    );
    assert.equal(missing.status, 503);
    assert.equal(missing.body.error.code, 'PANORAMA_INTEGRITY_ERROR');
  });

  it('elimina EXIF y GPS de los archivos almacenados', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const adminAuthorization = await authorizationFor(admin.email);
    const location = await createLocation();
    const image = await makePanoramaImage({ exif: true });
    const inputMetadata = await sharp(image).metadata();
    assert.ok(inputMetadata.exif, 'La imagen de prueba debe contener EXIF');

    const created = await createDraft(
      adminAuthorization,
      location.id,
      {},
      image,
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const panorama = created.body.data;

    const originalMetadata = await sharp(
      panoramaFilePath(panorama.id, 'original.jpg'),
    ).metadata();
    const derivativeMetadata = await sharp(
      panoramaFilePath(panorama.id, 'derivative.webp'),
    ).metadata();
    const thumbnailMetadata = await sharp(
      panoramaFilePath(panorama.id, 'thumbnail.webp'),
    ).metadata();

    for (const metadata of [
      originalMetadata,
      derivativeMetadata,
      thumbnailMetadata,
    ]) {
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.gps, undefined);
    }
  });

  it('archiva una escena y la retira de la API pública', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const historian = await createUser('historian@panorama.local', 'historian');
    const adminAuthorization = await authorizationFor(admin.email);
    const historianAuthorization = await authorizationFor(historian.email);
    const location = await createLocation();

    const created = await createDraft(adminAuthorization, location.id);
    const published = await approveAndPublish(
      historianAuthorization,
      created.body.data,
    );

    const archived = await request(app)
      .post(`/api/admin/panoramas/${published.id}/archive`)
      .set('Authorization', historianAuthorization)
      .set('If-Match', ifMatch(published.version));
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    assert.equal(archived.body.data.status, 'archived');
    assert.ok(archived.body.data.archivedAt);

    assert.equal(
      (await request(app).get(`/api/panoramas/${published.id}`)).status,
      404,
    );
    assert.equal(
      (await request(app).get(`/api/panoramas/${published.id}/image`)).status,
      404,
    );

    const publicList = await request(app).get('/api/panoramas');
    assert.equal(publicList.body.data.length, 0);

    const again = await request(app)
      .post(`/api/admin/panoramas/${published.id}/archive`)
      .set('Authorization', historianAuthorization)
      .set('If-Match', ifMatch(archived.body.data.version));
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'INVALID_STATUS_TRANSITION');
  });

  it('exige versión y capacidades de gestión para editar', async () => {
    const admin = await createUser('admin@panorama.local', 'admin');
    const historian = await createUser('historian@panorama.local', 'historian');
    const user = await createUser('user@panorama.local', 'user');
    const adminAuthorization = await authorizationFor(admin.email);
    const historianAuthorization = await authorizationFor(historian.email);
    const userAuthorization = await authorizationFor(user.email);
    const location = await createLocation();

    const created = await createDraft(adminAuthorization, location.id);
    const panorama = created.body.data;

    const missing = await request(app)
      .patch(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', adminAuthorization)
      .send({ title: 'Otro título' });
    assert.equal(missing.status, 428);
    assert.equal(missing.body.error.code, 'VERSION_REQUIRED');

    const stale = await request(app)
      .patch(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(9))
      .send({ title: 'Otro título' });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'VERSION_CONFLICT');

    const historianEdit = await request(app)
      .patch(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', historianAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ title: 'Otro título' });
    assert.equal(historianEdit.status, 403);

    const userEdit = await request(app)
      .patch(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', userAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ title: 'Otro título' });
    assert.equal(userEdit.status, 403);

    const updated = await request(app)
      .patch(`/api/admin/panoramas/${panorama.id}`)
      .set('Authorization', adminAuthorization)
      .set('If-Match', ifMatch(0))
      .send({ title: 'Plaza Bolívar al atardecer' });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.data.title, 'Plaza Bolívar al atardecer');
    assert.equal(updated.body.data.version, 1);
    assert.match(updated.body.data.checksum, /^[a-f0-9]{64}$/);
  });
});
