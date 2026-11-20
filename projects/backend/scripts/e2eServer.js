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

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const PENDING_ADMIN_EMAIL = 'pending-admin@e2e.local';
const PENDING_ADMIN_PASSWORD = 'PendingE2E12345';
const INSPECTOR_PASSWORD = 'InspectorE2E123';
const HISTORIAN_EMAIL = 'historian@e2e.local';
const HISTORIAN_PASSWORD = 'HistorianE2E123';

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

  await ensureHistorian({
    email: HISTORIAN_EMAIL,
    name: 'Historiador E2E',
  });

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
