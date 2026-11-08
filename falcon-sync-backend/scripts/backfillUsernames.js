import { connectDB, disconnectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import { generateUniqueUsername } from "../src/services/usernameService.js";

async function backfillUsernames() {
  await User.init();

  const users = await User.find({
    $or: [
      { username: { $exists: false } },
      { username: null },
      { username: "" },
    ],
  }).sort({ createdAt: 1 });

  if (users.length === 0) {
    console.log("[backfill:usernames] No hay usuarios sin nombre de usuario.");
    return { updated: 0 };
  }

  let updated = 0;

  for (const user of users) {
    user.username = await generateUniqueUsername({
      name: user.name,
      email: user.email,
      excludeUserId: user._id,
    });
    await user.save();
    updated += 1;
    console.log(
      `[backfill:usernames] ${user.email} -> ${user.username}`,
    );
  }

  console.log(
    `[backfill:usernames] ${updated} usuarios actualizados con nombre de usuario.`,
  );

  return { updated };
}

async function main() {
  await connectDB();

  try {
    await backfillUsernames();
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error("[backfill:usernames] Error:", error.message);
  process.exitCode = 1;
});
