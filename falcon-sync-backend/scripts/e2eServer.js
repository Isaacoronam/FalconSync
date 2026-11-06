import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import AuditLog from '../src/models/AuditLog.js';
import Location from '../src/models/Location.js';
import RefreshSession from '../src/models/RefreshSession.js';
import User from '../src/models/User.js';
import { ensureAdmin } from '../src/services/adminBootstrap.js';
import { seedLocations } from './seedLocations.js';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const PENDING_ADMIN_EMAIL = 'pending-admin@e2e.local';
const PENDING_ADMIN_PASSWORD = 'PendingE2E12345';

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

  console.log(
    '[e2e] Base de datos reiniciada con 6 POI, un admin operativo y un admin pendiente de cambio de contraseña.',
  );
}

prepareDatabase()
  .then(() => import('../src/server.js'))
  .catch(async (error) => {
    console.error('[e2e] No se pudo preparar el entorno:', error);
    await disconnectDB();
    process.exitCode = 1;
  });
