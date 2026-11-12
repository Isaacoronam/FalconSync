import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import Adventure from '../src/models/Adventure.js';
import AdventureStop from '../src/models/AdventureStop.js';
import CheckIn from '../src/models/CheckIn.js';
import Location from '../src/models/Location.js';
import User from '../src/models/User.js';
import UserAchievement from '../src/models/UserAchievement.js';
import { reconcileUserAchievements } from '../src/services/achievementService.js';

const APPLY = process.argv.includes('--apply');
const ALLOW_PRODUCTION = process.argv.includes('--allow-production');
const USER_ARG = process.argv.find((argument) => argument.startsWith('--user='));
const USER_EMAIL = USER_ARG ? USER_ARG.slice('--user='.length).trim() : null;

function assertSafeTarget() {
  if (config.nodeEnv === 'production' && !ALLOW_PRODUCTION) {
    throw new Error(
      'El backfill no se ejecuta en producción sin --allow-production. Ejecuta primero en staging con respaldo verificado.',
    );
  }
}

async function resolveUsers() {
  if (USER_EMAIL) {
    const user = await User.findOne({
      email: USER_EMAIL.toLowerCase(),
    }).select('_id email');

    if (!user) {
      throw new Error(`No se encontró el usuario ${USER_EMAIL}`);
    }

    return [user];
  }

  const userIds = await CheckIn.distinct('user');

  return User.find({ _id: { $in: userIds } })
    .select('_id email')
    .sort({ createdAt: 1 });
}

async function main() {
  assertSafeTarget();
  await connectDB();
  await Promise.all([
    User.init(),
    Location.init(),
    Adventure.init(),
    AdventureStop.init(),
    CheckIn.init(),
    UserAchievement.init(),
  ]);

  const databaseName = mongoose.connection.name;
  const mode = APPLY ? 'aplicar' : 'simulación';
  console.log(
    `[backfill:achievements] Base: ${databaseName} · modo: ${mode}${
      APPLY ? '' : ' (usa --apply para escribir)'
    }`,
  );

  const users = await resolveUsers();
  let locationAwards = 0;

  for (const user of users) {
    const result = await reconcileUserAchievements(user._id, {
      dryRun: !APPLY,
    });
    const userLocationAwards = result.locationAwards.length;

    locationAwards += userLocationAwards;

    if (userLocationAwards > 0) {
      console.log(
        `[backfill:achievements] ${user.email}: +${userLocationAwards} lugares`,
      );
    }
  }

  console.log(
    `[backfill:achievements] ${users.length} usuarios procesados · ${locationAwards} insignias de lugar · modo ${mode}.`,
  );

  if (!APPLY) {
    console.log(
      '[backfill:achievements] No se escribió nada. Revisa el resultado y vuelve a ejecutar con --apply.',
    );
  }
}

main()
  .catch((error) => {
    console.error('[backfill:achievements] Error:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
