import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repositoryRoot = path.resolve(backendRoot, '..', '..');
const frontendRoot = path.join(repositoryRoot, 'projects', 'frontend');

const BACKEND_DIRECTORIES = [
  'api',
  'assets',
  'bin',
  'databases',
  'helpers',
  'logs',
  'microservices',
  'middlewares',
  'public',
  'scripts',
  'seeders',
  'test',
  'uploads',
];

const API_MODULES = [
  'admin',
  'adventures',
  'auth',
  'check-ins',
  'conservation',
  'evidence',
  'locations',
  'panoramas',
  'uploads',
  'users',
];

const FRONTEND_APP_DIRECTORIES = ['components', 'models', 'pages', 'services'];
const FRONTEND_SERVICE_DIRECTORIES = [
  'guards',
  'interceptors',
  'utils',
  'validators',
];
const FRONTEND_ROOT_FILES = [
  'app.config.ts',
  'app.html',
  'app.routes.ts',
  'app.scss',
  'app.spec.ts',
  'app.ts',
];

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function directories(target) {
  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function files(target) {
  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

describe('estructura obligatoria del repositorio', () => {
  it('el backend no conserva la carpeta src/ y tiene los directorios aprobados', async () => {
    assert.equal(
      await exists(path.join(backendRoot, 'src')),
      false,
      'projects/backend/src/ no debe existir: el código vive en api/, microservices/, databases/, etc.',
    );

    for (const directory of BACKEND_DIRECTORIES) {
      assert.equal(
        await exists(path.join(backendRoot, directory)),
        true,
        `Falta projects/backend/${directory}/`,
      );
    }
  });

  it('api/ solo contiene módulos aprobados y cada uno expone rutas', async () => {
    const modules = await directories(path.join(backendRoot, 'api'));

    assert.deepEqual(
      modules,
      [...API_MODULES].sort(),
      'api/ contiene módulos no registrados en la estructura o en memory/architecture_decisions.md',
    );

    for (const moduleName of API_MODULES) {
      const moduleFiles = await files(path.join(backendRoot, 'api', moduleName));
      assert.ok(
        moduleFiles.some((file) => file.endsWith('Routes.js')),
        `api/${moduleName}/ debe declarar al menos un archivo *Routes.js`,
      );
    }
  });

  it('las cargas iniciales viven en seeders/ y no en scripts/', async () => {
    const scriptFiles = await files(path.join(backendRoot, 'scripts'));
    const misplaced = scriptFiles.filter((file) => /^seed/i.test(file));

    assert.deepEqual(
      misplaced,
      [],
      `Estos seeders deben estar en seeders/: ${misplaced.join(', ')}`,
    );
  });

  it('el frontend usa pages/, components/, services/ y models/ sin core/ ni features/', async () => {
    assert.equal(
      await exists(path.join(frontendRoot, 'public')),
      false,
      'projects/frontend/public/ no debe existir: los estáticos viven en src/assets/',
    );

    const appRoot = path.join(frontendRoot, 'src', 'app');
    const appDirectories = await directories(appRoot);

    assert.deepEqual(
      appDirectories,
      [...FRONTEND_APP_DIRECTORIES].sort(),
      'src/app/ contiene carpetas fuera de la estructura (core/, features/ u otras)',
    );

    const serviceDirectories = await directories(path.join(appRoot, 'services'));
    assert.deepEqual(
      serviceDirectories,
      [...FRONTEND_SERVICE_DIRECTORIES].sort(),
      'services/ debe contener guards, interceptors, utils y validators; no config/',
    );

    const appFiles = await files(appRoot);
    for (const file of FRONTEND_ROOT_FILES) {
      assert.ok(appFiles.includes(file), `Falta src/app/${file}`);
    }
  });

  it('el frontend tiene los archivos de arranque y assets en su lugar', async () => {
    assert.equal(
      await exists(path.join(frontendRoot, 'src', 'main.ts')),
      true,
      'Falta src/main.ts',
    );
    assert.equal(
      await exists(path.join(frontendRoot, 'src', 'index.html')),
      true,
      'Falta src/index.html',
    );
    assert.equal(
      await exists(path.join(frontendRoot, 'src', 'assets', 'images', 'locations')),
      true,
      'Faltan las imágenes de POI en src/assets/images/locations/',
    );
  });
});
