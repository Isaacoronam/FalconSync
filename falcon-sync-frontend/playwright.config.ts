import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const isCi = Boolean(process.env.CI);
const e2eUploadDir = path.resolve('test-results/e2e-uploads');
const frontendUrl = 'http://127.0.0.1:4201';
const backendUrl = 'http://127.0.0.1:3101';
const mongoUri =
    process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/falconsync_e2e';

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
      cwd: '../falcon-sync-backend',
      url: `${backendUrl}/api/health`,
      timeout: 120_000,
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
