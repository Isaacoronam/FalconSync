import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from '../databases/db.js';
import User from '../databases/models/User.js';
import { ingestManifest, verifyCorpus } from './ingestRagCorpus.js';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const manifestPath = path.join(
  backendRoot,
  'corpus',
  'manifests',
  'S-033.json',
);

async function main() {
  await connectDB();

  try {
    const admin = await User.findOne({
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
    });

    if (!admin) {
      throw new Error(
        'No hay un administrador operativo para ejecutar source.manage.',
      );
    }

    const historian = await User.findOne({
      role: 'historian',
      isActive: true,
    });

    if (!historian) {
      throw new Error(
        'No hay un historiador activo para verificar los derechos de S-033. Crea o activa un historiador antes de aplicar el corpus.',
      );
    }

    const input = JSON.parse(await readFile(manifestPath, 'utf8'));
    input.source.rightsVerifiedBy = historian._id.toString();

    const { applied, summary } = await ingestManifest({
      input,
      actor: admin,
      apply: true,
    });

    if (!applied) {
      throw new Error('La ingesta de S-033 no se aplicó.');
    }

    const verification = await verifyCorpus();

    console.log(
      `[rag:apply-poi] S-033 aplicada: ${summary.chunkCount} fragmentos; ` +
        `corpus con ${verification.documentCount} fuentes y ` +
        `${verification.chunkCount} fragmentos.`,
    );

    if (!verification.ok) {
      console.error(
        `[rag:apply-poi] Verificación con problemas: ${verification.problems.join(' | ')}`,
      );
      process.exitCode = 1;
    }
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error('[rag:apply-poi] Error:', error.message);
  process.exitCode = 1;
});
