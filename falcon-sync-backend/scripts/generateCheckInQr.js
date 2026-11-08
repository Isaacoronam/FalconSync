import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB, disconnectDB } from "../src/config/db.js";
import AuditLog from "../src/models/AuditLog.js";
import Location from "../src/models/Location.js";
import User from "../src/models/User.js";
import {
  createCheckInToken,
  hashCheckInToken,
} from "../src/services/checkInTokenService.js";
import { renderCheckInQr } from "../src/services/qrService.js";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".qr-codes",
);

async function findAuditActor() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  return User.findOne({ email, role: "admin" });
}

async function recordAudit(actor, location) {
  if (!actor) {
    return;
  }

  try {
    await AuditLog.create({
      action: "location.qr.rotated",
      actor: actor._id,
      actorEmail: actor.email,
      entityType: "Location",
      entityId: location._id,
      summary: `Rotó el QR de check-in del POI «${location.title}»`,
      metadata: {
        slug: location.slug,
        tokenVersion: location.checkInTokenVersion,
        source: "generateCheckInQr",
      },
    });
  } catch (error) {
    console.warn(
      "[qr:generate] No se pudo registrar la auditoría:",
      error.message,
    );
  }
}

function decodeDataUrl(dataUrl) {
  const [header, payload] = dataUrl.split(",");
  const match = /^data:([^;]+);base64$/.exec(header);

  if (!match || !payload) {
    throw new Error("La imagen QR no tiene el formato data URL esperado");
  }

  return Buffer.from(payload, "base64");
}

async function generateQrCodes() {
  const actor = await findAuditActor();

  if (!actor) {
    console.warn(
      "[qr:generate] No se encontró un administrador para la auditoría; se continuará sin registrar auditoría.",
    );
  }

  const candidates = await Location.find({
    status: "published",
    deletedAt: null,
    isCatalogVisible: { $ne: false },
  })
    .select("+checkInTokenHash")
    .sort({ title: 1 });

  const generated = [];
  let skipped = 0;

  for (const location of candidates) {
    const hasToken =
      Boolean(location.checkInTokenHash) ||
      (location.checkInTokenVersion ?? 0) > 0;

    if (hasToken && !FORCE) {
      skipped += 1;
      console.log(
        `[qr:generate] Ya tiene QR, se omite: ${location.slug} (v${location.checkInTokenVersion})`,
      );
      continue;
    }

    if (!APPLY) {
      console.log(`[qr:generate:dry-run] Rotaría el QR de: ${location.slug}`);
      generated.push({
        slug: location.slug,
        title: location.title,
        locationId: location._id.toString(),
        tokenVersion: (location.checkInTokenVersion ?? 0) + 1,
        rotatedAt: null,
        file: `${location.slug}.svg`,
        dryRun: true,
      });
      continue;
    }

    const token = createCheckInToken();
    const rotatedAt = new Date();

    location.checkInTokenHash = hashCheckInToken(token);
    location.checkInTokenVersion = (location.checkInTokenVersion ?? 0) + 1;
    location.checkInTokenRotatedAt = rotatedAt;
    location.updatedBy = actor?._id ?? location.updatedBy;

    await location.save();

    const qr = await renderCheckInQr({
      locationId: location._id,
      token,
      format: "svg",
    });
    const file = `${location.slug}.svg`;

    await writeFile(path.join(OUTPUT_DIR, file), decodeDataUrl(qr.dataUrl));

    await recordAudit(actor, location);

    generated.push({
      slug: location.slug,
      title: location.title,
      locationId: location._id.toString(),
      tokenVersion: location.checkInTokenVersion,
      rotatedAt: rotatedAt.toISOString(),
      file,
    });

    console.log(
      `[qr:generate] QR generado: ${location.slug} (v${location.checkInTokenVersion})`,
    );
  }

  if (APPLY && generated.length > 0) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(
      path.join(OUTPUT_DIR, "manifest.json"),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          count: generated.length,
          items: generated,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  console.log(
    `[qr:generate] ${generated.length} ${APPLY ? "generados" : "por generar"}, ${skipped} omitidos por tener QR vigente.`,
  );

  if (!APPLY) {
    console.log(
      "[qr:generate] Modo simulación. Ejecuta con --apply para rotar y guardar los QR. Usa --force solo si quieres invalidar los QR existentes.",
    );
    return { generated, skipped };
  }

  if (generated.length > 0) {
    console.log(`[qr:generate] Archivos en: ${OUTPUT_DIR}`);
    console.log(
      "[qr:generate] No commitees esta carpeta: los SVG contienen tokens de check-in.",
    );
  }

  return { generated, skipped };
}

async function main() {
  await connectDB();

  try {
    if (APPLY) {
      await mkdir(OUTPUT_DIR, { recursive: true });
    }

    await generateQrCodes();
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error("[qr:generate] Error:", error);
  process.exitCode = 1;
});
