import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const isCi = Boolean(process.env.CI);
const e2eUploadDir = path.resolve('test-results/e2e-uploads');
const frontendUrl = 'http://127.0.0.1:4201';
const backendUrl = 'http://127.0.0.1:3101';
const mongoUri =
    process.env.E2E_MONGODB_URI ??
    'mongodb://127.0.0.1:27018/falconsync_e2e?replicaSet=falconsyncTest';

// El .env del backend define las banderas RAG para desarrollo. Aquí se fijan
// para que la suite E2E sea determinista: sin una petición explícita del
// entorno que lanza la suite, el asistente turístico arranca apagado y no se
// ingiere corpus (así siguen en verde `guia.spec.ts`, `npm run verify` y CI).
const ragTouristEnabled = process.env.RAG_TOURIST_ENABLED ?? 'false';
const ragCorpusVersion = process.env.RAG_CORPUS_VERSION ?? '';
const ragTechnicalEnabled = process.env.RAG_TECHNICAL_ENABLED ?? 'false';
// Con corpus, el arranque del backend ingerirá los manifiestos y calculará los
// embeddings de sus fragmentos antes de responder al health check: ese tiempo
// extra solo aplica cuando se pide el corpus y amplía el timeout de arranque.
const ragIngestionPlanned =
  ragTouristEnabled === 'true' && ragCorpusVersion.trim() !== '';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  reporter: isCi
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: isCi ? undefined : 'msedge',
      },
    },
  ],
  webServer: [
    {
      command: 'node scripts/e2eServer.js',
      cwd: '../backend',
      url: `${backendUrl}/api/health`,
      timeout: ragIngestionPlanned ? 600_000 : 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PORT: '3101',
        MONGODB_URI: mongoUri,
        CORS_ORIGIN: `${frontendUrl},http://localhost:4201`,
        JWT_ACCESS_SECRET:
          'e2e-access-secret-with-more-than-32-characters',
        JWT_REFRESH_SECRET:
          'e2e-refresh-secret-with-more-than-32-characters',
        ACCESS_TOKEN_TTL_SECONDS: '900',
        REFRESH_TOKEN_TTL_DAYS: '7',
        BCRYPT_COST: '10',
        REFRESH_COOKIE_NAME: 'falconsync_refresh',
        COOKIE_SECURE: 'false',
        TRUST_PROXY: 'false',
        UPLOAD_DIR: e2eUploadDir,
        UPLOAD_PRIVATE_DIR: path.resolve('test-results/e2e-uploads-private'),
        // Fijadas aquí: ver el comentario superior sobre el .env del backend.
        RAG_TOURIST_ENABLED: ragTouristEnabled,
        RAG_CORPUS_VERSION: ragCorpusVersion,
        RAG_TECHNICAL_ENABLED: ragTechnicalEnabled,
      },
    },
    {
      command:
        'npm start -- --host 127.0.0.1 --port 4201 --proxy-config proxy.e2e.conf.json',
      url: frontendUrl,
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
