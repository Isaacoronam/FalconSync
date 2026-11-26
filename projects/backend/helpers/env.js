import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    dir: path.resolve(
      process.env.UPLOAD_DIR ?? path.join(backendRoot, 'uploads', 'images'),
    ),
    privateDir: path.resolve(
      process.env.UPLOAD_PRIVATE_DIR ??
        path.join(backendRoot, 'uploads', 'documents'),
    ),
    publicPrefix: '/api/uploads',
    maxImageBytes: toPositiveInteger(
      process.env.UPLOAD_MAX_IMAGE_BYTES,
      5 * 1024 * 1024,
    ),
  },
  evidence: {
    maxBytes: toPositiveInteger(
      process.env.EVIDENCE_MAX_BYTES,
      10 * 1024 * 1024,
    ),
    retentionDays: toPositiveInteger(
      process.env.EVIDENCE_RETENTION_DAYS,
      365,
    ),
    // Sin un motor antimalware desplegado no se habilitan cargas en producción.
    // Los entornos de desarrollo y prueba permiten el flujo explícitamente no escaneado.
    scanRequired: nodeEnv === 'production',
    allowUnscanned: nodeEnv !== 'production',
  },
  telegram: {
    // El canal permanece apagado hasta que exista un token propio y una
    // decisión operativa explícita.
    enabled: toBoolean(process.env.TELEGRAM_ENABLED, false),
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
    // URL pública de la SPA: los mensajes del bot la usan para enlazar al
    // perfil, a las fichas de POI y al detalle de una incidencia.
    webUrl: (
      process.env.TELEGRAM_WEB_URL?.trim() || 'http://localhost:4200'
    ).replace(/\/+$/, ''),
    mode: process.env.TELEGRAM_MODE === 'webhook' ? 'webhook' : 'polling',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL?.trim() || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '',
    webhookPort: toPositiveInteger(process.env.TELEGRAM_WEBHOOK_PORT, 3201),
    webhookPath:
      process.env.TELEGRAM_WEBHOOK_PATH?.trim() || '/telegram/webhook',
    linkCodeTtlMinutes: toPositiveInteger(
      process.env.TELEGRAM_LINK_CODE_TTL_MINUTES,
      10,
    ),
    maxQueriesPerHour: toPositiveInteger(
      process.env.TELEGRAM_MAX_QUERIES_PER_HOUR,
      20,
    ),
    maxReportsPerDay: toPositiveInteger(
      process.env.TELEGRAM_MAX_REPORTS_PER_DAY,
      3,
    ),
  },
  assistant: {
    touristEnabled: toBoolean(process.env.RAG_TOURIST_ENABLED, false),
    technicalEnabled: toBoolean(process.env.RAG_TECHNICAL_ENABLED, false),
    corpusVersion: process.env.RAG_CORPUS_VERSION?.trim() || null,
    embeddingModel:
      process.env.RAG_EMBEDDING_MODEL?.trim() ||
      'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    embeddingDtype: process.env.RAG_EMBEDDING_DTYPE?.trim() || 'q8',
    embeddingCacheDir: path.resolve(
      process.env.RAG_EMBEDDING_CACHE_DIR?.trim() || path.join(backendRoot, 'models'),
    ),
    embeddingAllowRemote: toBoolean(process.env.RAG_EMBEDDING_ALLOW_REMOTE, true),
    minSimilarity: toNumber(process.env.RAG_MIN_SIMILARITY, 0.6),
  },
  panoramas: {
    // El original nunca se sirve: se guarda bajo UPLOAD_PRIVATE_DIR. El límite
    // protege la memoria del proceso antes de decodificar la imagen maestra.
    maxBytes: toPositiveInteger(
      process.env.PANORAMA_MAX_BYTES,
      40 * 1024 * 1024,
    ),
    maxPixels: toPositiveInteger(
      process.env.PANORAMA_MAX_PIXELS,
      120_000_000,
    ),
    derivativeWidth: toPositiveInteger(
      process.env.PANORAMA_DERIVATIVE_WIDTH,
      4096,
    ),
    thumbnailWidth: 640,
    minWidth: 1024,
  },
};

function isInsideDirectory(parent, child) {
  const normalize = (value) =>
    process.platform === 'win32' ? value.toLowerCase() : value;
  const relative = path.relative(normalize(parent), normalize(child));

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// El estático de /api/uploads sirve UPLOAD_DIR. Si la carpeta privada quedara
// dentro, la evidencia y los datos personales serían accesibles sin autorización.
if (isInsideDirectory(config.uploads.dir, config.uploads.privateDir)) {
  throw new Error(
    `[FalconSync] UPLOAD_PRIVATE_DIR (${config.uploads.privateDir}) no puede estar dentro de UPLOAD_DIR (${config.uploads.dir}). Usa carpetas separadas, por ejemplo uploads/images y uploads/documents.`,
  );
}

// Configuraciones heredadas apuntaban UPLOAD_DIR a la raíz uploads/ y dejaban
// documents/ dentro del estático público.
if (fs.existsSync(path.join(config.uploads.dir, 'documents'))) {
  throw new Error(
    `[FalconSync] UPLOAD_DIR (${config.uploads.dir}) contiene una carpeta documents/. El estático público expondría evidencia y datos privados. Cambia UPLOAD_DIR a uploads/images.`,
  );
}

if (config.telegram.enabled && !config.telegram.botToken) {
  throw new Error(
    '[FalconSync] TELEGRAM_ENABLED=true exige TELEGRAM_BOT_TOKEN. Configúralo en .env o en el gestor de secretos.',
  );
}

if (config.telegram.enabled && config.telegram.mode === 'webhook') {
  if (!/^https:\/\/[^\s]+$/i.test(config.telegram.webhookUrl)) {
    throw new Error(
      '[FalconSync] TELEGRAM_WEBHOOK_URL debe ser una URL HTTPS pública cuando TELEGRAM_MODE=webhook.',
    );
  }
  if (config.telegram.webhookPort > 65535) {
    throw new Error(
      '[FalconSync] TELEGRAM_WEBHOOK_PORT debe ser un puerto válido entre 1 y 65535.',
    );
  }
  if (
    config.telegram.webhookSecret.length < 16 ||
    config.telegram.webhookSecret.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(config.telegram.webhookSecret)
  ) {
    throw new Error(
      '[FalconSync] TELEGRAM_WEBHOOK_SECRET debe tener entre 16 y 256 caracteres y solo usar A-Z, a-z, 0-9, _ y -.',
    );
  }
}

if (config.telegram.linkCodeTtlMinutes > 60) {
  throw new Error(
    '[FalconSync] TELEGRAM_LINK_CODE_TTL_MINUTES no puede superar 60 minutos.',
  );
}

if (!/^https?:\/\/[^\s]+$/i.test(config.telegram.webUrl)) {
  throw new Error(
    '[FalconSync] TELEGRAM_WEB_URL debe ser una URL http(s) válida, por ejemplo https://falconsync.example.',
  );
}

if (
  nodeEnv === 'production' &&
  config.telegram.enabled &&
  !/^https:\/\//i.test(config.telegram.webUrl)
) {
  throw new Error(
    '[FalconSync] TELEGRAM_WEB_URL debe usar HTTPS cuando TELEGRAM_ENABLED=true en producción.',
  );
}

if (config.auth.bcryptCost < 10 || config.auth.bcryptCost > 15) {
  throw new Error(
    '[FalconSync] BCRYPT_COST debe estar entre 10 y 15 para equilibrar seguridad y rendimiento.',
  );
}
