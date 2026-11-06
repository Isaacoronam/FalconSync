import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import RefreshSession from '../models/RefreshSession.js';
import User from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';

const TOKEN_ISSUER = 'falconsync-api';
const TOKEN_AUDIENCE = 'falconsync-web';
const DUMMY_PASSWORD_HASH =
  '$2b$12$fzsY9OtowWfzeeAmGs5oU.Hjew9OhAgNZN9mrMx6P/nwy4GSg/hOq';

export function publicUser(user) {
  return user.toJSON();
}

export function hashPassword(password) {
  return bcrypt.hash(password, config.auth.bcryptCost);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export async function verifyDummyPassword(password) {
  await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}

function signAccessToken(user) {
  return jwt.sign(
    {
      type: 'access',
      role: user.role,
      ver: user.tokenVersion,
    },
    config.auth.accessSecret,
    {
      subject: user.id,
      expiresIn: config.auth.accessTtlSeconds,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      algorithm: 'HS256',
    },
  );
}

function signRefreshToken(user, tokenId) {
  return jwt.sign(
    {
      type: 'refresh',
      ver: user.tokenVersion,
    },
    config.auth.refreshSecret,
    {
      subject: user.id,
      jwtid: tokenId,
      expiresIn: `${config.auth.refreshTtlDays}d`,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      algorithm: 'HS256',
    },
  );
}

export function verifyAccessToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, config.auth.accessSecret, {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
  } catch {
    throw new HttpError(
      401,
      'INVALID_ACCESS_TOKEN',
      'La sesión no es válida o ha expirado',
    );
  }

  if (payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new HttpError(
      401,
      'INVALID_ACCESS_TOKEN',
      'La sesión no es válida o ha expirado',
    );
  }

  return payload;
}

function verifyRefreshToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, config.auth.refreshSecret, {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
  } catch {
    throw new HttpError(
      401,
      'INVALID_REFRESH_TOKEN',
      'La sesión de renovación no es válida o ha expirado',
    );
  }

  if (
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw new HttpError(
      401,
      'INVALID_REFRESH_TOKEN',
      'La sesión de renovación no es válida o ha expirado',
    );
  }

  return payload;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function tokensMatch(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sessionContext(context = {}) {
  return {
    userAgent: context.userAgent?.slice(0, 500),
    ip: context.ip?.slice(0, 100),
  };
}

export async function createSession(user, context) {
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken(user, tokenId);
  const expiresAt = new Date(
    Date.now() + config.auth.refreshTtlDays * 24 * 60 * 60 * 1000,
  );

  await RefreshSession.create({
    user: user._id,
    tokenId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    ...sessionContext(context),
  });

  return {
    refreshToken,
    refreshTokenId: tokenId,
    refreshExpiresAt: expiresAt,
    accessToken: signAccessToken(user),
    accessExpiresIn: config.auth.accessTtlSeconds,
  };
}

export async function rotateRefreshSession(refreshToken, context) {
  const payload = verifyRefreshToken(refreshToken);
  const now = new Date();
  const session = await RefreshSession.findOne({ tokenId: payload.jti });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= now.getTime() ||
    !tokensMatch(hashToken(refreshToken), session.tokenHash)
  ) {
    throw new HttpError(
      401,
      'INVALID_REFRESH_TOKEN',
      'La sesión de renovación no es válida o ha expirado',
    );
  }

  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    throw new HttpError(401, 'ACCOUNT_UNAVAILABLE', 'La cuenta no está activa');
  }

  if (user.tokenVersion !== payload.ver) {
    throw new HttpError(
      401,
      'SESSION_REVOKED',
      'La sesión fue revocada. Inicia sesión de nuevo',
    );
  }

  const revoked = await RefreshSession.findOneAndUpdate(
    {
      _id: session._id,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { revokedAt: now } },
    { returnDocument: 'before' },
  );

  if (!revoked) {
    throw new HttpError(
      401,
      'INVALID_REFRESH_TOKEN',
      'La sesión de renovación ya fue utilizada',
    );
  }

  const nextSession = await createSession(user, context);

  await RefreshSession.updateOne(
    { _id: session._id },
    { $set: { replacedByTokenId: nextSession.refreshTokenId } },
  );

  return {
    user,
    ...nextSession,
  };
}

export async function revokeRefreshSession(refreshToken) {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return false;
  }

  const result = await RefreshSession.updateOne(
    { tokenId: payload.jti, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  return result.modifiedCount > 0;
}

export async function revokeAllUserSessions(userId) {
  await RefreshSession.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
