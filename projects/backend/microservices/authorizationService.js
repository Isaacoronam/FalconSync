import { HttpError } from '../helpers/HttpError.js';

export const CAPABILITIES = Object.freeze([
  'report.create',
  'report.read.own',
  'report.read.all',
  'report.triage',
  'inspection.create',
  'inspection.read.assigned',
  'inspection.read.audit',
  'inspection.execute',
  'inspection.review',
  'inspection.close',
  'finding.propose',
  'finding.confirm',
  'intervention.propose',
  'intervention.verify',
  'evidence.upload',
  'evidence.read.assigned',
  'evidence.read.audit',
  'asset.read',
  'asset.manage',
  'content.edit',
  'content.review',
  'account.manage',
  'audit.read',
  'source.read',
  'source.manage',
  'panorama.publish',
  'panorama.manage',
  'break_glass.inspection',
  'notification.read.own',
  'realtime.connect',
  'assistant.tourist',
  'assistant.inspection',
]);

const knownCapabilities = new Set(CAPABILITIES);

const capabilitiesByRole = Object.freeze({
  user: Object.freeze([
    'report.create',
    'report.read.own',
    'evidence.upload',
    'evidence.read.assigned',
    'asset.read',
    'notification.read.own',
    'realtime.connect',
    'assistant.tourist',
  ]),
  historian: Object.freeze([
    'report.create',
    'report.read.own',
    'asset.read',
    'content.edit',
    'content.review',
    'source.read',
    'panorama.publish',
    'notification.read.own',
    'realtime.connect',
    'assistant.tourist',
    'assistant.inspection',
  ]),
  inspector: Object.freeze([
    'report.create',
    'report.read.own',
    'report.read.all',
    'report.triage',
    'inspection.create',
    'inspection.read.assigned',
    'inspection.execute',
    'inspection.review',
    'inspection.close',
    'finding.propose',
    'finding.confirm',
    'intervention.propose',
    'intervention.verify',
    'evidence.upload',
    'evidence.read.assigned',
    'asset.read',
    'asset.manage',
    'source.read',
    'notification.read.own',
    'realtime.connect',
    'assistant.tourist',
    'assistant.inspection',
  ]),
  admin: Object.freeze([
    'report.create',
    'report.read.own',
    'inspection.read.audit',
    'evidence.read.audit',
    'asset.read',
    'asset.manage',
    'account.manage',
    'audit.read',
    'source.read',
    'source.manage',
    'panorama.manage',
    'notification.read.own',
    'realtime.connect',
    'assistant.tourist',
  ]),
});

export function hasCapability(user, capability) {
  const role = typeof user === 'string' ? user : user?.role;
  return (
    Object.hasOwn(capabilitiesByRole, role) &&
    capabilitiesByRole[role].includes(capability)
  );
}

export function requireAnyCapability(...capabilities) {
  if (
    capabilities.length === 0 ||
    capabilities.some((capability) => !knownCapabilities.has(capability))
  ) {
    throw new TypeError(
      'requireAnyCapability recibió una capacidad no reconocida',
    );
  }

  return (request, _response, next) => {
    if (!request.user) {
      return next(
        new HttpError(
          401,
          'AUTHENTICATION_REQUIRED',
          'Debes iniciar sesión para continuar',
        ),
      );
    }

    if (request.user.mustChangePassword) {
      return next(
        new HttpError(
          403,
          'PASSWORD_CHANGE_REQUIRED',
          'Debes cambiar la contraseña antes de continuar',
        ),
      );
    }

    if (!capabilities.some((capability) => hasCapability(request.user, capability))) {
      return next(
        new HttpError(
          403,
          'FORBIDDEN',
          'No tienes permisos para realizar esta acción',
        ),
      );
    }

    next();
  };
}
