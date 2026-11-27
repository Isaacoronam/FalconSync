import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const corpusVersion = process.env.RAG_CORPUS_VERSION?.trim() || 'e2e-2026-11-26';
const args = process.argv.slice(2);
const cli = path.resolve('node_modules/@playwright/test/cli.js');

if (!existsSync(cli)) {
  console.error(`[e2e:rag] No se encontró el CLI de Playwright en ${cli}`);
  process.exit(1);
}

const child = spawn(process.execPath, [cli, 'test', ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    RAG_TOURIST_ENABLED: 'true',
    RAG_CORPUS_VERSION: corpusVersion,
  },
});

child.on('error', (error) => {
  console.error('[e2e:rag] No se pudo iniciar Playwright:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
