import { config } from '../config/env.js';
import User from '../models/User.js';
import {
  createSession,
  hashPassword,
  publicUser,
  revokeAllUserSessions,
  revokeRefreshSession,
  rotateRefreshSession,
  verifyDummyPassword,
  verifyPassword,
} from '../services/authService.js';
import { HttpError } from '../utils/HttpError.js';
import { generateUniqueUsername } from '../services/usernameService.js';
import {
  normalizeEmail,
  validateEmail,
  validateName,
  validatePassword,
} from '../utils/validation.js';

function refreshCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'strict',
    path: '/api/auth',
    expires: expiresAt,
  };
}

function setRefreshCookie(response, refreshToken, expiresAt) {
  response.cookie(
    config.auth.cookieName,
    refreshToken,
    refreshCookieOptions(expiresAt),
  );
}

function clearRefreshCookie(response) {
  response.clearCookie(
    config.auth.cookieName,
    refreshCookieOptions(new Date(0)),
  );
}

function sessionContext(request) {
  return {
    userAgent: request.get('user-agent'),
    ip: request.ip,
  };
}

function authResponse(user, session) {
  return {
    data: {
      user: publicUser(user),
      accessToken: session.accessToken,
      tokenType: 'Bearer',
      expiresIn: session.accessExpiresIn,
    },
  };
}

function assertNoIssues(issues) {
  if (issues.length > 0) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Los datos enviados no son válidos',
      issues,
    );
  }
}

export async function register(request, response) {
  const body = request.body ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);

  assertNoIssues([
    ...validateName(name),
    ...validateEmail(email),
    ...validatePassword(body.password),
  ]);

  const existing = await User.exists({ email });

  if (existing) {
    throw new HttpError(
      409,
      'EMAIL_IN_USE',
      'Ya existe una cuenta con ese correo electrónico',
    );
  }

  const passwordHash = await hashPassword(body.password);
  const username = await generateUniqueUsername({ name, email });
  const user = await User.create({
    name,
    email,
    username,
    passwordHash,
    role: 'user',
  });

  const session = await createSession(user, sessionContext(request));
  setRefreshCookie(response, session.refreshToken, session.refreshExpiresAt);

  response.status(201).json(authResponse(user, session));
}

export async function login(request, response) {
  const body = request.body ?? {};
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  assertNoIssues([
    ...validateEmail(email),
    ...(password ? [] : ['La contraseña es obligatoria']),
  ]);

  if (password.length > 128) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Los datos enviados no son válidos',
      ['La contraseña no puede superar 128 caracteres'],
    );
  }

  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    await verifyDummyPassword(password);
    throw new HttpError(
      401,
      'INVALID_CREDENTIALS',
      'Correo o contraseña incorrectos',
    );
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    throw new HttpError(
      401,
      'INVALID_CREDENTIALS',
      'Correo o contraseña incorrectos',
    );
  }

  if (!user.isActive) {
    throw new HttpError(
      403,
      'ACCOUNT_DISABLED',
      'La cuenta está desactivada. Contacta a un administrador',
    );
  }

  const lastLoginAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt } });
  user.lastLoginAt = lastLoginAt;

  const session = await createSession(user, sessionContext(request));
  setRefreshCookie(response, session.refreshToken, session.refreshExpiresAt);

  response.json(authResponse(user, session));
}

export async function refresh(request, response) {
  const refreshToken = request.cookies?.[config.auth.cookieName];

  if (!refreshToken) {
    throw new HttpError(
      401,
      'SESSION_REQUIRED',
      'No hay una sesión de renovación activa',
    );
  }

  try {
    const session = await rotateRefreshSession(
      refreshToken,
      sessionContext(request),
    );

    setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
    );

    response.json(authResponse(session.user, session));
  } catch (error) {
    clearRefreshCookie(response);
    throw error;
  }
}

export async function logout(request, response) {
  const refreshToken = request.cookies?.[config.auth.cookieName];

  if (refreshToken) {
    await revokeRefreshSession(refreshToken);
  }

  clearRefreshCookie(response);
  response.status(204).end();
}

export async function me(request, response) {
  response.json({ data: { user: publicUser(request.user) } });
}

export async function changePassword(request, response) {
  const body = request.body ?? {};
  const currentPassword =
    typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword =
    typeof body.newPassword === 'string' ? body.newPassword : '';

  assertNoIssues([
    ...(currentPassword ? [] : ['La contraseña actual es obligatoria']),
    ...validatePassword(newPassword),
  ]);

  const user = await User.findById(request.user._id).select('+passwordHash');

  if (!user || !user.isActive) {
    throw new HttpError(
      401,
      'ACCOUNT_UNAVAILABLE',
      'La cuenta no existe o está desactivada',
    );
  }

  const validCurrentPassword = await verifyPassword(
    currentPassword,
    user.passwordHash,
  );

  if (!validCurrentPassword) {
    throw new HttpError(
      400,
      'INVALID_CURRENT_PASSWORD',
      'La contraseña actual no es correcta',
    );
  }

  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new HttpError(
      400,
      'PASSWORD_REUSED',
      'La nueva contraseña debe ser distinta a la actual',
    );
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  user.mustChangePassword = false;
  await user.save();

  await revokeAllUserSessions(user._id);
  const session = await createSession(user, sessionContext(request));
  setRefreshCookie(response, session.refreshToken, session.refreshExpiresAt);

  response.json(authResponse(user, session));
}
