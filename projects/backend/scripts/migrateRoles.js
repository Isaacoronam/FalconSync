import { connectDB, disconnectDB } from '../databases/db.js';
import AuditLog from '../databases/models/AuditLog.js';
import User from '../databases/models/User.js';
import { revokeAllUserSessions } from '../microservices/authService.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = !apply;

function actorEmailArgument() {
  const index = process.argv.indexOf('--actor-email');
  return index >= 0 ? process.argv[index + 1] : null;
}

async function resolveActor() {
  const requestedEmail = actorEmailArgument();

  if (requestedEmail) {
    return User.findOne({
      email: requestedEmail.trim().toLowerCase(),
      role: 'admin',
      isActive: true,
    });
  }

  return User.findOne({ role: 'admin', isActive: true }).sort({
    createdAt: 1,
  });
}

async function migrateRoles() {
  const moderators = await User.find({ role: 'moderator' }).sort({
    createdAt: 1,
  });

  console.log(
    `[migrate:roles] Cuentas con rol moderator: ${moderators.length}`,
  );

  for (const user of moderators) {
    console.log(` - ${user.email} (${user._id.toString()})`);
  }

  if (moderators.length === 0) {
    console.log('[migrate:roles] Nada que migrar.');
    return { migrated: 0, dryRun };
  }

  if (dryRun) {
    console.log(
      '[migrate:roles] Dry-run: no se escribió nada. Usa --apply para aplicar.',
    );
    return { migrated: 0, dryRun };
  }

  const actor = await resolveActor();

  if (!actor) {
    throw new Error(
      'No hay un administrador activo para atribuir la auditoría. Usa --actor-email o crea un administrador.',
    );
  }

  let migrated = 0;

  for (const user of moderators) {
    const previousRole = user.role;
    const previousTokenVersion = user.tokenVersion;

    try {
      user.role = 'historian';
      user.tokenVersion += 1;
      await user.save();
      await revokeAllUserSessions(user._id);

      await AuditLog.create({
        action: 'user.role.updated',
        actor: actor._id,
        actorEmail: actor.email,
        entityType: 'User',
        entityId: user._id,
        summary: `Migración de rol moderator → historian para ${user.email}`,
        metadata: {
          previousRole,
          newRole: 'historian',
          migration: 'expand-contract',
        },
      });

      migrated += 1;
      console.log(`[migrate:roles] Migrado: ${user.email}`);
    } catch (error) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            role: previousRole,
            tokenVersion: previousTokenVersion,
          },
        },
      );
      throw error;
    }
  }

  console.log(
    `[migrate:roles] ${migrated} cuentas migradas a historian; sesiones anteriores revocadas.`,
  );

  return { migrated, dryRun };
}

async function main() {
  await connectDB();

  try {
    await migrateRoles();
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error('[migrate:roles] Error:', error.message);
  process.exitCode = 1;
});
