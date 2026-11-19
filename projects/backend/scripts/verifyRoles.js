import { connectDB, disconnectDB } from '../databases/db.js';
import User, { USER_ROLES } from '../databases/models/User.js';

async function verifyRoles() {
  const [roleCounts, activeAdmins, unknownRoles] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 } } }]),
    User.countDocuments({ role: 'admin', isActive: true }),
    User.countDocuments({ role: { $nin: USER_ROLES } }),
  ]);

  const totals = Object.fromEntries(
    roleCounts.map(({ _id, total }) => [_id, total]),
  );

  console.log('[verify:roles] Distribución de roles:');

  for (const role of USER_ROLES) {
    console.log(` - ${role}: ${totals[role] ?? 0}`);
  }

  console.log(` - administradores activos: ${activeAdmins}`);

  const problems = [];

  if ((totals.moderator ?? 0) > 0) {
    problems.push(
      `Quedan ${totals.moderator} cuentas con rol moderator. Ejecuta migrate:roles --apply.`,
    );
  }

  if (activeAdmins === 0) {
    problems.push('No hay ningún administrador activo.');
  }

  if (unknownRoles > 0) {
    problems.push(`Hay ${unknownRoles} cuentas con un rol fuera del enum.`);
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`[verify:roles] ${problem}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log('[verify:roles] OK: sin moderator, con administrador activo.');
}

async function main() {
  await connectDB();

  try {
    await verifyRoles();
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error('[verify:roles] Error:', error.message);
  process.exitCode = 1;
});
