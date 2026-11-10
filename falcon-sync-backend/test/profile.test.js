import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27017/falconsync_profile_test';
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
const { default: CheckIn } = await import('../src/models/CheckIn.js');
const { default: Location } = await import('../src/models/Location.js');
const { default: User } = await import('../src/models/User.js');
const { default: mongoose } = await import('mongoose');
const { createCheckInToken, hashCheckInToken } = await import(
  '../src/services/checkInTokenService.js'
);

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PASSWORD = 'PerfilSeguro123';
const LOCATION_COORDINATES = [-69.6778, 11.4075];

let location;
let checkInToken;
let userCounter = 0;

function uniqueEmail(prefix) {
  userCounter += 1;
  return `${prefix}-${userCounter}@perfil-test.local`;
}

async function registerUser(prefix) {
  const email = uniqueEmail(prefix);
  const response = await request(app).post('/api/auth/register').send({
    name: `Usuario ${prefix}`,
    email,
    password: PASSWORD,
  });

  assert.equal(response.status, 201, JSON.stringify(response.body));

  return {
    email,
    token: response.body.data.accessToken,
    user: response.body.data.user,
  };
}

function asUser(token, requestBuilder) {
  return requestBuilder.set('Authorization', `Bearer ${token}`);
}

describe('Perfil privado y fotos de check-in', () => {
  before(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    await Promise.all([
      User.init(),
      Location.init(),
      CheckIn.init(),
      Adventure.init(),
      AdventureStop.init(),
    ]);

    checkInToken = createCheckInToken();
    location = await Location.create({
      title: 'POI de Perfil',
      slug: 'poi-de-perfil',
      category: 'museum',
      description:
        'Punto de interés de prueba para verificar el perfil privado y sus fotos.',
      address: 'Casco histórico de Coro',
      circuits: ['casco-historico'],
      tags: ['colonial'],
      location: {
        type: 'Point',
        coordinates: LOCATION_COORDINATES,
      },
      conservationStatus: 'unknown',
      coordinateSource: 'Prueba automatizada',
      coordinateVerifiedAt: new Date(),
      verificationLevel: 'single-source',
      status: 'published',
      checkInTokenHash: hashCheckInToken(checkInToken),
      checkInTokenVersion: 1,
      checkInRadiusMeters: 100,
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('exige autenticación y no expone el perfil sin sesión', async () => {
    const response = await request(app).get('/api/profile/me');
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
  });

  it('genera el nombre de usuario al registrarse y devuelve un perfil privado', async () => {
    const { token, user, email } = await registerUser('privado');

    assert.ok(user.username);
    assert.match(user.username, /^[a-z0-9][a-z0-9._-]+$/);

    const profileResponse = await asUser(token, request(app).get('/api/profile/me'));
    assert.equal(profileResponse.status, 200, JSON.stringify(profileResponse.body));

    const { profile, stats, recentCheckIns } = profileResponse.body.data;
    assert.equal(profile.email, email);
    assert.equal(profile.username, user.username);
    assert.equal(profile.bio, '');
    assert.equal(profile.hasAvatar, false);
    assert.equal(profile.avatarUrl, null);
    assert.equal(stats.totalCheckIns, 0);
    assert.equal(stats.completedAdventures, 0);
    assert.deepEqual(recentCheckIns, []);
    assert.equal(profileResponse.body.data.profile.passwordHash, undefined);

    const authMe = await asUser(token, request(app).get('/api/auth/me'));
    assert.equal(authMe.status, 200);
    assert.equal(authMe.body.data.user.username, user.username);
  });

  it('actualiza nombre, usuario y biografía, y rechaza usuarios duplicados o inválidos', async () => {
    const first = await registerUser('edicion');
    const second = await registerUser('duplicado');

    const updated = await asUser(
      first.token,
      request(app).patch('/api/profile/me'),
    ).send({
      name: 'Nombre Editado',
      username: 'cronista.coro',
      bio: 'Explorador del casco histórico.',
    });

    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.data.profile.name, 'Nombre Editado');
    assert.equal(updated.body.data.profile.username, 'cronista.coro');
    assert.equal(
      updated.body.data.profile.bio,
      'Explorador del casco histórico.',
    );

    const duplicate = await asUser(
      second.token,
      request(app).patch('/api/profile/me'),
    ).send({ username: 'cronista.coro' });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'USERNAME_IN_USE');

    const invalid = await asUser(
      first.token,
      request(app).patch('/api/profile/me'),
    ).send({ username: 'No Válido' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

    const longBio = await asUser(
      first.token,
      request(app).patch('/api/profile/me'),
    ).send({ bio: 'a'.repeat(281) });
    assert.equal(longBio.status, 400);
  });

  it('sube un avatar privado, lo sirve con sesión y lo elimina', async () => {
    const { token } = await registerUser('avatar');

    const upload = await asUser(token, request(app).post('/api/profile/avatar')).attach(
      'image',
      PNG_PIXEL,
      { filename: 'avatar.png', contentType: 'image/png' },
    );

    assert.equal(upload.status, 200, JSON.stringify(upload.body));
    assert.equal(upload.body.data.profile.hasAvatar, true);
    assert.match(upload.body.data.profile.avatarUrl, /^\/api\/profile\/avatar\?v=\d+$/);

    const avatar = await asUser(token, request(app).get('/api/profile/avatar'));
    assert.equal(avatar.status, 200);
    assert.match(avatar.headers['content-type'], /image\/png/);
    assert.match(avatar.headers['cache-control'], /private/);

    const anonymousAvatar = await request(app).get('/api/profile/avatar');
    assert.equal(anonymousAvatar.status, 401);

    const user = await User.findOne({ email: { $regex: /^avatar-/ } }).select(
      '+avatarFilename',
    );
    const publicLeak = await request(app).get(
      `/api/uploads/avatars/${user.avatarFilename}`,
    );
    assert.equal(publicLeak.status, 404);

    const removed = await asUser(
      token,
      request(app).delete('/api/profile/avatar'),
    );
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.profile.hasAvatar, false);

    const missing = await asUser(token, request(app).get('/api/profile/avatar'));
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'AVATAR_NOT_FOUND');
  });

  it('registra un check-in con foto y la sirve solo a su dueño', async () => {
    const owner = await registerUser('foto');
    const stranger = await registerUser('ajeno');

    const checkIn = await asUser(owner.token, request(app).post('/api/check-ins'))
      .field('locationId', location.id)
      .field('token', checkInToken)
      .field('latitude', String(LOCATION_COORDINATES[1]))
      .field('longitude', String(LOCATION_COORDINATES[0]))
      .attach('image', PNG_PIXEL, {
        filename: 'visita.png',
        contentType: 'image/png',
      });

    assert.equal(checkIn.status, 201, JSON.stringify(checkIn.body));
    assert.equal(checkIn.body.data.photo.mimeType, 'image/png');
    assert.ok(checkIn.body.data.photo.filename);

    const profileResponse = await asUser(
      owner.token,
      request(app).get('/api/profile/me'),
    );
    assert.equal(profileResponse.status, 200);
    assert.equal(profileResponse.body.data.stats.totalCheckIns, 1);
    assert.equal(profileResponse.body.data.recentCheckIns.length, 1);

    const recent = profileResponse.body.data.recentCheckIns[0];
    assert.equal(recent.photoAvailable, true);
    assert.equal(recent.location.slug, 'poi-de-perfil');
    assert.match(
      recent.photoUrl,
      /^\/api\/profile\/check-ins\/[a-f0-9]+\/photo\?v=\d+$/,
    );

    const photo = await asUser(owner.token, request(app).get(recent.photoUrl));
    assert.equal(photo.status, 200);
    assert.match(photo.headers['content-type'], /image\/png/);

    const otherUserPhoto = await asUser(
      stranger.token,
      request(app).get(recent.photoUrl),
    );
    assert.equal(otherUserPhoto.status, 404);
    assert.equal(otherUserPhoto.body.error.code, 'CHECK_IN_PHOTO_NOT_FOUND');

    const anonymousPhoto = await request(app).get(recent.photoUrl);
    assert.equal(anonymousPhoto.status, 401);
  });

  it('conserva el resumen de progreso legado sin generar insignias de recorrido', async () => {
    const { token } = await registerUser('aventura');

    const adventure = await Adventure.create({
      title: 'Aventura de Perfil',
      slug: 'aventura-de-perfil',
      summary: 'Aventura de prueba para el resumen del perfil privado.',
      description:
        'Aventura de prueba con una sola parada para verificar el cálculo de progreso del perfil.',
      difficulty: 'easy',
      estimatedMinutes: 30,
      status: 'published',
    });
    await AdventureStop.create({
      adventure: adventure._id,
      location: location._id,
      order: 1,
      didacticText: 'Parada única de prueba.',
    });

    const checkIn = await asUser(token, request(app).post('/api/check-ins')).send({
      locationId: location.id,
      token: checkInToken,
      latitude: LOCATION_COORDINATES[1],
      longitude: LOCATION_COORDINATES[0],
    });
    assert.equal(checkIn.status, 201, JSON.stringify(checkIn.body));

    const profileResponse = await asUser(
      token,
      request(app).get('/api/profile/me'),
    );
    assert.equal(profileResponse.status, 200);

    const { stats, adventures } = profileResponse.body.data;
    assert.equal(stats.totalCheckIns, 1);
    assert.equal(stats.totalAdventures, 1);
    assert.equal(stats.startedAdventures, 1);
    assert.equal(stats.completedAdventures, 0);
    assert.equal(stats.totalStops, 1);
    assert.equal(stats.visitedStops, 1);

    const summary = adventures.find(
      (item) => item.slug === 'aventura-de-perfil',
    );
    assert.ok(summary);
    assert.equal(summary.percentage, 100);
    assert.equal(summary.completed, true);
    assert.ok(summary.lastVisitAt);
  });
});
