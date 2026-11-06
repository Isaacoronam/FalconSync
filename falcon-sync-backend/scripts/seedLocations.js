import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../src/config/db.js";
import Location from "../src/models/Location.js";

export const locations = [
  {
    title: "Catedral de Coro",
    slug: "catedral-de-coro",
    category: "religious",
    description:
      "Basílica Catedral de Santa Ana, templo colonial frente a la Plaza Bolívar. Forma parte del conjunto histórico de Coro y su puerto, declarado Patrimonio Mundial por la UNESCO en 1993.",
    historicalPeriod: "Siglos XVI-XVIII",
    location: {
      type: "Point",
      coordinates: [-69.6778073, 11.4075246],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/way/370610638",
    images: ["/images/locations/catedral-de-coro.jpg"],
    isProvisional: false,
  },
  {
    title: "Casa de las Ventanas de Hierro",
    slug: "casa-de-las-ventanas-de-hierro",
    category: "architecture",
    description:
      "Casona colonial del siglo XVII con un portal de más de ocho metros y ventanales protegidos por una estructura de hierro forjado importada de Sevilla. Es una de las casas emblemáticas del casco histórico de Coro.",
    historicalPeriod: "Siglo XVII",
    location: {
      type: "Point",
      coordinates: [-69.6799844, 11.4089625],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://plus.codes/773GC85C+H2J",
    images: ["/images/locations/casa-de-las-ventanas-de-hierro.jpg"],
    isProvisional: false,
  },
  {
    title: "Casa del Sol",
    slug: "casa-del-sol",
    category: "architecture",
    description:
      "Casa colonial del siglo XVII ubicada en la esquina de las calles Zamora y Federación, diagonal a la Iglesia de San Clemente. Su fachada principal muestra un sol sobre la puerta.",
    historicalPeriod: "Siglo XVII",
    location: {
      type: "Point",
      coordinates: [-69.6790501, 11.4089358],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/node/1122775758",
    images: ["/images/locations/casa-del-sol.jpg"],
    isProvisional: false,
  },
  {
    title: "Arco de la Federación",
    slug: "arco-de-la-federacion",
    category: "monument",
    description:
      "Monumento conmemorativo de la Federación Venezolana y uno de los hitos del casco histórico de Coro. Su ubicación y relevancia lo convierten en referencia del paisaje urbano patrimonial.",
    historicalPeriod: "Siglo XIX",
    location: {
      type: "Point",
      coordinates: [-69.6713859, 11.410797],
    },
    conservationStatus: "unknown",
    sourceUrl:
      "https://es.wikipedia.org/wiki/Arco_de_la_Federaci%C3%B3n_(Santa_Ana_de_Coro)",
    images: ["/images/locations/arco-de-la-federacion.jpg"],
    isProvisional: false,
  },
  {
    title: "Médanos de Coro",
    slug: "medanos-de-coro",
    category: "nature",
    description:
      "Campo de dunas del Parque Nacional Médanos de Coro, al norte de la ciudad. Es un paisaje natural emblemático del estado Falcón y un espacio de transición entre la ciudad patrimonial y la costa.",
    location: {
      type: "Point",
      coordinates: [-69.6577925, 11.4384496],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/relation/3461483",
    images: ["/images/locations/medanos-de-coro.jpg"],
    isProvisional: false,
  },
  {
    title: "Plaza Bolívar de Coro",
    slug: "plaza-bolivar-de-coro",
    category: "urban",
    description:
      "Plaza central del casco histórico, frente a la Catedral de Coro. Funciona como espacio de encuentro, referencia urbana y punto de partida para recorridos patrimoniales.",
    historicalPeriod: "Época colonial",
    location: {
      type: "Point",
      coordinates: [-69.6782276, 11.4072929],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/way/370610469",
    images: ["/images/locations/plaza-bolivar-de-coro.jpg"],
    isProvisional: false,
  },
];

async function seedLocations() {
  await connectDB();
  await Location.init();

  for (const location of locations) {
    await Location.findOneAndUpdate(
      { slug: location.slug },
      { $set: location },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      },
    );
    console.log(`[seed] ${location.title}`);
  }

  console.log(`[seed] ${locations.length} lugares sincronizados`);
}

export { seedLocations };

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  seedLocations()
    .catch((error) => {
      console.error("[seed] Error:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectDB();
    });
}
