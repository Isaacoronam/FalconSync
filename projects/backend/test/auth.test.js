import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/falconsync_auth_test';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';

const { default: app } = await import('../src/app.js');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: User } = await import('../src/models/User.js');
const { default: RefreshSession } = await import(
  '../src/models/RefreshSession.js'
);
const { default: Location } = await import('../src/models/Location.js');
const { ensureAdmin } = await import('../src/services/adminBootstrap.js');

const USER_PASSWORD = 'UsuarioSegura123';
const COOKIE_NAME = 'falconsync_refresh';

function cookiesFrom(response) {
  const header = response.headers['set-cookie'];
  return Array.isArray(header) ? header : header ? [header] : [];
}

function refreshCookie(response) {
  const cookie = cookiesFrom(response).find((item) =>
    item.startsWith(`${COOKIE_NAME}=`),
  );

  assert.ok(cookie, 'La respuesta debe incluir la cookie de renovación');
  return cookie;
}

function cookiePair(response) {
  return refreshCookie(response).split(';')[0];
}

async function register(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: USER_PASSWORD,
      ...overrides,
    });
}

async function login(email = 'ana@example.com', password = USER_PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

describe('Autenticación FalconSync', () => {
  before(async () => {
    await connectDB();
    await Promise.all([User.init(), RefreshSession.init(), Location.init()]);
  });

  beforeEach(async () => {
    await Promise.all([
      RefreshSession.deleteMany({}),
      User.deleteMany({}),
      Location.deleteMany({}),
    ]);
  });

  after(async () => {
    await Promise.all([
      RefreshSession.deleteMany({}),
      User.deleteMany({}),
      Location.deleteMany({}),
    ]);
    await disconnectDB();
  });

  it('registra un usuario y entrega un access token sin exponer el hash', async () => {
    const response = await register({ email: 'Ana@Example.com' });

    assert.equal(response.status, 201);
    assert.ok(response.body.data.accessToken);
    assert.equal(response.body.data.user.email, 'ana@example.com');
    assert.equal(response.body.data.user.role, 'user');
    assert.equal(response.body.data.user.passwordHash, undefined);

    const cookie = refreshCookie(response);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\/api\/auth/i);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`);

    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, 'ana@example.com');
  });

  it('rechaza correos duplicados sin distinguir mayúsculas', async () => {
    await register();
    const duplicate = await register({ email: 'ANA@example.com' });

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'EMAIL_IN_USE');
  });

  it('valida nombre, correo y fortaleza de la contraseña', async () => {
    const response = await register({
      name: 'A',
      email: 'correo-invalido',
      password: 'corta',
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    assert.ok(response.body.error.details.length >= 3);
  });

  it('inicia sesión con credenciales válidas y rechaza las inválidas', async () => {
    await register();

    const valid = await login();
    assert.equal(valid.status, 200);
    assert.ok(valid.body.data.accessToken);

    const wrongPassword = await login('ana@example.com', 'Incorrecta123');
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');

    const unknownUser = await login('nadie@example.com', 'Incorrecta123');
    assert.equal(unknownUser.status, 401);
    assert.equal(unknownUser.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('impide el acceso de cuentas desactivadas', async () => {
    await register();
    await User.updateOne({ email: 'ana@example.com' }, { isActive: false });

    const response = await login();

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'ACCOUNT_DISABLED');
  });

  it('protege /me sin token y con token inválido', async () => {
    const missing = await request(app).get('/api/auth/me');
    const invalid = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-invalido');

    assert.equal(missing.status, 401);
    assert.equal(missing.body.error.code, 'AUTHENTICATION_REQUIRED');
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.error.code, 'INVALID_ACCESS_TOKEN');
  });

  it('rota la cookie de renovación e invalida el token anterior', async () => {
    const registered = await register();
    const firstCookie = cookiePair(registered);

    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie);

    assert.equal(firstRefresh.status, 200);
    assert.ok(firstRefresh.body.data.accessToken);

    const secondCookie = cookiePair(firstRefresh);
    assert.notEqual(secondCookie, firstCookie);

    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie);

    assert.equal(replay.status, 401);
    assert.equal(replay.body.error.code, 'INVALID_REFRESH_TOKEN');

    const validRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', secondCookie);

    assert.equal(validRefresh.status, 200);
  });

  it('devuelve 401 si la cookie de renovación no existe o es inválida', async () => {
    const missing = await request(app).post('/api/auth/refresh');
    const invalid = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${COOKIE_NAME}=no-es-un-jwt`);

    assert.equal(missing.status, 401);
    assert.equal(missing.body.error.code, 'SESSION_REQUIRED');
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.error.code, 'INVALID_REFRESH_TOKEN');
  });

  it('cierra la sesión y revoca la cookie de renovación', async () => {
    const registered = await register();
    const cookie = cookiePair(registered);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    assert.equal(logout.status, 204);
    assert.match(refreshCookie(logout), /Expires=Thu, 01 Jan 1970/i);

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    assert.equal(refresh.status, 401);
  });

  it('cambia la contraseña y revoca los tokens anteriores', async () => {
    const registered = await register();
    const oldAccessToken = registered.body.data.accessToken;
    const oldCookie = cookiePair(registered);

    const changed = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .send({
        currentPassword: USER_PASSWORD,
        newPassword: 'NuevaSegura456',
      });

    assert.equal(changed.status, 200);
    assert.notEqual(changed.body.data.accessToken, oldAccessToken);

    const oldAccess = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    assert.equal(oldAccess.status, 401);
    assert.equal(oldAccess.body.error.code, 'SESSION_REVOKED');

    const oldRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', oldCookie);
    assert.equal(oldRefresh.status, 401);

    const oldPasswordLogin = await login('ana@example.com', USER_PASSWORD);
    assert.equal(oldPasswordLogin.status, 401);

    const newPasswordLogin = await login(
      'ana@example.com',
      'NuevaSegura456',
    );
    assert.equal(newPasswordLogin.status, 200);
  });

  it('bloquea el panel admin a usuarios normales y exige cambio de clave al admin inicial', async () => {
    await register();
    const userLogin = await login();

    const forbidden = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${userLogin.body.data.accessToken}`);

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'FORBIDDEN');

    const bootstrap = await ensureAdmin({
      email: 'admin@example.com',
      password: 'AdminInicial123',
      name: 'Administrador',
    });
    assert.equal(bootstrap.created, true);
    assert.equal(bootstrap.user.mustChangePassword, true);

    const adminLogin = await login('admin@example.com', 'AdminInicial123');
    assert.equal(adminLogin.status, 200);

    const blocked = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`);

    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');

    const passwordChange = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`)
      .send({
        currentPassword: 'AdminInicial123',
        newPassword: 'AdminNueva456',
      });

    assert.equal(passwordChange.status, 200);

    const summary = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${passwordChange.body.data.accessToken}`);

    assert.equal(summary.status, 200);
    assert.equal(summary.body.data.users, 2);
    assert.equal(summary.body.data.byRole.admin, 1);
  });

  it('es idempotente al crear el administrador y no restablece su contraseña', async () => {
    const first = await ensureAdmin({
      email: 'admin@example.com',
      password: 'AdminInicial123',
      name: 'Administrador',
    });
    const second = await ensureAdmin({
      email: 'admin@example.com',
      password: 'OtraClaveDistinta456',
      name: 'Otro Nombre',
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.updated, false);
    assert.equal(second.user.name, 'Administrador');

    const loginWithOriginalPassword = await login(
      'admin@example.com',
      'AdminInicial123',
    );
    assert.equal(loginWithOriginalPassword.status, 200);
  });
});
