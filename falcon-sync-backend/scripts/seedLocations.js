import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../src/config/db.js";
import Location from "../src/models/Location.js";
import { haversineDistanceMeters } from "../src/utils/geo.js";

const VERIFIED_AT = "2026-11-06T00:00:00.000Z";
const REVIEWED_AT = "2026-11-07T00:00:00.000Z";
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
      "Ubicación aproximada junto a Antigua Carretera y el par vial Coro–Punto Fijo; la referencia OpenStreetMap way 573233913 corresponde a la vía Antigua Carretera, no a la entrada del parque; pendiente de verificación en campo",
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "unverified",
    checkInRadiusMeters: 200,
    images: ["/images/locations/parque-nacional-medanos-de-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Plaza Bolívar de Coro",
    slug: "plaza-bolivar-de-coro",
    category: "urban",
    description:
      "Plaza central del casco histórico, frente a la Catedral de Coro. Funciona como espacio de encuentro y referencia urbana.",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/iglesia-de-san-francisco.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Janethrodri",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Iglesia_de_San_Francisco,_Coro.jpg",
        file: "iglesia-de-san-francisco.jpg",
      }),
    ],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Iglesia de San Clemente",
    slug: "iglesia-de-san-clemente",
    category: "religious",
    description:
      "Templo católico del casco histórico de Coro, ubicado en el área patrimonial declarada por la UNESCO y entre los hitos religiosos de la ciudad.",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/iglesia-de-san-clemente.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Janethrodri",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Iglesia_de_San_Clemente,_Coro.jpg",
        file: "iglesia-de-san-clemente.jpg",
      }),
    ],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Cruz de San Clemente",
    slug: "cruz-de-san-clemente",
    category: "monument",
    description:
      "Cruz monumental situada en el entorno de la Iglesia de San Clemente, dentro del casco histórico de Coro y vinculada a la historia religiosa de la ciudad.",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/cruz-de-san-clemente.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Zerojosefer",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Cruz_de_San_Clemente_(Coro).jpg",
        file: "cruz-de-san-clemente.jpg",
      }),
    ],
    isProvisional: false,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/casa-balcon-de-los-arcaya.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Zerojosefer",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Casa_Balc%C3%B3n_de_los_Arcaya_(exterior).jpg",
        file: "casa-balcon-de-los-arcaya.jpg",
      }),
    ],
    isProvisional: false,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/museo-de-arte-de-coro.jpg"],
    imageCredits: [
      commonsCredit({
        author: "Janethrodri",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Sede_Museo_de_Arte_de_Coro.jpg",
        file: "museo-de-arte-de-coro.jpg",
      }),
    ],
    isProvisional: false,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/museo-alberto-herique-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Museo Guadalupano",
    slug: "museo-guadalupano",
    category: "museum",
    description:
      "Espacio museístico de temática religiosa en el casco histórico de Coro, vinculado a la devoción guadalupana y a la memoria cultural de la ciudad.",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/museo-guadalupano.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/museo-diocesano-de-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/monumento-de-las-madres-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/teatro-armonia.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Gelatería El Sol",
    slug: "heladeria-el-sol",
    category: "commerce",
    description:
      "Heladería de tradición local en el centro de Coro, en la calle El Sol entre Comercio y Ampíes, como parte de la oferta gastronómica de la ciudad.",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/Gelateria-el-sol.jpeg"],
    imageCredits: [],
    isProvisional: false,
    isCatalogVisible: true,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/paseo-independencia-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Casa Museo Locos de la Vela",
    slug: "casa-museo-locos-de-la-vela",
    category: "museum",
    description:
      "Casa museo en La Vela de Coro dedicada a la tradición de los Locos de la Vela, manifestación cultural y festiva del municipio Colina.",
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
      "Google Maps, Plus Code FC3G+F2X; discrepancia de unos 100 m con la ficha 'Casa Museo', pendiente de verificación en campo",
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    checkInRadiusMeters: 100,
    images: ["/images/locations/Casa-Museo-Locos-de-la-Vela.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/mirador-ali-primera.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Ciudad Deportiva",
    slug: "ciudad-deportiva",
    category: "service",
    description:
      "Complejo deportivo universitario de Coro con instalaciones para la práctica del deporte y actividades recreativas.",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/ciudad-deportiva-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
  {
    title: "Plaza Antillana",
    slug: "plaza-antillana",
    category: "urban",
    description:
      "Plaza pública de La Vela de Coro, en el municipio Colina, como espacio de encuentro y referencia urbana de la localidad.",
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
    coordinateVerifiedAt: REVIEWED_AT,
    verificationLevel: "single-source",
    images: ["/images/locations/plaza-antillana-coro.jpg"],
    imageCredits: [],
    isProvisional: false,
    status: "published",
  },
];

const unescoCoroSource = "https://whc.unesco.org/en/list/658/";
const medanosSource =
  "https://es.wikipedia.org/wiki/Parque_nacional_Los_M%C3%A9danos_de_Coro";

const editorialContent = {
  "catedral-de-coro": {
    historicalStory:
      "La Catedral de Santa Ana ocupa un lugar central en la historia eclesiástica de Venezuela: Coro fue sede del primer obispado establecido en la América del Sur continental, en 1531. El edificio que hoy se observa es resultado de etapas constructivas posteriores. Su escala y su relación con la Plaza Bolívar ayudan a entender cómo se organizaba el núcleo cívico y religioso de la ciudad. UNESCO reconoce el valor del conjunto histórico de Coro y La Vela, pero señala expresamente que la Catedral no está dentro de los límites actuales del bien inscrito.",
    interestingFacts: [
      "La diócesis de Coro fue establecida en 1531, según la ficha de Patrimonio Mundial de UNESCO.",
      "La Catedral y la Plaza Bolívar son hitos del paisaje histórico, aunque no están dentro de los límites actuales del bien inscrito por UNESCO.",
      "Su entorno permite observar la relación entre el templo, la plaza y las calles del centro histórico.",
    ],
    visitorInfo:
      "Es un templo activo. Confirma los horarios de apertura y las condiciones de visita antes de entrar; evita interrumpir celebraciones y solicita autorización para fotografiar el interior.",
    contentSources: [unescoCoroSource],
  },
  "casa-de-las-ventanas-de-hierro": {
    historicalStory:
      "La Casa de las Ventanas de Hierro forma parte del tejido de viviendas históricas que distingue a Coro. Su nombre destaca la rejería de sus vanos, mientras que la fachada y la escala doméstica permiten apreciar la relación entre ornamentación y vida cotidiana. La arquitectura tradicional de Coro combina técnicas de tierra —como tapia, adobe y bahareque— con influencias hispánicas, mudéjares y, desde el siglo XVII, neerlandesas llegadas a través del Caribe. La historia particular de sus propietarios y de la procedencia de cada elemento requiere documentación específica.",
    interestingFacts: [
      "El nombre del inmueble alude a sus ventanas protegidas con hierro.",
      "Coro conserva ejemplos de tapia, adobe y bahareque, técnicas tradicionales de construcción con tierra.",
      "La arquitectura local integra influencias hispánicas, mudéjares y neerlandesas.",
    ],
    visitorInfo:
      "La ficha no confirma si el interior está abierto al público. Verifica el acceso y los horarios localmente; si solo puedes verla desde la calle, respeta la privacidad de residentes y comercios.",
    contentSources: [unescoCoroSource],
  },
  "casa-del-sol": {
    historicalStory:
      "La Casa del Sol se reconoce por el relieve solar que corona su portal y por su posición en una esquina del casco histórico, frente al entorno de San Clemente. Este detalle ornamental convierte la fachada en una referencia visual y ofrece una oportunidad para observar de cerca cómo los elementos decorativos identifican las casas tradicionales. La vivienda forma parte de un paisaje urbano más amplio cuyo valor reside también en la continuidad de sus calles, materiales y técnicas constructivas.",
    interestingFacts: [
      "El relieve con forma de sol sobre el portal es el rasgo que da nombre a la casa.",
      "Su ubicación conecta visualmente con el entorno de la Iglesia y la Cruz de San Clemente.",
      "La arquitectura doméstica de Coro combina técnicas locales de tierra con influencias del Caribe.",
    ],
    visitorInfo:
      "La reseña describe principalmente el exterior; no se confirma acceso al interior. Observa desde el espacio público y verifica localmente si hay visitas guiadas.",
    contentSources: [unescoCoroSource],
  },
  "arco-de-la-federacion": {
    historicalStory:
      "El Arco de la Federación es un monumento cívico asociado a la memoria federalista de Falcón y a la historia republicana de Venezuela. Su nombre invita a recordar la Guerra Federal y el papel de figuras como Juan Crisóstomo Falcón y Ezequiel Zamora. Más que atribuirle una fecha, autoría o programa arquitectónico sin respaldo documental disponible, esta ficha destaca su función como hito urbano y soporte de memoria colectiva. La cronología precisa del monumento queda pendiente de una fuente patrimonial especializada.",
    interestingFacts: [
      "El monumento está dedicado a la memoria de la Federación venezolana.",
      "Su presencia vincula el paisaje urbano de Coro con la historia política del siglo XIX.",
      "La fecha exacta de construcción y los detalles de sus restauraciones requieren confirmación documental.",
    ],
    visitorInfo:
      "Puede apreciarse desde el espacio público. Ten precaución al acercarte si está junto a una vía vehicular y no subas a la estructura.",
    contentSources: [],
  },
  "medanos-de-coro": {
    historicalStory:
      "Los Médanos de Coro son un paisaje de dunas modelado por el viento en el istmo que comunica la península de Paraguaná con el resto de Falcón. La arena cambia de forma y posición, por lo que la experiencia del paisaje varía con el tiempo y las condiciones ambientales. El área forma parte del Parque Nacional Médanos de Coro, creado en 1974, y debe entenderse como un ecosistema protegido, no como una superficie recreativa sin límites. Las dunas y la vegetación adaptada a la aridez son especialmente sensibles al tránsito fuera de las zonas permitidas.",
    interestingFacts: [
      "El parque nacional fue creado en 1974.",
      "El viento modifica continuamente la forma de las dunas.",
      "El paisaje combina áreas arenosas con ambientes costeros y vegetación adaptada a condiciones secas.",
    ],
    visitorInfo:
      "Lleva agua, protección solar y calzado apropiado. Sigue las indicaciones del parque, no dejes residuos ni conduzcas sobre las dunas. No te detengas en la calzada para tomar fotografías.",
    contentSources: [medanosSource],
  },
  "parque-nacional-medanos-de-coro": {
    historicalStory:
      "El Parque Nacional Médanos de Coro protege un paisaje costero singular en el istmo de Paraguaná. Sus dunas móviles son la imagen más conocida, pero el área protegida incluye ambientes diversos y frágiles. Fue creado en 1974; la ficha del parque y las condiciones de acceso deben consultarse antes de organizar actividades. La ubicación señalada aquí corresponde a un punto de referencia aproximado junto a la vía Coro–Punto Fijo y no sustituye la identificación de una entrada oficial verificada en campo.",
    interestingFacts: [
      "El parque nacional fue creado en 1974 para proteger paisajes naturales del istmo.",
      "Las dunas se desplazan por la acción del viento y no mantienen una forma fija.",
      "La coordenada de este POI es aproximada; no confirma por sí sola el acceso oficial al área protegida.",
    ],
    visitorInfo:
      "Confirma previamente los accesos y las normas vigentes con las autoridades del parque. Evita detenerte en la carretera, conducir sobre las dunas o dejar residuos; lleva agua y protección solar.",
    contentSources: [medanosSource],
  },
  "plaza-bolivar-de-coro": {
    historicalStory:
      "La Plaza Bolívar es un espacio cívico frente a la Catedral y una referencia para orientarse en el centro de Coro. Su relación con el templo y las edificaciones circundantes permite leer la plaza como parte de la estructura histórica de la ciudad. Conviene distinguir esa importancia del límite formal del Patrimonio Mundial: UNESCO identifica la Plaza Bolívar y la Catedral como atributos relevantes que no están incluidos dentro de los límites actuales del bien inscrito.",
    interestingFacts: [
      "La plaza se encuentra frente a la Catedral de Santa Ana.",
      "Es un punto de orientación y encuentro en el centro urbano de Coro.",
      "UNESCO señala que la Plaza Bolívar no forma parte de los límites actuales del bien inscrito, aunque la reconoce entre sus atributos relevantes.",
    ],
    visitorInfo:
      "Espacio público abierto. Respeta las actividades cívicas y comunitarias, cuida las áreas verdes y considera el sol y el calor al planificar la visita.",
    contentSources: [unescoCoroSource],
  },
  "iglesia-de-san-francisco": {
    historicalStory:
      "La Iglesia de San Francisco es uno de los templos que forman parte de la memoria religiosa de Coro. Su escala y su presencia entre las calles del casco histórico ayudan a comprender el papel de las instituciones religiosas en la formación de la ciudad. El conjunto urbano de Coro y La Vela es reconocido por UNESCO por conservar una trama histórica y una arquitectura que combina tradiciones locales con influencias hispánicas, mudéjares y neerlandesas. La datación y los detalles de las distintas etapas del templo requieren fuentes monográficas.",
    interestingFacts: [
      "El templo se ubica en el casco histórico de Coro.",
      "La construcción tradicional de la ciudad incluye tapia, adobe y bahareque.",
      "La Iglesia debe interpretarse dentro de un paisaje urbano histórico, no como un monumento aislado.",
    ],
    visitorInfo:
      "Verifica los horarios de apertura antes de entrar. Si hay una actividad religiosa, mantén silencio y sigue las indicaciones del personal del templo.",
    contentSources: [unescoCoroSource],
  },
  "iglesia-de-san-clemente": {
    historicalStory:
      "La Iglesia de San Clemente es un referente religioso del casco histórico de Coro y comparte su entorno urbano con la plaza y la Cruz de San Clemente. La proximidad de estos espacios permite apreciar cómo los edificios de culto y los lugares públicos se relacionan en la ciudad histórica. Su planta, fechas de reconstrucción y elementos interiores suelen describirse de manera distinta en reseñas secundarias; se presentan aquí solo los rasgos generales hasta contar con una fuente patrimonial específica.",
    interestingFacts: [
      "La iglesia forma un conjunto urbano de interés con la plaza y la Cruz de San Clemente.",
      "Se encuentra en el casco histórico de Coro, reconocido internacionalmente por su arquitectura tradicional.",
      "Las fechas y características arquitectónicas detalladas requieren verificación con una fuente especializada.",
    ],
    visitorInfo:
      "Confirma el acceso y los horarios localmente. Respeta los servicios religiosos y consulta antes de fotografiar el interior.",
    contentSources: [unescoCoroSource],
  },
  "cruz-de-san-clemente": {
    historicalStory:
      "La Cruz de San Clemente es una referencia religiosa y urbana situada junto al templo del mismo nombre. La tradición local la vincula con los primeros años de la ciudad y con la celebración de una misa en 1527; esa narración debe entenderse como tradición mientras no se coteje con documentación histórica especializada. El templete que la protege y la plaza forman un pequeño conjunto donde conviven memoria, devoción y arquitectura del casco histórico.",
    interestingFacts: [
      "La tradición local relaciona la cruz con los primeros años de Coro y con una misa celebrada en 1527.",
      "La cruz se encuentra en el entorno de la Iglesia y la Plaza de San Clemente.",
      "La fecha, el material original y los detalles de su protección requieren una fuente patrimonial específica.",
    ],
    visitorInfo:
      "Visítala con respeto: es un lugar de significado religioso para la comunidad. Evita tocar la cruz o ingresar al templete si no está autorizado.",
    contentSources: [unescoCoroSource],
  },
  "casa-balcon-de-los-arcaya": {
    historicalStory:
      "La Casa Balcón de los Arcaya destaca en el paisaje residencial de Coro por su balcón de madera. Como otras casas históricas de la ciudad, permite observar la adaptación de la vivienda al clima mediante patios, corredores, muros de tierra y elementos de madera. UNESCO describe el valor del conjunto urbano por la permanencia de técnicas como tapia, adobe y bahareque, así como por la mezcla de tradiciones arquitectónicas locales, hispánicas, mudéjares y neerlandesas. La historia familiar y la fecha exacta de cada elemento necesitan documentación propia.",
    interestingFacts: [
      "El balcón de madera es el rasgo más reconocible de la fachada.",
      "La arquitectura residencial de Coro aprovecha materiales locales y soluciones adaptadas al clima.",
      "El conjunto histórico de Coro y La Vela fue inscrito en la Lista del Patrimonio Mundial en 1993.",
    ],
    visitorInfo:
      "La información disponible no confirma horarios ni acceso al interior. Consulta localmente si hay visitas; observa desde el espacio público y no ingreses a áreas privadas.",
    contentSources: [unescoCoroSource],
  },
  "museo-de-arte-de-coro": {
    historicalStory:
      "El Museo de Arte de Coro reúne dos capas de interés: la actividad artística contemporánea y su emplazamiento en el centro histórico. La visita permite acercarse al arte desde una ciudad cuya arquitectura tradicional conserva técnicas de tierra y una historia urbana de intercambios caribeños. La fecha de fundación, la identificación de la casa como «Casa de las Catorce Ventanas» y la lista de obras expuestas deben confirmarse con el museo, pues las colecciones y exposiciones pueden cambiar.",
    interestingFacts: [
      "Es un espacio dedicado a las artes plásticas en el casco histórico de Coro.",
      "La arquitectura histórica del entorno ofrece un contraste con las propuestas artísticas contemporáneas.",
      "Las exposiciones, obras y servicios disponibles pueden variar; verifica la información vigente con el museo.",
    ],
    visitorInfo:
      "Confirma antes de ir si el museo está abierto, qué exposiciones presenta y si requiere reserva o pago de entrada.",
    contentSources: [unescoCoroSource],
  },
  "museo-alberto-henriquez": {
    historicalStory:
      "El Museo Alberto Henríquez es un espacio cultural situado en el casco histórico de Coro. Su nombre y su relación con el patrimonio artístico local invitan a explorar la diversidad de historias que han dado forma a la ciudad, incluidas las conexiones históricas entre Coro y el Caribe. La administración actual, la colección expuesta y la historia de la sede deben confirmarse con la institución antes de atribuirle piezas, usos religiosos anteriores o actividades académicas específicas.",
    interestingFacts: [
      "El museo se encuentra en el área histórica de Coro.",
      "La historia urbana de Coro incluye intercambios con islas vecinas del Caribe.",
      "La colección y el horario de visita deben verificarse con la institución.",
    ],
    visitorInfo:
      "Consulta a la institución o a fuentes locales para confirmar apertura, visitas guiadas, exposiciones y condiciones de acceso.",
    contentSources: [unescoCoroSource],
  },
  "museo-guadalupano": {
    historicalStory:
      "El Museo Guadalupano ofrece una aproximación a la devoción mariana y a las expresiones religiosas vinculadas con la Virgen de Guadalupe en Falcón. La ficha lo sitúa en el centro histórico de Coro, donde la vida religiosa forma parte de la historia y del uso cotidiano de los espacios. Para no confundir tradición local con historia documentada, las fechas de fundación, el origen de cada pieza y la relación institucional con el Santuario de Carrizal requieren confirmación directa.",
    interestingFacts: [
      "Su temática se relaciona con la devoción a la Virgen de Guadalupe en Falcón.",
      "La sede se encuentra en el casco histórico de Coro.",
      "Las piezas expuestas y las actividades pueden cambiar; verifica la información antes de la visita.",
    ],
    visitorInfo:
      "Confirma localmente si está abierto, los horarios y si la visita requiere coordinación previa.",
    contentSources: [unescoCoroSource],
  },
  "museo-diocesano": {
    historicalStory:
      "El Museo Diocesano está dedicado al patrimonio religioso relacionado con la diócesis de Coro. Sus colecciones pueden ayudar a comprender la historia de la Iglesia y la producción artística que acompañó la vida religiosa de la región. La información recibida identifica 1946 como año de fundación y menciona una sede histórica; antes de presentar como verificadas la fecha, la procedencia de cada objeto o la amplitud del archivo, es necesario cotejarlas con el museo o la diócesis.",
    interestingFacts: [
      "El museo se dedica a la historia y al arte religioso de la diócesis de Coro.",
      "La fecha de fundación y los datos de la sede requieren confirmación institucional.",
      "Consulta al museo por las piezas disponibles: la exhibición puede variar por conservación o programación.",
    ],
    visitorInfo:
      "Verifica horarios, tarifas, condiciones de acceso y disponibilidad de visitas guiadas con el museo o la diócesis.",
    contentSources: [unescoCoroSource],
  },
  "monumento-de-las-madres": {
    historicalStory:
      "El Monumento de las Madres es una obra cívica situada en el Paseo Monseñor Iturriza. Su tema reconoce la maternidad y el cuidado familiar, mientras que su emplazamiento lo incorpora al paisaje de los espacios públicos modernos de Coro. Las reseñas disponibles no permiten confirmar con seguridad la fecha de instalación, la autoría ni el programa de actos vinculados al monumento; esos datos quedan pendientes de una fuente municipal o patrimonial.",
    interestingFacts: [
      "Está ubicado en el Paseo Monseñor Iturriza.",
      "El monumento está dedicado a las madres y forma parte del arte público de la ciudad.",
      "La autoría y la fecha de instalación requieren confirmación documental.",
    ],
    visitorInfo:
      "Puede apreciarse desde el espacio público. Mantén despejadas las áreas de circulación y cuida el mobiliario y la vegetación.",
    contentSources: [],
  },
  "teatro-armonia": {
    historicalStory:
      "El Teatro Armonía es un espacio de referencia para las artes escénicas y musicales de Coro. A diferencia de los templos y casonas coloniales, representa la infraestructura cultural moderna de la ciudad y ofrece un lugar para la presentación de espectáculos y actividades colectivas. La capacidad de la sala, el año de construcción, la agenda y la relación actual con agrupaciones artísticas deben comprobarse con la administración del teatro.",
    interestingFacts: [
      "Es un recinto cultural destinado a actividades escénicas y musicales.",
      "Su programación puede incluir distintos formatos de espectáculos y eventos.",
      "La capacidad y la agenda vigente deben consultarse con el teatro.",
    ],
    visitorInfo:
      "Consulta la programación y las condiciones de acceso antes de desplazarte; los horarios y la disponibilidad dependen de cada evento.",
    contentSources: [],
  },
  "heladeria-el-sol": {
    historicalStory:
      "Gelatería El Sol forma parte de la oferta gastronómica cotidiana de Coro y está ubicada en la calle que lleva su nombre, entre Comercio y Ampíes. Los comercios tradicionales también cuentan la historia de una ciudad: son lugares de encuentro, descanso y continuidad de prácticas locales. No se afirma aquí que sea la heladería más antigua ni se atribuyen recetas o fechas de fundación, porque esos datos requieren testimonio o documentación del establecimiento.",
    interestingFacts: [
      "Está en la calle El Sol, entre Comercio y Ampíes.",
      "Su actividad gastronómica complementa la visita al centro de Coro.",
      "La historia del negocio y la disponibilidad de sabores deben confirmarse directamente en el local.",
    ],
    visitorInfo:
      "Verifica el horario de atención y la oferta del día con el establecimiento; la disponibilidad de productos puede cambiar.",
    contentSources: [],
  },
  "paseo-independencia": {
    historicalStory:
      "El Paseo Independencia es un espacio urbano asociado a la circulación peatonal y al esparcimiento. Su escala permite observar otra dimensión de Coro, más allá del núcleo de arquitectura histórica: la ciudad contemporánea y sus lugares de encuentro. Las fechas de diseño, las especies vegetales, los monumentos presentes y el equipamiento actual deben confirmarse con fuentes municipales o mediante una visita reciente.",
    interestingFacts: [
      "Es un espacio público de Coro destinado al tránsito y al encuentro.",
      "Permite conocer sectores de la ciudad fuera del casco histórico.",
      "El mobiliario y las actividades pueden variar; comprueba las condiciones en el sitio.",
    ],
    visitorInfo:
      "Usa las áreas peatonales, mantente atento al tránsito y evita dejar pertenencias sin cuidado. Considera el calor y la exposición al sol.",
    contentSources: [],
  },
  "casa-museo-locos-de-la-vela": {
    historicalStory:
      "La Casa Museo Locos de la Vela está dedicada a una manifestación festiva emblemática de La Vela de Coro, asociada con el Día de los Santos Inocentes, el 28 de diciembre. Los trajes, las máscaras, la música y la participación de portadores locales forman parte de una tradición viva, cuya transmisión depende de la comunidad. Los detalles de la colección permanente, el archivo y los talleres deben confirmarse con la institución; no se presenta la fiesta como inscrita en una lista de UNESCO sin evidencia oficial.",
    interestingFacts: [
      "La celebración de Los Locos de La Vela se asocia tradicionalmente con el 28 de diciembre.",
      "La manifestación reúne vestuario, máscaras, música y participación comunitaria.",
      "La información sobre exhibiciones y actividades educativas debe confirmarse con la Casa Museo.",
    ],
    visitorInfo:
      "Consulta con la Casa Museo si está abierta y si ofrece visitas o talleres. En días festivos puede haber cambios de circulación y programación en La Vela.",
    contentSources: [],
  },
  "mirador-ali-primera": {
    historicalStory:
      "El Mirador Alí Primera lleva el nombre del cantautor falconiano Alí Primera y ofrece un punto de observación del entorno de Coro. El lugar vincula paisaje y memoria cultural: el nombre recuerda a una figura cuya obra se asocia con Falcón y con temas sociales. La ficha no confirma instalaciones, murales, iluminación ni servicios actuales; conviene comprobar en el sitio qué áreas están habilitadas.",
    interestingFacts: [
      "El mirador rinde homenaje nominal al cantautor falconiano Alí Primera.",
      "Su ubicación elevada permite contemplar el entorno urbano y el paisaje regional.",
      "El equipamiento y los servicios disponibles deben comprobarse en el lugar.",
    ],
    visitorInfo:
      "Visita de día si no conoces el estado del acceso. Mantente en las zonas habilitadas y evita dejar residuos; verifica localmente la seguridad y los servicios disponibles.",
    contentSources: [],
  },
  "ciudad-deportiva": {
    historicalStory:
      "La Ciudad Deportiva es un espacio de infraestructura para la práctica física y las actividades recreativas en Coro. Su interés para el visitante está en mostrar la vida cotidiana y los servicios contemporáneos de la ciudad, complementando la oferta histórica y cultural. No se detallan aquí disciplinas, instalaciones, convenios universitarios ni acceso libre porque esa información puede cambiar y debe confirmarse con la administración del complejo.",
    interestingFacts: [
      "Es un complejo destinado a actividades deportivas y recreativas.",
      "Su uso y la disponibilidad de instalaciones dependen de la programación vigente.",
      "Confirma con la administración qué áreas están abiertas al público.",
    ],
    visitorInfo:
      "Antes de ir, verifica horarios, actividades y requisitos de acceso con la administración. Respeta las áreas reservadas para entrenamientos y eventos.",
    contentSources: [],
  },
  "plaza-antillana": {
    historicalStory:
      "La Plaza Antillana se encuentra en La Vela de Coro, puerto histórico ligado a la vida de Coro y a los intercambios del Caribe. UNESCO describe la influencia neerlandesa introducida en la arquitectura de Coro y su puerto desde la segunda mitad del siglo XVII, a través de islas vecinas como Curazao y Aruba. La plaza ofrece un punto desde el cual acercarse a esa historia regional; no se atribuyen aquí esculturas o elementos de diseño específicos sin una fuente local.",
    interestingFacts: [
      "La plaza está en La Vela de Coro, municipio Colina.",
      "Coro y su puerto de La Vela forman conjuntamente un sitio inscrito en la Lista del Patrimonio Mundial.",
      "La historia arquitectónica de la región refleja intercambios con las islas vecinas del Caribe.",
    ],
    visitorInfo:
      "Espacio público abierto; considera el sol y la brisa costera. Respeta las actividades comunitarias y verifica en el lugar si hay eventos o restricciones temporales.",
    contentSources: [unescoCoroSource],
  },
};

for (const location of locations) {
  Object.assign(location, editorialContent[location.slug]);
}

const SYNC_FIELDS = [
  "title",
  "category",
  "description",
  "historicalStory",
  "interestingFacts",
  "visitorInfo",
  "contentSources",
  "address",
  "circuits",
  "tags",
  "historicalPeriod",
  "conservationStatus",
  "sourceUrl",
  "coordinateSource",
  "coordinateVerifiedAt",
  "verificationLevel",
  "checkInRadiusMeters",
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

async function syncEditorialContent() {
  await Location.init();

  const slugs = locations.map((location) => location.slug);
  const stored = await Location.find({ slug: { $in: slugs } }).select(
    "slug historicalStory interestingFacts visitorInfo contentSources",
  );
  const bySlug = new Map(stored.map((location) => [location.slug, location]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));

  if (missing.length > 0) {
    throw new Error(
      `[seed:editorial] No se encontraron todos los POI; faltan: ${missing.join(", ")}`,
    );
  }

  const populated = stored
    .filter(
      (location) =>
        location.historicalStory?.trim() ||
        location.interestingFacts?.length ||
        location.visitorInfo?.trim() ||
        location.contentSources?.length,
    )
    .map((location) => location.slug);

  if (populated.length > 0) {
    throw new Error(
      `[seed:editorial] Se aborta para no sobrescribir contenido existente: ${populated.join(", ")}`,
    );
  }

  const emptyEditorialFields = [
    {
      $or: [
        { historicalStory: { $exists: false } },
        { historicalStory: null },
        { historicalStory: "" },
      ],
    },
    {
      $or: [
        { interestingFacts: { $exists: false } },
        { interestingFacts: null },
        { interestingFacts: { $size: 0 } },
      ],
    },
    {
      $or: [
        { visitorInfo: { $exists: false } },
        { visitorInfo: null },
        { visitorInfo: "" },
      ],
    },
    {
      $or: [
        { contentSources: { $exists: false } },
        { contentSources: null },
        { contentSources: { $size: 0 } },
      ],
    },
  ];
  let updated = 0;

  for (const location of locations) {
    const $set = Object.fromEntries(
      ["historicalStory", "interestingFacts", "visitorInfo", "contentSources"].map(
        (field) => [field, location[field]],
      ),
    );
    const result = await Location.updateOne(
      {
        slug: location.slug,
        $and: emptyEditorialFields,
      },
      { $set },
      { runValidators: true },
    );

    if (result.matchedCount !== 1) {
      throw new Error(
        `[seed:editorial] No se actualizó ${location.slug}; verifica si el contenido cambió durante la operación`,
      );
    }

    if (result.modifiedCount > 0) {
      updated += 1;
    }
  }

  console.log(`[seed:editorial] ${updated} fichas actualizadas; no se alteraron otros campos.`);
  return { updated };
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
  const mode = process.argv.includes("--sync-editorial")
    ? "editorial"
    : process.argv.includes("--sync")
      ? "sync"
      : process.argv.includes("--verify")
        ? "verify"
        : "insert";

  await connectDB();

  try {
    if (mode === "editorial") {
      await syncEditorialContent();
    } else if (mode === "sync") {
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

export {
  seedLocations,
  insertLocations,
  syncLocations,
  syncEditorialContent,
  verifyLocations,
};

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error) => {
    console.error("[seed] Error:", error);
    process.exitCode = 1;
  });
}
