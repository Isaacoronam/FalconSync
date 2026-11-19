import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasCapability,
  requireAnyCapability,
} from '../microservices/authorizationService.js';

describe('Autorización por capacidades', () => {
  it('mantiene separadas las capacidades operativas y de auditoría', () => {
    assert.equal(hasCapability('inspector', 'inspection.execute'), true);
    assert.equal(hasCapability('inspector', 'inspection.read.audit'), false);
    assert.equal(hasCapability('admin', 'inspection.read.audit'), true);
    assert.equal(hasCapability('admin', 'inspection.execute'), false);
    assert.equal(hasCapability('historian', 'report.triage'), false);
    assert.equal(hasCapability('admin', 'break_glass.inspection'), false);
    assert.equal(hasCapability('moderator', 'report.read.own'), false);
    assert.equal(hasCapability('toString', 'report.read.own'), false);
  });

  it('falla cerrado para capacidades desconocidas', () => {
    assert.equal(hasCapability('admin', 'system.root'), false);
    assert.throws(
      () => requireAnyCapability('system.root'),
      /capacidad no reconocida/,
    );
  });

  it('exige autenticación y cambio de contraseña antes de autorizar', () => {
    const middleware = requireAnyCapability('report.create');
    let authenticationError;
    middleware({}, {}, (error) => {
      authenticationError = error;
    });
    assert.equal(authenticationError.statusCode, 401);

    let passwordError;
    middleware(
      { user: { role: 'user', mustChangePassword: true } },
      {},
      (error) => {
        passwordError = error;
      },
    );
    assert.equal(passwordError.code, 'PASSWORD_CHANGE_REQUIRED');
  });

  it('permite solo si el usuario tiene alguna capacidad requerida', () => {
    let allowed = false;
    requireAnyCapability('inspection.read.assigned', 'inspection.read.audit')(
      { user: { role: 'admin', mustChangePassword: false } },
      {},
      (error) => {
        assert.equal(error, undefined);
        allowed = true;
      },
    );
    assert.equal(allowed, true);

    let denied;
    requireAnyCapability('inspection.read.assigned')(
      { user: { role: 'user', mustChangePassword: false } },
      {},
      (error) => {
        denied = error;
      },
    );
    assert.equal(denied.statusCode, 403);
  });
});
