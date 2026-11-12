import { connectDB, disconnectDB } from "../src/config/db.js";
import AuditLog from "../src/models/AuditLog.js";
import Location from "../src/models/Location.js";
import User from "../src/models/User.js";
import { locations } from "./seedLocations.js";

const APPLY = process.argv.includes("--apply");

async function findAuditActor() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  return User.findOne({ email, role: "admin" });
}

async function recordAudit(actor, { entityId, summary, metadata }) {
  if (!actor) {
    return;
  }

  try {
    await AuditLog.create({
      action: "location.updated",
      actor: actor._id,
      actorEmail: actor.email,
      entityType: "Location",
      entityId,
      summary,
      metadata: { ...metadata, source: "publishLocations" },
    });
  } catch (error) {
    console.warn(
      "[publish:pois] No se pudo registrar la auditoría:",
      error.message,
    );
  }
}

async function publishLocations() {
  const actor = await findAuditActor();

  if (!actor) {
    console.warn(
      "[publish:pois] No se encontró un administrador para la auditoría; se continuará sin registrar auditoría.",
    );
  }

  let published = 0;
  let unchanged = 0;
  let skipped = 0;
  let missing = 0;

  for (const expected of locations) {
    if (expected.status !== "published") {
      skipped += 1;
      continue;
    }

    const location = await Location.findOne({ slug: expected.slug });

    if (!location) {
      missing += 1;
      console.warn(`[publish:pois] Falta en la base de datos: ${expected.slug}`);
      continue;
    }

    if (location.deletedAt || location.status === "archived") {
      skipped += 1;
      console.warn(
        `[publish:pois] Archivado, se omite: ${expected.slug}`,
      );
      continue;
    }

    if (
      location.status === "published" &&
      !location.isProvisional &&
      location.coordinateVerifiedAt
    ) {
      unchanged += 1;
      continue;
    }

    const changedFields = [];

    if (location.status !== "published") {
      changedFields.push("status");
      location.status = "published";
    }

    if (location.isProvisional) {
      changedFields.push("isProvisional");
      location.isProvisional = false;
    }

    if (!location.coordinateVerifiedAt) {
      changedFields.push("coordinateVerifiedAt");
      location.coordinateVerifiedAt = new Date(
        expected.coordinateVerifiedAt ?? Date.now(),
      );
    }

    if (location.verificationLevel !== expected.verificationLevel) {
      changedFields.push("verificationLevel");
      location.verificationLevel = expected.verificationLevel ?? "unverified";
    }

    if (location.isCatalogVisible !== (expected.isCatalogVisible !== false)) {
      changedFields.push("isCatalogVisible");
      location.isCatalogVisible = expected.isCatalogVisible !== false;
    }

    if (
      expected.checkInRadiusMeters !== undefined &&
      location.checkInRadiusMeters !== expected.checkInRadiusMeters
    ) {
      changedFields.push("checkInRadiusMeters");
      location.checkInRadiusMeters = expected.checkInRadiusMeters;
    }

    if (
      expected.coordinateSource &&
      location.coordinateSource !== expected.coordinateSource
    ) {
      changedFields.push("coordinateSource");
      location.coordinateSource = expected.coordinateSource;
    }

    if (changedFields.length === 0) {
      unchanged += 1;
      continue;
    }

    if (actor) {
      location.updatedBy = actor._id;
    }

    if (!APPLY) {
      console.log(
        `[publish:pois:dry-run] ${expected.slug}: ${changedFields.join(", ")}`,
      );
      published += 1;
      continue;
    }

    await location.save();
    await recordAudit(actor, {
      entityId: location._id,
      summary: `Publicó el POI «${location.title}» para check-in`,
      metadata: {
        slug: location.slug,
        changedFields,
        verificationLevel: location.verificationLevel,
      },
    });

    published += 1;
    console.log(
      `[publish:pois] Publicado: ${location.title} (${changedFields.join(", ")})`,
    );
  }

  const summary =
    `[publish:pois] ${published} ${APPLY ? "publicados" : "por publicar"}, ` +
    `${unchanged} ya publicados, ${skipped} omitidos, ${missing} ausentes.`;

  console.log(summary);

  if (!APPLY) {
    console.log(
      "[publish:pois] Modo simulación. Ejecuta con --apply para guardar los cambios.",
    );
  }

  return { published, unchanged, skipped, missing };
}

async function main() {
  await connectDB();

  try {
    await publishLocations();
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error("[publish:pois] Error:", error);
  process.exitCode = 1;
});
