import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../src/config/db.js";
import Location from "../src/models/Location.js";
import { haversineDistanceMeters } from "../src/utils/geo.js";

const VERIFIED_AT = "2026-11-06T00:00:00.000Z";
const DISTANCE_WARNING_METERS = 25;
const DUPLICATE_WARNING_METERS = 10;
const REMOVED_LOCATION_SLUG = "mirador-del-pueblo";
const COORDINATE_SYNC_SLUGS = new Set(["parque-nacional-medanos-de-coro"]);

const commonsCredit = ({ author, sourceUrl, file }) => ({
  url: `/images/locations/${file}`,
  author,
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  sourceUrl,
});

const googleMapsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

export const locations = [
  {
    title: "Catedral de Coro",
    slug: "catedral-de-coro",
    category: "religious",
    description:
      "Basílica Catedral de Santa Ana, templo colonial frente a la Plaza Bolívar. Forma parte del conjunto histórico de Coro y su puerto, declarado Patrimonio Mundial por la UNESCO en 1993.",
    address: "Frente a la Plaza Bolívar, casco histórico de Coro",
    circuits: ["casco-historico"],
    tags: ["colonial", "unesco"],
    historicalPeriod: "Siglos XVI-XVIII",
    location: {
      type: "Point",
      coordinates: [-69.6778073, 11.4075246],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/way/370610638",
    coordinateSource: "OpenStreetMap way 370610638",
    coordinateVerifiedAt: VERIFIED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/catedral-de-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Casa de las Ventanas de Hierro",
    slug: "casa-de-las-ventanas-de-hierro",
    category: "architecture",
    description:
      "Casona colonial del siglo XVII con un portal de más de ocho metros y ventanales protegidos por una estructura de hierro forjado importada de Sevilla. Es una de las casas emblemáticas del casco histórico de Coro.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico"],
    tags: ["colonial", "unesco", "photogenic"],
    historicalPeriod: "Siglo XVII",
    location: {
      type: "Point",
      coordinates: [-69.6799844, 11.4089625],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://plus.codes/773GC85C+H2J",
    coordinateSource: "Google Maps, Plus Code 773GC85C+H2J",
    coordinateVerifiedAt: VERIFIED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/casa-de-las-ventanas-de-hierro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Casa del Sol",
    slug: "casa-del-sol",
    category: "architecture",
    description:
      "Casa colonial del siglo XVII ubicada en la esquina de las calles Zamora y Federación, diagonal a la Iglesia de San Clemente. Su fachada principal muestra un sol sobre la puerta.",
    address: "Esquina de las calles Zamora y Federación, casco histórico de Coro",
    circuits: ["casco-historico"],
    tags: ["colonial", "unesco", "photogenic"],
    historicalPeriod: "Siglo XVII",
    location: {
      type: "Point",
      coordinates: [-69.6790501, 11.4089358],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/node/1122775758",
    coordinateSource: "OpenStreetMap node 1122775758",
    coordinateVerifiedAt: VERIFIED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/casa-del-sol.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Arco de la Federación",
    slug: "arco-de-la-federacion",
    category: "monument",
    description:
      "Monumento conmemorativo de la Federación Venezolana y uno de los hitos del casco histórico de Coro. Su ubicación y relevancia lo convierten en referencia del paisaje urbano patrimonial.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico", "espacios-urbanos"],
    tags: ["unesco", "photogenic", "free-entry"],
    historicalPeriod: "Siglo XIX",
    location: {
      type: "Point",
      coordinates: [-69.6713859, 11.410797],
    },
    conservationStatus: "unknown",
    sourceUrl:
      "https://es.wikipedia.org/wiki/Arco_de_la_Federaci%C3%B3n_(Santa_Ana_de_Coro)",
    coordinateSource: "Wikipedia en español, artículo del Arco de la Federación",
    coordinateVerifiedAt: VERIFIED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/arco-de-la-federacion.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Médanos de Coro",
    slug: "medanos-de-coro",
    category: "nature",
    description:
      "Campo de dunas del Parque Nacional Médanos de Coro, al norte de la ciudad. Es un paisaje natural emblemático del estado Falcón y un espacio de transición entre la ciudad patrimonial y la costa.",
    address: "Parque Nacional Médanos de Coro, al norte de la ciudad",
    circuits: ["naturaleza-miradores"],
    tags: ["family", "photogenic"],
    location: {
      type: "Point",
      coordinates: [-69.6577925, 11.4384496],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/relation/3461483",
    coordinateSource: "OpenStreetMap relation 3461483",
    coordinateVerifiedAt: VERIFIED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/medanos-de-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Parque Nacional Médanos de Coro",
    slug: "parque-nacional-medanos-de-coro",
    category: "nature",
    description:
      "Entrada principal del Parque Nacional Médanos de Coro, sobre la vía Coro–Punto Fijo. Es el acceso de referencia para iniciar la visita a las dunas y al paisaje natural protegido.",
    address:
      "Antigua Carretera, junto al par vial Coro–Punto Fijo, Estado Falcón, Venezuela",
    circuits: ["naturaleza-miradores"],
    tags: ["family", "photogenic"],
    location: {
      type: "Point",
      coordinates: [-69.6677, 11.437],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/way/573233913",
    coordinateSource:
      "Ubicación aproximada junto a Antigua Carretera y el par vial Coro–Punto Fijo; referencia OpenStreetMap way 573233913",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/parque-nacional-medanos-de-coro.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Plaza Bolívar de Coro",
    slug: "plaza-bolivar-de-coro",
    category: "urban",
    description:
      "Plaza central del casco histórico, frente a la Catedral de Coro. Funciona como espacio de encuentro, referencia urbana y punto de partida para recorridos patrimoniales.",
    address: "Casco histórico de Coro, frente a la Catedral",
    circuits: ["casco-historico", "espacios-urbanos"],
    tags: ["colonial", "unesco", "free-entry", "family", "photogenic"],
    historicalPeriod: "Época colonial",
    location: {
      type: "Point",
      coordinates: [-69.6782276, 11.4072929],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/way/370610469",
    coordinateSource: "OpenStreetMap way 370610469",
    coordinateVerifiedAt: VERIFIED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/plaza-bolivar-de-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Iglesia de San Francisco",
    slug: "iglesia-de-san-francisco",
    category: "religious",
    description:
      "Templo católico del casco histórico de Coro, integrante del conjunto religioso y arquitectónico declarado Patrimonio Mundial por la UNESCO. Su fachada y volumetría forman parte del paisaje patrimonial de la ciudad.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico"],
    tags: ["colonial", "unesco", "photogenic"],
    historicalPeriod: "Época colonial",
    location: {
      type: "Point",
      coordinates: [-69.6780331, 11.4094245],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/node/1757367724",
    coordinateSource: "OpenStreetMap node 1757367724",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/iglesia-de-san-francisco.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Janethrodri",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Iglesia_de_San_Francisco,_Coro.jpg",
        file: "iglesia-de-san-francisco.jpg",
      }),
    ],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Iglesia de San Clemente",
    slug: "iglesia-de-san-clemente",
    category: "religious",
    description:
      "Templo católico del casco histórico de Coro, ubicado en el área patrimonial declarada por la UNESCO. Es uno de los hitos religiosos que articulan el recorrido por las calles coloniales de la ciudad.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico"],
    tags: ["colonial", "unesco", "photogenic"],
    historicalPeriod: "Época colonial",
    location: {
      type: "Point",
      coordinates: [-69.6789163, 11.4091188],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/way/1194221626",
    coordinateSource: "OpenStreetMap way 1194221626",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/iglesia-de-san-clemente.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Janethrodri",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Iglesia_de_San_Clemente,_Coro.jpg",
        file: "iglesia-de-san-clemente.jpg",
      }),
    ],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Cruz de San Clemente",
    slug: "cruz-de-san-clemente",
    category: "monument",
    description:
      "Cruz monumental situada en el entorno de la Iglesia de San Clemente, dentro del casco histórico de Coro. Funciona como referencia visual y punto de paso en el recorrido patrimonial.",
    address: "Entorno de la Iglesia de San Clemente, casco histórico de Coro",
    circuits: ["casco-historico"],
    tags: ["colonial", "photogenic"],
    location: {
      type: "Point",
      coordinates: [-69.6786578, 11.4091267],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4091267, -69.6786578),
    coordinateSource: "Google Maps, Plus Code C85C+MG4",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/cruz-de-san-clemente.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Zerojosefer",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Cruz_de_San_Clemente_(Coro).jpg",
        file: "cruz-de-san-clemente.jpg",
      }),
    ],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Casa Balcón de los Arcaya",
    slug: "casa-balcon-de-los-arcaya",
    category: "architecture",
    description:
      "Casona colonial del casco histórico de Coro vinculada a la familia Arcaya. Destaca por su balcón de madera y por su valor como ejemplo de la arquitectura doméstica patrimonial de la ciudad.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico"],
    tags: ["colonial", "unesco", "photogenic"],
    location: {
      type: "Point",
      coordinates: [-69.6791503, 11.4089915],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4089915, -69.6791503),
    coordinateSource: "Google Maps, Plus Code C85C+H8X",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/casa-balcon-de-los-arcaya.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Zerojosefer",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Casa_Balc%C3%B3n_de_los_Arcaya_(exterior).jpg",
        file: "casa-balcon-de-los-arcaya.jpg",
      }),
    ],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Museo de Arte de Coro",
    slug: "museo-de-arte-de-coro",
    category: "museum",
    description:
      "Museo de arte fundado en 1988, con sede en una casona colonial del casco histórico de Coro. Su colección y su edificio forman parte de la oferta cultural del centro patrimonial.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico", "museos"],
    tags: ["unesco", "guided-tour", "family"],
    historicalPeriod: "Siglo XX",
    location: {
      type: "Point",
      coordinates: [-69.6768188, 11.4082394],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.wikidata.org/wiki/Q51077695",
    coordinateSource: "Wikidata Q51077695 y Google Maps, Plus Code C85F+77V",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/museo-de-arte-de-coro.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Janethrodri",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Sede_Museo_de_Arte_de_Coro.jpg",
        file: "museo-de-arte-de-coro.jpg",
      }),
    ],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Museo Alberto Henríquez",
    slug: "museo-alberto-henriquez",
    category: "museum",
    description:
      "Museo de arte de carácter universitario en el casco histórico de Coro, orientado a la conservación y difusión del patrimonio artístico de la región. Su sede se encuentra en el área patrimonial de la ciudad.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico", "museos"],
    tags: ["unesco", "guided-tour"],
    location: {
      type: "Point",
      coordinates: [-69.6765199, 11.4082434],
    },
    conservationStatus: "unknown",
    sourceUrl: "https://www.openstreetmap.org/way/504410904",
    coordinateSource: "OpenStreetMap way 504410904",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/museo-alberto-herique-coro.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Museo Guadalupano",
    slug: "museo-guadalupano",
    category: "museum",
    description:
      "Espacio museístico de temática religiosa en el casco histórico de Coro, vinculado a la devoción guadalupana. Forma parte del conjunto de museos que complementan el recorrido patrimonial.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico", "museos"],
    tags: ["unesco", "guided-tour"],
    location: {
      type: "Point",
      coordinates: [-69.6802642, 11.4088278],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4088278, -69.6802642),
    coordinateSource: "Google Maps, Plus Code C859+GVQ",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/museo-guadalupano.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Museo Diocesano",
    slug: "museo-diocesano",
    category: "museum",
    description:
      "Museo fundado en 1946 por Monseñor Francisco José Iturriza Guillén, dedicado al patrimonio religioso de la diócesis de Coro. Reúne objetos litúrgicos, artísticos e históricos vinculados a la Iglesia local.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico", "museos"],
    tags: ["unesco", "guided-tour", "family"],
    historicalPeriod: "Siglo XX",
    location: {
      type: "Point",
      coordinates: [-69.6778133, 11.4094739],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4094739, -69.6778133),
    coordinateSource: "Google Maps, Plus Code C85C+QV",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/museo-diocesano-de-coro.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Monumento de las Madres",
    slug: "monumento-de-las-madres",
    category: "monument",
    description:
      "Monumento urbano del Paseo Monseñor Iturriza, dedicado a las madres. Es un hito de referencia del paseo y un punto de encuentro en la ciudad.",
    address: "Paseo Monseñor Iturriza, Coro",
    circuits: ["espacios-urbanos"],
    tags: ["family", "photogenic"],
    location: {
      type: "Point",
      coordinates: [-69.6441837, 11.4316237],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4316237, -69.6441837),
    coordinateSource:
      "Google Maps, consulta directa; referencia Paseo Monseñor Iturriza",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/monumento-de-las-madres-coro.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Teatro Armonía",
    slug: "teatro-armonia",
    category: "urban",
    description:
      "Espacio cultural de Coro dedicado a las artes escénicas y musicales. Su sede actual dispone de unos 5.000 metros cuadrados y acoge actividades de la Orquesta Sinfónica de Falcón.",
    address: "Casco histórico de Coro, municipio Miranda",
    circuits: ["casco-historico", "espacios-urbanos"],
    tags: ["theater", "photogenic"],
    historicalPeriod: "Siglo XX",
    location: {
      type: "Point",
      coordinates: [-69.6821997, 11.4075936],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4075936, -69.6821997),
    coordinateSource: "Google Maps, Plus Code C859+24M",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/teatro-armonia.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Gelatería El Sol",
    slug: "heladeria-el-sol",
    category: "commerce",
    description:
      "Heladería de tradición local en el centro de Coro, en la calle El Sol entre Comercio y Ampíes. Se incorpora al catálogo como parada de gastronomía y servicios dentro del recorrido patrimonial.",
    address:
      "Calle El Sol (entre calle Comercio y Ampíes), Coro 4101, Estado Falcón, Venezuela",
    circuits: ["casco-historico", "comercio-servicios"],
    tags: ["gastronomy", "family"],
    location: {
      type: "Point",
      coordinates: [-69.6739281, 11.4012389],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4012389, -69.6739281),
    coordinateSource: "Google Maps, Plus Code C82G+FCW",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/Gelateria-el-sol.jpeg"],
    imageCredits: [],
    isProvisional: true,
    isCatalogVisible: true,
    status: "draft",
  },
  {
    title: "Paseo Independencia",
    slug: "paseo-independencia",
    category: "urban",
    description:
      "Paseo urbano de Coro concebido como espacio de circulación peatonal y recreación. Articula actividades al aire libre y forma parte de los espacios públicos de la ciudad.",
    address: "Paseo Independencia, Coro",
    circuits: ["espacios-urbanos"],
    tags: ["promenade", "family", "photogenic"],
    location: {
      type: "Point",
      coordinates: [-69.6479324, 11.4229136],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4229136, -69.6479324),
    coordinateSource: "Google Maps, Plus Code C9F2+5R8",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/paseo-independencia-coro.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Casa Museo Locos de la Vela",
    slug: "casa-museo-locos-de-la-vela",
    category: "museum",
    description:
      "Casa museo en La Vela de Coro dedicada a la tradición de los Locos de la Vela, manifestación cultural del municipio Colina. Su recorrido acerca la memoria festiva y patrimonial de la localidad.",
    address: "La Vela de Coro, municipio Colina",
    circuits: ["la-vela", "museos"],
    tags: ["family", "guided-tour"],
    location: {
      type: "Point",
      coordinates: [-69.5749945, 11.4536306],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4536306, -69.5749945),
    coordinateSource:
      "Google Maps, Plus Code FC3G+F2X; discrepancia de unos 100 m con la ficha 'Casa Museo', pendiente de verificación",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/Casa-Museo-Locos-de-la-Vela.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Mirador Alí Primera",
    slug: "mirador-ali-primera",
    category: "viewpoint",
    description:
      "Mirador urbano de Coro nombrado en homenaje al cantautor venezolano Alí Primera. Ofrece una vista abierta de la ciudad y su entorno.",
    address: "Mirador Alí Primera, Coro",
    circuits: ["naturaleza-miradores"],
    tags: ["family", "photogenic", "free-entry"],
    location: {
      type: "Point",
      coordinates: [-69.6617382, 11.3761342],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.3761342, -69.6617382),
    coordinateSource: "Google Maps, Plus Code 98GQ+F82",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/mirador-ali-primera.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Ciudad Deportiva",
    slug: "ciudad-deportiva",
    category: "service",
    description:
      "Complejo deportivo universitario de Coro con instalaciones para la práctica del deporte y actividades recreativas. Se incorpora como parada de servicios y espacios urbanos.",
    address: "Ciudad Deportiva Universitaria, Coro",
    circuits: ["espacios-urbanos", "comercio-servicios"],
    tags: ["sports", "family"],
    location: {
      type: "Point",
      coordinates: [-69.660002, 11.4208232],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4208232, -69.660002),
    coordinateSource: "Google Maps, Plus Code C8CQ+8XH",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/ciudad-deportiva-coro.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
  {
    title: "Plaza Antillana",
    slug: "plaza-antillana",
    category: "urban",
    description:
      "Plaza pública de La Vela de Coro, en el municipio Colina. Funciona como espacio de encuentro y referencia urbana dentro del recorrido por la localidad.",
    address: "La Vela de Coro, municipio Colina",
    circuits: ["la-vela", "espacios-urbanos"],
    tags: ["promenade", "family", "photogenic"],
    location: {
      type: "Point",
      coordinates: [-69.5702697, 11.4593277],
    },
    conservationStatus: "unknown",
    sourceUrl: googleMapsUrl(11.4593277, -69.5702697),
    coordinateSource: "Google Maps, consulta directa",
    coordinateVerifiedAt: null,
    verificationLevel: "unverified",
    images: ["/images/locations/plaza-antillana-coro.jpg"],
    imageCredits: [],
    isProvisional: true,
    status: "draft",
  },
];

const SYNC_FIELDS = [
  "title",
  "category",
  "description",
  "address",
  "circuits",
  "tags",
  "historicalPeriod",
  "conservationStatus",
  "sourceUrl",
  "coordinateSource",
  "coordinateVerifiedAt",
  "verificationLevel",
  "isCatalogVisible",
  "images",
  "imageCredits",
  "audioGuideUrl",
];

function countByStatus(documents) {
  return documents.reduce(
    (counts, document) => {
      counts[document.status] = (counts[document.status] ?? 0) + 1;
      return counts;
    },
    { published: 0, draft: 0, archived: 0 },
  );
}

async function insertLocations({ quiet = false } = {}) {
  await Location.init();

  const removed = await Location.deleteOne({ slug: REMOVED_LOCATION_SLUG });

  if (removed.deletedCount > 0 && !quiet) {
    console.log("[seed] eliminado: Mirador del Pueblo");
  }

  let inserted = 0;
  let existing = 0;

  for (const location of locations) {
    const result = await Location.updateOne(
      { slug: location.slug },
      { $setOnInsert: location },
      { upsert: true, runValidators: true },
    );

    if (result.upsertedCount > 0) {
      inserted += 1;
    } else {
      existing += 1;
    }

    if (!quiet) {
      console.log(
        `[seed] ${result.upsertedCount > 0 ? "insertado" : "ya existía"}: ${location.title}`,
      );
    }
  }

  const stored = await Location.find({
    slug: { $in: locations.map((location) => location.slug) },
  }).select("status isProvisional");

  if (!quiet) {
    const counts = countByStatus(stored);
    console.log(
      `[seed] ${inserted} insertados, ${existing} ya existían. ` +
        `Estado en base de datos: ${counts.published} publicados, ` +
        `${counts.draft} borradores, ${counts.archived} archivados.`,
    );
  }

  return { inserted, existing };
}

async function syncLocations() {
  await Location.init();

  const removed = await Location.deleteOne({ slug: REMOVED_LOCATION_SLUG });

  if (removed.deletedCount > 0) {
    console.log("[seed:sync] eliminado: Mirador del Pueblo");
  }

  let updated = 0;
  let missing = 0;

  for (const location of locations) {
    const $set = {};

    for (const field of SYNC_FIELDS) {
      if (location[field] !== undefined) {
        $set[field] = location[field];
      }
    }

    if (COORDINATE_SYNC_SLUGS.has(location.slug)) {
      $set.location = location.location;
    }

    const result = await Location.updateOne(
      { slug: location.slug },
      { $set },
      { runValidators: true },
    );

    if (result.matchedCount === 0) {
      missing += 1;
      console.warn(`[seed:sync] No existe, se omite: ${location.slug}`);
      continue;
    }

    if (result.modifiedCount > 0) {
      updated += 1;
    }

    console.log(`[seed:sync] Actualizado: ${location.title}`);
  }

  console.log(
    `[seed:sync] ${updated} actualizados, ${locations.length - updated - missing} sin cambios, ${missing} ausentes. ` +
      "Solo se sincronizaron las coordenadas del Parque Nacional Médanos de Coro; estado e isProvisional se preservan.",
  );

  return { updated, missing };
}

function coordinatePair(location) {
  const [longitude, latitude] = location.location.coordinates;
  return { longitude, latitude };
}

async function verifyLocations() {
  await Location.init();

  const stored = await Location.find({
    slug: { $in: locations.map((location) => location.slug) },
  });
  const bySlug = new Map(stored.map((document) => [document.slug, document]));
  const issues = [];

  if (await Location.exists({ slug: REMOVED_LOCATION_SLUG })) {
    issues.push("mirador-del-pueblo: POI eliminado todavía presente en la base de datos");
  }

  for (const expected of locations) {
    const document = bySlug.get(expected.slug);

    if (!document) {
      issues.push(`Falta en la base de datos: ${expected.slug}`);
      continue;
    }

    const expectedCoordinates = coordinatePair(expected);
    const storedCoordinates = coordinatePair(document);
    const distance = haversineDistanceMeters(
      expectedCoordinates.latitude,
      expectedCoordinates.longitude,
      storedCoordinates.latitude,
      storedCoordinates.longitude,
    );

    if (distance > DISTANCE_WARNING_METERS) {
      issues.push(
        `${expected.slug}: desviación de ${Math.round(distance)} m respecto al seed`,
      );
    }

    if (document.status === "published") {
      if (document.isProvisional) {
        issues.push(`${expected.slug}: publicado pero marcado como provisional`);
      }

      if (!document.coordinateVerifiedAt) {
        issues.push(
          `${expected.slug}: publicado sin fecha de verificación de coordenadas`,
        );
      }
    }

    const expectedCatalogVisibility = expected.isCatalogVisible !== false;

    if (document.isCatalogVisible !== expectedCatalogVisibility) {
      issues.push(
        `${expected.slug}: isCatalogVisible debe ser ${expectedCatalogVisibility}`,
      );
    }

    console.log(
      `[seed:verify] ${expected.slug}: ${document.status}` +
        `${document.isProvisional ? " (provisional)" : ""}, ` +
        `${document.isCatalogVisible === false ? "fuera del catálogo, " : ""}` +
        `${document.verificationLevel}, distancia ${Math.round(distance)} m`,
    );
  }

  for (let first = 0; first < locations.length; first += 1) {
    for (let second = first + 1; second < locations.length; second += 1) {
      const a = coordinatePair(locations[first]);
      const b = coordinatePair(locations[second]);
      const distance = haversineDistanceMeters(
        a.latitude,
        a.longitude,
        b.latitude,
        b.longitude,
      );

      if (distance < DUPLICATE_WARNING_METERS) {
        issues.push(
          `${locations[first].slug} y ${locations[second].slug} están a ${Math.round(distance)} m; revisa si son el mismo lugar`,
        );
      }
    }
  }

  if (issues.length > 0) {
    console.warn(`[seed:verify] ${issues.length} advertencia(s):`);

    for (const issue of issues) {
      console.warn(`[seed:verify] - ${issue}`);
    }

    return { ok: false, issues };
  }

  console.log(
    `[seed:verify] ${locations.length} POI revisados sin desviaciones ni publicaciones inválidas.`,
  );

  return { ok: true, issues };
}

async function seedLocations() {
  const wasConnected = mongoose.connection.readyState === 1;

  // En E2E el servidor ya está conectado: no se cierra su conexión.
  // En ejecución directa, main() gestiona la conexión y la desconexión.
  await connectDB();

  try {
    return await insertLocations();
  } finally {
    if (!wasConnected) {
      await disconnectDB();
    }
  }
}

async function main() {
  const mode = process.argv.includes("--sync")
    ? "sync"
    : process.argv.includes("--verify")
      ? "verify"
      : "insert";

  await connectDB();

  try {
    if (mode === "sync") {
      await syncLocations();
    } else if (mode === "verify") {
      const result = await verifyLocations();

      if (!result.ok) {
        process.exitCode = 1;
      }
    } else {
      await insertLocations();
    }
  } finally {
    await disconnectDB();
  }
}

export { seedLocations, insertLocations, syncLocations, verifyLocations };

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error) => {
    console.error("[seed] Error:", error);
    process.exitCode = 1;
  });
}
