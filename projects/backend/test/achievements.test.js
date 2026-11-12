import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27017/falconsync_achievements_test';
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
const { default: UserAchievement } = await import(
  '../src/models/UserAchievement.js'
);
const { default: mongoose } = await import('mongoose');
const { createCheckInToken, hashCheckInToken } = await import(
  '../src/services/checkInTokenService.js'
);
const { reconcileUserAchievements } = await import(
  '../src/services/achievementService.js'
);

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PASSWORD = 'LogrosSeguro123';
const BASE_COORDINATES = [-69.6778, 11.4075];

let counter = 0;

function unique(prefix) {
  counter += 1;
  return `${prefix}-${counter}`;
}

async function registerUser(prefix) {
  const email = `${unique(prefix)}@logros-test.local`;
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

async function createLocation({ title, category = 'museum' } = {}) {
  const slug = unique('poi');
  const token = createCheckInToken();
  const location = await Location.create({
    title: title ?? `POI ${slug}`,
    slug,
    category,
    description:
      'Punto de interés de prueba para verificar las insignias y la galería privada.',
    address: 'Casco histórico de Coro',
    circuits: ['casco-historico'],
    tags: ['colonial'],
    location: {
      type: 'Point',
      coordinates: BASE_COORDINATES,
    },
    conservationStatus: 'unknown',
    coordinateSource: 'Prueba automatizada',
    coordinateVerifiedAt: new Date(),
    verificationLevel: 'single-source',
    status: 'published',
    checkInTokenHash: hashCheckInToken(token),
    checkInTokenVersion: 1,
    checkInRadiusMeters: 100,
  });

  return { location, token };
}

async function createAdventure({
  title = 'Recorrido de prueba',
  badge,
  status = 'published',
} = {}) {
  const slug = unique('recorrido');
  const adventure = await Adventure.create({
    title: `${title} ${slug}`,
    slug,
    summary: 'Recorrido de prueba para verificar el otorgamiento de insignias.',
    description:
      'Recorrido de prueba con paradas publicadas para validar el cierre y la persistencia de la insignia.',
    difficulty: 'easy',
    estimatedMinutes: 30,
    badge,
    status,
  });

  return adventure;
}

async function addStop(adventure, location, order) {
  return AdventureStop.create({
    adventure: adventure._id,
    location: location._id,
    order,
    didacticText: `Parada ${order} de prueba.`,
  });
}

function checkInPayload(location, token) {
  return {
    locationId: location.id,
    token,
    latitude: BASE_COORDINATES[1],
    longitude: BASE_COORDINATES[0],
  };
}

async function createCheckIn(userToken, location, token) {
  return asUser(userToken, request(app).post('/api/check-ins')).send(
    checkInPayload(location, token),
  );
}

describe('Insignias, check-in en dos fases y galería privada', () => {
  before(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    await Promise.all([
      User.init(),
      Location.init(),
      CheckIn.init(),
      Adventure.init(),
      AdventureStop.init(),
      UserAchievement.init(),
    ]);
  });

  after(async () => {
    await disconnectDB();
  });

  it('otorga la insignia de lugar una sola vez y reconcilia un duplicado', async () => {
    const user = await registerUser('lugar');
    const { location, token } = await createLocation({
      title: 'Catedral de Prueba',
      category: 'religious',
    });

    const created = await createCheckIn(user.token, location, token);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.achievementsAwarded.length, 1);
    assert.equal(created.body.achievementsAwarded[0].type, 'location');
    assert.equal(
      created.body.achievementsAwarded[0].name,
      'Catedral de Prueba',
    );
    assert.equal(
      created.body.achievementsAwarded[0].category,
      'religious',
    );
    assert.equal(await UserAchievement.countDocuments({ user: user.user.id }), 1);

    const duplicate = await createCheckIn(user.token, location, token);
    assert.equal(duplicate.status, 409);
    assert.equal(await UserAchievement.countDocuments({ user: user.user.id }), 1);

    // Si el otorgamiento falló en el pasado, el reintento lo repara sin
    // duplicar la insignia.
    await UserAchievement.deleteMany({ user: user.user.id });
    const repair = await createCheckIn(user.token, location, token);
    assert.equal(repair.status, 409);
    assert.equal(await UserAchievement.countDocuments({ user: user.user.id }), 1);

    const profile = await asUser(
      user.token,
      request(app).get('/api/profile/me'),
    );
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.stats.totalAchievements, 1);
    assert.equal(profile.body.data.stats.locationAchievements, 1);
    assert.equal(profile.body.data.stats.adventureAchievements, 0);
    assert.equal(profile.body.data.achievements[0].sourceActive, true);
    assert.equal(profile.body.data.achievements[0].sourceSlug, location.slug);
  });

  it('otorga solo insignias de lugar aunque se complete un recorrido heredado', async () => {
    const user = await registerUser('recorrido');
    const first = await createLocation({ title: 'Parada Uno' });
    const second = await createLocation({ title: 'Parada Dos' });
    const adventure = await createAdventure({
      title: 'Ruta de las Dos Paradas',
      badge: {
        name: 'Guardián del Casco',
        description: 'Completa las dos paradas del recorrido.',
        image: '/images/locations/insignia-prueba.svg',
      },
    });

    await addStop(adventure, first.location, 1);
    await addStop(adventure, second.location, 2);

    const firstCheckIn = await createCheckIn(
      user.token,
      first.location,
      first.token,
    );
    assert.equal(firstCheckIn.status, 201, JSON.stringify(firstCheckIn.body));
    assert.equal(firstCheckIn.body.achievementsAwarded.length, 1);

    const secondCheckIn = await createCheckIn(
      user.token,
      second.location,
      second.token,
    );
    assert.equal(secondCheckIn.status, 201, JSON.stringify(secondCheckIn.body));
    assert.deepEqual(
      secondCheckIn.body.achievementsAwarded.map((award) => award.type),
      ['location'],
    );

    const progress = await asUser(
      user.token,
      request(app).get(`/api/adventures/${adventure.slug}/progress`),
    );
    assert.equal(progress.status, 200);
    assert.equal(progress.body.data.achievement, null);

    const profile = await asUser(
      user.token,
      request(app).get('/api/profile/me'),
    );
    assert.equal(profile.body.data.stats.totalAchievements, 2);
    assert.equal(profile.body.data.stats.adventureAchievements, 0);
    assert.equal(profile.body.data.stats.completedAdventures, 0);

    // El backfill reconstruye solo insignias de lugar y es idempotente.
    await UserAchievement.deleteMany({ user: user.user.id });
    const rebuilt = await reconcileUserAchievements(user.user.id);
    assert.equal(rebuilt.locationAwards.length, 2);
    assert.equal(rebuilt.adventureAwards.length, 0);
    assert.equal(await UserAchievement.countDocuments({ user: user.user.id }), 2);

    const again = await reconcileUserAchievements(user.user.id);
    assert.equal(again.locationAwards.length, 0);
    assert.equal(again.adventureAwards.length, 0);
    assert.equal(await UserAchievement.countDocuments({ user: user.user.id }), 2);
  });

  it('no otorga insignias de recorrido nuevas y conserva las insignias históricas', async () => {
    const firstUser = await registerUser('archivo-uno');
    const secondUser = await registerUser('archivo-dos');
    const first = await createLocation();
    const second = await createLocation();
    const adventure = await createAdventure({ title: 'Ruta Archivable' });

    await addStop(adventure, first.location, 1);
    await addStop(adventure, second.location, 2);

    await createCheckIn(firstUser.token, first.location, first.token);
    await createCheckIn(firstUser.token, second.location, second.token);

    await UserAchievement.create({
      user: firstUser.user.id,
      type: 'adventure',
      sourceId: adventure._id,
      sourceSlug: adventure.slug,
      name: 'Insignia histórica',
      description: 'Logro conservado de una versión anterior.',
    });

    adventure.status = 'archived';
    await adventure.save();

    await createCheckIn(secondUser.token, first.location, first.token);
    const secondUserLast = await createCheckIn(
      secondUser.token,
      second.location,
      second.token,
    );

    assert.equal(secondUserLast.status, 201);
    assert.equal(
      await UserAchievement.countDocuments({
        user: secondUser.user.id,
        type: 'adventure',
      }),
      0,
    );
    assert.equal(
      await UserAchievement.countDocuments({
        user: secondUser.user.id,
        type: 'location',
      }),
      2,
    );

    const profile = await asUser(
      firstUser.token,
      request(app).get('/api/profile/me'),
    );
    const historicAward = profile.body.data.achievements.find(
      (achievement) => achievement.type === 'adventure',
    );
    assert.ok(historicAward);
    assert.equal(historicAward.sourceActive, false);
    assert.equal(profile.body.data.stats.completedAdventures, 1);
  });

  it('crea la foto después del check-in, la reemplaza, la elimina y protege la propiedad', async () => {
    const owner = await registerUser('foto-dueno');
    const stranger = await registerUser('foto-ajeno');
    const { location, token } = await createLocation();

    const created = await createCheckIn(owner.token, location, token);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.photo, null);
    const checkInId = created.body.data.id;

    const anonymousUpload = await request(app)
      .put(`/api/profile/check-ins/${checkInId}/photo`)
      .attach('image', PNG_PIXEL, {
        filename: 'visita.png',
        contentType: 'image/png',
      });
    assert.equal(anonymousUpload.status, 401);

    const strangerUpload = await asUser(
      stranger.token,
      request(app).put(`/api/profile/check-ins/${checkInId}/photo`),
    ).attach('image', PNG_PIXEL, {
      filename: 'visita.png',
      contentType: 'image/png',
    });
    assert.equal(strangerUpload.status, 404);
    assert.equal(strangerUpload.body.error.code, 'CHECK_IN_NOT_FOUND');

    const uploaded = await asUser(
      owner.token,
      request(app).put(`/api/profile/check-ins/${checkInId}/photo`),
    ).attach('image', PNG_PIXEL, {
      filename: 'visita.png',
      contentType: 'image/png',
    });
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.data.checkIn.photoAvailable, true);
    const firstPhotoUrl = uploaded.body.data.checkIn.photoUrl;
    assert.match(
      firstPhotoUrl,
      /^\/api\/profile\/check-ins\/[a-f0-9]+\/photo\?v=\d+$/,
    );

    const image = await asUser(owner.token, request(app).get(firstPhotoUrl));
    assert.equal(image.status, 200);
    assert.match(image.headers['content-type'], /image\/png/);

    const invalid = await asUser(
      owner.token,
      request(app).put(`/api/profile/check-ins/${checkInId}/photo`),
    ).attach('image', Buffer.from('esto no es una imagen'), {
      filename: 'rota.png',
      contentType: 'image/png',
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'INVALID_IMAGE');

    const stillThere = await asUser(
      owner.token,
      request(app).get(firstPhotoUrl),
    );
    assert.equal(stillThere.status, 200);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const replaced = await asUser(
      owner.token,
      request(app).put(`/api/profile/check-ins/${checkInId}/photo`),
    ).attach('image', PNG_PIXEL, {
      filename: 'visita-2.png',
      contentType: 'image/png',
    });
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
    assert.notEqual(replaced.body.data.checkIn.photoUrl, firstPhotoUrl);

    const strangerDelete = await asUser(
      stranger.token,
      request(app).delete(`/api/profile/check-ins/${checkInId}/photo`),
    );
    assert.equal(strangerDelete.status, 404);

    const deleted = await asUser(
      owner.token,
      request(app).delete(`/api/profile/check-ins/${checkInId}/photo`),
    );
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    assert.equal(deleted.body.data.checkIn.photoAvailable, false);
    assert.equal(deleted.body.data.checkIn.photoUrl, null);

    const missing = await asUser(
      owner.token,
      request(app).get(
        `/api/profile/check-ins/${checkInId}/photo`,
      ),
    );
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'CHECK_IN_PHOTO_NOT_FOUND');
    assert.equal(await CheckIn.countDocuments({ _id: checkInId }), 1);
  });

  it('pagina la galería privada y filtra por presencia de foto', async () => {
    const owner = await registerUser('galeria');
    const stranger = await registerUser('galeria-ajena');
    const items = [];

    for (let index = 0; index < 3; index += 1) {
      const created = await createLocation({ title: `Galería ${index}` });
      const checkIn = await createCheckIn(owner.token, created.location, created.token);
      assert.equal(checkIn.status, 201, JSON.stringify(checkIn.body));
      items.push({ ...created, checkInId: checkIn.body.data.id });
    }

    for (const item of items.slice(0, 2)) {
      const uploaded = await asUser(
        owner.token,
        request(app).put(`/api/profile/check-ins/${item.checkInId}/photo`),
      ).attach('image', PNG_PIXEL, {
        filename: 'galeria.png',
        contentType: 'image/png',
      });
      assert.equal(uploaded.status, 200);
    }

    const firstPage = await asUser(
      owner.token,
      request(app).get('/api/profile/check-ins?page=1&limit=2'),
    );
    assert.equal(firstPage.status, 200);
    assert.equal(firstPage.body.data.length, 2);
    assert.equal(firstPage.body.meta.total, 3);
    assert.equal(firstPage.body.meta.totalPages, 2);

    const secondPage = await asUser(
      owner.token,
      request(app).get('/api/profile/check-ins?page=2&limit=2'),
    );
    assert.equal(secondPage.body.data.length, 1);

    const withPhoto = await asUser(
      owner.token,
      request(app).get('/api/profile/check-ins?hasPhoto=true'),
    );
    assert.equal(withPhoto.body.meta.total, 2);
    assert.ok(
      withPhoto.body.data.every((checkIn) => checkIn.photoAvailable),
    );

    const withoutPhoto = await asUser(
      owner.token,
      request(app).get('/api/profile/check-ins?hasPhoto=false'),
    );
    assert.equal(withoutPhoto.body.meta.total, 1);
    assert.ok(
      withoutPhoto.body.data.every((checkIn) => !checkIn.photoAvailable),
    );

    const otherGallery = await asUser(
      stranger.token,
      request(app).get('/api/profile/check-ins'),
    );
    assert.equal(otherGallery.body.meta.total, 0);

    const anonymous = await request(app).get('/api/profile/check-ins');
    assert.equal(anonymous.status, 401);

    const invalidFilter = await asUser(
      owner.token,
      request(app).get('/api/profile/check-ins?hasPhoto=quizas'),
    );
    assert.equal(invalidFilter.status, 400);
    assert.equal(invalidFilter.body.error.code, 'VALIDATION_ERROR');
  });

  it('no genera una insignia de recorrido aunque la última parada se visite', async () => {
    const user = await registerUser('generica');
    const { location, token } = await createLocation();
    const adventure = await createAdventure({ title: 'Ruta Sin Insignia' });

    await addStop(adventure, location, 1);

    const created = await createCheckIn(user.token, location, token);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    assert.deepEqual(
      created.body.achievementsAwarded.map((award) => award.type),
      ['location'],
    );
    assert.equal(
      await UserAchievement.countDocuments({
        user: user.user.id,
        type: 'adventure',
      }),
      0,
    );
  });
});
