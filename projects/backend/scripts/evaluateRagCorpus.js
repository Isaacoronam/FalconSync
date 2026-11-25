import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../databases/db.js';
import AuditLog from '../databases/models/AuditLog.js';
import Conversation from '../databases/models/Conversation.js';
import Location from '../databases/models/Location.js';
import Message from '../databases/models/Message.js';
import RefreshSession from '../databases/models/RefreshSession.js';
import SourceChunk from '../databases/models/SourceChunk.js';
import SourceDocument from '../databases/models/SourceDocument.js';
import User from '../databases/models/User.js';
import { config } from '../helpers/env.js';
import { hashPassword } from '../microservices/authService.js';
import {
  answerAssistantQuestion,
  clearAssistantCaches,
  FALLBACK_MESSAGE,
  SCHEDULE_ABSTENTION_MESSAGE,
} from '../microservices/assistantService.js';
import { modelIdentity } from '../microservices/embeddingService.js';
import { insertLocations } from '../seeders/seedLocations.js';
import { ingestManifest, verifyCorpus } from './ingestRagCorpus.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Base de datos propia y desechable: nunca se toca la de desarrollo ni la de pruebas.
const EVAL_DB_NAME = 'falconsync_rag_eval';
// El filtro de estados permite medir también las fuentes en borrador pendientes
// de aprobación; el informe lo declara explícitamente.
const EVAL_STATUSES = ['active', 'draft'];
// Corpus completo de la guía turística: fuentes oficiales, registro interno y
// las fuentes externas curadas (S-024 a S-029) incorporadas en la expansión.
const EVAL_MANIFESTS = [
  'S-002',
  'S-003',
  'S-020',
  'S-021',
  'S-022',
  'S-024',
  'S-025',
  'S-026',
  'S-027',
  'S-028',
  'S-029',
  'S-030',
  'S-031',
  'S-032',
];
const EXCLUDED_MANIFESTS = [
  {
    sourceId: 'S-005',
    reason: 'Borrador sin casos en el conjunto dorado v2; sigue sin aprobar.',
  },
  {
    sourceId: 'S-023',
    reason:
      'Su manifiesto exige que el POI cataratas-de-hueque esté publicado y el POI sigue en borrador.',
  },
];
// S-021 y S-022 fueron aprobadas por el responsable del proyecto el
// 2026-11-23 y ya responden en producción; no hay fuentes en borrador entre
// las incluidas.
const INCLUDED_DRAFT_SOURCES = [];
// Identificador fijo que declaran los manifiestos activos como verificador de derechos.
const HISTORIAN_ID = '6aee4b03d9a54453e896062c';

function percentile(values, ratio) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);

  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 1;
}

function normalize(value) {
  return value.replace(/\s+/gu, ' ').trim();
}

function evalDatabaseName() {
  const configured = process.env.RAG_EVAL_DB?.trim();

  if (configured && !configured.startsWith(EVAL_DB_NAME)) {
    throw new Error(
      `RAG_EVAL_DB (${configured}) debe comenzar por ${EVAL_DB_NAME}: el script solo limpia bases de datos propias.`,
    );
  }

  return configured || EVAL_DB_NAME;
}

function evalUri(baseUri, dbName) {
  if (process.env.RAG_EVAL_MONGODB_URI?.trim()) {
    return process.env.RAG_EVAL_MONGODB_URI.trim();
  }

  const [withoutQuery, ...queryParts] = baseUri.split('?');
  const query = queryParts.length ? `?${queryParts.join('?')}` : '';
  const base = withoutQuery.replace(/\/+$/, '').replace(/\/[^/]*$/, '');

  return `${base}/${dbName}${query}`;
}

function parseArguments(args) {
  const options = {
    dataset: null,
    report: null,
    sources: null,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (
      argument === '--dataset' ||
      argument === '--report' ||
      argument === '--sources'
    ) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new TypeError(`${argument} requiere un valor`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new TypeError(`Argumento no reconocido: ${argument}`);
  }

  return options;
}

function printHelp() {
  console.log(
    [
      'Evalúa el asistente turístico contra los conjuntos dorados RAG (v2 y v3).',
      '  node scripts/evaluateRagCorpus.js [--dataset <archivo.json>] [--report <archivo.json>]',
      '  node scripts/evaluateRagCorpus.js --dataset <v2> --report <informe> --sources S-002,S-003,S-020,S-021,S-022',
      'Usa una base de datos temporal propia (falconsync_rag_eval) que limpia al inicio.',
      '--sources limita la ingesta de la evaluación (para regresiones bajo las condiciones originales).',
      'Requiere un replica set (transacciones de ingesta) y el modelo de embeddings local.',
    ].join('\n'),
  );
}

async function resetEvaluationDatabase() {
  await Promise.all([
    SourceDocument.deleteMany({}),
    SourceChunk.deleteMany({}),
    Location.deleteMany({}),
    AuditLog.deleteMany({}),
    User.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    RefreshSession.deleteMany({}),
  ]);
}

async function createEvaluationActors() {
  // El historiador conserva el identificador que declaran los manifiestos S-002,
  // S-003 y S-020 como verificador de derechos.
  const historian = await User.create({
    _id: HISTORIAN_ID,
    name: 'Historiador de evaluación',
    email: 'historian@rag-eval.local',
    passwordHash: await hashPassword('EvaluacionRag2026'),
    role: 'historian',
    mustChangePassword: false,
  });
  const admin = await User.create({
    name: 'Administrador de evaluación',
    email: 'admin@rag-eval.local',
    passwordHash: await hashPassword('EvaluacionRag2026'),
    role: 'admin',
    mustChangePassword: false,
  });

  return { historian, admin };
}

async function ingestEvaluationCorpus(admin, sourceIds = EVAL_MANIFESTS) {
  const ingested = [];

  for (const sourceId of sourceIds) {
    const manifestPath = path.join(backendRoot, 'corpus', 'manifests', `${sourceId}.json`);
    const input = JSON.parse(await readFile(manifestPath, 'utf8'));
    const result = await ingestManifest({ input, actor: admin, apply: true });

    ingested.push({
      sourceId,
      status: result.summary.status,
      usagePolicy: result.summary.usagePolicy,
      level: input.source.level,
      chunkCount: result.summary.chunkCount,
      declaredAsDraft: INCLUDED_DRAFT_SOURCES.includes(sourceId),
    });
  }

  return ingested;
}

async function findPublishedPoiBySlug(slug) {
  const location = await Location.findOne({
    slug,
    status: 'published',
    deletedAt: null,
  })
    .select('_id slug title')
    .lean();

  return location
    ? { id: location._id.toString(), slug: location.slug, title: location.title }
    : null;
}

async function citationIsVerifiable(citation) {
  const chunk = await SourceChunk.findOne({ chunkKey: citation.chunkId })
    .select('text')
    .lean();

  if (!chunk) {
    return false;
  }
  if (citation.kind === 'context') {
    return true;
  }

  return normalize(chunk.text).includes(normalize(citation.quote));
}

function expectPoiOf(testCase) {
  return 'poi' in testCase.expect ? testCase.expect.poi : undefined;
}

function caseFailureReason(testCase, answer) {
  const reasons = [];

  if ('abstained' in testCase.expect && answer.abstained !== testCase.expect.abstained) {
    reasons.push(
      `abstained esperado ${testCase.expect.abstained}, obtenido ${answer.abstained}`,
    );
  }
  const expectedPoi = expectPoiOf(testCase);
  if (expectedPoi !== undefined && (answer.poi?.slug ?? null) !== expectedPoi) {
    reasons.push(
      `poi esperado ${expectedPoi}, obtenido ${answer.poi?.slug ?? null}`,
    );
  }
  if (testCase.expect.answerType && answer.answerType !== testCase.expect.answerType) {
    reasons.push(
      `answerType esperado ${testCase.expect.answerType}, obtenido ${answer.answerType}`,
    );
  }

  return reasons.join('; ');
}

async function runCases(cases) {
  const latencies = [];
  const failures = [];
  const sourceMisses = [];
  const categoryTotals = new Map();

  let poiTotal = 0;
  let poiHits = 0;
  let clarificationTotal = 0;
  let clarificationHits = 0;
  let abstentionTotal = 0;
  let abstentionHits = 0;
  let expectedSources = 0;
  let hitSources = 0;
  let citationTotal = 0;
  let validCitations = 0;
  let fallbackTotal = 0;
  let fallbackExact = 0;
  let suggestionsTotal = 0;
  let suggestionsComplete = 0;

  for (const testCase of cases) {
    const startedAt = Date.now();
    const answer = await answerAssistantQuestion({
      question: testCase.question,
      scope: 'tourist',
      contextPoi: testCase.context
        ? await findPublishedPoiBySlug(testCase.context)
        : null,
      statuses: EVAL_STATUSES,
    });
    latencies.push(Date.now() - startedAt);

    const category = testCase.category;
    const totals = categoryTotals.get(category) ?? { total: 0, passed: 0 };
    totals.total += 1;

    const reasons = caseFailureReason(testCase, answer);
    if (reasons) {
      failures.push({
        id: testCase.id,
        category,
        question: testCase.question,
        expected: testCase.expect,
        actual: {
          poi: answer.poi?.slug ?? null,
          abstained: answer.abstained,
          answerType: answer.answerType,
          abstentionReason: answer.abstentionReason,
        },
        reason: reasons,
      });
    } else {
      totals.passed += 1;
    }
    categoryTotals.set(category, totals);

    if ('poi' in testCase.expect) {
      poiTotal += 1;
      if ((answer.poi?.slug ?? null) === testCase.expect.poi) {
        poiHits += 1;
      }
    }

    if (testCase.expect.answerType === 'clarification') {
      clarificationTotal += 1;
      if (answer.answerType === 'clarification') {
        clarificationHits += 1;
      }
    }

    if ('abstained' in testCase.expect) {
      abstentionTotal += 1;
      if (answer.abstained === testCase.expect.abstained) {
        abstentionHits += 1;
      }
    }

    const returnedSources = new Set(answer.sources.map(({ id }) => id));
    for (const sourceId of testCase.expect.sourceIds ?? []) {
      expectedSources += 1;
      if (returnedSources.has(sourceId)) {
        hitSources += 1;
      } else {
        sourceMisses.push({
          id: testCase.id,
          sourceId,
          question: testCase.question,
        });
      }
    }

    for (const citation of answer.citations) {
      citationTotal += 1;
      if (await citationIsVerifiable(citation)) {
        validCitations += 1;
      }
    }

    const isClarification = testCase.expect.answerType === 'clarification';
    if (testCase.expect.abstained === true && !isClarification) {
      fallbackTotal += 1;
      if (
        answer.answer === FALLBACK_MESSAGE ||
        answer.answer === SCHEDULE_ABSTENTION_MESSAGE
      ) {
        fallbackExact += 1;
      }

      suggestionsTotal += 1;
      if (
        answer.suggestions.length === 3 &&
        answer.suggestions.every((suggestion) => typeof suggestion === 'string')
      ) {
        suggestionsComplete += 1;
      }
    }
  }

  return {
    latencies,
    failures,
    sourceMisses,
    categoryTotals,
    counts: {
      poiTotal,
      poiHits,
      clarificationTotal,
      clarificationHits,
      abstentionTotal,
      abstentionHits,
      expectedSources,
      hitSources,
      citationTotal,
      validCitations,
      fallbackTotal,
      fallbackExact,
      suggestionsTotal,
      suggestionsComplete,
    },
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const datasetPath = path.resolve(
    backendRoot,
    options.dataset ?? path.join('corpus', 'evaluation', 'rag-golden-v2.json'),
  );
  const reportPath = path.resolve(
    backendRoot,
    options.report ??
      path.join('corpus', 'evaluation', 'rag-golden-v2-report.json'),
  );
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
  if (dataset.schemaVersion !== 2 || !Array.isArray(dataset.cases)) {
    throw new Error('El conjunto dorado debe declarar schemaVersion 2 y una lista de casos');
  }

  const dbName = evalDatabaseName();
  const uri = evalUri(config.mongoUri, dbName);
  console.log(`[rag:eval] Base de datos temporal: ${dbName}`);
  await connectDB(uri);

  try {
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      AuditLog.init(),
      SourceDocument.init(),
      SourceChunk.init(),
      Conversation.init(),
      Message.init(),
      Location.init(),
    ]);
    await resetEvaluationDatabase();
    const { admin } = await createEvaluationActors();
    await insertLocations({ quiet: true });

    const corpus = await ingestEvaluationCorpus(
      admin,
      options.sources
        ? options.sources
            .split(',')
            .map((sourceId) => sourceId.trim())
            .filter(Boolean)
        : undefined,
    );
    clearAssistantCaches();
    const corpusVerification = await verifyCorpus();

    // Calentamiento: carga el modelo y el índice fuera de la medición de latencia.
    const warmupStartedAt = Date.now();
    await answerAssistantQuestion({
      question: '¿Qué es Coro?',
      scope: 'tourist',
      statuses: EVAL_STATUSES,
    });
    const warmupMs = Date.now() - warmupStartedAt;

    const run = await runCases(dataset.cases);
    const metrics = {
      poiAccuracy: ratio(run.counts.poiHits, run.counts.poiTotal),
      clarificationAccuracy: ratio(
        run.counts.clarificationHits,
        run.counts.clarificationTotal,
      ),
      abstentionAccuracy: ratio(
        run.counts.abstentionHits,
        run.counts.abstentionTotal,
      ),
      sourceHit: ratio(run.counts.hitSources, run.counts.expectedSources),
      citationValidity: ratio(
        run.counts.validCitations,
        run.counts.citationTotal,
      ),
      fallbackExact: ratio(run.counts.fallbackExact, run.counts.fallbackTotal),
      suggestionsComplete: ratio(
        run.counts.suggestionsComplete,
        run.counts.suggestionsTotal,
      ),
      invalidCitations: run.counts.citationTotal - run.counts.validCitations,
      latencyP50Ms: percentile(run.latencies, 0.5),
      latencyP95Ms: percentile(run.latencies, 0.95),
    };

    const unmetTargets = Object.entries(dataset.targets)
      .filter(([name, target]) =>
        name === 'latencyP95Ms'
          ? metrics[name] > target
          : metrics[name] < target,
      )
      .map(([name, target]) => ({ metric: name, target, actual: metrics[name] }));

    const report = {
      schemaVersion: 2,
      dataset: path.relative(backendRoot, datasetPath).replaceAll('\\', '/'),
      datasetName: dataset.name,
      executedAt: new Date().toISOString(),
      corpusVersion: config.assistant.corpusVersion,
      embeddingModel: modelIdentity(),
      minSimilarity: config.assistant.minSimilarity,
      database: dbName,
      evaluationStatuses: EVAL_STATUSES,
      warmupMs,
      sampleSize: dataset.cases.length,
      corpus: {
        ingested: corpus,
        excluded: EXCLUDED_MANIFESTS,
        declaredAsDraft: INCLUDED_DRAFT_SOURCES,
        note: 'S-021 y S-022 fueron aprobadas por el responsable del proyecto el 2026-11-23 y ya responden en producción; S-024 a S-029 son fuentes externas de niveles C y D incorporadas en la expansión del corpus (resúmenes propios con atribución y enlace); S-030 y S-031 aportan horarios publicados por el museo y la catedral, y el resto de lugares responde «Sin horarios confirmados».',
      },
      corpusVerification,
      targets: dataset.targets,
      metrics,
      unmetTargets,
      categoryBreakdown: Object.fromEntries(
        [...run.categoryTotals.entries()].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      failures: run.failures,
      sourceMisses: run.sourceMisses,
    };

    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(JSON.stringify({ metrics, unmetTargets }, null, 2));
    console.log(
      `[rag:eval] ${dataset.cases.length} casos, ${run.failures.length} fallos. Informe: ${path.relative(process.cwd(), reportPath)}`,
    );

    if (unmetTargets.length || !corpusVerification.ok) {
      process.exitCode = 1;
    }
  } finally {
    await disconnectDB();
  }
}

main().catch(async (error) => {
  console.error('[rag:eval] Error:', error.message);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exitCode = 1;
});
