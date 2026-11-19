import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), `falconsync-uploads-${process.pid}-`),
);
const publicDir = path.join(temporaryRoot, 'images');
const privateDir = path.join(temporaryRoot, 'documents');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27017/falconsync_uploads_test';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';
process.env.UPLOAD_DIR = publicDir;
process.env.UPLOAD_PRIVATE_DIR = privateDir;

const { default: app } = await import('../index.js');

before(async () => {
  await mkdir(path.join(publicDir, 'locations'), { recursive: true });
  await mkdir(path.join(privateDir, 'evidence'), { recursive: true });
  await writeFile(
    path.join(publicDir, 'locations', 'publica.jpg'),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  );
  await writeFile(
    path.join(privateDir, 'evidence', 'privada.jpg'),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  );
});

after(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe('separación de almacenamiento público y privado', () => {
  it('sirve las imágenes públicas en /api/uploads', async () => {
    const response = await request(app).get(
      '/api/uploads/locations/publica.jpg',
    );

    assert.equal(response.status, 200);
    assert.equal(
      response.headers['cross-origin-resource-policy'],
      'cross-origin',
    );
  });

  it('no sirve la evidencia privada desde el estático público', async () => {
    const response = await request(app).get(
      '/api/uploads/evidence/privada.jpg',
    );

    assert.equal(response.status, 404);
  });

  it('rechaza intentos de salir del directorio público', async () => {
    const traversal = await request(app).get(
      '/api/uploads/../documents/evidence/privada.jpg',
    );
    const encodedTraversal = await request(app).get(
      '/api/uploads/%2e%2e/documents/evidence/privada.jpg',
    );

    assert.notEqual(traversal.status, 200);
    assert.notEqual(encodedTraversal.status, 200);
  });

  it('impide arrancar si la carpeta privada queda dentro de la pública', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', "await import('./helpers/env.js')"],
      {
        cwd: backendRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          UPLOAD_DIR: publicDir,
          UPLOAD_PRIVATE_DIR: path.join(publicDir, 'documents'),
        },
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no puede estar dentro de UPLOAD_DIR/);
  });

  it('impide arrancar si UPLOAD_DIR apunta a una raíz uploads con documents/', async () => {
    const legacyPublicDir = path.join(temporaryRoot, 'legacy-images');
    await mkdir(path.join(legacyPublicDir, 'documents'), { recursive: true });
    await writeFile(
      path.join(legacyPublicDir, 'documents', 'evidencia.jpg'),
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    );

    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', "await import('./helpers/env.js')"],
      {
        cwd: backendRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          UPLOAD_DIR: legacyPublicDir,
          UPLOAD_PRIVATE_DIR: path.join(temporaryRoot, 'legacy-private'),
        },
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contiene una carpeta documents/);
  });
});
