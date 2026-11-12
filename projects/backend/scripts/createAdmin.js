import { connectDB, disconnectDB } from '../src/config/db.js';
import { ensureAdmin } from '../src/services/adminBootstrap.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME;

async function createAdmin() {
  if (!email || !password || !name) {
    throw new Error(
      'Define ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_NAME en el entorno o en .env antes de ejecutar el script.',
    );
  }

  await connectDB();
  const result = await ensureAdmin({ email, password, name });

  if (result.created) {
    console.log(
      `[createAdmin] Administrador creado: ${result.user.email}. Debe cambiar la contraseña en el primer acceso.`,
    );
    return;
  }

  if (result.updated) {
    console.log(
      `[createAdmin] El usuario ${result.user.email} ya existía y fue promovido/activado como administrador. La contraseña no se modificó.`,
    );
    return;
  }

  console.log(
    `[createAdmin] El administrador ${result.user.email} ya existía. No se hicieron cambios.`,
  );
}

createAdmin()
  .catch((error) => {
    console.error('[createAdmin] Error:', error.message);
    if (error.details) {
      console.error('[createAdmin] Detalles:', error.details.join('; '));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
