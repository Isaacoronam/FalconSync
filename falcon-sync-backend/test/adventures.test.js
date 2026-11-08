import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27017/falconsync_adventures_test';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';

const { default: app } = await import('../src/app.js');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: Adventure } = await import('../src/models/Adventure.js');
const { default: AdventureStop } = await import(
  '../src/models/AdventureStop.js'
);
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { default: CheckIn } = await import('../src/models/CheckIn.js');
const { default: Location } = await import('../src/models/Location.js');
const { default: RefreshSession } = await import(
  '../src/models/RefreshSession.js'
);
const { default: User } = await import('../src/models/User.js');
const { ensureAdmin } = await import('../src/services/adminBootstrap.js');

const ADMIN_EMAIL = 'admin@aventuras-test.local';
const ADMIN_PASSWORD = 'AdminAventuras12345';
const USER_EMAIL = 'usuario@aventuras-test.local';
const USER_PASSWORD = 'UsuarioAventuras123';

const BASE_COORDINATES = [-69.6778, 11.4075];

let adminToken;
let userToken;

function asAdmin(requestBuilder) {
  return requestBuilder.set('Authorization', `Bearer ${adminToken}`);
}

function asUser(requestBuilder) {
  return requestBuilder.set('Authorization', `Bearer ${userToken}`);
}

async function login(email, password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.data.accessToken;
}

function poiPayload(overrides = {}) {
  return {
    title: 'POI de Aventura',
    category: 'architecture',
    description:
      'Punto de interés de prueba con una descripción suficientemente extensa.',
    address: 'Casco histórico de Coro, municipio Miranda',
    circuits: ['casco-historico'],
    tags: ['colonial'],
    latitude: BASE_COORDINATES[1],
    longitude: BASE_COORDINATES[0],
    conservationStatus: 'unknown',
    coordinateSource: 'Google Maps, Plus Code de prueba',
    coordinateVerifiedAt: '2026-11-01T00:00:00.000Z',
    verificationLevel: 'single-source',
    isProvisional: false,
    status: 'published',
    ...overrides,
  };
}

async function createLocation(overrides = {}) {
  const response = await asAdmin(
    request(app).post('/api/admin/locations'),
  ).send(poiPayload(overrides));

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data;
}

function adventurePayload(overrides = {}) {
  return {
    title: 'Ruta del Centro',
    summary: 'Recorrido de prueba por el centro histórico de Coro.',
    description:
      'Una aventura de prueba con varias paradas patrimoniales del centro de Coro.',
    difficulty: 'easy',
    estimatedMinutes: 90,
    badge: {
      name: 'Explorador del centro',
      description: 'Completa todas las paradas de la ruta.',
    },
    ...overrides,
  };
}

async function createAdventure(overrides = {}) {
  const response = await asAdmin(
    request(app).post('/api/admin/adventures'),
  ).send(adventurePayload(overrides));

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data;
}

async function addStop(adventureId, locationId, overrides = {}) {
  const response = await asAdmin(
    request(app).post(`/api/admin/adventures/${adventureId}/stops`),
  ).send({ locationId, ...overrides });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data;
}

async function publishAdventure(adventureId) {
  const response = await asAdmin(
    request(app).post(`/api/admin/adventures/${adventureId}/publish`),
  );

  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.data;
}

async function rotateQr(locationId, format = 'svg') {
  const response = await asAdmin(
    request(app).post(
      `/api/admin/locations/${locationId}/qr/rotate?format=${format}`,
    ),
  );

  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.data;
}

function checkInPayload(locationId, token, overrides = {}) {
  return {
    locationId,
    token,
    latitude: BASE_COORDINATES[1],
    longitude: BASE_COORDINATES[0],
    ...overrides,
  };
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function createAdventureWithThreeStops() {
  const locations = [];

  for (let index = 0; index < 3; index += 1) {
    locations.push(
      await createLocation({
        title: `Parada ${index + 1}`,
        slug: `parada-${index + 1}`,
        longitude: BASE_COORDINATES[0] + index * 0.0001,
        latitude: BASE_COORDINATES[1] + index * 0.0001,
      }),
    );
  }

  const adventure = await createAdventure({ slug: 'ruta-del-centro' });
  const stops = [];

  for (let index = 0; index < locations.length; index += 1) {
    stops.push(
      await addStop(adventure.id, locations[index].id, {
        order: index + 1,
        didacticText: `Texto didáctico de la parada ${index + 1}`,
      }),
    );
  }

  await publishAdventure(adventure.id);

  return { locations, adventure, stops };
}

describe('CoroAventura — aventuras, QR y check-in', () => {
  before(async () => {
    await connectDB();
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      Location.init(),
      Adventure.init(),
      AdventureStop.init(),
      CheckIn.init(),
      AuditLog.init(),
    ]);
    await Promise.all([
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
      Location.deleteMany({}),
      Adventure.deleteMany({}),
      AdventureStop.deleteMany({}),
      CheckIn.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    const admin = await ensureAdmin({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: 'Admin de Aventuras',
    });

    await User.updateOne(
      { _id: admin.user._id },
      { $set: { mustChangePassword: false } },
    );

    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    const registered = await request(app).post('/api/auth/register').send({
      name: 'Usuario de Aventuras',
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });

    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    userToken = registered.body.data.accessToken;
  });

  beforeEach(async () => {
    await Promise.all([
      CheckIn.deleteMany({}),
      AdventureStop.deleteMany({}),
      Adventure.deleteMany({}),
      Location.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  });

  after(async () => {
    await Promise.all([
      CheckIn.deleteMany({}),
      AdventureStop.deleteMany({}),
      Adventure.deleteMany({}),
      Location.deleteMany({}),
      AuditLog.deleteMany({}),
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
    ]);
    await disconnectDB();
  });

  it('protege la administración de aventuras', async () => {
    const anonymous = await request(app).get('/api/admin/adventures');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.error.code, 'AUTHENTICATION_REQUIRED');

    const regularUser = await asUser(
      request(app).get('/api/admin/adventures'),
    );
    assert.equal(regularUser.status, 403);
    assert.equal(regularUser.body.error.code, 'FORBIDDEN');

    const admin = await asAdmin(request(app).get('/api/admin/adventures'));
    assert.equal(admin.status, 200);
  });

  it('genera un QR SVG una sola vez y guarda solo el hash', async () => {
    const location = await createLocation({ title: 'Catedral QR' });

    const generated = await rotateQr(location.id);

    assert.match(generated.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(generated.tokenVersion, 1);
    assert.equal(generated.format, 'svg');
    assert.match(generated.qrDataUrl, /^data:image\/svg\+xml;base64,/);

    const svg = Buffer.from(
      generated.qrDataUrl.split(',')[1],
      'base64',
    ).toString('utf8');
    assert.match(svg, /^<svg/);

    const stored = await Location.findById(location.id).select(
      '+checkInTokenHash',
    );
    assert.equal(stored.checkInTokenHash, sha256(generated.token));
    assert.notEqual(stored.checkInTokenHash, generated.token);
    assert.equal(stored.checkInTokenVersion, 1);
    assert.ok(stored.checkInTokenRotatedAt);

    const adminDetail = await asAdmin(
      request(app).get(`/api/admin/locations/${location.id}`),
    );
    assert.equal(adminDetail.status, 200);
    assert.equal(adminDetail.body.data.checkInTokenHash, undefined);
    assert.equal(adminDetail.body.data.checkInTokenConfigured, true);
    assert.equal(adminDetail.body.data.token, undefined);

    const publicDetail = await request(app).get(
      `/api/locations/${location.slug}`,
    );
    assert.equal(publicDetail.status, 200);
    assert.equal(publicDetail.body.data.checkInTokenHash, undefined);
    assert.equal(publicDetail.body.data.token, undefined);

    const audit = await AuditLog.findOne({
      action: 'location.qr.rotated',
      entityId: location.id,
    });
    assert.ok(audit);
    assert.equal(audit.metadata.token, undefined);
    assert.equal(audit.metadata.tokenVersion, 1);
  });

  it('rotar invalida el token anterior y rechaza tokens inválidos', async () => {
    const location = await createLocation({ title: 'POI Rotación' });
    const first = await rotateQr(location.id);
    const second = await rotateQr(location.id, 'png');

    assert.notEqual(first.token, second.token);
    assert.equal(second.tokenVersion, 2);
    assert.match(second.qrDataUrl, /^data:image\/png;base64,/);

    const oldToken = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, first.token),
    );
    assert.equal(oldToken.status, 400);
    assert.equal(oldToken.body.error.code, 'INVALID_CHECK_IN_TOKEN');

    const invalidToken = await asUser(
      request(app).post('/api/check-ins'),
    ).send(checkInPayload(location.id, 'token-inventado'));

    assert.equal(invalidToken.status, 400);
    assert.equal(invalidToken.body.error.code, 'INVALID_CHECK_IN_TOKEN');

    const validToken = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, second.token),
    );
    assert.equal(validToken.status, 201, JSON.stringify(validToken.body));
    assert.equal(validToken.body.data.tokenVersion, 2);
  });

  it('registra un check-in válido dentro del radio y rechaza el duplicado', async () => {
    const location = await createLocation({ title: 'POI Check-in' });
    const { token } = await rotateQr(location.id);

    const anonymous = await request(app)
      .post('/api/check-ins')
      .send(checkInPayload(location.id, token));
    assert.equal(anonymous.status, 401);

    const created = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, token),
    );

    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.location, location.id);
    assert.equal(created.body.data.distanceMeters, 0);
    assert.equal(created.body.data.tokenVersion, 1);
    assert.deepEqual(created.body.data.coordinates.coordinates, BASE_COORDINATES);

    const duplicate = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, token),
    );

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'CHECK_IN_ALREADY_EXISTS');
    assert.equal(await CheckIn.countDocuments({ location: location.id }), 1);
  });

  it('rechaza un check-in fuera de la geocerca', async () => {
    const location = await createLocation({ title: 'POI Geocerca' });
    const { token } = await rotateQr(location.id);

    const response = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, token, {
        latitude: BASE_COORDINATES[1] + 0.01,
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'CHECK_IN_OUTSIDE_GEOFENCE');
    assert.equal(response.body.error.details.radiusMeters, 50);
    assert.ok(response.body.error.details.distanceMeters > 50);
    assert.equal(await CheckIn.countDocuments({}), 0);
  });

  it('rechaza el check-in en un POI provisional aunque tenga token vigente', async () => {
    const location = await createLocation({
      title: 'POI Provisional Check-in',
      slug: 'poi-provisional-check-in',
    });
    const { token } = await rotateQr(location.id);

    await Location.collection.updateOne(
      { slug: 'poi-provisional-check-in' },
      { $set: { isProvisional: true } },
    );

    const response = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, token),
    );

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'LOCATION_NOT_AVAILABLE');
    assert.equal(await CheckIn.countDocuments({}), 0);
  });

  it('rechaza el check-in de un POI excluido del catálogo', async () => {
    const location = await createLocation({
      title: 'POI Fuera del Catálogo',
      slug: 'poi-fuera-del-catalogo',
      isCatalogVisible: false,
    });
    const { token } = await rotateQr(location.id);

    const response = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, token),
    );

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'LOCATION_NOT_AVAILABLE');
    assert.equal(await CheckIn.countDocuments({}), 0);
  });

  it('permite configurar el radio entre 10 y 500 metros', async () => {
    const location = await createLocation({ title: 'POI Radio' });

    const updated = await asAdmin(
      request(app).patch(`/api/admin/locations/${location.id}`),
    ).send({ checkInRadiusMeters: 10 });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.checkInRadiusMeters, 10);

    const tooSmall = await asAdmin(
      request(app).patch(`/api/admin/locations/${location.id}`),
    ).send({ checkInRadiusMeters: 9 });
    assert.equal(tooSmall.status, 400);
    assert.equal(tooSmall.body.error.code, 'VALIDATION_ERROR');

    const tooLarge = await asAdmin(
      request(app).patch(`/api/admin/locations/${location.id}`),
    ).send({ checkInRadiusMeters: 501 });
    assert.equal(tooLarge.status, 400);

    const { token } = await rotateQr(location.id);
    const outside = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(location.id, token, {
        latitude: BASE_COORDINATES[1] + 0.0002,
      }),
    );

    assert.equal(outside.status, 400);
    assert.equal(outside.body.error.code, 'CHECK_IN_OUTSIDE_GEOFENCE');
    assert.equal(outside.body.error.details.radiusMeters, 10);
  });

  it('solo admite POI publicados como parada y bloquea archivar un POI en uso', async () => {
    const draft = await createLocation({
      title: 'POI Borrador',
      slug: 'poi-borrador',
      status: 'draft',
    });
    const draftAdventure = await createAdventure({ slug: 'ruta-borrador' });

    const invalidStop = await asAdmin(
      request(app).post(
        `/api/admin/adventures/${draftAdventure.id}/stops`,
      ),
    ).send({ locationId: draft.id });

    assert.equal(invalidStop.status, 409);
    assert.equal(invalidStop.body.error.code, 'LOCATION_NOT_PUBLISHED');

    const archivedPoi = await createLocation({
      title: 'POI Archivado',
      slug: 'poi-archivado',
    });
    const archiveResponse = await asAdmin(
      request(app).delete(`/api/admin/locations/${archivedPoi.id}`),
    );
    assert.equal(archiveResponse.status, 200);

    const archivedStop = await asAdmin(
      request(app).post(
        `/api/admin/adventures/${draftAdventure.id}/stops`,
      ),
    ).send({ locationId: archivedPoi.id });

    assert.equal(archivedStop.status, 409);
    assert.equal(archivedStop.body.error.code, 'LOCATION_NOT_PUBLISHED');

    const location = await createLocation({
      title: 'POI En Uso',
      slug: 'poi-en-uso',
    });
    const adventure = await createAdventure({ slug: 'ruta-en-uso' });
    await addStop(adventure.id, location.id, { order: 1 });
    await publishAdventure(adventure.id);

    const blockedDelete = await asAdmin(
      request(app).delete(`/api/admin/locations/${location.id}`),
    );
    assert.equal(blockedDelete.status, 409);
    assert.equal(blockedDelete.body.error.code, 'LOCATION_IN_USE');

    const blockedDraft = await asAdmin(
      request(app).patch(`/api/admin/locations/${location.id}`),
    ).send({ status: 'draft' });
    assert.equal(blockedDraft.status, 409);
    assert.equal(blockedDraft.body.error.code, 'LOCATION_IN_USE');

    const archivedAdventure = await asAdmin(
      request(app).delete(`/api/admin/adventures/${adventure.id}`),
    );
    assert.equal(archivedAdventure.status, 200);

    const allowedDelete = await asAdmin(
      request(app).delete(`/api/admin/locations/${location.id}`),
    );
    assert.equal(allowedDelete.status, 200);
    assert.equal(allowedDelete.body.data.status, 'archived');
  });

  it('oculta un POI provisional del API público y lo rechaza como parada', async () => {
    const location = await createLocation({
      title: 'POI Provisional Público',
      slug: 'poi-provisional-publico',
    });
    const adventure = await createAdventure({
      slug: 'ruta-provisional-publica',
    });

    await Location.collection.updateOne(
      { slug: 'poi-provisional-publico' },
      { $set: { isProvisional: true } },
    );

    const publicList = await request(app).get('/api/locations');
    assert.equal(publicList.body.meta.total, 0);

    const publicDetail = await request(app).get(
      '/api/locations/poi-provisional-publico',
    );
    assert.equal(publicDetail.status, 404);

    const stop = await asAdmin(
      request(app).post(`/api/admin/adventures/${adventure.id}/stops`),
    ).send({ locationId: location.id });

    assert.equal(stop.status, 409);
    assert.equal(stop.body.error.code, 'LOCATION_NOT_PUBLISHED');
  });

  it('rechaza como parada un POI excluido del catálogo', async () => {
    const location = await createLocation({
      title: 'Comercio Fuera del Catálogo',
      slug: 'comercio-fuera-del-catalogo',
      isCatalogVisible: false,
    });
    const adventure = await createAdventure({
      slug: 'ruta-comercio-no-visible',
    });

    const stop = await asAdmin(
      request(app).post(`/api/admin/adventures/${adventure.id}/stops`),
    ).send({ locationId: location.id });

    assert.equal(stop.status, 409);
    assert.equal(stop.body.error.code, 'LOCATION_NOT_PUBLISHED');
  });

  it('publica aventuras con paradas ordenadas y las expone solo si están publicadas', async () => {
    const first = await createLocation({
      title: 'Parada Primera',
      slug: 'parada-primera',
    });
    const second = await createLocation({
      title: 'Parada Segunda',
      slug: 'parada-segunda',
    });
    const adventure = await createAdventure({ slug: 'ruta-publicada' });

    const beforeStops = await asAdmin(
      request(app).post(`/api/admin/adventures/${adventure.id}/publish`),
    );
    assert.equal(beforeStops.status, 409);
    assert.equal(beforeStops.body.error.code, 'ADVENTURE_WITHOUT_STOPS');

    await addStop(adventure.id, second.id, { order: 2 });
    await addStop(adventure.id, first.id, { order: 1 });

    const hiddenList = await request(app).get('/api/adventures');
    assert.equal(hiddenList.body.meta.total, 0);
    assert.equal(
      (await request(app).get('/api/adventures/ruta-publicada')).status,
      404,
    );

    await publishAdventure(adventure.id);

    const publicList = await request(app).get('/api/adventures');
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.meta.total, 1);
    assert.equal(publicList.body.data[0].slug, 'ruta-publicada');
    assert.equal(publicList.body.data[0].stopsCount, 2);

    const detail = await request(app).get('/api/adventures/ruta-publicada');
    assert.equal(detail.status, 200);
    assert.deepEqual(
      detail.body.data.stops.map((stop) => stop.order),
      [1, 2],
    );
    assert.deepEqual(
      detail.body.data.stops.map((stop) => stop.location.slug),
      ['parada-primera', 'parada-segunda'],
    );
    assert.equal(detail.body.data.stops[0].location.checkInTokenHash, undefined);
    assert.equal(detail.body.data.createdBy, undefined);

    const archived = await asAdmin(
      request(app).post(`/api/admin/adventures/${adventure.id}/archive`),
    );
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.status, 'archived');

    const afterArchive = await request(app).get('/api/adventures');
    assert.equal(afterArchive.body.meta.total, 0);
    assert.equal(
      (await request(app).get('/api/adventures/ruta-publicada')).status,
      404,
    );
  });

  it('calcula progreso con check-in en cualquier orden, siguiente parada y cierre', async () => {
    const { locations, adventure } = await createAdventureWithThreeStops();
    const tokens = [];

    for (const location of locations) {
      tokens.push((await rotateQr(location.id)).token);
    }

    const second = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(locations[1].id, tokens[1]),
    );
    assert.equal(second.status, 201);

    const first = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(locations[0].id, tokens[0]),
    );
    assert.equal(first.status, 201);

    const partial = await asUser(
      request(app).get(`/api/adventures/${adventure.slug}/progress`),
    );

    assert.equal(partial.status, 200, JSON.stringify(partial.body));
    assert.equal(partial.body.data.totalStops, 3);
    assert.equal(partial.body.data.visitedStops, 2);
    assert.equal(partial.body.data.remainingStops, 1);
    assert.equal(partial.body.data.percentage, 67);
    assert.equal(partial.body.data.completed, false);
    assert.equal(partial.body.data.completedAt, null);
    assert.equal(partial.body.data.nextStop.order, 3);
    assert.equal(partial.body.data.nextStop.location.id, locations[2].id);
    assert.deepEqual(
      partial.body.data.stops.map((stop) => stop.visited),
      [true, true, false],
    );

    const third = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(locations[2].id, tokens[2]),
    );
    assert.equal(third.status, 201);

    const completed = await asUser(
      request(app).get(`/api/adventures/${adventure.slug}/progress`),
    );

    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.visitedStops, 3);
    assert.equal(completed.body.data.percentage, 100);
    assert.equal(completed.body.data.completed, true);
    assert.equal(completed.body.data.nextStop, null);
    assert.ok(completed.body.data.completedAt);
  });

  it('comparte el check-in global entre aventuras que usan el mismo POI', async () => {
    const { locations, adventure } = await createAdventureWithThreeStops();
    const secondAdventure = await createAdventure({
      title: 'Segunda Ruta',
      slug: 'segunda-ruta',
      summary: 'Otra ruta de prueba que reutiliza las mismas paradas.',
    });

    await addStop(secondAdventure.id, locations[0].id, { order: 1 });
    await addStop(secondAdventure.id, locations[1].id, { order: 2 });
    await publishAdventure(secondAdventure.id);

    const { token } = await rotateQr(locations[0].id);
    const checkIn = await asUser(request(app).post('/api/check-ins')).send(
      checkInPayload(locations[0].id, token),
    );
    assert.equal(checkIn.status, 201);

    const firstProgress = await asUser(
      request(app).get(`/api/adventures/${adventure.slug}/progress`),
    );
    const secondProgress = await asUser(
      request(app).get(`/api/adventures/${secondAdventure.slug}/progress`),
    );

    assert.equal(firstProgress.body.data.visitedStops, 1);
    assert.equal(firstProgress.body.data.percentage, 33);
    assert.equal(secondProgress.body.data.visitedStops, 1);
    assert.equal(secondProgress.body.data.percentage, 50);
    assert.equal(secondProgress.body.data.nextStop.order, 2);
  });

  it('reordena paradas de forma atómica y valida la lista completa', async () => {
    const first = await createLocation({ title: 'Reordenar Uno', slug: 'reordenar-uno' });
    const second = await createLocation({ title: 'Reordenar Dos', slug: 'reordenar-dos' });
    const third = await createLocation({ title: 'Reordenar Tres', slug: 'reordenar-tres' });
    const adventure = await createAdventure({ slug: 'ruta-reordenar' });

    const stopOne = await addStop(adventure.id, first.id, { order: 1 });
    const stopTwo = await addStop(adventure.id, second.id, { order: 2 });
    const stopThree = await addStop(adventure.id, third.id, { order: 3 });

    const invalid = await asAdmin(
      request(app).put(
        `/api/admin/adventures/${adventure.id}/stops/reorder`,
      ),
    ).send({ order: [stopOne.id, stopTwo.id] });

    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

    const reordered = await asAdmin(
      request(app).put(
        `/api/admin/adventures/${adventure.id}/stops/reorder`,
      ),
    ).send({ order: [stopThree.id, stopOne.id, stopTwo.id] });

    assert.equal(reordered.status, 200, JSON.stringify(reordered.body));

    const detail = await asAdmin(
      request(app).get(`/api/admin/adventures/${adventure.id}`),
    );
    assert.deepEqual(
      detail.body.data.stops.map((stop) => stop.order),
      [1, 2, 3],
    );
    assert.deepEqual(
      detail.body.data.stops.map((stop) => stop.id),
      [stopThree.id, stopOne.id, stopTwo.id],
    );
  });

  it('audita creación, edición, archivo y restauración de aventuras', async () => {
    const adventure = await createAdventure({ slug: 'ruta-auditada' });

    const updated = await asAdmin(
      request(app).patch(`/api/admin/adventures/${adventure.id}`),
    ).send({
      title: 'Ruta Auditada Actualizada',
      difficulty: 'moderate',
      badge: {
        name: 'Guardián del patrimonio',
        description: 'Insignia de prueba',
      },
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.difficulty, 'moderate');
    assert.equal(updated.body.data.badge.name, 'Guardián del patrimonio');

    const archived = await asAdmin(
      request(app).delete(`/api/admin/adventures/${adventure.id}`),
    );
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.status, 'archived');
    assert.ok(archived.body.data.deletedAt);
    assert.equal(archived.body.data.createdBy, undefined);

    const restored = await asAdmin(
      request(app).post(`/api/admin/adventures/${adventure.id}/restore`),
    );
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.status, 'draft');
    assert.equal(restored.body.data.deletedAt, null);

    const actions = await AuditLog.find({
      entityId: adventure.id,
    }).distinct('action');

    assert.deepEqual(actions.sort(), [
      'adventure.archived',
      'adventure.created',
      'adventure.restored',
      'adventure.updated',
    ]);
  });

  it('rechaza el QR en un formato desconocido', async () => {
    const location = await createLocation({ title: 'POI Formato QR' });
    const response = await asAdmin(
      request(app).post(
        `/api/admin/locations/${location.id}/qr/rotate?format=gif`,
      ),
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_QR_FORMAT');
  });
});
