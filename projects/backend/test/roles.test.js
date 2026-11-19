import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27017/falconsync_roles_test';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';

const { default: app } = await import('../index.js');
const { connectDB, disconnectDB } = await import('../databases/db.js');
const { default: AuditLog } = await import('../databases/models/AuditLog.js');
const { default: RefreshSession } = await import(
  '../databases/models/RefreshSession.js'
);
const { default: User } = await import('../databases/models/User.js');
const { hashPassword } = await import('../microservices/authService.js');

const PASSWORD = 'UsuarioSegura123';

async function createUser({
  email,
  role = 'user',
  isActive = true,
  name = 'Usuario de prueba',
}) {
  return User.create({
    name,
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
    isActive,
    mustChangePassword: false,
  });
}

async function login(email, password = PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

async function authorizationFor(email) {
  const response = await login(email);
  assert.equal(
    response.status,
    200,
    `No se pudo iniciar sesión con ${email}: ${JSON.stringify(response.body)}`,
  );

  return `Bearer ${response.body.data.accessToken}`;
}

function patchRole(id, payload, authorization) {
  return request(app)
    .patch(`/api/admin/users/${id}/role`)
    .set('Authorization', authorization)
    .send(payload);
}

function patchStatus(id, payload, authorization) {
  return request(app)
    .patch(`/api/admin/users/${id}/status`)
    .set('Authorization', authorization)
    .send(payload);
}

function revokeSessions(id, payload, authorization) {
  return request(app)
    .post(`/api/admin/users/${id}/revoke-sessions`)
    .set('Authorization', authorization)
    .send(payload);
}

describe('Roles y administración sensible', () => {
  before(async () => {
    await connectDB();
    await Promise.all([User.init(), RefreshSession.init(), AuditLog.init()]);
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  });

  after(async () => {
    await Promise.all([
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    await disconnectDB();
  });

  it('filtra por historian e inspector y los cuenta en el resumen', async () => {
    await createUser({ email: 'admin@roles.local', role: 'admin' });
    await createUser({
      email: 'historiador@roles.local',
      role: 'historian',
    });
    await createUser({ email: 'inspector@roles.local', role: 'inspector' });
    await createUser({ email: 'turista@roles.local' });

    const authorization = await authorizationFor('admin@roles.local');

    const historians = await request(app)
      .get('/api/admin/users?role=historian')
      .set('Authorization', authorization);

    assert.equal(historians.status, 200);
    assert.equal(historians.body.data.length, 1);
    assert.equal(historians.body.data[0].role, 'historian');

    const inspectors = await request(app)
      .get('/api/admin/users?role=inspector')
      .set('Authorization', authorization);

    assert.equal(inspectors.status, 200);
    assert.equal(inspectors.body.data.length, 1);
    assert.equal(inspectors.body.data[0].role, 'inspector');

    const summary = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', authorization);

    assert.equal(summary.status, 200);
    assert.equal(summary.body.data.byRole.admin, 1);
    assert.equal(summary.body.data.byRole.historian, 1);
    assert.equal(summary.body.data.byRole.inspector, 1);
    assert.equal(summary.body.data.byRole.moderator, 0);
    assert.equal(summary.body.data.byRole.user, 1);
  });

  it('cambia el rol con reautenticación, revoca sesiones y audita', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const target = await createUser({ email: 'objetivo@roles.local' });
    const targetAuthorization = await authorizationFor(target.email);
    const adminAuthorization = await authorizationFor(admin.email);

    assert.equal(
      await RefreshSession.countDocuments({
        user: target._id,
        revokedAt: null,
      }),
      1,
    );

    const response = await patchRole(
      target._id,
      { role: 'historian', currentPassword: PASSWORD },
      adminAuthorization,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.role, 'historian');
    assert.equal(response.body.meta.changed, true);
    assert.equal(response.body.meta.sessionsRevoked, true);

    const updated = await User.findById(target._id);
    assert.equal(updated.role, 'historian');
    assert.equal(updated.tokenVersion, 1);
    assert.equal(
      await RefreshSession.countDocuments({
        user: target._id,
        revokedAt: null,
      }),
      0,
    );

    const oldAccess = await request(app)
      .get('/api/auth/me')
      .set('Authorization', targetAuthorization);

    assert.equal(oldAccess.status, 401);
    assert.equal(oldAccess.body.error.code, 'SESSION_REVOKED');

    const audit = await AuditLog.findOne({
      action: 'user.role.updated',
      entityId: target._id,
    });

    assert.ok(audit);
    assert.equal(audit.actorEmail, admin.email);
    assert.deepEqual(audit.metadata, {
      previousRole: 'user',
      newRole: 'historian',
    });
  });

  it('exige la contraseña actual y rechaza la incorrecta', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const target = await createUser({ email: 'objetivo@roles.local' });
    const authorization = await authorizationFor(admin.email);

    const missing = await patchRole(
      target._id,
      { role: 'historian' },
      authorization,
    );

    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.code, 'REAUTHENTICATION_REQUIRED');

    const wrong = await patchRole(
      target._id,
      { role: 'historian', currentPassword: 'OtraClave123' },
      authorization,
    );

    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error.code, 'INVALID_CURRENT_PASSWORD');

    const unchanged = await User.findById(target._id);
    assert.equal(unchanged.role, 'user');
    assert.equal(unchanged.tokenVersion, 0);
  });

  it('rechaza moderator y roles fuera del catálogo asignable', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const target = await createUser({ email: 'objetivo@roles.local' });
    const authorization = await authorizationFor(admin.email);

    const moderator = await patchRole(
      target._id,
      { role: 'moderator', currentPassword: PASSWORD },
      authorization,
    );

    assert.equal(moderator.status, 400);
    assert.equal(moderator.body.error.code, 'VALIDATION_ERROR');

    const unknown = await patchRole(
      target._id,
      { role: 'superuser', currentPassword: PASSWORD },
      authorization,
    );

    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.error.code, 'VALIDATION_ERROR');

    const unchanged = await User.findById(target._id);
    assert.equal(unchanged.role, 'user');
  });

  it('protege al último administrador y prohíbe la autodegradación', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const authorization = await authorizationFor(admin.email);

    const lastAdminDemotion = await patchRole(
      admin._id,
      { role: 'user', currentPassword: PASSWORD },
      authorization,
    );

    assert.equal(lastAdminDemotion.status, 409);
    assert.equal(lastAdminDemotion.body.error.code, 'LAST_ADMIN_PROTECTED');

    const lastAdminDeactivation = await patchStatus(
      admin._id,
      { isActive: false, currentPassword: PASSWORD },
      authorization,
    );

    assert.equal(lastAdminDeactivation.status, 409);
    assert.equal(
      lastAdminDeactivation.body.error.code,
      'LAST_ADMIN_PROTECTED',
    );

    await createUser({
      email: 'segundo-admin@roles.local',
      role: 'admin',
    });

    const selfDemotion = await patchRole(
      admin._id,
      { role: 'historian', currentPassword: PASSWORD },
      authorization,
    );

    assert.equal(selfDemotion.status, 409);
    assert.equal(selfDemotion.body.error.code, 'SELF_DEMOTION_FORBIDDEN');

    const selfDeactivation = await patchStatus(
      admin._id,
      { isActive: false, currentPassword: PASSWORD },
      authorization,
    );

    assert.equal(selfDeactivation.status, 409);
    assert.equal(
      selfDeactivation.body.error.code,
      'SELF_DEACTIVATION_FORBIDDEN',
    );
  });

  it('cambia el estado, revoca sesiones y audita cada transición', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const target = await createUser({ email: 'objetivo@roles.local' });
    const targetAuthorization = await authorizationFor(target.email);
    const adminAuthorization = await authorizationFor(admin.email);

    const deactivated = await patchStatus(
      target._id,
      { isActive: false, currentPassword: PASSWORD },
      adminAuthorization,
    );

    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.data.isActive, false);
    assert.equal(deactivated.body.meta.changed, true);

    const oldAccess = await request(app)
      .get('/api/auth/me')
      .set('Authorization', targetAuthorization);

    assert.equal(oldAccess.status, 401);
    assert.equal(oldAccess.body.error.code, 'ACCOUNT_UNAVAILABLE');

    const blockedLogin = await login(target.email);
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.body.error.code, 'ACCOUNT_DISABLED');

    const reactivated = await patchStatus(
      target._id,
      { isActive: true, currentPassword: PASSWORD },
      adminAuthorization,
    );

    assert.equal(reactivated.status, 200);
    assert.equal(reactivated.body.data.isActive, true);
    assert.equal((await login(target.email)).status, 200);

    const audits = await AuditLog.find({
      action: 'user.status.updated',
      entityId: target._id,
    }).sort({ createdAt: 1 });

    assert.equal(audits.length, 2);
    assert.equal(audits[0].metadata.previousIsActive, true);
    assert.equal(audits[0].metadata.isActive, false);
    assert.equal(audits[1].metadata.previousIsActive, false);
    assert.equal(audits[1].metadata.isActive, true);
  });

  it('revoca sesiones sin cambiar rol ni estado', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const target = await createUser({ email: 'objetivo@roles.local' });
    const targetAuthorization = await authorizationFor(target.email);
    const adminAuthorization = await authorizationFor(admin.email);

    const response = await revokeSessions(
      target._id,
      { currentPassword: PASSWORD },
      adminAuthorization,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.sessionsRevoked, true);

    const updated = await User.findById(target._id);
    assert.equal(updated.role, 'user');
    assert.equal(updated.isActive, true);
    assert.equal(updated.tokenVersion, 1);

    const oldAccess = await request(app)
      .get('/api/auth/me')
      .set('Authorization', targetAuthorization);

    assert.equal(oldAccess.status, 401);
    assert.equal(oldAccess.body.error.code, 'SESSION_REVOKED');

    const audit = await AuditLog.findOne({
      action: 'user.sessions.revoked',
      entityId: target._id,
    });

    assert.ok(audit);
    assert.equal(audit.actorEmail, admin.email);
  });

  it('rechaza usuarios inexistentes y a quien no es administrador', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const user = await createUser({ email: 'turista@roles.local' });
    const adminAuthorization = await authorizationFor(admin.email);
    const userAuthorization = await authorizationFor(user.email);

    const notFound = await patchRole(
      '000000000000000000000000',
      { role: 'historian', currentPassword: PASSWORD },
      adminAuthorization,
    );

    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.error.code, 'USER_NOT_FOUND');

    const forbidden = await patchRole(
      admin._id,
      { role: 'historian', currentPassword: PASSWORD },
      userAuthorization,
    );

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, 'FORBIDDEN');
  });

  it('no revoca sesiones cuando el rol solicitado no cambia', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const target = await createUser({ email: 'objetivo@roles.local' });
    await authorizationFor(target.email);
    const adminAuthorization = await authorizationFor(admin.email);

    const response = await patchRole(
      target._id,
      { role: 'user', currentPassword: PASSWORD },
      adminAuthorization,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.changed, false);
    assert.equal(response.body.meta.sessionsRevoked, false);

    const unchanged = await User.findById(target._id);
    assert.equal(unchanged.tokenVersion, 0);
    assert.equal(
      await RefreshSession.countDocuments({
        user: target._id,
        revokedAt: null,
      }),
      1,
    );
  });

  it('revierte el cambio si la auditoría obligatoria falla', async () => {
    const admin = await createUser({
      email: 'admin@roles.local',
      role: 'admin',
    });
    const target = await createUser({ email: 'objetivo@roles.local' });
    const adminAuthorization = await authorizationFor(admin.email);
    const originalCreate = AuditLog.create;

    AuditLog.create = async () => {
      throw new Error('auditoría no disponible');
    };

    try {
      const response = await patchRole(
        target._id,
        { role: 'historian', currentPassword: PASSWORD },
        adminAuthorization,
      );

      assert.equal(response.status, 503);
      assert.equal(response.body.error.code, 'AUDIT_REQUIRED');
    } finally {
      AuditLog.create = originalCreate;
    }

    const unchanged = await User.findById(target._id);
    assert.equal(unchanged.role, 'user');
    assert.equal(unchanged.tokenVersion, 0);
    assert.equal(
      await AuditLog.countDocuments({
        action: 'user.role.updated',
        entityId: target._id,
      }),
      0,
    );
  });
});
