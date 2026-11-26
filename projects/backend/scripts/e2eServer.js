import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../databases/db.js';
import { config } from '../helpers/env.js';
import AuditLog from '../databases/models/AuditLog.js';
import Location from '../databases/models/Location.js';
import Panorama from '../databases/models/Panorama.js';
import RefreshSession from '../databases/models/RefreshSession.js';
import User from '../databases/models/User.js';
import { ensureAdmin } from '../microservices/adminBootstrap.js';
import { hashPassword } from '../microservices/authService.js';
import { generateUniqueUsername } from '../microservices/usernameService.js';
import { seedLocations } from '../seeders/seedLocations.js';
import { ingestManifest, verifyCorpus } from './ingestRagCorpus.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const PENDING_ADMIN_EMAIL = 'pending-admin@e2e.local';
const PENDING_ADMIN_PASSWORD = 'PendingE2E12345';
const INSPECTOR_PASSWORD = 'InspectorE2E123';
const HISTORIAN_EMAIL = 'historian@e2e.local';
const HISTORIAN_PASSWORD = 'HistorianE2E123';

// Corpus que usa la evaluación dorada: 14 fuentes activas (S-005 y S-023
// quedan fuera, igual que en scripts/evaluateRagCorpus.js). Solo se ingiere
// cuando el entorno que lanza la suite pide el corpus RAG a propósito.
const RAG_CORPUS_MANIFESTS = [
  'S-002',
  'S-003',
  'S-020',
  'S-021',
  'S-022',
  'S-024',
  'S-025',
  'S-026',
  'S-027',
  'S-028',
  'S-029',
  'S-030',
  'S-031',
  'S-032',
];

/**
 * Ingresa el corpus de la guía en la base E2E recién dropeada. Los manifiestos
 * declaran como verificador de derechos al historiador del entorno de
 * desarrollo; aquí se sustituye en memoria por el historiador E2E recién
 * creado, que es el único historiador activo de esta base. La activación no es
 * necesaria: los 14 manifiestos ya declaran status=active.
 */
async function ingestE2eCorpus(historian) {
  const startedAt = Date.now();
  const admin = await User.findOne({
    email: ADMIN_EMAIL,
    isActive: true,
    mustChangePassword: false,
  }).lean();

  if (!admin) {
    throw new Error('No se encontró el administrador E2E para ingerir el corpus.');
  }

  let chunkTotal = 0;

  for (const sourceId of RAG_CORPUS_MANIFESTS) {
    const manifestPath = path.join(
      backendRoot,
      'corpus',
      'manifests',
      `${sourceId}.json`,
    );
    const input = JSON.parse(await readFile(manifestPath, 'utf8'));
    input.source.rightsVerifiedBy = historian._id.toString();

    const { applied, summary } = await ingestManifest({
      input,
      actor: admin,
      apply: true,
    });

    if (!applied) {
      throw new Error(`La ingesta de ${sourceId} no se aplicó.`);
    }

    chunkTotal += summary.chunkCount;
    console.log(
      `[e2e] RAG: ${sourceId} ingerida (${summary.status}, ${summary.chunkCount} fragmentos).`,
    );
  }

  const verification = await verifyCorpus();

  if (!verification.ok) {
    throw new Error(
      `Corpus RAG inválido en E2E: ${verification.problems.join(' | ')}`,
    );
  }

  console.log(
    `[e2e] RAG: corpus verificado (${verification.documentCount} fuentes, ` +
      `${verification.chunkCount} fragmentos, ${Date.now() - startedAt} ms ` +
      'desde el arranque de la ingesta, embeddings incluidos).',
  );
}

async function ensureInspector({ email, name }) {
  const passwordHash = await hashPassword(INSPECTOR_PASSWORD);
  return User.create({
    name,
    email,
    username: await generateUniqueUsername({ name, email }),
    passwordHash,
    role: 'inspector',
    mustChangePassword: false,
  });
}

async function ensureHistorian({ email, name }) {
  const passwordHash = await hashPassword(HISTORIAN_PASSWORD);
  return User.create({
    name,
    email,
    username: await generateUniqueUsername({ name, email }),
    passwordHash,
    role: 'historian',
    mustChangePassword: false,
  });
}

async function prepareDatabase() {
  if (!config.mongoUri.includes('_e2e')) {
    throw new Error(
      'El servidor E2E solo puede usar una base de datos cuyo nombre contenga "_e2e".',
    );
  }

  await connectDB();
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    RefreshSession.init(),
    Location.init(),
    AuditLog.init(),
    Panorama.init(),
  ]);
  await seedLocations();

  const admin = await ensureAdmin({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: 'Admin E2E',
  });

  await User.updateOne(
    { _id: admin.user._id },
    { $set: { mustChangePassword: false } },
  );

  await ensureAdmin({
    email: PENDING_ADMIN_EMAIL,
    password: PENDING_ADMIN_PASSWORD,
    name: 'Admin Pendiente E2E',
  });

  await ensureInspector({
    email: 'inspector1@e2e.local',
    name: 'Inspector Uno E2E',
  });
  await ensureInspector({
    email: 'inspector2@e2e.local',
    name: 'Inspector Dos E2E',
  });

  const historian = await ensureHistorian({
    email: HISTORIAN_EMAIL,
    name: 'Historiador E2E',
  });

  if (config.assistant.touristEnabled && config.assistant.corpusVersion) {
    console.log(
      `[e2e] Guía turística habilitada (corpus ${config.assistant.corpusVersion}): ingeriendo el corpus en la base E2E…`,
    );
    await ingestE2eCorpus(historian);
  } else {
    console.log(
      '[e2e] Guía turística sin corpus RAG en E2E (modo por defecto): no se ingiere corpus.',
    );
  }

  console.log(
    '[e2e] Base de datos reiniciada con 23 POI publicados, un admin operativo, un admin pendiente de cambio de contraseña, dos inspectores y un historiador.',
  );
}

prepareDatabase()
  .then(() => import('../bin/server.js'))
  .catch(async (error) => {
    console.error('[e2e] No se pudo preparar el entorno:', error);
    await disconnectDB();
    process.exitCode = 1;
  });
