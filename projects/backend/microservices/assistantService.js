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
const POI_LEXICAL_MIN = 0.5;
const POI_AMBIGUITY_MARGIN = 0.05;
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
// intervención técnica (propio del apoyo técnico). Los términos materiales
// (adobe, tapia, estructura) no están aquí a propósito: preguntar qué son o
// cómo se construían es consulta cultural legítima de la guía.
const TOURIST_OUT_OF_SCOPE_PATTERN =
  /\b(inspecci[oó]n|diagn[oó]stico|intervenci[oó]n|reforzar|fisura|cimentaci[oó]n|construir|ampliaci[oó]n)\b/iu;
const ADVERSARIAL_PATTERN =
  /\b(ignora tus reglas|copia el informe|asume que|afirma que)\b/iu;
// La respuesta es extractiva: ante una petición de texto nuevo generado no hay
// evidencia que citar y el asistente se abstiene.
const FREE_FORM_PATTERN =
  /\b(poema|poes[ií]a|verso|rima|escríbeme|hazme un|redacta un|inventa|improvisa)\b/iu;
const FOLLOW_UP_PATTERN =
  /\b(su|sus|ese|esa|eso|esos|esas|este|esta|esto|ahí|allí|allá|él|ella)\b/iu;

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
// compuesta; partes demasiado elípticas no aportan recuperación propia.
const MIN_COMPOUND_PART_TOKENS = 2;
// Margen de cobertura para partes de una pregunta compuesta: un fragmento
// partido es más corto que una consulta natural y su similitud tiende a
// bajar; una parte con evidencia cercana cuenta como cubierta, mientras que
// la selección de candidatos sigue exigiendo el umbral completo.
const COVERAGE_SIMILARITY_MARGIN = 0.1;
// Conector interrogativo: "y qué", "y dónde", "e cómo"...
const COMPOUND_CONNECTOR_PATTERN =
  /\s+(?:y|e)\s+(?=(?:cu[aá]l|cu[aá]les|qu[eé]|d[oó]nde|c[oó]mo|cu[aá]ndo|cu[aá]nt[oa]s?|quien|qui[eé]nes|por qu[eé]|para qu[eé]))/iu;

/**
 * Divide una pregunta compuesta en sus sub-consultas para recuperar la
 * evidencia de cada parte por separado. Devuelve [] cuando la pregunta es
 * simple, de modo que el comportamiento de una consulta única no cambia.
 */
export function splitSubQueries(question) {
  const trimmed = question.trim();
  const byMarks = trimmed
    .split(/\?(?=\s*¿)/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (
    byMarks.length > 1 &&
    byMarks.length <= MAX_SUB_QUERIES &&
    byMarks.every((part) => contentTokens(part).length >= MIN_COMPOUND_PART_TOKENS)
  ) {
    return byMarks;
  }

  const connector = COMPOUND_CONNECTOR_PATTERN.exec(trimmed);
  if (connector) {
    const left = trimmed.slice(0, connector.index).trim();
    const right = trimmed.slice(connector.index + connector[0].length).trim();

    if (
      contentTokens(left).length >= MIN_COMPOUND_PART_TOKENS &&
      contentTokens(right).length >= MIN_COMPOUND_PART_TOKENS
    ) {
      return [left, right];
    }
  }

  return [];
}

// Vector de la pregunta completa más uno por cada sub-consulta; la posición 0
// es siempre la pregunta original.
async function embedQueryVectors(question) {
  const texts = [question, ...splitSubQueries(question)];

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

function bestSimilarity(item, queryVector) {
  return Math.max(
    cosineSimilarity(queryVector, item.textVector),
    ...item.questionVectors.map((vector) => cosineSimilarity(queryVector, vector)),
  );
}

function semanticPoiScores(index, queryVector) {
  const scores = new Map();

  for (const item of index.items) {
    if (!item.poiSlugs.length) {
      continue;
    }

    const similarity = bestSimilarity(item, queryVector);
    for (const slug of item.poiSlugs) {
      scores.set(slug, Math.max(scores.get(slug) ?? 0, similarity));
    }
  }

  return scores;
}

// Mejor similitud de la evidencia que no pertenece a ningún lugar concreto:
// sirve de referencia para decidir si la pregunta es sobre un lugar o sobre
// Coro en general.
function bestGeneralSimilarity(index, queryVector) {
  let best = 0;

  for (const item of index.items) {
    if (item.poiSlugs.length) {
      continue;
    }

    best = Math.max(best, bestSimilarity(item, queryVector));
  }

  return best;
}

function lexicalPoiScores(question, pois) {
  const queryTokens = new Set(contentTokens(question));
  const titles = pois.map((poi) => ({
    poi,
    tokens: [...new Set(contentTokens(poi.title))],
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

function isFollowUp(question) {
  return FOLLOW_UP_PATTERN.test(question) || contentTokens(question).length <= 3;
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

function scoreItems(index, queryVectors, resolvedPoi) {
  return index.items.map((item) => {
    // Similitud por cada consulta (la completa y cada sub-consulta): la
    // aceptación usa la mejor, pero se conserva la de cada parte para exigir
    // evidencia de todos los fragmentos de una pregunta compuesta.
    const perQuery = queryVectors.map((vector) => bestSimilarity(item, vector));
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
    url: item.source.url,
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

// Selecciona las citas del tope de candidatos: primero una por fuente para
// que la respuesta cubra el lugar preguntado y el registro general, y después
// completa el tope con la siguiente cita válida. En preguntas compuestas el
// tope sube para que cada parte tenga su cita en un mismo texto.
function pickCitations(selected, maxCitations = MAX_ANSWER_CITATIONS) {
  const picked = [];
  const usedChunks = new Set();
  const usedSources = new Set();

  for (const { item } of selected) {
    if (picked.length >= maxCitations) {
      break;
    }
    if (usedSources.has(item.source.sourceId)) {
      continue;
    }

    const citation = citationFor(item);

    if (!citation) {
      continue;
    }

    usedSources.add(citation.sourceId);
    usedChunks.add(item.chunkKey);
    picked.push(citation);
  }

  for (const { item } of selected) {
    if (picked.length >= maxCitations) {
      break;
    }
    if (usedChunks.has(item.chunkKey)) {
      continue;
    }

    const citation = citationFor(item);

    if (citation) {
      usedChunks.add(item.chunkKey);
      picked.push(citation);
    }
  }

  return picked;
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

function abstentionResponse({ reason, suggestions, poi, corpusVersion }) {
  return {
    answerType: 'abstention',
    answer:
      reason === 'NO_CURRENT_STATUS'
        ? SCHEDULE_ABSTENTION_MESSAGE
        : FALLBACK_MESSAGE,
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

export async function answerAssistantQuestion({
  question,
  scope,
  contextPoi = null,
  statuses = ['active'],
}) {
  const corpusVersion = config.assistant.corpusVersion;
  // Vector de la pregunta completa (posición 0) más uno por cada sub-consulta
  // de una pregunta compuesta, para recuperar la evidencia de cada parte.
  const queryVectors = await embedQueryVectors(question);
  const [queryVector] = queryVectors;
  const index = await loadIndex(scope, { statuses });
  const pois = scope === 'tourist' ? await publishedPois() : [];
  const generalScore = bestGeneralSimilarity(index, queryVector);

  const abstain = (reason, resolvedPoi = null) =>
    abstentionResponse({
      reason,
      suggestions: nearestQuestions(index, queryVector, question),
      poi: publicPoi(resolvedPoi),
      corpusVersion,
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
          semanticScores: semanticPoiScores(index, queryVector),
          generalScore,
          contextPoi,
        })
      : { poi: null, ambiguous: [] };
  const poi = publicPoi(resolution.poi);

  if (resolution.ambiguous.length) {
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
  const scored = scoreItems(index, queryVectors, resolution.poi);
  // En una pregunta compuesta, el mejor candidato de cada sub-consulta entra
  // en la selección para que ninguna parte quede sin responder.
  const coverageIds = new Set();

  for (let position = 1; position < queryVectors.length; position += 1) {
    let best = null;

    for (const entry of scored) {
      if (entry.perQuery[position] < entry.minimum) {
        continue;
      }
      if (!best || entry.perQuery[position] > best.perQuery[position]) {
        best = entry;
      }
    }

    if (best) {
      coverageIds.add(best.item.id);
    }
  }

  const selected = selectCandidates(scored, statusQuestion, coverageIds);

  if (statusQuestion) {
    const statusEvidence = selected.filter(
      ({ item }) => item.claimType === 'current_status',
    );
    const asksPrice = PRICE_ASPECT_PATTERN.test(question);
    // Un horario publicado no responde una pregunta de precio: si la pregunta
    // pide tarifas, la evidencia de estado debe contener datos de precio.
    const covered =
      statusEvidence.length > 0 &&
      (!asksPrice ||
        statusEvidence.some(({ item }) =>
          PRICE_ASPECT_PATTERN.test(item.text),
        ));

    if (!covered) {
      return abstain('NO_CURRENT_STATUS', resolution.poi);
    }
  }

  // Si alguna parte de una pregunta compuesta no tiene evidencia propia, la
  // respuesta completa se abstiene: no se responde a medias. El piso usa el
  // umbral con margen (fragmentos cortos); ver COVERAGE_SIMILARITY_MARGIN.
  const coverageFloor =
    config.assistant.minSimilarity - COVERAGE_SIMILARITY_MARGIN;
  const uncoveredPart =
    queryVectors.length > 1 &&
    Array.from(
      { length: queryVectors.length - 1 },
      (_, offset) => offset + 1,
    ).some((position) =>
      scored.every((entry) => entry.perQuery[position] < coverageFloor),
    );

  if (uncoveredPart) {
    return abstain('NO_EVIDENCE', resolution.poi);
  }

  // Si la pregunta nombra un año concreto y ningún fragmento seleccionado lo
  // contiene, no hay evidencia sobre ese hecho (p. ej. un terremoto de 1812).
  const explicitYears = [
    ...new Set(question.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/gu) ?? []),
  ];

  if (
    explicitYears.length &&
    !selected.some(({ item }) =>
      explicitYears.some((year) => item.text.includes(year)),
    )
  ) {
    return abstain('NO_EVIDENCE', resolution.poi);
  }

  const citations = pickCitations(
    selected,
    queryVectors.length > 1 ? MAX_ANSWER_CITATIONS_COMPOUND : MAX_ANSWER_CITATIONS,
  );

  if (!citations.length) {
    return abstain('NO_EVIDENCE', resolution.poi);
  }

  const sources = sourcesFor(citations);

  return {
    answerType: answerTypeFor(citations),
    answer: citations.map(({ quote }) => quote).join(' '),
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

  if (question.length < 3 || question.length > 2000) {
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
