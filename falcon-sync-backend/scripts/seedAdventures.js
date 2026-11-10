import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../src/config/db.js";
import Adventure from "../src/models/Adventure.js";
import AdventureStop from "../src/models/AdventureStop.js";
import AuditLog from "../src/models/AuditLog.js";
import Location from "../src/models/Location.js";
import User from "../src/models/User.js";

const VERIFY = process.argv.includes("--verify");

export const adventures = [
  {
    title: "Ruta del Casco Histórico de Coro",
    slug: "ruta-del-casco-historico-de-coro",
    summary:
      "Cinco hitos del casco histórico para leer la ciudad colonial: fe, vivienda, comercio y espacio público en un recorrido a pie.",
    description:
      "La Ruta del Casco Histórico propone un recorrido peatonal por cinco lugares emblemáticos de Santa Ana de Coro. La visita comienza frente a la Catedral, continúa por dos casonas coloniales, atraviesa la Plaza Bolívar y cierra en el Arco de la Federación. Cada parada invita a observar la arquitectura, el trazado urbano y la memoria de una ciudad inscrita en la Lista del Patrimonio Mundial. El recorrido está pensado para hacerse con calma, en familia o en grupo, y puede completarse en unas dos horas. Las paradas son independientes: cada check-in queda registrado aunque no se complete la ruta en un solo día.",
    difficulty: "easy",
    estimatedMinutes: 120,
    coverImage: "/images/locations/catedral-de-coro.jpg",
    badge: {
      name: "Cronista de Coro",
      description:
        "Completa las cinco paradas de la Ruta del Casco Histórico y recibe la insignia de cronista.",
      image: "/images/locations/arco-de-la-federacion.jpg",
    },
    status: "published",
    stops: [
      {
        slug: "catedral-de-coro",
        didacticText:
          "La Basílica Catedral de Santa Ana preside la Plaza Bolívar. Observa la fachada y el campanario: son testimonios de las distintas etapas constructivas del templo, iniciado en el siglo XVI y transformado durante la Colonia.",
        instructions:
          "Ubícate frente a la entrada principal de la catedral, sobre la Plaza Bolívar, y registra tu check-in cuando estés dentro del radio permitido.",
      },
      {
        slug: "casa-de-las-ventanas-de-hierro",
        didacticText:
          "Esta casona del siglo XVII es conocida por su portal de gran altura y por los ventanales protegidos con hierro forjado. Fíjate en cómo la vivienda colonial organiza la fachada hacia la calle y reserva el interior para la vida doméstica.",
        instructions:
          "Recorre la fachada desde la acera y evita interrumpir el paso. El check-in se habilita cerca del acceso principal.",
      },
      {
        slug: "casa-del-sol",
        didacticText:
          "En la esquina de Zamora y Federación, la Casa del Sol muestra un sol sobre la puerta principal. Su volumen y sus vanos ayudan a entender la escala de la arquitectura doméstica del centro histórico.",
        instructions:
          "Sitúate en la esquina de la casa, sin bloquear la circulación peatonal, y registra la visita.",
      },
      {
        slug: "plaza-bolivar-de-coro",
        didacticText:
          "La Plaza Bolívar articula el casco histórico y concentra edificios civiles y religiosos. Su trazado recuerda la importancia de la plaza mayor como espacio de encuentro, comercio y representación pública.",
        instructions:
          "Elige un punto despejado de la plaza, junto a la fuente o los jardines, y completa el check-in.",
      },
      {
        slug: "arco-de-la-federacion",
        didacticText:
          "El Arco de la Federación conmemora un episodio de la historia política venezolana. Su presencia en el paisaje urbano invita a preguntar cómo los monumentos construyen la memoria colectiva de una ciudad.",
        instructions:
          "Acércate al monumento por la acera y registra tu check-in dentro del radio permitido.",
      },
    ],
  },
];

async function findAuditActor() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (email) {
    return User.findOne({ email, role: "admin" });
  }

  return User.findOne({ role: "admin" }).sort({ createdAt: 1 });
}

async function recordAudit(actor, adventure, action, summary, metadata = {}) {
  if (!actor) {
    return;
  }

  try {
    await AuditLog.create({
      action,
      actor: actor._id,
      actorEmail: actor.email,
      entityType: "Adventure",
      entityId: adventure._id,
      summary,
      metadata: { slug: adventure.slug, source: "seedAdventures", ...metadata },
    });
  } catch (error) {
    console.warn(
      "[seed:adventures] No se pudo registrar la auditoría:",
      error.message,
    );
  }
}

async function resolveStops(seed) {
  const slugs = seed.stops.map((stop) => stop.slug);
  const locations = await Location.find({ slug: { $in: slugs } }).select(
    "title slug status deletedAt isProvisional isCatalogVisible",
  );
  const bySlug = new Map(locations.map((location) => [location.slug, location]));
  const missing = [];
  const unavailable = [];

  for (const stop of seed.stops) {
    const location = bySlug.get(stop.slug);

    if (!location) {
      missing.push(stop.slug);
      continue;
    }

    if (
      location.status !== "published" ||
      location.deletedAt ||
      location.isProvisional ||
      location.isCatalogVisible === false
    ) {
      unavailable.push(stop.slug);
    }
  }

  if (missing.length > 0 || unavailable.length > 0) {
    throw new Error(
      `[seed:adventures] Paradas no disponibles: ${
        [...missing, ...unavailable].join(", ") || "ninguna"
      }. Ejecuta primero la publicación del catálogo de POI.`,
    );
  }

  return new Map(
    [...bySlug.entries()].map(([slug, location]) => [slug, location]),
  );
}

async function syncStops(adventure, seed, locations) {
  const existing = await AdventureStop.find({ adventure: adventure._id }).sort({
    order: 1,
  });
  const desiredLocationIds = new Set(
    seed.stops.map((stop) => locations.get(stop.slug)._id.toString()),
  );

  if (existing.length > 0) {
    await AdventureStop.bulkWrite(
      existing.map((stop, index) => ({
        updateOne: {
          filter: { _id: stop._id },
          update: { $set: { order: -(index + 1) } },
        },
      })),
    );
  }

  for (const [index, stop] of seed.stops.entries()) {
    const location = locations.get(stop.slug);

    await AdventureStop.findOneAndUpdate(
      { adventure: adventure._id, location: location._id },
      {
        $set: {
          order: index + 1,
          didacticText: stop.didacticText,
          instructions: stop.instructions,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );
  }

  await AdventureStop.deleteMany({
    adventure: adventure._id,
    location: { $nin: [...desiredLocationIds] },
  });
}

async function seedAdventure(seed, actor) {
  const locations = await resolveStops(seed);
  let adventure = await Adventure.findOne({ slug: seed.slug });
  let created = false;

  if (adventure?.deletedAt || adventure?.status === "archived") {
    console.warn(
      `[seed:adventures] La aventura ${seed.slug} está archivada; se omite.`,
    );
    return { skipped: true };
  }

  const payload = {
    title: seed.title,
    slug: seed.slug,
    summary: seed.summary,
    description: seed.description,
    difficulty: seed.difficulty,
    estimatedMinutes: seed.estimatedMinutes,
    coverImage: seed.coverImage,
    badge: seed.badge,
    status: "published",
    updatedBy: actor?._id ?? null,
  };

  if (!adventure) {
    adventure = await Adventure.create({
      ...payload,
      createdBy: actor?._id ?? null,
    });
    created = true;
    console.log(`[seed:adventures] Creada: ${adventure.title}`);
    await recordAudit(
      actor,
      adventure,
      "adventure.created",
      `Creó la aventura «${adventure.title}» desde el seed`,
    );
  } else {
    Object.assign(adventure, payload);
    await adventure.save();
    console.log(`[seed:adventures] Actualizada: ${adventure.title}`);
    await recordAudit(
      actor,
      adventure,
      "adventure.updated",
      `Actualizó la aventura «${adventure.title}» desde el seed`,
    );
  }

  await syncStops(adventure, seed, locations);
  const total = await AdventureStop.countDocuments({ adventure: adventure._id });

  console.log(
    `[seed:adventures] ${created ? "Creada" : "Sincronizada"}: ${
      adventure.slug
    } con ${total} paradas.`,
  );

  return { adventure, created, total };
}

async function verifyAdventure(seed) {
  const adventure = await Adventure.findOne({ slug: seed.slug });

  if (!adventure) {
    throw new Error(`[seed:adventures:verify] Falta ${seed.slug}`);
  }

  if (adventure.status !== "published" || adventure.deletedAt) {
    throw new Error(
      `[seed:adventures:verify] ${seed.slug} no está publicada y activa`,
    );
  }

  const stops = await AdventureStop.find({ adventure: adventure._id })
    .sort({ order: 1 })
    .populate({
      path: "location",
      select: "title slug status deletedAt isProvisional isCatalogVisible",
    });

  if (stops.length !== seed.stops.length) {
    throw new Error(
      `[seed:adventures:verify] ${seed.slug} tiene ${stops.length} paradas; se esperaban ${seed.stops.length}`,
    );
  }

  const expectedSlugs = seed.stops.map((stop) => stop.slug);

  stops.forEach((stop, index) => {
    const location = stop.location;

    if (!location) {
      throw new Error(
        `[seed:adventures:verify] La parada ${index + 1} no resuelve su POI`,
      );
    }

    if (location.slug !== expectedSlugs[index] || stop.order !== index + 1) {
      throw new Error(
        `[seed:adventures:verify] Orden inesperado en la parada ${index + 1}: ${location.slug}`,
      );
    }

    if (
      location.status !== "published" ||
      location.deletedAt ||
      location.isProvisional ||
      location.isCatalogVisible === false
    ) {
      throw new Error(
        `[seed:adventures:verify] La parada ${location.slug} no está disponible para check-in`,
      );
    }
  });

  console.log(
    `[seed:adventures:verify] ${seed.slug}: published, ${stops.length} paradas, orden y disponibilidad correctos.`,
  );
}

async function main() {
  await connectDB();

  try {
    if (VERIFY) {
      for (const seed of adventures) {
        await verifyAdventure(seed);
      }

      return;
    }

    const actor = await findAuditActor();

    if (!actor) {
      console.warn(
        "[seed:adventures] No se encontró un administrador para la auditoría; se continuará sin registrar auditoría.",
      );
    }

    for (const seed of adventures) {
      await seedAdventure(seed, actor);
    }
  } finally {
    await disconnectDB();
  }
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error) => {
    console.error("[seed:adventures] Error:", error.message);
    process.exitCode = 1;
  });
}