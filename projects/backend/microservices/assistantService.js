import mongoose from 'mongoose';
import Conversation from '../databases/models/Conversation.js';
import Location from '../databases/models/Location.js';
import Message from '../databases/models/Message.js';
import SourceChunk from '../databases/models/SourceChunk.js';
import SourceDocument from '../databases/models/SourceDocument.js';
import { config } from '../helpers/env.js';
import { HttpError } from '../helpers/HttpError.js';
import {
  cosineSimilarity,
  embedTexts,
  modelIdentity,
} from './embeddingService.js';

const MAX_CANDIDATES = 3;
const MAX_CANDIDATES_PER_SOURCE = 2;
const MAX_ANSWER_CITATIONS = 2;
// En una pregunta compuesta cada sub-consulta aporta su propia cita, así que
// el tope crece con el número de partes para responder todo en un mismo texto.
const MAX_ANSWER_CITATIONS_COMPOUND = 3;
const MAX_CITATION_WORDS = 60;
const MAX_SUGGESTIONS = 3;
const MAX_OPTIONS = 3;
const CONVERSATION_RETENTION_DAYS = 90;
const INDEX_TTL_MS = 30 * 1000;
const POI_CACHE_TTL_MS = 60 * 1000;
// Una coincidencia léxica parcial de un título no basta para atribuir la
// pregunta a un lugar: «ciudad de Coro» compartía «ciudad» con «Ciudad
// Deportiva» y resolvía el POI equivocado con 0.5 exacto.
const POI_LEXICAL_MIN = 0.6;
const POI_AMBIGUITY_MARGIN = 0.05;
// Una cita secundaria solo acompaña a la primera si cubre una parte de una
// pregunta compuesta, pertenece al lugar preguntado o está cerca de su
// puntaje. Evita pegar evidencia tangencial (p. ej. tapial en «¿Qué es
// FALCONSYNC?») sin perder la historia del lugar citado.
const SECONDARY_CITATION_MAX_GAP = 0.15;
// Las fuentes internas del proyecto no exponen una URL pública: se citan como
// documentación del propio sistema y nunca como enlace al repositorio.
const INTERNAL_SOURCE_INSTITUTIONS = new Set(['Proyecto FALCONSYNC']);
// La ficha del lugar resuelto se acepta con umbral propio: pertenecer al lugar
// identificado por nombre es una señal más fuerte que la similitud sola.
const POI_FICHA_MIN_SIMILARITY = 0.4;
// Prioridad de la ficha del lugar resuelto al ordenar los candidatos.
const POI_CONTEXT_BOOST = 0.18;
// Diferencia que la ficha de un lugar debe tener sobre la evidencia general
// para atribuir la pregunta a ese lugar por la vía semántica.
const POI_GENERAL_MARGIN = 0.15;

export const FALLBACK_MESSAGE =
  'No cuento con evidencia suficiente para responder, prueba con una pregunta sobre el patrimonio de Coro';
// Motivo NO_CURRENT_STATUS: la pregunta pide horarios, tarifas o estado de
// apertura y el corpus no tiene evidencia vigente. Se responde de forma
// directa en lugar del mensaje genérico, sin prometer datos no verificados.
export const SCHEDULE_ABSTENTION_MESSAGE =
  'Sin horarios confirmados. No cuento con una fuente verificada de horarios, tarifas ni estado de apertura; confirma directamente con el lugar antes de tu visita.';
const CLARIFICATION_MESSAGE = '¿A cuál de estos lugares te refieres?';
export const GREETING_MESSAGE =
  '¡Epa! Soy Chivito, tu guía turístico de FalconSync. Puedo contarte sobre Coro, sus lugares, su historia y su arquitectura. ¿Qué quieres descubrir hoy?';
const GREETING_SUGGESTIONS = [
  '¿Qué es Coro?',
  '¿Qué lugares puedo visitar en Coro?',
  '¿Cómo se construye un muro de tapial?',
];
// Saludos de mensaje completo: si la persona escribe «hola, ¿qué es Coro?» la
// pregunta real manda y se responde con el corpus, no con la bienvenida.
const GREETING_PHRASES = new Set([
  'hola',
  'hi',
  'hello',
  'hey',
  'buenas',
  'buen dia',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'que tal',
  'saludos',
  'gracias',
  'muchas gracias',
  'adios',
  'hasta luego',
  'chao',
  'hola buenos dias',
  'hola buenas tardes',
  'hola buenas noches',
  'hola que tal',
]);
// La pregunta pide una ruta o indicaciones. Incluye «llego» y sus variantes:
// «¿cómo llego a la Catedral?» es tan explícito como «¿cómo puedo llegar?».
const ROUTE_QUESTION_PATTERN =
  /\b(?:c[oó]mo\s+(?:(?:puedo|se\s+puede|se)\s+)?(?:lleg(?:ar|amos|an|as|o|a))|c[oó]mo\s+voy|rutas?|indicaciones?|recorridos?|itinerarios?)\b/iu;
export const ROUTE_NOTICE =
  'No tengo una ruta verificada en el corpus; te comparto los datos registrados del lugar.';
// Cuando el corpus sí contiene un dato de acceso (bus, avenida, estacionamiento),
// no se niega la existencia de una ruta: se etiqueta como dato registrado y se
// pide confirmar antes de viajar.
export const ACCESS_DATA_NOTICE =
  'Datos de acceso registrados en el corpus; confirma horarios y disponibilidad antes de viajar.';
export const ROUTE_ABSTENTION_MESSAGE =
  'No tengo una ruta o unas indicaciones verificadas en el corpus para esa consulta.';
export const PARKING_ABSTENTION_MESSAGE =
  'No tengo evidencia verificada sobre estacionamiento en el corpus. Confirma las opciones con el lugar o con las autoridades locales.';
export const NIGHT_TOUR_ABSTENTION_MESSAGE =
  'No tengo evidencia verificada sobre visitas guiadas nocturnas o recorridos de leyendas en el corpus.';
export const TRANSPORT_ABSTENTION_MESSAGE =
  'No tengo evidencia verificada sobre transporte público o taxis para esa consulta en el corpus.';
export const DISTANCE_ABSTENTION_MESSAGE =
  'No puedo calcular distancias ni tiempos de viaje con el corpus actual. Consulta una aplicación de mapas para la ruta.';
export const PRICE_ABSTENTION_MESSAGE =
  'Sin precios confirmados. No cuento con una fuente verificada de tarifas ni condiciones de entrada; confirma directamente con el lugar antes de tu visita.';

// Intenciones de orientación que no se responden con una ficha genérica. Si
// la evidencia no cubre el aspecto preguntado, es preferible abstenerse a
// pegar un fragmento tangencial (p. ej. la ruta a Caracas para «¿dónde
// estaciono?»).
const PARKING_INTENT_PATTERN =
  /\b(?:estacion(?:ar|amiento|adero)|parking|aparcar)\b/iu;
const NIGHT_TOUR_INTENT_PATTERN =
  /\b(?:visitas?\s+guiadas?|recorridos?\s+(?:de\s+leyendas|nocturnos?)|nocturn[oa]s?|de\s+noche)\b/iu;
const TRANSPORT_INTENT_PATTERN =
  /\b(?:transporte|bus|buseta|taxi|carro\s+por\s+puesto|metro|autob[uú]s)\b/iu;
const DISTANCE_INTENT_PATTERN =
  /\b(?:distancia|cu[aá]nto\s+(?:tarda|se\s+tarda)|tiempo\s+(?:de\s+viaje|en\s+llegar)|minutos\s+(?:a\s+pie|caminando|en\s+carro))\b/iu;
// Evidencia de acceso: dos señales distintas o una señal fuerte de recorrido.
// Una descripción con «calles empedradas» no es una ruta.
const ROUTE_EVIDENCE_PATTERNS = [
  /\brutas?\b/iu,
  /\brecorridos?\b/iu,
  /\bitinerarios?\b/iu,
  /\blleg(?:ar|amos|an|as|o|a)\b/iu,
  /\bbus\b/iu,
  /\bbusetas?\b/iu,
  /\btaxis?\b/iu,
  /\btransporte\b/iu,
  /\bautob[uú]s(?:es)?\b/iu,
  /\bestacion(?:ar|amiento|adero)\b/iu,
  /\ba\s+pie\b/iu,
  /\bcaminando\b/iu,
  /\bdistancia\b/iu,
  /\bminutos\b/iu,
  /\bavenidas?\b/iu,
  /\bcarreteras?\b/iu,
  /\bautopistas?\b/iu,
  /\bcalles?\b/iu,
];
const ROUTE_STRONG_EVIDENCE_PATTERN =
  /\b(?:rutas?|recorridos?|itinerarios?|indicaciones?|lleg(?:ar|amos|an|as|o|a))\b/iu;
const DISTANCE_EVIDENCE_PATTERN =
  /\b(?:distancia|km|kil[oó]metros|minutos|a\s+pie|tiempo\s+de\s+viaje)\b/iu;

function routeEvidenceMatches(text) {
  const matches = ROUTE_EVIDENCE_PATTERNS.filter((pattern) => pattern.test(text)).length;

  return matches >= 2 || ROUTE_STRONG_EVIDENCE_PATTERN.test(text);
}

function classifyAccessIntent(question) {
  if (PARKING_INTENT_PATTERN.test(question)) {
    return 'parking';
  }
  if (NIGHT_TOUR_INTENT_PATTERN.test(question)) {
    return 'nightTour';
  }
  if (DISTANCE_INTENT_PATTERN.test(question)) {
    return 'distance';
  }
  if (TRANSPORT_INTENT_PATTERN.test(question)) {
    return 'transport';
  }
  if (ROUTE_QUESTION_PATTERN.test(question)) {
    return 'route';
  }

  return null;
}

function accessEvidenceMatches(intent, text) {
  switch (intent) {
    case 'parking':
      return PARKING_INTENT_PATTERN.test(text);
    case 'nightTour':
      return NIGHT_TOUR_INTENT_PATTERN.test(text);
    case 'distance':
      return DISTANCE_EVIDENCE_PATTERN.test(text);
    case 'transport':
      return TRANSPORT_INTENT_PATTERN.test(text);
    case 'route':
      return routeEvidenceMatches(text);
    default:
      return true;
  }
}

function accessAbstentionMessage(intent) {
  switch (intent) {
    case 'parking':
      return PARKING_ABSTENTION_MESSAGE;
    case 'nightTour':
      return NIGHT_TOUR_ABSTENTION_MESSAGE;
    case 'distance':
      return DISTANCE_ABSTENTION_MESSAGE;
    case 'transport':
      return TRANSPORT_ABSTENTION_MESSAGE;
    default:
      return ROUTE_ABSTENTION_MESSAGE;
  }
}

// "estado" excluye "estado Falcón" (el nombre del estado): «la mejor época
// para visitar Coro y el estado Falcón» no es una pregunta de estado actual.
const CURRENT_STATUS_PATTERN =
  /\b(horario|abierto|cerrado|actual|vigente|hoy|precio|tarifa|costa|cuesta|entrada|estado(?! (?:de |del )?Falc[oó]n)|acceso|restaurado)\b/iu;
// Pregunta por la hora exacta del momento: el corpus no puede responderla y
// no debe confundirse con un horario de apertura de un lugar.
const TIME_NOW_PATTERN = /\bqu[eé] hora (?:es|est[aá]|ser[aá])\b/iu;
// Aspecto de precio dentro de una pregunta de estado: exige evidencia de
// precio; un horario de misas no responde «¿cuánto cuesta?».
const PRICE_ASPECT_PATTERN =
  /\b(precios?|costos?|cuesta|cuestan|costar|tarifas?|entradas?|gratis|bol[ií]var(?:es)?|d[oó]lares?)\b/iu;
// Motivos de rechazo del asistente turístico: consultas de diagnóstico o
// intervención técnica (propio del apoyo técnico) y gestiones administrativas
// como reportar o denunciar daños. Los términos materiales (adobe, tapia,
// estructura) y el verbo construir no están aquí a propósito: preguntar qué
// son o cómo se construían es consulta cultural legítima de la guía.
const TOURIST_OUT_OF_SCOPE_PATTERN =
  /\b(inspecci[oó]n|diagn[oó]stico|intervenci[oó]n|reforzar|fisura|cimentaci[oó]n|ampliaci[oó]n|reportar|denunciar)\b/iu;
const ADVERSARIAL_PATTERN =
  /\b(ignora tus reglas|copia el informe|asume que|afirma que)\b/iu;
// La respuesta es extractiva: ante una petición de texto nuevo generado no hay
// evidencia que citar y el asistente se abstiene.
const FREE_FORM_PATTERN =
  /\b(poema|poes[ií]a|verso|rima|escríbeme|hazme un|redacta un|inventa|improvisa)\b/iu;
const FOLLOW_UP_PATTERN =
  /\b(su|sus|ese|esa|eso|esos|esas|este|esta|esto|ahí|allí|allá|él|ella)\b|\bd[oó]nde (?:queda|est[aá])\b/iu;

const STOPWORDS = new Set([
  'a',
  'al',
  'como',
  'con',
  'cual',
  'cuales',
  'cuando',
  'de',
  'del',
  'donde',
  'e',
  'el',
  'en',
  'es',
  'hay',
  'la',
  'las',
  'lo',
  'los',
  'o',
  'para',
  'por',
  'que',
  'quien',
  'se',
  'si',
  'sin',
  'son',
  'su',
  'sus',
  'un',
  'una',
  'y',
]);

const indexCache = new Map();
const poiCache = { loadedAt: 0, pois: [] };
const unpublishedPoiCache = { loadedAt: 0, pois: [] };

export function clearAssistantCaches() {
  indexCache.clear();
  poiCache.loadedAt = 0;
  poiCache.pois = [];
  unpublishedPoiCache.loadedAt = 0;
  unpublishedPoiCache.pois = [];
}

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function contentTokens(value) {
  return (normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (token) => !STOPWORDS.has(token),
  );
}

function phraseOf(value) {
  return ` ${(normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? []).join(' ')} `;
}

// Forma canónica para comparar preguntas: sin acentos, mayúsculas ni
// puntuación. Así «que es coro?», «¿Qué es Coro?» y «QUE ES CORO» son la
// misma consulta.
function comparableText(value) {
  return (normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
}

export function isGreeting(value) {
  return GREETING_PHRASES.has(comparableText(value));
}

function scopeRules(scope) {
  return scope === 'technical'
    ? {
        levels: ['A', 'B', 'C'],
        accessLevels: ['public', 'internal'],
        includeContext: false,
      }
    : {
        levels: ['A', 'B', 'C', 'D'],
        accessLevels: ['public'],
        includeContext: true,
      };
}

function toIndexItem(chunk) {
  return {
    id: chunk._id.toString(),
    chunkKey: chunk.chunkKey,
    text: chunk.text,
    factKey: chunk.factKey ?? null,
    factValue: chunk.factValue ?? null,
    claimType: chunk.claimType ?? null,
    page: chunk.page ?? null,
    section: chunk.section ?? null,
    poiSlugs: chunk.poiSlugs ?? [],
    questions: chunk.questions ?? [],
    textVector: chunk.embeddings.text,
    questionVectors: chunk.embeddings.questions ?? [],
    source: {
      id: chunk.source._id.toString(),
      sourceId: chunk.source.sourceId,
      title: chunk.source.title,
      institution: chunk.source.institution,
      level: chunk.source.level,
      sourceLabel: chunk.source.sourceLabel,
      url: chunk.source.url ?? null,
      verifiedAt: chunk.source.verifiedAt ?? null,
      usagePolicy: chunk.source.usagePolicy,
    },
  };
}

async function loadIndex(scope, { statuses = ['active'] } = {}) {
  const key = `${scope}|${statuses.join(',')}|${modelIdentity()}`;
  const cached = indexCache.get(key);

  if (cached && Date.now() - cached.loadedAt < INDEX_TTL_MS) {
    return cached.index;
  }

  const rules = scopeRules(scope);
  const usageConditions = [
    { 'source.usagePolicy': 'final', 'source.level': { $in: rules.levels } },
    ...(rules.includeContext ? [{ 'source.usagePolicy': 'context' }] : []),
  ];
  const chunks = await SourceChunk.aggregate([
    {
      $match: {
        assistantScopes: scope,
        language: 'es',
        'embeddings.model': modelIdentity(),
      },
    },
    {
      $lookup: {
        from: SourceDocument.collection.name,
        localField: 'documentId',
        foreignField: '_id',
        as: 'source',
      },
    },
    { $unwind: '$source' },
    {
      $match: {
        'source.status': { $in: statuses },
        'source.language': 'es',
        'source.accessLevel': { $in: rules.accessLevels },
        $or: usageConditions,
      },
    },
    {
      $project: {
        chunkKey: 1,
        text: 1,
        factKey: 1,
        factValue: 1,
        claimType: 1,
        page: 1,
        section: 1,
        poiSlugs: 1,
        questions: 1,
        embeddings: 1,
        'source._id': 1,
        'source.sourceId': 1,
        'source.title': 1,
        'source.institution': 1,
        'source.level': 1,
        'source.sourceLabel': 1,
        'source.url': 1,
        'source.verifiedAt': 1,
        'source.usagePolicy': 1,
      },
    },
  ]);

  const index = { items: chunks.map(toIndexItem) };
  indexCache.set(key, { loadedAt: Date.now(), index });

  return index;
}

async function hasEligibleCorpus(scope) {
  const index = await loadIndex(scope);

  return index.items.some(({ source }) => source.usagePolicy === 'final');
}

async function publishedPois() {
  if (Date.now() - poiCache.loadedAt > POI_CACHE_TTL_MS) {
    const locations = await Location.find({
      status: 'published',
      deletedAt: null,
    })
      .select('_id slug title')
      .lean();
    poiCache.pois = locations.map((location) => ({
      id: location._id.toString(),
      slug: location.slug,
      title: location.title,
    }));
    poiCache.loadedAt = Date.now();
  }

  return poiCache.pois;
}

async function findPublishedPoi(id) {
  return (await publishedPois()).find((poi) => poi.id === id) ?? null;
}

// Lugares del catálogo que no están publicados: mencionarlos por nombre no
// genera respuesta, porque no hay ficha publicada que citar.
async function unpublishedPois() {
  if (Date.now() - unpublishedPoiCache.loadedAt > POI_CACHE_TTL_MS) {
    const locations = await Location.find({
      status: { $in: ['draft', 'archived'] },
      deletedAt: null,
    })
      .select('_id slug title')
      .lean();
    unpublishedPoiCache.pois = locations.map((location) => ({
      id: location._id.toString(),
      slug: location.slug,
      title: location.title,
    }));
    unpublishedPoiCache.loadedAt = Date.now();
  }

  return unpublishedPoiCache.pois;
}

const MAX_SUB_QUERIES = 3;
// Mínimo de palabras con contenido en cada parte para partir una pregunta
// compuesta. Una parte como «¿Qué es Coro?» aporta un solo token distintivo,
// pero es una subconsulta completa; las partes vacías («y qué») siguen fuera.
const MIN_COMPOUND_PART_TOKENS = 1;
// Margen de cobertura para partes de una pregunta compuesta: un fragmento
// partido es más corto que una consulta natural y su similitud tiende a
// bajar; una parte con evidencia cercana cuenta como cubierta, mientras que
// la selección de candidatos sigue exigiendo el umbral completo.
const COVERAGE_SIMILARITY_MARGIN = 0.1;
// Conector interrogativo: "y qué", "y dónde", "e cómo", "y quién", o una coma
// seguida de otra pregunta. La forma singular acentuada ("quién") tiene que
// entrar: sin ella la pregunta no se parte y la consulta única puede responder
// con una cita ajena.
const COMPOUND_INTERROGATIVE =
  '(?:cu[aá]l(?:es)?|qu[eé]|d[oó]nde|c[oó]mo|cu[aá]ndo|cu[aá]nt[oa]s?|qui[eé]n(?:es)?|por\\s+qu[eé]|para\\s+qu[eé])';
const COMPOUND_BOUNDARY_PATTERN = new RegExp(
  `(?:\\?|,|;|\\s+(?:y|e))\\s*(?=(?:¿\\s*)?${COMPOUND_INTERROGATIVE}(?![\\p{L}\\p{N}]))`,
  'giu',
);

/**
 * Divide una pregunta compuesta en sus sub-consultas para recuperar la
 * evidencia de cada parte por separado. Admite dos o tres partes separadas
 * por «?», comas o conectores («y qué», «y cómo»). Devuelve [] cuando la
 * pregunta es simple, de modo que el comportamiento de una consulta única no
 * cambia.
 */
function isQuestionFragment(text) {
  return /[?¿]|\b(?:qu[eé]|cu[aá]l|d[oó]nde|c[oó]mo|cu[aá]ndo|cu[aá]nt[oa]s?|qui[eé]n)/iu.test(
    text,
  );
}

export function splitSubQueries(question) {
  const trimmed = question.trim();
  const boundaries = [...trimmed.matchAll(COMPOUND_BOUNDARY_PATTERN)];

  if (!boundaries.length) {
    return [];
  }

  const parts = [];
  let start = 0;

  for (const boundary of boundaries) {
    const part = trimmed.slice(start, boundary.index).trim();

    // «Voy a Coro este fin de semana, ¿qué lugares...?» no es una pregunta
    // doble: la primera parte es un preámbulo, no una subconsulta. Solo se
    // parte cuando lo que queda a la izquierda ya es una pregunta.
    if (!isQuestionFragment(part)) {
      continue;
    }
    if (part) {
      parts.push(part);
    }
    start = boundary.index + boundary[0].length;
  }

  const tail = trimmed.slice(start).trim();
  if (tail) {
    parts.push(tail);
  }

  if (
    parts.length < 2 ||
    parts.length > MAX_SUB_QUERIES ||
    !parts.every((part) => contentTokens(part).length >= MIN_COMPOUND_PART_TOKENS)
  ) {
    return [];
  }

  return parts;
}

// Vector de la pregunta completa más uno por cada sub-consulta; la posición 0
// es siempre la pregunta original.
async function embedQueryVectors(texts) {
  try {
    const vectors = await embedTexts(texts);

    if (vectors.length !== texts.length) {
      throw new Error('El modelo de embeddings no devolvió un vector por texto');
    }

    return vectors;
  } catch (error) {
    console.error('[assistant] Modelo de embeddings no disponible:', error.message);
    throw new HttpError(
      503,
      'ASSISTANT_MODEL_UNAVAILABLE',
      'El buscador de la guía no está disponible en este momento',
    );
  }
}

function exactQuestionMatch(item, queryText) {
  const asked = comparableText(queryText);

  return Boolean(asked) && item.questions.some((text) => comparableText(text) === asked);
}

function bestSimilarity(item, queryVector, queryText = null) {
  if (queryText && exactQuestionMatch(item, queryText)) {
    return 1;
  }

  return Math.max(
    cosineSimilarity(queryVector, item.textVector),
    ...item.questionVectors.map((vector) => cosineSimilarity(queryVector, vector)),
  );
}

function semanticPoiScores(index, queryVector, queryText = null) {
  const scores = new Map();

  for (const item of index.items) {
    if (!item.poiSlugs.length) {
      continue;
    }

    const similarity = bestSimilarity(item, queryVector, queryText);
    for (const slug of item.poiSlugs) {
      scores.set(slug, Math.max(scores.get(slug) ?? 0, similarity));
    }
  }

  return scores;
}

// Mejor similitud de la evidencia que no pertenece a ningún lugar concreto:
// sirve de referencia para decidir si la pregunta es sobre un lugar o sobre
// Coro en general.
function bestGeneralSimilarity(index, queryVector, queryText = null) {
  let best = 0;

  for (const item of index.items) {
    if (item.poiSlugs.length) {
      continue;
    }

    best = Math.max(best, bestSimilarity(item, queryVector, queryText));
  }

  return best;
}

// «Coro» y «ciudad» aparecen en casi todos los títulos de POI o en preguntas
// sobre la ciudad: no distinguen unos lugares de otros. «Ciudad Deportiva»
// sigue necesitando «deportiva» y «la catedral» resuelve «Catedral de Coro».
const POI_TITLE_STOPWORDS = new Set(['coro', 'ciudad']);

function lexicalPoiScores(question, pois) {
  const queryTokens = new Set(contentTokens(question));
  const titles = pois.map((poi) => ({
    poi,
    tokens: [...new Set(contentTokens(poi.title))].filter(
      (token) => !POI_TITLE_STOPWORDS.has(token),
    ),
  }));
  const frequency = new Map();

  for (const { tokens } of titles) {
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const weight = (token) => 1 / (frequency.get(token) ?? 1);

  return new Map(
    titles.map(({ poi, tokens }) => {
      const total = tokens.reduce((sum, token) => sum + weight(token), 0);
      const matched = tokens
        .filter((token) => queryTokens.has(token))
        .reduce((sum, token) => sum + weight(token), 0);

      return [poi.slug, total > 0 ? matched / total : 0];
    }),
  );
}

function exactPoiMatches(question, pois) {
  const padded = phraseOf(question);

  return pois
    .filter((poi) => padded.includes(phraseOf(poi.title)))
    .sort(
      (left, right) =>
        phraseOf(right.title).length - phraseOf(left.title).length,
    );
}

function rankedPois(scores, pois, minimum) {
  return pois
    .map((poi) => ({ poi, score: scores.get(poi.slug) ?? 0 }))
    .filter(({ score }) => score >= minimum)
    .sort((left, right) => right.score - left.score);
}

// Una pregunta que solo aporta palabras genéricas («ciudad», «Coro») no debe
// activar la vía semántica de un POI concreto. «¿Qué es la ciudad?» no es
// «Ciudad Deportiva», aunque el modelo vea similitud por la palabra «ciudad».
function hasDistinctivePoiToken(question) {
  return contentTokens(question).some((token) => !POI_TITLE_STOPWORDS.has(token));
}

function isFollowUp(question) {
  // Una pregunta genérica como «¿Qué es la ciudad?» tiene un solo token, pero
  // no es un seguimiento: no debe heredar el último POI. Solo se hereda con
  // pronombres/posesivos («su fachada») o con un arranque explícito («¿Y el
  // horario?»).
  if (FOLLOW_UP_PATTERN.test(question)) {
    return true;
  }

  return (
    /^\s*(?:¿|\?)?\s*(?:y|e|entonces|ahora)\b/iu.test(question) &&
    contentTokens(question).length <= 2
  );
}

// Pregunta que pide identificar un lugar (no un atributo): "¿dónde...?",
// "¿cuál es la iglesia/museo/...?" — ante empate de candidatos conviene
// pedir aclaración en lugar de responder como si uno hubiese ganado.
const PLACE_SELECTING_PATTERN =
  /\bd[oó]nde\b|cu[aá]l(?:es)?\s+es\s+(?:el|la|los|las)?\s*(?:lugar|museo|iglesia|casa|monumento|sitio|plaza|templo|edificio|palacio)\b/iu;

function resolvePoi({ question, pois, semanticScores, generalScore, contextPoi }) {
  const exact = exactPoiMatches(question, pois);

  if (exact.length) {
    return { poi: exact[0], ambiguous: [] };
  }

  const lexical = rankedPois(lexicalPoiScores(question, pois), pois, POI_LEXICAL_MIN);

  if (lexical.length === 1) {
    return { poi: lexical[0].poi, ambiguous: [] };
  }
  if (lexical.length > 1) {
    return ambiguousOrFirst(lexical);
  }
  if (contextPoi && isFollowUp(question)) {
    return { poi: contextPoi, ambiguous: [] };
  }

  // Sin un token distintivo no hay atribución semántica a un POI: una pregunta
  // sobre «la ciudad» no puede terminar respondiendo por «Ciudad Deportiva».
  if (!hasDistinctivePoiToken(question)) {
    return { poi: null, ambiguous: [] };
  }

  const semantic = rankedPois(
    semanticScores,
    pois,
    config.assistant.minSimilarity,
  );

  if (!semantic.length) {
    return { poi: null, ambiguous: [] };
  }

  // Si la evidencia general ya alcanza el umbral y la ficha de ningún lugar
  // la supera con claridad, la pregunta no se atribuye a un lugar concreto:
  // evita que "¿Qué es Coro?" active la vía semántica de un lugar que solo
  // comparte palabras con la pregunta. Si la pregunta pide identificar un
  // lugar (PLACE_SELECTING_PATTERN) y los candidatos empatan, se prefiere
  // pedir aclaración antes que responder como si uno hubiese ganado.
  if (
    generalScore >= config.assistant.minSimilarity &&
    semantic[0].score - generalScore < POI_GENERAL_MARGIN
  ) {
    if (PLACE_SELECTING_PATTERN.test(question)) {
      return ambiguousOrFirst(semantic);
    }

    return { poi: null, ambiguous: [] };
  }

  return ambiguousOrFirst(semantic);
}

function ambiguousOrFirst(ranked) {
  // Con un solo candidato no hay nada que aclarar.
  if (
    ranked.length < 2 ||
    ranked[0].score - ranked[1].score >= POI_AMBIGUITY_MARGIN
  ) {
    return { poi: ranked[0].poi, ambiguous: [] };
  }

  return {
    poi: null,
    ambiguous: ranked.slice(0, MAX_OPTIONS).map(({ poi }) => poi),
  };
}

function scoreItems(index, queryVectors, queryTexts, resolvedPoi) {
  return index.items.map((item) => {
    // Similitud por cada consulta (la completa y cada sub-consulta): la
    // aceptación usa la mejor, pero se conserva la de cada parte para exigir
    // evidencia de todos los fragmentos de una pregunta compuesta.
    const perQuery = queryVectors.map((vector, position) =>
      bestSimilarity(item, vector, queryTexts[position]),
    );
    const semantic = Math.max(...perQuery);
    const poiMatch = Boolean(
      resolvedPoi && item.poiSlugs.includes(resolvedPoi.slug),
    );
    // La ficha del lugar resuelto se acepta con umbral propio y sube en el
    // orden para que la primera cita sea siempre del lugar preguntado.
    const minimum = poiMatch
      ? POI_FICHA_MIN_SIMILARITY
      : config.assistant.minSimilarity;

    return {
      item,
      perQuery,
      semantic,
      score: semantic + (poiMatch ? POI_CONTEXT_BOOST : 0),
      accepted: semantic >= minimum,
      minimum,
    };
  });
}

function selectCandidates(scored, statusQuestion, coverageIds = new Set()) {
  const perSource = new Map();

  const sorted = scored
    .filter(({ accepted }) => accepted)
    .sort((left, right) => {
      if (statusQuestion) {
        const statusOrder =
          Number(right.item.claimType === 'current_status') -
          Number(left.item.claimType === 'current_status');

        if (statusOrder !== 0) {
          return statusOrder;
        }
      }

      return right.score - left.score;
    });

  const selected = [];
  const used = new Set();
  const take = (entry) => {
    const sourceId = entry.item.source.sourceId;
    const count = perSource.get(sourceId) ?? 0;

    if (count >= MAX_CANDIDATES_PER_SOURCE) {
      return false;
    }

    perSource.set(sourceId, count + 1);
    selected.push(entry);
    used.add(entry.item.id);

    return true;
  };

  // Primero la cobertura: el mejor fragmento de cada sub-consulta de una
  // pregunta compuesta, para que ninguna parte quede sin responder.
  for (const entry of sorted) {
    if (selected.length >= MAX_CANDIDATES) {
      break;
    }
    if (coverageIds.has(entry.item.id) && !used.has(entry.item.id)) {
      take(entry);
    }
  }

  // Después el resto por orden de similitud.
  for (const entry of sorted) {
    if (selected.length >= MAX_CANDIDATES) {
      break;
    }
    if (!used.has(entry.item.id)) {
      take(entry);
    }
  }

  return selected;
}

function limitWords(text, maxWords) {
  const selected = [];
  let words = 0;

  for (const sentence of text.split(/(?<=[.!?])\s+/u)) {
    const count = sentence.split(/\s+/u).filter(Boolean).length;

    if (selected.length && words + count > maxWords) {
      break;
    }

    selected.push(sentence);
    words += count;
  }

  return selected.join(' ').trim();
}

function quoteFor(item) {
  if (item.factValue) {
    const sentence = item.text
      .split(/(?<=[.!?])\s+/u)
      .find((part) => part.includes(item.factValue));

    return sentence ?? item.factValue;
  }

  return limitWords(item.text, MAX_CITATION_WORDS);
}

function citationFor(item) {
  const quote = quoteFor(item);

  if (!quote) {
    return null;
  }

  const kind = item.factValue
    ? 'fact'
    : item.source.usagePolicy === 'context'
      ? 'context'
      : 'quote';

  return {
    documentId: item.source.id,
    chunkId: item.chunkKey,
    sourceId: item.source.sourceId,
    title: item.source.title,
    institution: item.source.institution,
    sourceLevel: item.source.level,
    sourceLabel: item.source.sourceLabel,
    // Una captura interna del proyecto puede tener una URL de repositorio en
    // su manifiesto; la respuesta pública no la expone.
    url: INTERNAL_SOURCE_INSTITUTIONS.has(item.source.institution)
      ? null
      : item.source.url,
    verifiedAt: item.source.verifiedAt,
    page: item.page,
    section: item.section,
    kind,
    quote,
    claimType: item.claimType ?? (kind === 'context' ? 'context' : null),
    factKey: item.factKey,
    factValue: item.factValue,
    contradictionGroup: null,
    validAsOf: null,
  };
}

function isRelevantSecondaryCitation(
  entry,
  anchorScore,
  resolvedPoi,
  coverageIds,
) {
  if (coverageIds.has(entry.item.id)) {
    return true;
  }
  if (
    resolvedPoi &&
    (entry.item.poiSlugs.includes(resolvedPoi.slug) ||
      phraseOf(entry.item.text).includes(phraseOf(resolvedPoi.title)))
  ) {
    return true;
  }

  return anchorScore - entry.score <= SECONDARY_CITATION_MAX_GAP;
}

// Selecciona las citas del tope de candidatos: primero una por fuente para
// que la respuesta cubra el lugar preguntado y el registro general, y después
// completa el tope con la siguiente cita válida. En preguntas compuestas el
// tope sube para que cada parte tenga su cita en un mismo texto. Toda cita
// posterior a la primera debe aportar cobertura, pertenecer al lugar
// preguntado o estar cerca del puntaje principal.
function pickCitations(
  selected,
  maxCitations = MAX_ANSWER_CITATIONS,
  { resolvedPoi = null, coverageIds = new Set() } = {},
) {
  const picked = [];
  const usedChunks = new Set();
  const usedSources = new Set();
  const anchorScore = selected[0]?.score ?? 0;
  const relevant = (entry) =>
    picked.length === 0 ||
    isRelevantSecondaryCitation(entry, anchorScore, resolvedPoi, coverageIds);

  for (const entry of selected) {
    if (picked.length >= maxCitations) {
      break;
    }
    if (!relevant(entry)) {
      continue;
    }
    if (usedSources.has(entry.item.source.sourceId)) {
      continue;
    }

    const citation = citationFor(entry.item);

    if (!citation) {
      continue;
    }

    usedSources.add(citation.sourceId);
    usedChunks.add(entry.item.chunkKey);
    picked.push(citation);
  }

  for (const entry of selected) {
    if (picked.length >= maxCitations) {
      break;
    }
    if (usedChunks.has(entry.item.chunkKey) || !relevant(entry)) {
      continue;
    }

    const citation = citationFor(entry.item);

    if (citation) {
      usedChunks.add(entry.item.chunkKey);
      picked.push(citation);
    }
  }

  return picked;
}

const HISTORICAL_DISCLAIMER_PATTERN =
  /^historia, horarios y estado actual no est[aá]n verificados en el corpus\.?$/iu;

function sentenceTokens(sentence) {
  return new Set(contentTokens(sentence));
}

// Una frase es redundante si su contenido está incluido en otra ya compuesta
// (o al revés): cubre la repetición de dirección y datos entre la ficha del
// POI y la captura del registro interno.
function isRedundantSentence(tokens, seen) {
  if (tokens.size < 4) {
    return false;
  }

  return seen.some((existing) => {
    const smaller = Math.min(tokens.size, existing.size);

    if (smaller < 4) {
      return false;
    }

    const overlap = [...tokens].filter((token) => existing.has(token)).length;

    return overlap >= smaller;
  });
}

// Compone la respuesta a partir de las citas: elimina frases repetidas,
// capitaliza el inicio de cada frase y retira el aviso de datos no
// verificados cuando otra cita sí aporta historia o un horario/estado actual.
function composeAnswer(citations) {
  const hasHistoricalCitation = citations.some(
    ({ claimType }) => claimType === 'historical',
  );
  const hasCurrentStatusCitation = citations.some(
    ({ claimType }) => claimType === 'current_status',
  );
  const seen = [];
  const parts = [];

  for (const citation of citations) {
    for (const rawSentence of citation.quote.split(/(?<=[.!?])\s+/u)) {
      const sentence = rawSentence.trim();

      if (!sentence) {
        continue;
      }
      if (
        (hasHistoricalCitation || hasCurrentStatusCitation) &&
        HISTORICAL_DISCLAIMER_PATTERN.test(sentence)
      ) {
        continue;
      }

      const tokens = sentenceTokens(sentence);

      if (isRedundantSentence(tokens, seen)) {
        continue;
      }

      seen.push(tokens);
      parts.push(
        sentence.replace(/^([a-záéíóúüñ])/u, (letter) => letter.toUpperCase()),
      );
    }
  }

  return parts.join(' ');
}

function answerTypeFor(citations) {
  if (citations.every(({ kind }) => kind === 'fact')) {
    return 'structured';
  }
  if (citations.every(({ kind }) => kind === 'context')) {
    return 'contextual';
  }
  if (citations.some(({ kind }) => kind !== 'quote')) {
    return 'mixed';
  }

  return 'extractive';
}

function sourcesFor(citations) {
  return [
    ...new Map(
      citations.map((citation) => [
        citation.sourceId,
        {
          id: citation.sourceId,
          title: citation.title,
          institution: citation.institution,
          level: citation.sourceLevel,
          label: citation.sourceLabel,
        },
      ]),
    ).values(),
  ];
}

function nearestQuestions(index, queryVector, question) {
  const asked = normalizeText(question).trim();
  const candidates = [];

  for (const item of index.items) {
    item.questions.forEach((text, position) => {
      const vector = item.questionVectors[position];

      if (vector && normalizeText(text).trim() !== asked) {
        candidates.push({ text, score: cosineSimilarity(queryVector, vector) });
      }
    });
  }

  const seen = new Set();

  return candidates
    .sort((left, right) => right.score - left.score)
    .filter(({ text }) => {
      if (seen.has(text)) {
        return false;
      }

      seen.add(text);

      return true;
    })
    .slice(0, MAX_SUGGESTIONS)
    .map(({ text }) => text);
}

function publicPoi(poi) {
  return poi ? { id: poi.id, slug: poi.slug, title: poi.title } : null;
}

function abstentionResponse({ reason, suggestions, poi, corpusVersion, message = null }) {
  return {
    answerType: 'abstention',
    answer:
      message ??
      (reason === 'NO_CURRENT_STATUS' ? SCHEDULE_ABSTENTION_MESSAGE : FALLBACK_MESSAGE),
    citations: [],
    sources: [],
    confidenceLabel: null,
    abstained: true,
    abstentionReason: reason,
    suggestions,
    options: [],
    poi,
    corpusVersion,
    retrieval: { chunkIds: [], scores: [], topK: 0 },
  };
}

function clarificationResponse(pois, corpusVersion) {
  return {
    answerType: 'clarification',
    answer: CLARIFICATION_MESSAGE,
    citations: [],
    sources: [],
    confidenceLabel: null,
    abstained: true,
    abstentionReason: 'AMBIGUOUS_POI',
    suggestions: [],
    options: pois.map((poi) => ({ id: poi.id, title: poi.title })),
    poi: null,
    corpusVersion,
    retrieval: { chunkIds: [], scores: [], topK: 0 },
  };
}

function greetingResponse(corpusVersion) {
  return {
    answerType: 'greeting',
    answer: GREETING_MESSAGE,
    citations: [],
    sources: [],
    confidenceLabel: null,
    abstained: false,
    abstentionReason: null,
    suggestions: [...GREETING_SUGGESTIONS],
    options: [],
    poi: null,
    corpusVersion,
    retrieval: { chunkIds: [], scores: [], topK: 0 },
  };
}

function statusAbstentionFor({ selected, askedPoi, question }) {
  if (!CURRENT_STATUS_PATTERN.test(question)) {
    return null;
  }

  // Un horario o estado publicado solo responde por el lugar preguntado:
  // si la pregunta resuelve un POI, la evidencia debe pertenecerle (por la
  // etiqueta del fragmento o por mencionar su título en el texto).
  const statusEvidence = selected.filter(({ item }) => {
    if (item.claimType !== 'current_status') {
      return false;
    }
    if (!askedPoi) {
      return true;
    }

    return (
      item.poiSlugs.includes(askedPoi.slug) ||
      phraseOf(item.text).includes(phraseOf(askedPoi.title))
    );
  });
  const asksPrice = PRICE_ASPECT_PATTERN.test(question);
  const covered =
    statusEvidence.length > 0 &&
    (!asksPrice ||
      statusEvidence.some(({ item }) => PRICE_ASPECT_PATTERN.test(item.text)));

  if (covered) {
    return null;
  }

  return {
    reason: 'NO_CURRENT_STATUS',
    message: asksPrice ? PRICE_ABSTENTION_MESSAGE : SCHEDULE_ABSTENTION_MESSAGE,
  };
}

function hasUnsupportedYear(question, selected) {
  const explicitYears = [
    ...new Set(question.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/gu) ?? []),
  ];

  if (!explicitYears.length) {
    return false;
  }

  return !selected.some(({ item }) =>
    explicitYears.some((year) => item.text.includes(year)),
  );
}

function allowPoiChunksFor(question, resolvedPoi) {
  return Boolean(resolvedPoi) || hasDistinctivePoiToken(question);
}

// Una pregunta «¿Qué es la Casa X?» sobre un lugar que no resuelve un POI y
// cuya palabra distintiva no aparece en la evidencia seleccionada no debe
// responderse con otra ficha parecida. Es el caso de «Casa del Tesoro», que
// no existe en el corpus y no puede convertirse en «Casa del Sol».
const PLACE_SUBJECT_PATTERN =
  /^\s*¿?\s*(?:qué|que)\s+(?:es|son)\s+(?:el|la|los|las)?\s*(casa|museo|iglesia|catedral|plaza|monumento|teatro|parque|arco|mirador|paseo|edificio|palacio|convento|capilla|hotel|posada|mercado|puente|torre|castillo|fuerte)\b/iu;
const PLACE_TYPE_TOKENS = new Set([
  'casa',
  'museo',
  'iglesia',
  'catedral',
  'plaza',
  'monumento',
  'teatro',
  'parque',
  'arco',
  'mirador',
  'paseo',
  'edificio',
  'palacio',
  'convento',
  'capilla',
  'hotel',
  'posada',
  'mercado',
  'puente',
  'torre',
  'castillo',
  'fuerte',
]);

function hasUnsupportedPlaceSubject(question, selected, resolvedPoi) {
  if (resolvedPoi || !PLACE_SUBJECT_PATTERN.test(question.trim())) {
    return false;
  }

  const subject = question.trim().replace(/^\s*¿?\s*(?:qué|que)\s+(?:es|son)\s+/iu, '');
  const distinctive = contentTokens(subject).filter(
    (token) => !PLACE_TYPE_TOKENS.has(token),
  );

  if (!distinctive.length) {
    return false;
  }

  const tokenSets = selected.map(
    ({ item }) => new Set(contentTokens(item.text)),
  );

  return !distinctive.every((token) =>
    tokenSets.some((tokens) => tokens.has(token)),
  );
}

/**
 * Resuelve cada parte de una pregunta doble o triple por separado: recupera
 * su evidencia, decide su propia intención y compone su propio texto. Así
 * «¿Qué es Coro y qué es la Ciudad Deportiva?» no mezcla la ficha del POI con
 * la definición de la ciudad ni responde en un orden arbitrario.
 */
async function answerCompoundQuestion({
  question,
  scope,
  contextPoi,
  queryTexts,
  queryVectors,
  index,
  pois,
  corpusVersion,
  abstain,
  fallbackSelected = [],
  fallbackPoi = null,
}) {
  const parts = queryTexts.slice(1);
  const partAnswers = [];
  const allCitations = [];
  const chunkIds = [];
  const scores = [];
  const resolvedPois = [];
  const usedSources = new Set();
  let previousPoi = contextPoi ?? fallbackPoi;

  for (let position = 0; position < parts.length; position += 1) {
    const text = parts[position];
    const vector = queryVectors[position + 1];

    if (scope === 'tourist' && !exactPoiMatches(text, pois).length) {
      const unpublished = exactPoiMatches(text, await unpublishedPois());

      if (unpublished.length) {
        return abstain('NO_EVIDENCE', null, null, vector, text);
      }
    }

    const generalScore = bestGeneralSimilarity(index, vector, text);
    const resolution =
      scope === 'tourist'
        ? resolvePoi({
            question: text,
            pois,
            semanticScores: semanticPoiScores(index, vector, text),
            generalScore,
            contextPoi: previousPoi,
          })
        : { poi: null, ambiguous: [] };

    if (resolution.ambiguous.length) {
      return clarificationResponse(resolution.ambiguous, corpusVersion);
    }

    const poiContext = resolution.poi ?? previousPoi ?? fallbackPoi;

    if (scope === 'tourist' && TOURIST_OUT_OF_SCOPE_PATTERN.test(text)) {
      return abstain('OUT_OF_SCOPE', poiContext, null, vector, text);
    }
    if (ADVERSARIAL_PATTERN.test(text)) {
      return abstain(
        /\bcopia el informe\b/iu.test(text) ? 'RIGHTS_RESTRICTED' : 'NO_EVIDENCE',
        poiContext,
        null,
        vector,
        text,
      );
    }
    if (FREE_FORM_PATTERN.test(text)) {
      return abstain('NO_EVIDENCE', poiContext, null, vector, text);
    }

    const allowPoiChunks = allowPoiChunksFor(text, resolution.poi);
    const scored = scoreItems(index, [vector], [text], resolution.poi).filter(
      ({ item }) => allowPoiChunks || item.poiSlugs.length === 0,
    );
    const statusQuestion =
      scope === 'tourist' && CURRENT_STATUS_PATTERN.test(text);
    const selected = selectCandidates(scored, statusQuestion, new Set());
    const elliptical = isFollowUp(text) || contentTokens(text).length <= 1;
    let effectiveSelected = selected;
    let statusAbstention = statusAbstentionFor({
      selected: effectiveSelected,
      askedPoi: poiContext,
      question: text,
    });
    const initialCitations = pickCitations(effectiveSelected, 2, {
      resolvedPoi: poiContext,
    });

    // Una parte elíptica («cómo se obtienen», «su horario») no recupera por sí
    // sola el sujeto de la parte anterior. Si no encuentra evidencia o el
    // aspecto de estado no está cubierto, se apoya en la selección de la
    // pregunta completa, que sí contiene el sujeto.
    if (elliptical && (!initialCitations.length || statusAbstention)) {
      effectiveSelected = fallbackSelected;
      statusAbstention = statusAbstentionFor({
        selected: effectiveSelected,
        askedPoi: poiContext,
        question: text,
      });
    }

    if (hasUnsupportedPlaceSubject(text, effectiveSelected, resolution.poi)) {
      return abstain('NO_EVIDENCE', poiContext, null, vector, text);
    }

    if (statusAbstention) {
      return abstain(
        statusAbstention.reason,
        poiContext,
        statusAbstention.message,
        vector,
        text,
      );
    }

    if (hasUnsupportedYear(text, effectiveSelected)) {
      return abstain('NO_EVIDENCE', poiContext, null, vector, text);
    }

    // Para una parte compuesta se prefieren dos fuentes distintas si ambas
    // son relevantes: «adobe y tapia» debe citar S-024 y S-025, no dos veces
    // S-024. Luego se elige una cita por parte, priorizando una fuente que no
    // se haya usado ya en otra parte.
    const topSourceId = effectiveSelected[0]?.item.source.sourceId ?? null;
    const alternate = effectiveSelected.find(
      ({ item, accepted }) =>
        accepted && item.source.sourceId !== topSourceId,
    );
    const coverageIds = alternate ? new Set([alternate.item.id]) : new Set();
    const partCitations = pickCitations(effectiveSelected, 2, {
      resolvedPoi: poiContext,
      coverageIds,
    });

    if (!partCitations.length) {
      return abstain('NO_EVIDENCE', poiContext, null, vector, text);
    }

    const primaryCitation = partCitations[0];
    const diverseCitation = partCitations.find(
      (citation) => !usedSources.has(citation.sourceId),
    );
    const chosenCitation = diverseCitation ?? primaryCitation;

    const accessIntent = scope === 'tourist' ? classifyAccessIntent(text) : null;
    const accessEvidence = accessIntent
      ? effectiveSelected.some(({ item }) =>
          accessEvidenceMatches(accessIntent, item.text),
        )
      : false;

    if (accessIntent && !accessEvidence) {
      if (!(accessIntent === 'route' && poiContext)) {
        return abstain(
          'NO_EVIDENCE',
          poiContext,
          accessAbstentionMessage(accessIntent),
          vector,
          text,
        );
      }
    }

    const composed = composeAnswer([chosenCitation]);
    let partAnswer = composed;

    if (accessIntent === 'route' && !accessEvidence && poiContext) {
      partAnswer = `${ROUTE_NOTICE} ${composed}`;
    } else if (
      (accessIntent === 'route' || accessIntent === 'transport') &&
      accessEvidence
    ) {
      partAnswer = `${ACCESS_DATA_NOTICE} ${composed}`;
    }

    if (!partAnswer.trim()) {
      continue;
    }

    partAnswers.push(partAnswer.trim());
    allCitations.push(chosenCitation);
    usedSources.add(chosenCitation.sourceId);

    for (const entry of effectiveSelected) {
      chunkIds.push(entry.item.id);
      scores.push(entry.score);
    }

    if (resolution.poi) {
      resolvedPois.push(resolution.poi);
      previousPoi = resolution.poi;
    }
  }

  const citations = [
    ...new Map(
      allCitations.map((citation) => [citation.chunkId, citation]),
    ).values(),
  ];

  if (!citations.length) {
    return abstain('NO_EVIDENCE', fallbackPoi);
  }

  const uniquePois = [
    ...new Map(resolvedPois.map((poi) => [poi.slug, poi])).values(),
  ];
  const sources = sourcesFor(citations);

  return {
    answerType: answerTypeFor(citations),
    answer: partAnswers.join('\n\n'),
    citations,
    sources,
    confidenceLabel: sources[0]?.label ?? null,
    abstained: false,
    abstentionReason: null,
    suggestions: [],
    options: [],
    // Con varios POI distintos en una misma pregunta no se elige uno solo:
    // un seguimiento posterior no debe heredar el lugar equivocado. Si ninguna
    // parte resolvió un POI, se conserva el de la pregunta completa.
    poi:
      uniquePois.length === 1
        ? publicPoi(uniquePois[0])
        : uniquePois.length === 0 && fallbackPoi
          ? publicPoi(fallbackPoi)
          : null,
    corpusVersion,
    retrieval: {
      chunkIds: [...new Set(chunkIds)],
      scores,
      topK: citations.length,
    },
  };
}

export async function answerAssistantQuestion({
  question,
  scope,
  contextPoi = null,
  statuses = ['active'],
}) {
  const corpusVersion = config.assistant.corpusVersion;
  // Un saludo de mensaje completo no consulta el corpus: responde con la
  // bienvenida y tres preguntas sugeridas.
  if (scope === 'tourist' && isGreeting(question)) {
    return greetingResponse(corpusVersion);
  }

  // Vector de la pregunta completa (posición 0) más uno por cada sub-consulta
  // de una pregunta compuesta, para recuperar la evidencia de cada parte.
  const queryTexts = [question, ...splitSubQueries(question)];
  const queryVectors = await embedQueryVectors(queryTexts);
  const [queryVector] = queryVectors;
  const index = await loadIndex(scope, { statuses });
  const pois = scope === 'tourist' ? await publishedPois() : [];
  const generalScore = bestGeneralSimilarity(index, queryVector, question);

  const abstain = (
    reason,
    resolvedPoi = null,
    message = null,
    vector = queryVector,
    text = question,
  ) =>
    abstentionResponse({
      reason,
      suggestions: nearestQuestions(index, vector, text),
      poi: publicPoi(resolvedPoi),
      corpusVersion,
      message,
    });

  // La hora exacta del momento no está en el corpus: se abstiene con el
  // mensaje único en lugar de confundirla con un horario de apertura.
  if (scope === 'tourist' && TIME_NOW_PATTERN.test(question)) {
    return abstain('NO_EVIDENCE');
  }

  // Un lugar que existe en el catálogo pero no está publicado no genera
  // respuesta: la pregunta se abstiene sin selector ni ambigüedad.
  if (scope === 'tourist' && !exactPoiMatches(question, pois).length) {
    const unpublished = exactPoiMatches(question, await unpublishedPois());

    if (unpublished.length) {
      return abstain('NO_EVIDENCE');
    }
  }

  const resolution =
    scope === 'tourist'
      ? resolvePoi({
          question,
          pois,
          semanticScores: semanticPoiScores(index, queryVector, question),
          generalScore,
          contextPoi,
        })
      : { poi: null, ambiguous: [] };
  const poi = publicPoi(resolution.poi);

  // Una pregunta triple no debe resolverse con la ambigüedad del texto
  // completo: cada parte se resuelve y se responde por separado.
  if (resolution.ambiguous.length && queryVectors.length === 1) {
    return clarificationResponse(resolution.ambiguous, corpusVersion);
  }

  if (scope === 'tourist' && TOURIST_OUT_OF_SCOPE_PATTERN.test(question)) {
    return abstain('OUT_OF_SCOPE', resolution.poi);
  }

  if (ADVERSARIAL_PATTERN.test(question)) {
    return abstain(
      /\bcopia el informe\b/iu.test(question) ? 'RIGHTS_RESTRICTED' : 'NO_EVIDENCE',
      resolution.poi,
    );
  }

  // Ante una petición de texto nuevo generado no hay evidencia que citar,
  // aunque la pregunta mencione un lugar publicado.
  if (FREE_FORM_PATTERN.test(question)) {
    return abstain('NO_EVIDENCE', resolution.poi);
  }

  const statusQuestion =
    scope === 'tourist' && CURRENT_STATUS_PATTERN.test(question);
  const allowPoiChunks = allowPoiChunksFor(question, resolution.poi);
  const scored = scoreItems(index, [queryVector], [question], resolution.poi).filter(
    ({ item }) => allowPoiChunks || item.poiSlugs.length === 0,
  );
  const selected = selectCandidates(scored, statusQuestion, new Set());

  if (queryVectors.length > 1) {
    return answerCompoundQuestion({
      question,
      scope,
      contextPoi,
      queryTexts,
      queryVectors,
      index,
      pois,
      corpusVersion,
      abstain,
      fallbackSelected: selected,
      fallbackPoi: resolution.poi,
    });
  }

  if (hasUnsupportedPlaceSubject(question, selected, resolution.poi)) {
    return abstain('NO_EVIDENCE', resolution.poi);
  }

  const statusAbstention = statusAbstentionFor({
    selected,
    askedPoi: resolution.poi,
    question,
  });
  if (statusAbstention) {
    return abstain(statusAbstention.reason, resolution.poi, statusAbstention.message);
  }

  if (hasUnsupportedYear(question, selected)) {
    return abstain('NO_EVIDENCE', resolution.poi);
  }

  const citations = pickCitations(selected, MAX_ANSWER_CITATIONS, {
    resolvedPoi: resolution.poi,
  });

  if (!citations.length) {
    return abstain('NO_EVIDENCE', resolution.poi);
  }

  const sources = sourcesFor(citations);
  const composed = composeAnswer(citations);
  const accessIntent = scope === 'tourist' ? classifyAccessIntent(question) : null;
  const accessEvidence = accessIntent
    ? selected.some(({ item }) => accessEvidenceMatches(accessIntent, item.text))
    : false;

  if (accessIntent && !accessEvidence) {
    // En una pregunta de ruta con un lugar resuelto sí se comparte la ficha,
    // pero con el aviso de que no hay ruta verificada. Para estacionamiento,
    // transporte, distancia o visitas nocturnas, una ficha genérica no
    // responde la pregunta y se prefiere la abstención específica.
    if (!(accessIntent === 'route' && resolution.poi)) {
      return abstain(
        'NO_EVIDENCE',
        resolution.poi,
        accessAbstentionMessage(accessIntent),
      );
    }
  }

  let answer = composed;

  if (accessIntent === 'route' && !accessEvidence && resolution.poi) {
    answer = `${ROUTE_NOTICE} ${composed}`;
  } else if (
    (accessIntent === 'route' || accessIntent === 'transport') &&
    accessEvidence
  ) {
    answer = `${ACCESS_DATA_NOTICE} ${composed}`;
  }

  return {
    answerType: answerTypeFor(citations),
    answer,
    citations,
    sources,
    confidenceLabel: sources[0]?.label ?? null,
    abstained: false,
    abstentionReason: null,
    suggestions: [],
    options: [],
    poi,
    corpusVersion,
    retrieval: {
      chunkIds: selected.map(({ item }) => item.id),
      scores: selected.map(({ score }) => score),
      topK: selected.length,
    },
  };
}

export function validateAssistantInput(body, scope) {
  const question =
    typeof body?.question === 'string' ? body.question.trim() : '';

  if (
    (question.length < 3 && !(scope === 'tourist' && isGreeting(question))) ||
    question.length > 2000
  ) {
    throw new HttpError(
      400,
      'INVALID_QUESTION',
      'La pregunta debe tener entre 3 y 2000 caracteres',
    );
  }

  let contextLocationId;
  if (body?.contextLocationId !== undefined && body.contextLocationId !== null) {
    if (
      scope !== 'tourist' ||
      typeof body.contextLocationId !== 'string' ||
      !mongoose.isValidObjectId(body.contextLocationId)
    ) {
      throw new HttpError(400, 'INVALID_POI', 'El POI indicado no es válido');
    }

    contextLocationId = body.contextLocationId;
  }

  let conversationId;
  if (body?.conversationId !== undefined && body.conversationId !== null) {
    if (
      scope !== 'technical' ||
      typeof body.conversationId !== 'string' ||
      !mongoose.isValidObjectId(body.conversationId)
    ) {
      throw new HttpError(
        400,
        'INVALID_CONVERSATION',
        'La conversación indicada no es válida',
      );
    }

    conversationId = body.conversationId;
  }

  if (body?.locale !== undefined && !['es', 'es-VE'].includes(body.locale)) {
    throw new HttpError(
      400,
      'UNSUPPORTED_LOCALE',
      'El asistente v1 solo responde en español',
    );
  }

  if (body?.assetId !== undefined || body?.inspectionId !== undefined) {
    throw new HttpError(
      400,
      'CONTEXT_NOT_SUPPORTED',
      'El asistente v1 no consulta datos de activos ni de inspecciones',
    );
  }

  return { question, scope, contextLocationId, conversationId };
}

async function findConversation(conversationId, userId) {
  if (!conversationId) {
    return null;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId,
    assistant: 'inspection',
    retentionUntil: { $gt: new Date() },
  });

  if (!conversation) {
    throw new HttpError(
      404,
      'CONVERSATION_NOT_FOUND',
      'La conversación no existe o no está disponible',
    );
  }

  if (conversation.corpusVersion !== config.assistant.corpusVersion) {
    throw new HttpError(
      409,
      'CORPUS_VERSION_CHANGED',
      'La versión del corpus cambió; inicia una conversación nueva',
    );
  }

  return conversation;
}

async function persistTechnicalAnswer({
  userId,
  conversation,
  question,
  answer,
  latencyMs,
}) {
  const now = new Date();
  const retentionUntil = new Date(
    now.getTime() + CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const session = await mongoose.startSession();
  let conversationId;
  let messageId;

  try {
    await session.withTransaction(async () => {
      let activeConversation = conversation;
      if (!activeConversation) {
        [activeConversation] = await Conversation.create(
          [
            {
              userId,
              assistant: 'inspection',
              startedAt: now,
              lastMessageAt: now,
              retentionUntil,
              corpusVersion: config.assistant.corpusVersion,
            },
          ],
          { session },
        );
      } else {
        activeConversation.lastMessageAt = now;
        activeConversation.retentionUntil = retentionUntil;
        await activeConversation.save({ session });
      }

      await Message.create(
        [
          {
            conversationId: activeConversation._id,
            role: 'user',
            content: question,
            retentionUntil,
            retrieval: { corpusVersion: config.assistant.corpusVersion },
          },
        ],
        { session },
      );
      const [assistantMessage] = await Message.create(
        [
          {
            conversationId: activeConversation._id,
            role: 'assistant',
            content: answer.answer,
            citations: answer.citations,
            answerType: answer.answerType,
            abstained: answer.abstained,
            abstentionReason: answer.abstentionReason,
            latencyMs,
            retrieval: {
              chunkIds: answer.retrieval.chunkIds,
              scores: answer.retrieval.scores,
              topK: answer.retrieval.topK,
              corpusVersion: config.assistant.corpusVersion,
            },
            retentionUntil,
          },
        ],
        { session },
      );
      conversationId = activeConversation._id.toString();
      messageId = assistantMessage._id.toString();
    });
  } finally {
    await session.endSession();
  }

  return { conversationId, messageId };
}

export async function queryAssistant(body, scope, user) {
  const input = validateAssistantInput(body, scope);
  const enabled =
    scope === 'tourist'
      ? config.assistant.touristEnabled
      : config.assistant.technicalEnabled;
  if (
    !enabled ||
    !config.assistant.corpusVersion ||
    !(await hasEligibleCorpus(scope))
  ) {
    throw new HttpError(
      503,
      'ASSISTANT_UNAVAILABLE',
      'El asistente todavía no tiene un corpus verificado y publicado',
    );
  }

  const contextPoi = input.contextLocationId
    ? await findPublishedPoi(input.contextLocationId)
    : null;
  const conversation =
    scope === 'technical'
      ? await findConversation(input.conversationId, user._id)
      : null;
  const startedAt = Date.now();
  const answer = await answerAssistantQuestion({
    question: input.question,
    scope,
    contextPoi,
  });
  const latencyMs = Date.now() - startedAt;
  let persisted = { conversationId: null, messageId: null };

  if (scope === 'technical') {
    persisted = await persistTechnicalAnswer({
      userId: user._id,
      conversation,
      question: input.question,
      answer,
      latencyMs,
    });
  }

  const { retrieval: _retrieval, ...publicAnswer } = answer;
  return {
    ...publicAnswer,
    ...persisted,
    latencyMs,
  };
}

export async function getAssistantStatus() {
  const [touristCorpusReady, technicalCorpusReady] = await Promise.all([
    hasEligibleCorpus('tourist'),
    hasEligibleCorpus('technical'),
  ]);
  const corpusVersion = config.assistant.corpusVersion;

  return {
    corpusVersion,
    tourist: {
      enabled: config.assistant.touristEnabled,
      available:
        config.assistant.touristEnabled &&
        Boolean(corpusVersion) &&
        touristCorpusReady,
    },
    technical: {
      enabled: config.assistant.technicalEnabled,
      available:
        config.assistant.technicalEnabled &&
        Boolean(corpusVersion) &&
        technicalCorpusReady,
    },
  };
}
