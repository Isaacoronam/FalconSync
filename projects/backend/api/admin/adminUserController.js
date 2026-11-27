import User, {
  ASSIGNABLE_USER_ROLES,
  USER_ROLES,
} from '../../databases/models/User.js';
import { recordAudit } from '../../microservices/auditService.js';
import {
  revokeAllUserSessions,
  verifyPassword,
} from '../../microservices/authService.js';
import { HttpError } from '../../helpers/HttpError.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validationError(details) {
  return new HttpError(
    400,
    'VALIDATION_ERROR',
    'Los filtros enviados no son válidos',
    details,
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    surname: user.surname ?? '',
    username: user.username ?? null,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

async function reauthenticateAdmin(request) {
  const currentPassword =
    typeof request.body?.currentPassword === 'string'
      ? request.body.currentPassword
      : '';

  if (!currentPassword) {
    throw new HttpError(
      400,
      'REAUTHENTICATION_REQUIRED',
      'Debes confirmar tu contraseña actual para realizar esta acción',
    );
  }

  if (currentPassword.length > 128) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Los datos enviados no son válidos',
      ['La contraseña no puede superar 128 caracteres'],
    );
  }

  const actor = await User.findById(request.user._id).select('+passwordHash');

  if (!actor || !actor.isActive) {
    throw new HttpError(
      401,
      'ACCOUNT_UNAVAILABLE',
      'La cuenta no existe o está desactivada',
    );
  }

  const validPassword = await verifyPassword(
    currentPassword,
    actor.passwordHash,
  );

  if (!validPassword) {
    throw new HttpError(
      400,
      'INVALID_CURRENT_PASSWORD',
      'La contraseña actual no es correcta',
    );
  }

  return actor;
}

async function findAdminUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'El usuario no existe');
  }

  return user;
}

function countOtherActiveAdmins(userId) {
  return User.countDocuments({
    _id: { $ne: userId },
    role: 'admin',
    isActive: true,
  });
}

async function restoreUserState(userId, { role, isActive, tokenVersion }) {
  try {
    await User.updateOne(
      { _id: userId },
      { $set: { role, isActive, tokenVersion } },
    );
  } catch (error) {
    // La compensación es el último recurso: si también falla, se registra
    // para que el incidente pueda investigarse.
    console.error(
      '[FalconSync] No se pudo compensar el cambio de usuario:',
      error,
    );
  }
}

function auditFailure(error) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(
    503,
    'AUDIT_REQUIRED',
    'No se pudo registrar la auditoría; el cambio fue revertido',
  );
}

export async function listAdminUsers(request, response) {
  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const filter = {};
  const issues = [];

  if (request.query.q !== undefined) {
    if (typeof request.query.q !== 'string' || request.query.q.length > 100) {
      issues.push('q debe ser texto de hasta 100 caracteres');
    } else if (request.query.q.trim()) {
      const query = escapeRegex(request.query.q.trim());
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { surname: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
      ];
    }
  }

  if (request.query.role !== undefined) {
    if (!USER_ROLES.includes(request.query.role)) {
      issues.push(`role debe ser uno de: ${USER_ROLES.join(', ')}`);
    } else {
      filter.role = request.query.role;
    }
  }

  if (request.query.active !== undefined) {
    if (!['true', 'false'].includes(request.query.active)) {
      issues.push('active solo admite true o false');
    } else {
      filter.isActive = request.query.active === 'true';
    }
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name surname username email role isActive createdAt lastLoginAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  response.json({
    data: users.map(serializeUser),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function updateAdminUserRole(request, response) {
  const role = request.body?.role;

  if (!ASSIGNABLE_USER_ROLES.includes(role)) {
    throw validationError([
      `role debe ser uno de: ${ASSIGNABLE_USER_ROLES.join(', ')}`,
    ]);
  }

  await reauthenticateAdmin(request);
  const target = await findAdminUser(request.params.id);
  const previousRole = target.role;

  if (previousRole === role) {
    return response.json({
      data: serializeUser(target),
      meta: { changed: false, sessionsRevoked: false },
    });
  }

  const removesActiveAdmin = previousRole === 'admin' && target.isActive;

  if (
    removesActiveAdmin &&
    (await countOtherActiveAdmins(target._id)) === 0
  ) {
    throw new HttpError(
      409,
      'LAST_ADMIN_PROTECTED',
      'No puedes degradar al último administrador activo',
    );
  }

  if (target.id === request.user.id && role !== 'admin') {
    throw new HttpError(
      409,
      'SELF_DEMOTION_FORBIDDEN',
      'No puedes quitarte tu propio rol de administrador',
    );
  }

  const previousTokenVersion = target.tokenVersion;
  target.role = role;
  target.tokenVersion += 1;

  try {
    await target.save();
    await revokeAllUserSessions(target._id);

    if (
      removesActiveAdmin &&
      (await countOtherActiveAdmins(target._id)) === 0
    ) {
      throw new HttpError(
        409,
        'LAST_ADMIN_PROTECTED',
        'No puedes degradar al último administrador activo',
      );
    }

    await recordAudit({
      request,
      action: 'user.role.updated',
      entityType: 'User',
      entityId: target._id,
      summary: `Rol de ${target.email}: ${previousRole} → ${role}`,
      metadata: { previousRole, newRole: role },
      required: true,
    });
  } catch (error) {
    await restoreUserState(target._id, {
      role: previousRole,
      isActive: target.isActive,
      tokenVersion: previousTokenVersion,
    });
    throw auditFailure(error);
  }

  return response.json({
    data: serializeUser(target),
    meta: { changed: true, sessionsRevoked: true },
  });
}

export async function updateAdminUserStatus(request, response) {
  const isActive = request.body?.isActive;

  if (typeof isActive !== 'boolean') {
    throw validationError(['isActive debe ser true o false']);
  }

  await reauthenticateAdmin(request);
  const target = await findAdminUser(request.params.id);
  const previousIsActive = target.isActive;

  if (previousIsActive === isActive) {
    return response.json({
      data: serializeUser(target),
      meta: { changed: false, sessionsRevoked: false },
    });
  }

  const removesActiveAdmin = previousIsActive && target.role === 'admin';

  if (
    removesActiveAdmin &&
    (await countOtherActiveAdmins(target._id)) === 0
  ) {
    throw new HttpError(
      409,
      'LAST_ADMIN_PROTECTED',
      'No puedes desactivar al último administrador activo',
    );
  }

  if (target.id === request.user.id && !isActive) {
    throw new HttpError(
      409,
      'SELF_DEACTIVATION_FORBIDDEN',
      'No puedes desactivar tu propia cuenta',
    );
  }

  const previousTokenVersion = target.tokenVersion;
  target.isActive = isActive;
  target.tokenVersion += 1;

  try {
    await target.save();
    await revokeAllUserSessions(target._id);

    if (
      removesActiveAdmin &&
      (await countOtherActiveAdmins(target._id)) === 0
    ) {
      throw new HttpError(
        409,
        'LAST_ADMIN_PROTECTED',
        'No puedes desactivar al último administrador activo',
      );
    }

    await recordAudit({
      request,
      action: 'user.status.updated',
      entityType: 'User',
      entityId: target._id,
      summary: `Estado de ${target.email}: ${
        previousIsActive ? 'activo' : 'inactivo'
      } → ${isActive ? 'activo' : 'inactivo'}`,
      metadata: { previousIsActive, isActive },
      required: true,
    });
  } catch (error) {
    await restoreUserState(target._id, {
      role: target.role,
      isActive: previousIsActive,
      tokenVersion: previousTokenVersion,
    });
    throw auditFailure(error);
  }

  return response.json({
    data: serializeUser(target),
    meta: { changed: true, sessionsRevoked: true },
  });
}

export async function revokeAdminUserSessions(request, response) {
  await reauthenticateAdmin(request);
  const target = await findAdminUser(request.params.id);
  const previousTokenVersion = target.tokenVersion;

  target.tokenVersion += 1;

  try {
    await target.save();
    await revokeAllUserSessions(target._id);

    await recordAudit({
      request,
      action: 'user.sessions.revoked',
      entityType: 'User',
      entityId: target._id,
      summary: `Sesiones revocadas para ${target.email}`,
      metadata: { tokenVersion: target.tokenVersion },
      required: true,
    });
  } catch (error) {
    await restoreUserState(target._id, {
      role: target.role,
      isActive: target.isActive,
      tokenVersion: previousTokenVersion,
    });
    throw auditFailure(error);
  }

  return response.json({
    data: { id: target.id, sessionsRevoked: true },
  });
}
