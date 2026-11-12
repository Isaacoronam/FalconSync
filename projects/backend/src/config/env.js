import path from 'node:path';
import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
}

function requireSecret(name) {
  const value = process.env[name];

  if (value && value.length >= 32) {
    return value;
  }

  if (nodeEnv === 'test') {
    return `falconsync-test-${name.toLowerCase()}-000000000000`;
  }

  throw new Error(
    `[FalconSync] ${name} debe estar definido y tener al menos 32 caracteres. Copia .env.example a .env y genera secretos propios.`,
  );
}

export const config = {
  nodeEnv,
  port: toNumber(process.env.PORT, 3000),
  mongoUri:
    process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/falconsync',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: toBoolean(process.env.TRUST_PROXY, false),
  auth: {
    accessSecret: requireSecret('JWT_ACCESS_SECRET'),
    refreshSecret: requireSecret('JWT_REFRESH_SECRET'),
    accessTtlSeconds: toPositiveInteger(
      process.env.ACCESS_TOKEN_TTL_SECONDS,
      15 * 60,
    ),
    refreshTtlDays: toPositiveInteger(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
    bcryptCost: toPositiveInteger(process.env.BCRYPT_COST, 12),
    cookieName: process.env.REFRESH_COOKIE_NAME ?? 'falconsync_refresh',
    cookieSecure: toBoolean(
      process.env.COOKIE_SECURE,
      nodeEnv === 'production',
    ),
  },
  uploads: {
    dir: path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')),
    privateDir: path.resolve(
      process.env.UPLOAD_PRIVATE_DIR ??
        path.join(process.cwd(), 'uploads-private'),
    ),
    publicPrefix: '/api/uploads',
    maxImageBytes: toPositiveInteger(
      process.env.UPLOAD_MAX_IMAGE_BYTES,
      5 * 1024 * 1024,
    ),
  },
};

if (config.auth.bcryptCost < 10 || config.auth.bcryptCost > 15) {
  throw new Error(
    '[FalconSync] BCRYPT_COST debe estar entre 10 y 15 para equilibrar seguridad y rendimiento.',
  );
}
