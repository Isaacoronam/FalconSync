import assert from 'node:assert/strict';
import { access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27017/falconsync_admin_test';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';
process.env.UPLOAD_DIR = path.join(
  os.tmpdir(),
  `falconsync-admin-test-uploads-${process.pid}`,
);

const { default: app } = await import('../src/app.js');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { config } = await import('../src/config/env.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { default: Location } = await import('../src/models/Location.js');
const { default: RefreshSession } = await import(
  '../src/models/RefreshSession.js'
);
const { default: User } = await import('../src/models/User.js');
const { ensureAdmin } = await import('../src/services/adminBootstrap.js');

const ADMIN_EMAIL = 'admin@admin-test.local';
const ADMIN_PASSWORD = 'AdminSegura12345';
const USER_PASSWORD = 'UsuarioSegura123';
const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let adminToken;
let userToken;

function poiPayload(overrides = {}) {
  return {
    title: 'Casa de Prueba',
    category: 'architecture',
    description:
      'Inmueble de prueba con una descripción suficientemente extensa.',
    latitude: 11.4075,
    longitude: -69.6778,
    conservationStatus: 'unknown',
    isProvisional: false,
    status: 'published',
    ...overrides,
  };
}

function asAdmin(requestBuilder) {
  return requestBuilder.set('Authorization', `Bearer ${adminToken}`);
}

async function login(email, password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  assert.equal(response.status, 200);
  return response.body.data.accessToken;
}

async function createLocation(overrides = {}) {
  const response = await asAdmin(
    request(app).post('/api/admin/locations'),
  ).send(poiPayload(overrides));

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data;
}

describe('Administración de POI', () => {
  before(async () => {
    await connectDB();
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      Location.init(),
      AuditLog.init(),
    ]);
    await Promise.all([
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
      Location.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    const admin = await ensureAdmin({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: 'Admin de Pruebas',
    });

    await User.updateOne(
      { _id: admin.user._id },
      { $set: { mustChangePassword: false } },
    );

    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    const registered = await request(app).post('/api/auth/register').send({
      name: 'Usuario de Pruebas',
      email: 'usuario@admin-test.local',
      password: USER_PASSWORD,
    });

    assert.equal(registered.status, 201);
    userToken = registered.body.data.accessToken;
  });

  beforeEach(async () => {
    await Promise.all([Location.deleteMany({}), AuditLog.deleteMany({})]);
  });

  after(async () => {
    await Promise.all([
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
      Location.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    await disconnectDB();
    await rm(config.uploads.dir, { recursive: true, force: true });
  });

  it('exige autenticación y rol admin', async () => {
    const anonymous = await request(app).get('/api/admin/locations');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.error.code, 'AUTHENTICATION_REQUIRED');

    const regularUser = await request(app)
      .get('/api/admin/locations')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(regularUser.status, 403);
    assert.equal(regularUser.body.error.code, 'FORBIDDEN');
  });

  it('devuelve un resumen con estados y actividad reciente', async () => {
    await createLocation();

    const response = await asAdmin(request(app).get('/api/admin/summary'));

    assert.equal(response.status, 200);
    assert.equal(response.body.data.locations, 1);
    assert.deepEqual(response.body.data.locationsByStatus, {
      published: 1,
      draft: 0,
      archived: 0,
    });
    assert.equal(response.body.data.recentActivity.length, 1);
    assert.equal(
      response.body.data.recentActivity[0].action,
      'location.created',
    );
  });

  it('crea un POI, genera el slug y registra auditoría', async () => {
    const location = await createLocation({
      title: 'Catedral de Prueba',
      latitude: 11.4075246,
      longitude: -69.6778073,
    });

    assert.equal(location.slug, 'catedral-de-prueba');
    assert.equal(location.status, 'published');
    assert.deepEqual(location.location.coordinates, [
      -69.6778073, 11.4075246,
    ]);

    const stored = await Location.findById(location.id);
    assert.ok(stored);
    assert.ok(stored.createdBy);
    assert.ok(stored.updatedBy);

    const audit = await asAdmin(request(app).get('/api/admin/audit'));
    assert.equal(audit.status, 200);
    assert.equal(audit.body.data[0].action, 'location.created');
    assert.equal(audit.body.data[0].entityId, location.id);
  });

  it('rechaza coordenadas fuera de Falcón y datos inválidos', async () => {
    const outside = await asAdmin(
      request(app).post('/api/admin/locations'),
    ).send(poiPayload({ latitude: 10.4806, longitude: -66.9036 }));

    assert.equal(outside.status, 400);
    assert.equal(outside.body.error.code, 'VALIDATION_ERROR');
    assert.ok(
      outside.body.error.details.some((detail) =>
        detail.includes('estado Falcón'),
      ),
    );

    const invalidCategory = await asAdmin(
      request(app).post('/api/admin/locations'),
    ).send(poiPayload({ category: 'inventada' }));

    assert.equal(invalidCategory.status, 400);

    const unsafeImage = await asAdmin(
      request(app).post('/api/admin/locations'),
    ).send(poiPayload({ images: ['javascript:alert(1)'] }));

    assert.equal(unsafeImage.status, 400);
  });

  it('rechaza slugs duplicados', async () => {
    await createLocation();

    const duplicate = await asAdmin(
      request(app).post('/api/admin/locations'),
    ).send(poiPayload({ title: 'Otra Casa', slug: 'casa-de-prueba' }));

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'DUPLICATE_SLUG');
  });

  it('lista, busca y filtra por estado y categoría', async () => {
    await createLocation({ title: 'Casa de Prueba', status: 'published' });
    await createLocation({
      title: 'Plaza de Prueba',
      slug: 'plaza-de-prueba',
      category: 'urban',
      status: 'draft',
    });

    const published = await asAdmin(
      request(app).get('/api/admin/locations?status=published'),
    );
    assert.equal(published.body.meta.total, 1);
    assert.equal(published.body.data[0].slug, 'casa-de-prueba');

    const search = await asAdmin(
      request(app).get('/api/admin/locations?q=plaza'),
    );
    assert.equal(search.body.meta.total, 1);
    assert.equal(search.body.data[0].title, 'Plaza de Prueba');

    const urban = await asAdmin(
      request(app).get('/api/admin/locations?category=urban'),
    );
    assert.equal(urban.body.meta.total, 1);
  });

  it('actualiza un POI, guarda el cambio y audita los campos', async () => {
    const location = await createLocation({ status: 'draft' });

    const response = await asAdmin(
      request(app).patch(`/api/admin/locations/${location.id}`),
    ).send({
      title: 'Casa Actualizada',
      status: 'published',
      conservationStatus: 'fair',
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.title, 'Casa Actualizada');
    assert.equal(response.body.data.status, 'published');
    assert.equal(response.body.data.conservationStatus, 'fair');

    const audit = await AuditLog.findOne({
      action: 'location.updated',
      entityId: location.id,
    });
    assert.ok(audit);
    assert.deepEqual(audit.metadata.changedFields.sort(), [
      'conservationStatus',
      'status',
      'title',
    ]);
  });

  it('archiva con borrado lógico, oculta del API público y restaura', async () => {
    const location = await createLocation();

    const deleted = await asAdmin(
      request(app).delete(`/api/admin/locations/${location.id}`),
    );

    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.status, 'archived');
    assert.ok(deleted.body.data.deletedAt);

    const publicList = await request(app).get('/api/locations');
    assert.equal(publicList.body.meta.total, 0);

    const publicDetail = await request(app).get(
      `/api/locations/${location.slug}`,
    );
    assert.equal(publicDetail.status, 404);

    const archived = await asAdmin(
      request(app).get('/api/admin/locations?status=archived'),
    );
    assert.equal(archived.body.meta.total, 1);

    const blockedEdit = await asAdmin(
      request(app).patch(`/api/admin/locations/${location.id}`),
    ).send({ title: 'No debería guardarse' });
    assert.equal(blockedEdit.status, 409);
    assert.equal(blockedEdit.body.error.code, 'LOCATION_ARCHIVED');

    const restored = await asAdmin(
      request(app).post(`/api/admin/locations/${location.id}/restore`),
    );
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.status, 'draft');
    assert.equal(restored.body.data.deletedAt, null);

    const publicAfterRestore = await request(app).get('/api/locations');
    assert.equal(publicAfterRestore.body.meta.total, 0);
  });

  it('sube, sirve y elimina una imagen validada', async () => {
    const location = await createLocation();

    const uploaded = await asAdmin(
      request(app)
        .post(`/api/admin/locations/${location.id}/images`)
        .attach('image', PNG_PIXEL, {
          filename: 'pixel.png',
          contentType: 'image/png',
        }),
    );

    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.data.images.length, 1);
    assert.match(
      uploaded.body.data.images[0],
      /^\/api\/uploads\/locations\/[A-Za-z0-9._-]+\.png$/,
    );

    const imageUrl = uploaded.body.data.images[0];
    const relativePath = imageUrl.replace('/api/uploads/', '');
    await access(path.join(config.uploads.dir, relativePath));

    const served = await request(app).get(imageUrl);
    assert.equal(served.status, 200);
    assert.match(served.headers['content-type'], /image\/png/);

    const removed = await asAdmin(
      request(app)
        .delete(`/api/admin/locations/${location.id}/images`)
        .send({ url: imageUrl }),
    );

    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.data.images, []);
    await assert.rejects(access(path.join(config.uploads.dir, relativePath)));
  });

  it('rechaza archivos que no son imágenes reales', async () => {
    const location = await createLocation();

    const fake = await asAdmin(
      request(app)
        .post(`/api/admin/locations/${location.id}/images`)
        .attach('image', Buffer.from('esto no es una imagen'), {
          filename: 'falsa.png',
          contentType: 'image/png',
        }),
    );

    assert.equal(fake.status, 400);
    assert.equal(fake.body.error.code, 'INVALID_IMAGE');

    const wrongType = await asAdmin(
      request(app)
        .post(`/api/admin/locations/${location.id}/images`)
        .attach('image', Buffer.from('texto'), {
          filename: 'nota.txt',
          contentType: 'text/plain',
        }),
    );

    assert.equal(wrongType.status, 400);
    assert.equal(wrongType.body.error.code, 'INVALID_IMAGE_TYPE');
  });
});
