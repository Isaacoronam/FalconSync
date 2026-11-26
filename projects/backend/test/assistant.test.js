import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27018/falconsync_assistant_test?replicaSet=falconsyncTest';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';
process.env.RAG_TOURIST_ENABLED = 'true';
process.env.RAG_TECHNICAL_ENABLED = 'true';
process.env.RAG_CORPUS_VERSION = 'assistant-test';

const { default: app } = await import('../index.js');
const { connectDB, disconnectDB } = await import('../databases/db.js');
const { default: Conversation } = await import(
  '../databases/models/Conversation.js'
);
const { default: Location } = await import('../databases/models/Location.js');
const { default: Message } = await import('../databases/models/Message.js');
const { default: RefreshSession } = await import(
  '../databases/models/RefreshSession.js'
);
const { default: SourceChunk } = await import(
  '../databases/models/SourceChunk.js'
);
const { default: SourceDocument } = await import(
  '../databases/models/SourceDocument.js'
);
const { default: User } = await import('../databases/models/User.js');
const { hashPassword } = await import('../microservices/authService.js');
const {
  clearAssistantCaches,
  FALLBACK_MESSAGE,
  GREETING_MESSAGE,
  PRICE_ABSTENTION_MESSAGE,
  ROUTE_NOTICE,
  SCHEDULE_ABSTENTION_MESSAGE,
  splitSubQueries,
} = await import('../microservices/assistantService.js');
const { modelIdentity, setEmbedderForTests } = await import(
  '../microservices/embeddingService.js'
);
const { config } = await import('../helpers/env.js');

const PASSWORD = 'UsuarioSegura123';
const STOPWORDS = new Set([
  'a', 'al', 'como', 'con', 'cual', 'cuando', 'de', 'del', 'donde', 'el',
  'en', 'es', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'que', 'se',
  'su', 'sus', 'un', 'una', 'y',
]);

function fakeVector(text) {
  const vector = new Array(256).fill(0);
  const tokens =
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [];

  for (const token of tokens) {
    if (STOPWORDS.has(token)) {
      continue;
    }

    let hash = 0;
    for (const character of token.slice(0, 5)) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    vector[hash % 256] += 1;
  }

  const norm = Math.hypot(...vector) || 1;

  return vector.map((value) => value / norm);
}

async function fakeEmbedder(texts) {
  return texts.map(fakeVector);
}

async function createUser(email, role = 'user') {
  return User.create({
    name: 'Usuario de prueba',
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
    mustChangePassword: false,
  });
}

async function authorizationFor(email) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  return `Bearer ${response.body.data.accessToken}`;
}

async function createSource({
  sourceId = 'S-002',
  level = 'A',
  status = 'active',
  usagePolicy = 'final',
  indexingPolicy = 'short_quotes_only',
  institution = 'UNESCO',
  url = 'https://whc.unesco.org/',
  sourceLabel = null,
} = {}) {
  return SourceDocument.create({
    sourceId,
    title: 'Ficha oficial de Coro',
    institution,
    version: '2026',
    sourceLabel:
      sourceLabel ??
      (level === 'A'
        ? 'Oficial UNESCO'
        : level === 'B'
          ? 'Académico'
          : 'Externo'),
    retrievedAt: new Date('2026-11-20T00:00:00.000Z'),
    verifiedAt: status === 'active' ? new Date() : null,
    url,
    level,
    usagePolicy,
    indexingPolicy,
    credibilityNotes: 'Fuente oficial para prueba automatizada',
    license: 'Cita breve',
    rights: 'Uso limitado a citas breves',
    rightsVerified: status === 'active',
    accessLevel: 'public',
    language: 'es',
    status,
  });
}

async function createChunk(
  source,
  {
    chunkKey = `${source.sourceId}#p1.01`,
    ordinal = 0,
    text = 'Coro y su Puerto fueron inscritos en 1993 con los criterios iv y v.',
    assistantScopes = ['tourist'],
    poiSlugs = [],
    questions = [],
    claimType = null,
  } = {},
) {
  return SourceChunk.create({
    chunkKey,
    documentId: source._id,
    ordinal,
    page: '1',
    section: 'Inscripción',
    language: 'es',
    text,
    claimType,
    indexingPolicy: source.indexingPolicy,
    assistantScopes,
    poiSlugs,
    questions,
    checksum: 'a'.repeat(64),
    embeddings: {
      model: modelIdentity(),
      text: fakeVector(text),
      questions: questions.map(fakeVector),
    },
  });
}

async function createPoi({ title, slug, category = 'religious', status = 'published' }) {
  return Location.create({
    title,
    slug,
    category,
    description: `Descripción de ${title}.`,
    address: 'Casco histórico de Coro',
    circuits: ['casco-historico'],
    location: { type: 'Point', coordinates: [-69.6778, 11.4075] },
    coordinateSource: 'Prueba automatizada',
    coordinateVerifiedAt: new Date('2026-11-22T00:00:00.000Z'),
    verificationLevel: 'single-source',
    status,
    isProvisional: false,
    isCatalogVisible: true,
  });
}

function askTourist(question, contextLocationId) {
  const payload = { question };
  if (contextLocationId) {
    payload.contextLocationId = contextLocationId;
  }

  return request(app).post('/api/assistant/tourist/query').send(payload);
}

async function createFinalCorpus() {
  const source = await createSource();
  await createChunk(source);
}

describe('Asistentes RAG', () => {
  let originalMinSimilarity;

  before(async () => {
    await connectDB();
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      SourceDocument.init(),
      SourceChunk.init(),
      Conversation.init(),
      Message.init(),
      Location.init(),
    ]);
    originalMinSimilarity = config.assistant.minSimilarity;
    config.assistant.minSimilarity = 0.3;
    setEmbedderForTests(fakeEmbedder);
  });

  beforeEach(async () => {
    clearAssistantCaches();
    await Promise.all([
      SourceChunk.deleteMany({}),
      SourceDocument.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Location.deleteMany({}),
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
    ]);
  });

  after(async () => {
    config.assistant.minSimilarity = originalMinSimilarity;
    setEmbedderForTests(null);
    await Promise.all([
      SourceChunk.deleteMany({}),
      SourceDocument.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Location.deleteMany({}),
      User.deleteMany({}),
      RefreshSession.deleteMany({}),
    ]);
    await disconnectDB();
  });

  it('responde con una cita literal y abstiene con el mensaje único si no hay evidencia', async () => {
    const source = await createSource();
    await createChunk(source);

    const answer = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: 'Coro y su Puerto fueron inscritos en 1993' });

    assert.equal(answer.status, 200, JSON.stringify(answer.body));
    assert.equal(answer.body.data.answerType, 'extractive');
    assert.equal(answer.body.data.abstained, false);
    assert.equal(
      answer.body.data.citations[0].quote,
      'Coro y su Puerto fueron inscritos en 1993 con los criterios iv y v.',
    );
    assert.equal(answer.body.data.citations[0].sourceId, 'S-002');
    assert.equal(answer.body.data.citations[0].page, '1');
    assert.equal(answer.body.data.citations[0].kind, 'quote');
    assert.equal(answer.body.data.conversationId, null);

    const noEvidence = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué infraestructura existe en Marte?' });

    assert.equal(noEvidence.status, 200, JSON.stringify(noEvidence.body));
    assert.equal(noEvidence.body.data.abstained, true);
    assert.equal(noEvidence.body.data.answerType, 'abstention');
    assert.equal(noEvidence.body.data.abstentionReason, 'NO_EVIDENCE');
    assert.equal(noEvidence.body.data.answer, FALLBACK_MESSAGE);
    assert.equal(await Message.countDocuments({}), 0);
  });

  it('no publica respuestas antes de tener corpus elegible', async () => {
    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué es el patrimonio de Coro?' });

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'ASSISTANT_UNAVAILABLE');
  });

  it('expone el estado de cada asistente sin revelar metadatos de fuentes', async () => {
    const response = await request(app).get('/api/assistant/status');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.tourist.enabled, true);
    assert.equal(response.body.data.tourist.available, false);
    assert.equal(response.body.data.technical.available, false);
    assert.equal(response.body.data.corpusVersion, 'assistant-test');
  });

  it('lista fuentes solo a source.read y no devuelve contenido ni rutas privadas', async () => {
    await createSource({
      sourceId: 'S-002',
      status: 'draft',
      usagePolicy: 'context',
    });
    await createUser('visitante-sources@assistant.local', 'user');
    await createUser('historiador-sources@assistant.local', 'historian');

    const anonymous = await request(app).get('/api/sources');
    assert.equal(anonymous.status, 401);

    const visitor = await request(app)
      .get('/api/sources')
      .set(
        'Authorization',
        await authorizationFor('visitante-sources@assistant.local'),
      );
    assert.equal(visitor.status, 403);

    const historian = await request(app)
      .get('/api/sources?status=draft&limit=1')
      .set(
        'Authorization',
        await authorizationFor('historiador-sources@assistant.local'),
      );
    assert.equal(historian.status, 200, JSON.stringify(historian.body));
    assert.equal(historian.body.data.length, 1);
    assert.equal(historian.body.data[0].sourceId, 'S-002');
    assert.equal(historian.body.data[0].usagePolicy, 'context');
    assert.equal(historian.body.meta.total, 1);
    assert.equal('storageKey' in historian.body.data[0], false);
    assert.equal('rightsVerifiedBy' in historian.body.data[0], false);
    assert.equal('chunks' in historian.body.data[0], false);
  });

  it('exige habilitación explícita del asistente aunque haya corpus', async () => {
    const source = await createSource();
    await createChunk(source);
    const enabled = config.assistant.touristEnabled;
    config.assistant.touristEnabled = false;

    let response;
    try {
      response = await request(app)
        .post('/api/assistant/tourist/query')
        .send({ question: '¿En qué año inscribieron a Coro?' });
    } finally {
      config.assistant.touristEnabled = enabled;
    }

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'ASSISTANT_UNAVAILABLE');
  });

  it('restringe el asistente técnico a usuarios con la capacidad requerida', async () => {
    await createUser('inspector@assistant.local', 'inspector');
    await createUser('otro-inspector@assistant.local', 'inspector');
    await createUser('visitante@assistant.local');
    const inspectorToken = await authorizationFor('inspector@assistant.local');
    const otherInspectorToken = await authorizationFor(
      'otro-inspector@assistant.local',
    );
    const visitorToken = await authorizationFor('visitante@assistant.local');

    const denied = await request(app)
      .post('/api/assistant/inspection/query')
      .set('Authorization', visitorToken)
      .send({ question: '¿Cómo se conserva una tapia?' });

    assert.equal(denied.status, 403);

    const source = await createSource({ sourceId: 'S-021', level: 'B' });
    await createChunk(source, {
      chunkKey: 'S-021#p4.tapia.01',
      text: 'La tapia se construye compactando tierra dentro de un encofrado.',
      assistantScopes: ['technical'],
    });

    const allowed = await request(app)
      .post('/api/assistant/inspection/query')
      .set('Authorization', inspectorToken)
      .send({ question: '¿Cómo se construye la tapia?' });

    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
    assert.equal(allowed.body.data.abstained, false);
    assert.equal(allowed.body.data.citations[0].sourceLevel, 'B');
    assert.ok(allowed.body.data.conversationId);
    assert.ok(allowed.body.data.messageId);
    assert.equal(allowed.body.data.corpusVersion, 'assistant-test');
    assert.equal(allowed.body.data.sources[0].id, 'S-021');
    assert.equal(
      await Message.countDocuments({
        conversationId: allowed.body.data.conversationId,
      }),
      2,
    );
    const storedAnswer = await Message.findOne({
      conversationId: allowed.body.data.conversationId,
      role: 'assistant',
    });
    assert.equal(storedAnswer.citations[0].sourceId, 'S-021');
    assert.equal(storedAnswer.citations[0].title, 'Ficha oficial de Coro');
    assert.equal(storedAnswer.citations[0].institution, 'UNESCO');
    assert.ok(storedAnswer.citations[0].verifiedAt instanceof Date);

    const followup = await request(app)
      .post('/api/assistant/inspection/query')
      .set('Authorization', inspectorToken)
      .send({
        question: '¿Qué dice la fuente sobre tapia?',
        conversationId: allowed.body.data.conversationId,
      });

    assert.equal(followup.status, 200, JSON.stringify(followup.body));
    assert.equal(
      followup.body.data.conversationId,
      allowed.body.data.conversationId,
    );
    assert.equal(
      await Message.countDocuments({
        conversationId: allowed.body.data.conversationId,
      }),
      4,
    );
    const conversation = await Conversation.findById(
      allowed.body.data.conversationId,
    );
    assert.equal(conversation.corpusVersion, 'assistant-test');
    assert.ok(
      conversation.retentionUntil.getTime() >
        Date.now() + 89 * 24 * 60 * 60 * 1000,
    );

    const crossAccount = await request(app)
      .post('/api/assistant/inspection/query')
      .set('Authorization', otherInspectorToken)
      .send({
        question: '¿Cómo se construye la tapia?',
        conversationId: allowed.body.data.conversationId,
      });

    assert.equal(crossAccount.status, 404);

    const tourist = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Cómo se construye la tapia?' });
    assert.equal(tourist.status, 503);
  });

  it('no permite publicar fuentes no finales ni citas largas', async () => {
    const pointerSource = await createSource({
      sourceId: 'S-006',
      level: 'D',
      usagePolicy: 'pointer',
    });
    await createChunk(pointerSource);

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿En qué año inscribieron a Coro?' });

    assert.equal(response.status, 503);

    const quoteOnlySource = await createSource({ sourceId: 'S-003' });
    await assert.rejects(
      createChunk(quoteOnlySource, {
        chunkKey: 'S-003#p1.long.01',
        text: 'Esta fuente contiene deliberadamente más de veinticinco palabras para comprobar que la política de citas breves impide almacenarla y publicarla en el corpus RAG sin una validación adicional.',
      }),
      /más de 25 palabras/,
    );

    const lowLevelTechnicalSource = await createSource({
      sourceId: 'S-007',
      level: 'D',
    });
    await createChunk(lowLevelTechnicalSource, {
      chunkKey: 'S-007#p1.technical.01',
      assistantScopes: ['technical'],
    });
    const inspector = await createUser(
      'inspector-low-source@assistant.local',
      'inspector',
    );
    const technicalResponse = await request(app)
      .post('/api/assistant/inspection/query')
      .set('Authorization', await authorizationFor(inspector.email))
      .send({ question: '¿En qué año inscribieron a Coro?' });

    assert.equal(technicalResponse.status, 503);
  });

  it('rechaza preguntas inválidas', async () => {
    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: 'ab' });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_QUESTION');
  });

  it('se abstiene ante estado actual y orientación técnica fuera del corpus turístico', async () => {
    const source = await createSource({
      sourceId: 'S-002',
      status: 'active',
      usagePolicy: 'final',
    });
    await createChunk(source, {
      questions: [
        '¿En qué año inscribieron a Coro?',
        '¿Qué criterios cumple Coro?',
        '¿Qué es Coro?',
      ],
    });

    const statusResponse = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Está abierto el Museo Diocesano hoy?' });
    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.body.data.abstained, true);
    assert.equal(statusResponse.body.data.abstentionReason, 'NO_CURRENT_STATUS');
    // Sin evidencia de apertura, la guía lo dice de forma directa.
    assert.equal(
      statusResponse.body.data.answer,
      SCHEDULE_ABSTENTION_MESSAGE,
    );
    assert.match(statusResponse.body.data.answer, /Sin horarios confirmados/);
    assert.equal(statusResponse.body.data.suggestions.length, 3);

    const technicalResponse = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Cómo diagnóstico una fisura en un muro de tapia?' });
    assert.equal(technicalResponse.status, 200);
    assert.equal(technicalResponse.body.data.abstained, true);
    assert.equal(technicalResponse.body.data.abstentionReason, 'OUT_OF_SCOPE');
  });

  it('no acepta datos de inspección que el asistente aún no está autorizado a consultar', async () => {
    const inspector = await createUser(
      'inspector-context@assistant.local',
      'inspector',
    );
    const response = await request(app)
      .post('/api/assistant/inspection/query')
      .set(
        'Authorization',
        await authorizationFor(inspector.email),
      )
      .send({
        question: '¿Qué muestra esta inspección?',
        inspectionId: '507f1f77bcf86cd799439011',
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'CONTEXT_NOT_SUPPORTED');
  });

  it('resuelve el lugar por su nombre sin selector y devuelve su ficha', async () => {
    const poi = await createPoi({
      title: 'Catedral de Coro',
      slug: 'catedral-de-coro',
    });
    await createFinalCorpus();
    const source = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-021#poi.catedral-de-coro',
      text: 'Catedral de Coro es un lugar religioso registrado en FALCONSYNC, en el circuito Casco histórico.',
      poiSlugs: ['catedral-de-coro'],
      questions: ['¿Qué es Catedral de Coro?', '¿Dónde está Catedral de Coro?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Dónde está la Catedral de Coro?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    assert.equal(response.body.data.poi.slug, 'catedral-de-coro');
    assert.equal(response.body.data.poi.id, poi._id.toString());
    assert.equal(response.body.data.citations[0].sourceId, 'S-021');
    assert.equal(response.body.data.citations[0].kind, 'context');
  });

  it('pide aclaración cuando dos lugares publicados son igual de probables', async () => {
    const first = await createPoi({
      title: 'Museo Diocesano',
      slug: 'museo-diocesano',
      category: 'museum',
    });
    const second = await createPoi({
      title: 'Museo Guadalupano',
      slug: 'museo-guadalupano',
      category: 'museum',
    });
    await createFinalCorpus();
    const source = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    const text = 'Museo registrado en FALCONSYNC en el casco histórico.';
    await createChunk(source, {
      chunkKey: 'S-021#poi.museo-diocesano',
      ordinal: 0,
      text,
      poiSlugs: ['museo-diocesano'],
    });
    await createChunk(source, {
      chunkKey: 'S-021#poi.museo-guadalupano',
      ordinal: 1,
      text,
      poiSlugs: ['museo-guadalupano'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Dónde está el museo?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.answerType, 'clarification');
    assert.equal(response.body.data.abstentionReason, 'AMBIGUOUS_POI');
    assert.equal(response.body.data.poi, null);
    assert.deepEqual(
      response.body.data.options.map(({ id }) => id).sort(),
      [first._id.toString(), second._id.toString()].sort(),
    );
  });

  it('usa el último lugar como pista de seguimiento sin filtrar la búsqueda', async () => {
    const poi = await createPoi({
      title: 'Casa del Sol',
      slug: 'casa-del-sol',
      category: 'architecture',
    });
    await createFinalCorpus();
    const source = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-021#poi.casa-del-sol',
      text: 'Casa del Sol es una obra de arquitectura registrada en FALCONSYNC, en el circuito Casco histórico.',
      poiSlugs: ['casa-del-sol'],
      questions: ['¿Qué es Casa del Sol?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Y su fachada?', contextLocationId: poi._id.toString() });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.poi.slug, 'casa-del-sol');
  });

  it('no hereda el lugar anterior en una pregunta corta con tema propio', async () => {
    const poi = await createPoi({
      title: 'Monumento de las Madres',
      slug: 'monumento-de-las-madres',
    });
    await createFinalCorpus();
    const ficha = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(ficha, {
      chunkKey: 'S-021#poi.monumento-de-las-madres',
      text: 'Monumento de las Madres es un monumento registrado en FALCONSYNC.',
      poiSlugs: ['monumento-de-las-madres'],
      questions: ['¿Qué es el Monumento de las Madres?'],
    });
    const tapial = await createSource({
      sourceId: 'S-025',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(tapial, {
      chunkKey: 'S-025#generalidades.tapial',
      text: 'La técnica del tapial consiste en rellenar un encofrado con capas de tierra.',
      questions: ['¿Cómo construir con tapia?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({
        question: 'como construir con tapia',
        contextLocationId: poi._id.toString(),
      });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    assert.equal(response.body.data.poi, null);
    assert.equal(response.body.data.citations[0].sourceId, 'S-025');
  });

  it('rechaza un contextLocationId con formato inválido e ignora un lugar no publicado', async () => {
    await createFinalCorpus();
    const source = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, { chunkKey: 'S-021#faq.coro' });

    const invalid = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué es Coro?', contextLocationId: 'no-es-un-id' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'INVALID_POI');

    const unpublished = await request(app)
      .post('/api/assistant/tourist/query')
      .send({
        question: '¿Y su fachada?',
        contextLocationId: '507f1f77bcf86cd799439011',
      });
    assert.equal(unpublished.status, 200, JSON.stringify(unpublished.body));
    assert.equal(unpublished.body.data.poi, null);
  });

  it('devuelve tres sugerencias respondibles cuando no hay evidencia', async () => {
    const source = await createSource();
    const questions = [
      '¿En qué año inscribieron a Coro?',
      '¿Qué criterios cumple Coro?',
      '¿Está Coro en peligro?',
      '¿Qué es Coro?',
    ];
    await createChunk(source, { questions });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué infraestructura existe en Marte?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.answer, FALLBACK_MESSAGE);
    assert.equal(response.body.data.suggestions.length, 3);
    for (const suggestion of response.body.data.suggestions) {
      assert.ok(questions.includes(suggestion), suggestion);
    }
  });

  it('se abstiene ante una petición de texto libre aunque la pregunta mencione un lugar', async () => {
    await createPoi({ title: 'Catedral de Coro', slug: 'catedral-de-coro' });
    const source = await createSource();
    await createChunk(source);

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: 'Escríbeme un poema sobre la catedral' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, true);
    assert.equal(response.body.data.abstentionReason, 'NO_EVIDENCE');
    assert.equal(response.body.data.answer, FALLBACK_MESSAGE);
    assert.equal(response.body.data.poi?.slug, 'catedral-de-coro');
  });

  it('se abstiene cuando la pregunta nombra un año que ningún fragmento contiene', async () => {
    const source = await createSource();
    await createChunk(source, {
      text: 'Coro fue inscrito en 1993 con los criterios iv y v.',
      questions: ['¿Qué pasó en Coro?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué le pasó a Coro en 1812?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, true);
    assert.equal(response.body.data.abstentionReason, 'NO_EVIDENCE');
    assert.equal(response.body.data.answer, FALLBACK_MESSAGE);
  });

  it('se abstiene ante un lugar del catálogo que no está publicado', async () => {
    await createPoi({
      title: 'Cataratas de Hueque',
      slug: 'cataratas-de-hueque',
      status: 'draft',
    });
    const source = await createSource();
    await createChunk(source, {
      text: 'Cataratas de Hueque son un atractivo natural de Falcón.',
      questions: ['¿Qué son las Cataratas de Hueque?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué son las Cataratas de Hueque?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, true);
    assert.equal(response.body.data.abstentionReason, 'NO_EVIDENCE');
    assert.equal(response.body.data.poi, null);
    assert.equal(response.body.data.citations.length, 0);
  });

  it('no atribuye la pregunta a un lugar cuando la evidencia general es más fuerte', async () => {
    await createPoi({
      title: 'Museo Diocesano',
      slug: 'museo-diocesano',
      category: 'museum',
    });
    const general = await createSource();
    await createChunk(general, { questions: ['¿Qué es Coro?'] });
    const poiSource = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
    });
    await createChunk(poiSource, {
      chunkKey: 'S-021#poi.museo-diocesano',
      text: 'Coro es patrimonio',
      poiSlugs: ['museo-diocesano'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué es Coro?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.poi, null);
    assert.equal(response.body.data.abstained, false);
    assert.notEqual(response.body.data.answerType, 'clarification');
  });

  it('responde 503 si el modelo de embeddings no está disponible', async () => {
    const source = await createSource();
    await createChunk(source);
    setEmbedderForTests(async () => {
      throw new Error('modelo no disponible');
    });

    let response;
    try {
      response = await request(app)
        .post('/api/assistant/tourist/query')
        .send({ question: 'Coro y su Puerto fueron inscritos en 1993' });
    } finally {
      setEmbedderForTests(fakeEmbedder);
    }

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'ASSISTANT_MODEL_UNAVAILABLE');
  });

  it('responde preguntas dobles en un solo texto con la evidencia de cada parte', async () => {
    await createPoi({ title: 'Casa del Sol', slug: 'casa-del-sol' });
    const unesco = await createSource();
    await createChunk(unesco, {
      chunkKey: 'S-002#p1.01',
      text: 'Coro y su Puerto fueron inscritos en 1993 con los criterios iv y v.',
      questions: ['¿En qué año inscribieron a Coro?', '¿Qué criterios cumple Coro?'],
    });
    const registry = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(registry, {
      chunkKey: 'S-021#poi.casa-del-sol',
      text: 'Casa del Sol es una obra de arquitectura registrada en FALCONSYNC, en el circuito Casco histórico.',
      poiSlugs: ['casa-del-sol'],
      questions: ['¿Qué es Casa del Sol?', '¿Dónde está Casa del Sol?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({
        question: '¿En qué año se inscribió Coro y qué es la Casa del Sol?',
      });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    // Una sola respuesta con la evidencia de las dos partes.
    const sourceIds = response.body.data.citations.map(({ sourceId }) => sourceId);
    assert.ok(sourceIds.includes('S-002'), JSON.stringify(response.body.data));
    assert.ok(sourceIds.includes('S-021'), JSON.stringify(response.body.data));
    assert.ok(response.body.data.citations.length >= 2);
    assert.ok(response.body.data.answer.includes('1993'));
    assert.ok(response.body.data.answer.includes('Casa del Sol'));
    // Toda respuesta con contenido lleva sus fuentes.
    assert.ok(response.body.data.sources.length >= 1);
    for (const citation of response.body.data.citations) {
      assert.ok(citation.quote.length > 0);
      assert.ok(citation.sourceId);
    }
  });

  it('se abstiene en una pregunta doble cuando una parte no tiene evidencia', async () => {
    const source = await createSource();
    await createChunk(source);

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({
        question: '¿En qué año se inscribió Coro y quién pintó la Mona Lisa?',
      });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, true);
    assert.equal(response.body.data.answer, FALLBACK_MESSAGE);
    assert.equal(response.body.data.citations.length, 0);
  });

  it('explica la arquitectura de tierra sin tratarla como orientación técnica', async () => {
    const source = await createSource();
    await createChunk(source, {
      chunkKey: 'S-024#p1.01',
      text: 'El adobe es un ladrillo de barro formado en moldes y secado al aire libre.',
      questions: ['¿Qué es el adobe?', '¿Cómo se hacían las casas de barro?'],
    });

    const cultural = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué es el adobe?' });

    assert.equal(cultural.status, 200, JSON.stringify(cultural.body));
    assert.equal(cultural.body.data.abstained, false);
    assert.ok(cultural.body.data.citations.length >= 1);

    const diagnostic = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Cómo diagnostico una fisura en un muro de tapia?' });

    assert.equal(diagnostic.status, 200);
    assert.equal(diagnostic.body.data.abstained, true);
    assert.equal(diagnostic.body.data.abstentionReason, 'OUT_OF_SCOPE');
  });

  it('devuelve siempre fuentes citadas en cada respuesta con contenido', async () => {
    const source = await createSource();
    await createChunk(source);

    const questions = [
      '¿En qué año inscribieron a Coro?',
      '¿Qué criterios cumple Coro?',
      '¿Qué es Coro?',
    ];

    for (const question of questions) {
      const response = await request(app)
        .post('/api/assistant/tourist/query')
        .send({ question });

      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.data.abstained, false, question);
      assert.ok(response.body.data.citations.length >= 1, question);
      assert.ok(response.body.data.sources.length >= 1, question);
      for (const citation of response.body.data.citations) {
        assert.ok(citation.quote.length > 0, question);
        assert.ok(citation.title, question);
      }
    }
  });

  it('distingue la hora actual y los precios sin fuente de un horario publicado', async () => {
    const source = await createSource();
    await createChunk(source, {
      chunkKey: 'S-002#mucor.horario',
      text: 'El Museo de Arte de Coro abre de martes a sábado de 9:00 a.m. a 4:00 p.m.',
      claimType: 'current_status',
      questions: [
        '¿A qué hora abre el Museo de Arte de Coro?',
        '¿Cuál es el horario del Museo de Arte de Coro?',
        '¿Los días de apertura del museo?',
      ],
    });

    // Una pregunta de precio sin evidencia de precio no se responde con un
    // horario publicado: avisa que faltan datos confirmados.
    const price = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Cuánto cuesta la entrada al Museo de Arte de Coro?' });
    assert.equal(price.status, 200, JSON.stringify(price.body));
    assert.equal(price.body.data.abstained, true);
    assert.equal(price.body.data.abstentionReason, 'NO_CURRENT_STATUS');
    assert.equal(price.body.data.answer, PRICE_ABSTENTION_MESSAGE);
    assert.equal(price.body.data.suggestions.length, 3);

    // La hora exacta del momento no se confunde con un horario de apertura.
    const now = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué hora es en Coro ahora?' });
    assert.equal(now.status, 200, JSON.stringify(now.body));
    assert.equal(now.body.data.abstained, true);
    assert.equal(now.body.data.abstentionReason, 'NO_EVIDENCE');
    assert.equal(now.body.data.answer, FALLBACK_MESSAGE);

    // Con evidencia de horario publicado, la pregunta de apertura responde.
    const schedule = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿A qué hora abre el Museo de Arte de Coro?' });
    assert.equal(schedule.status, 200, JSON.stringify(schedule.body));
    assert.equal(schedule.body.data.abstained, false);
    assert.ok(schedule.body.data.citations.length >= 1);

    // "estado Falcón" es el nombre del estado, no una pregunta de estado actual.
    const season = await request(app)
      .post('/api/assistant/tourist/query')
      .send({
        question: '¿Cuál es la mejor época del año para visitar Coro y el estado Falcón?',
      });
    assert.equal(season.status, 200, JSON.stringify(season.body));
    assert.notEqual(season.body.data.abstentionReason, 'NO_CURRENT_STATUS');
  });

  it('no responde con el horario de otro lugar cuando el lugar preguntado no tiene fuente', async () => {
    await createPoi({ title: 'Museo Diocesano', slug: 'museo-diocesano' });
    await createPoi({
      title: 'Museo de Arte de Coro',
      slug: 'museo-de-arte-de-coro',
    });
    const source = await createSource();
    await createChunk(source, {
      chunkKey: 'S-002#mucor.horario',
      text: 'El Museo de Arte de Coro abre de martes a sábado de 9:00 a.m. a 4:00 p.m.',
      claimType: 'current_status',
      questions: [
        '¿Cuál es el horario del Museo de Arte de Coro?',
        '¿Cuál es el horario del museo?',
      ],
    });

    // El horario publicado del MUCOR es evidencia de otro lugar: no responde
    // por el Museo Diocesano, que queda en «Sin horarios confirmados…».
    const otroLugar = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Cuál es el horario del Museo Diocesano?' });
    assert.equal(otroLugar.status, 200, JSON.stringify(otroLugar.body));
    assert.equal(otroLugar.body.data.abstained, true);
    assert.equal(otroLugar.body.data.abstentionReason, 'NO_CURRENT_STATUS');
    assert.equal(otroLugar.body.data.answer, SCHEDULE_ABSTENTION_MESSAGE);

    // El mismo fragmento sí responde por el lugar al que pertenece.
    const propio = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Cuál es el horario del Museo de Arte de Coro?' });
    assert.equal(propio.status, 200, JSON.stringify(propio.body));
    assert.equal(propio.body.data.abstained, false);
    assert.ok(propio.body.data.citations.length >= 1);
  });

  it('parte las preguntas compuestas que usan el conector «y quién»', () => {
    const parts = splitSubQueries(
      '¿En qué año se inscribió Coro y quién pintó la Mona Lisa?',
    );

    assert.equal(parts.length, 2);
    assert.match(parts[0], /año/i);
    assert.match(parts[1], /Mona Lisa/);

    // Una pregunta simple no se parte: el comportamiento de consulta única no
    // cambia.
    assert.deepEqual(splitSubQueries('¿Qué es Coro?'), []);
  });

  it('pide aclaración en una pregunta ¿dónde? sin lugar nombrado cuando la evidencia general no atribuye', async () => {
    await createPoi({ title: 'Casa del Agua', slug: 'casa-del-agua' });
    await createPoi({ title: 'Casa del Río', slug: 'casa-del-rio' });
    const source = await createSource();
    await createChunk(source, {
      chunkKey: 'S-002#general.museo',
      text: 'dónde está el museo de Coro y cómo llegar: información general del museo.',
      questions: ['¿Dónde está el museo en Coro?'],
    });
    await createChunk(source, {
      chunkKey: 'S-002#poi.agua',
      ordinal: 1,
      text: 'dónde está el museo Casa del Agua en FALCONSYNC',
      poiSlugs: ['casa-del-agua'],
    });
    await createChunk(source, {
      chunkKey: 'S-002#poi.rio',
      ordinal: 2,
      text: 'dónde está el museo Casa del Río en FALCONSYNC',
      poiSlugs: ['casa-del-rio'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Dónde está el museo?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.answerType, 'clarification');
    assert.equal(response.body.data.abstained, true);
    assert.equal(response.body.data.abstentionReason, 'AMBIGUOUS_POI');
    assert.equal(response.body.data.options.length, 2);
  });

  it('responde a saludos de mensaje completo sin consultar el corpus', async () => {
    const source = await createSource();
    await createChunk(source);

    for (const question of ['hola', 'hello', 'hi', 'buenas tardes']) {
      const response = await request(app)
        .post('/api/assistant/tourist/query')
        .send({ question });

      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.data.answerType, 'greeting', question);
      assert.equal(response.body.data.answer, GREETING_MESSAGE, question);
      assert.equal(response.body.data.abstained, false, question);
      assert.deepEqual(response.body.data.citations, [], question);
      assert.equal(response.body.data.suggestions.length, 3, question);
    }

    // Un saludo al inicio no se come la pregunta que viene después.
    const mixed = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: 'hola, ¿qué es Coro?' });

    assert.equal(mixed.status, 200, JSON.stringify(mixed.body));
    assert.notEqual(mixed.body.data.answerType, 'greeting');
  });

  it('normaliza la pregunta curada y no confunde «ciudad de Coro» con un POI', async () => {
    await createPoi({ title: 'Ciudad Deportiva', slug: 'ciudad-deportiva' });
    await createPoi({ title: 'Catedral de Coro', slug: 'catedral-de-coro' });
    const source = await createSource();
    await createChunk(source, {
      text: 'la ciudad de Coro es el único ejemplo subsistente de una fusión de técnicas y estilos.',
      questions: ['¿Qué es la ciudad de Coro?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: 'que es la ciudad de coro' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    assert.equal(response.body.data.poi, null);
    assert.equal(response.body.data.citations[0].sourceId, 'S-002');
    assert.equal(
      response.body.data.citations[0].url,
      'https://whc.unesco.org/',
    );
    // La composición capitaliza el inicio de la cita.
    assert.match(response.body.data.answer, /^La ciudad de Coro/);
  });

  it('no expone URLs internas ni adjunta citas tangenciales', async () => {
    await createFinalCorpus();
    const internal = await createSource({
      sourceId: 'S-022',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
      institution: 'Proyecto FALCONSYNC',
      sourceLabel: 'Documentación del proyecto',
      url: 'https://github.com/ejemplo/repositorio/blob/main/seed.js',
    });
    await createChunk(internal, {
      chunkKey: 'S-022#faq.que-es',
      text: 'FALCONSYNC es una plataforma digital para el patrimonio turístico de Coro.',
      questions: ['¿Qué es FALCONSYNC?'],
    });
    const tangential = await createSource({
      sourceId: 'S-025',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(tangential, {
      chunkKey: 'S-025#generalidades.tapial',
      text: 'FALCONSYNC registra el tapial como técnica constructiva de tierra.',
      questions: ['¿Qué es el tapial?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: '¿Qué es FALCONSYNC?' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    assert.equal(response.body.data.citations.length, 1);
    assert.equal(response.body.data.citations[0].sourceId, 'S-022');
    assert.equal(response.body.data.citations[0].url, null);
    assert.equal(response.body.data.confidenceLabel, 'Documentación del proyecto');
  });

  it('avisa que no hay ruta verificada y deduplica la ficha del lugar', async () => {
    await createFinalCorpus();
    await createPoi({
      title: 'Monumento de las Madres',
      slug: 'monumento-de-las-madres',
    });
    const ficha = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(ficha, {
      chunkKey: 'S-021#poi.monumento-de-las-madres',
      text: 'Monumento de las Madres es un monumento registrado en FALCONSYNC. Dirección registrada: Paseo Monseñor Iturriza, Coro. Historia, horarios y estado actual no están verificados en el corpus.',
      poiSlugs: ['monumento-de-las-madres'],
      questions: ['¿Cómo se puede llegar al Monumento de las Madres?'],
    });
    const registro = await createSource({
      sourceId: 'S-020',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(registro, {
      chunkKey: 'S-020#poi.monumento-de-las-madres',
      text: 'FALCONSYNC registra el Monumento de las Madres como POI publicado. La dirección registrada para el Monumento de las Madres es Paseo Monseñor Iturriza, Coro.',
      poiSlugs: ['monumento-de-las-madres'],
      questions: ['¿Dónde queda el Monumento de las Madres?'],
    });

    const response = await askTourist('¿Cómo se puede llegar al Monumento de las Madres?');

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    assert.equal(response.body.data.poi.slug, 'monumento-de-las-madres');
    assert.ok(
      response.body.data.answer.startsWith(ROUTE_NOTICE),
      response.body.data.answer,
    );
    assert.equal(
      (response.body.data.answer.match(/Paseo Monseñor Iturriza/g) ?? []).length,
      1,
      response.body.data.answer,
    );
  });

  it('separa la ciudad de Coro de Ciudad Deportiva aunque compartan «ciudad»', async () => {
    const deportiva = await createPoi({
      title: 'Ciudad Deportiva',
      slug: 'ciudad-deportiva',
    });
    const city = await createSource();
    await createChunk(city, {
      chunkKey: 'S-002#ciudad-coro',
      text: 'La ciudad de Coro es el único ejemplo subsistente de una fusión de técnicas y estilos arquitectónicos.',
      questions: ['¿Qué es la ciudad de Coro?', '¿Qué es la ciudad?', '¿Qué es Coro?'],
    });
    const ficha = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(ficha, {
      chunkKey: 'S-021#poi.ciudad-deportiva',
      text: 'Ciudad Deportiva es un lugar de servicios registrado en FALCONSYNC. Dirección registrada: Ciudad Deportiva Universitaria, Coro.',
      poiSlugs: ['ciudad-deportiva'],
      questions: ['¿Qué es la Ciudad Deportiva?'],
    });

    for (const question of [
      '¿Qué es la ciudad de Coro?',
      '¿Qué es la ciudad?',
      '¿Qué es Coro?',
    ]) {
      const response = await askTourist(question);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.data.poi, null, question);
      assert.match(response.body.data.answer, /fusión de técnicas/i, question);
      assert.doesNotMatch(response.body.data.answer, /Ciudad Deportiva/i, question);
      assert.ok(
        response.body.data.citations.every(({ sourceId }) => sourceId === 'S-002'),
        question,
      );
    }

    const contextual = await askTourist('¿Qué es la ciudad?', deportiva._id.toString());
    assert.equal(contextual.body.data.poi, null);
    assert.doesNotMatch(contextual.body.data.answer, /Ciudad Deportiva/i);

    const poiResponse = await askTourist('¿Qué es la Ciudad Deportiva?');
    assert.equal(poiResponse.body.data.poi.slug, 'ciudad-deportiva');
    assert.match(poiResponse.body.data.answer, /Ciudad Deportiva/);
  });

  it('responde una pregunta doble en el orden de la pregunta y sin mezclar conceptos', async () => {
    const city = await createSource();
    await createChunk(city, {
      chunkKey: 'S-002#ciudad-coro',
      text: 'La ciudad de Coro es el único ejemplo subsistente de una fusión de técnicas y estilos arquitectónicos.',
      questions: ['¿Qué es la ciudad de Coro?'],
    });
    const ficha = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(ficha, {
      chunkKey: 'S-021#poi.ciudad-deportiva',
      text: 'Ciudad Deportiva es un lugar de servicios registrado en FALCONSYNC.',
      poiSlugs: ['ciudad-deportiva'],
      questions: ['¿Qué es la Ciudad Deportiva?'],
    });
    await createPoi({ title: 'Ciudad Deportiva', slug: 'ciudad-deportiva' });

    const response = await askTourist(
      '¿Qué es la ciudad de Coro y qué es la Ciudad Deportiva?',
    );

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    const answer = response.body.data.answer;
    assert.ok(answer.indexOf('fusión de técnicas') >= 0, answer);
    assert.ok(
      answer.indexOf('Ciudad Deportiva') > answer.indexOf('fusión de técnicas'),
      answer,
    );
    assert.deepEqual(
      response.body.data.citations.map(({ sourceId }) => sourceId),
      ['S-002', 'S-021'],
    );
  });

  it('responde una pregunta triple con cada parte, en orden y con su aviso de ruta', async () => {
    const city = await createSource();
    await createChunk(city, {
      chunkKey: 'S-002#ciudad-coro',
      text: 'La ciudad de Coro es el único ejemplo subsistente de una fusión de técnicas y estilos arquitectónicos.',
      questions: ['¿Qué es Coro?'],
    });
    const ficha = await createSource({
      sourceId: 'S-021',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(ficha, {
      chunkKey: 'S-021#poi.ciudad-deportiva',
      text: 'Ciudad Deportiva es un lugar de servicios registrado en FALCONSYNC.',
      poiSlugs: ['ciudad-deportiva'],
      questions: ['¿Qué es la Ciudad Deportiva?'],
    });
    await createChunk(ficha, {
      chunkKey: 'S-021#poi.catedral-de-coro',
      ordinal: 1,
      text: 'Catedral de Coro es un lugar religioso registrado en FALCONSYNC. Dirección registrada: Frente a la Plaza Bolívar.',
      poiSlugs: ['catedral-de-coro'],
      questions: ['¿Cómo llego a la Catedral?'],
    });
    await createPoi({ title: 'Ciudad Deportiva', slug: 'ciudad-deportiva' });
    await createPoi({ title: 'Catedral de Coro', slug: 'catedral-de-coro' });

    const response = await askTourist(
      '¿Qué es Coro, qué es la Ciudad Deportiva y cómo llego a la Catedral?',
    );

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    const answer = response.body.data.answer;
    const cityIndex = answer.indexOf('fusión de técnicas');
    const deportivaIndex = answer.indexOf('Ciudad Deportiva');
    const routeIndex = answer.indexOf(ROUTE_NOTICE);
    assert.ok(cityIndex >= 0, answer);
    assert.ok(deportivaIndex > cityIndex, answer);
    assert.ok(routeIndex > deportivaIndex, answer);
    assert.ok(answer.indexOf('Catedral de Coro') > routeIndex, answer);
    assert.equal(response.body.data.poi, null);
    assert.equal(response.body.data.citations.length, 3);
  });

  it('parte preguntas triples separadas por comas y conectores', () => {
    const parts = splitSubQueries(
      '¿Qué es Coro, qué es la Ciudad Deportiva y cómo llego a la Catedral?',
    );

    assert.equal(parts.length, 3);
    assert.match(parts[0], /Coro/);
    assert.match(parts[1], /Ciudad Deportiva/);
    assert.match(parts[2], /Catedral/);
  });

  it('no responde con una descripción del casco histórico cuando piden una ruta', async () => {
    const source = await createSource({
      sourceId: 'S-026',
      level: 'D',
      usagePolicy: 'final',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-026#casco',
      text: 'El casco colonial de Coro conserva un paisaje urbano con calles empedradas y edificios históricos.',
      questions: ['¿Qué ruta debo seguir para recorrer el casco histórico?'],
    });

    const response = await askTourist('¿Qué ruta debo seguir para recorrer el casco histórico?');

    assert.equal(response.body.data.abstained, true);
    assert.equal(response.body.data.abstentionReason, 'NO_EVIDENCE');
    assert.doesNotMatch(response.body.data.answer, /calles empedradas|paisaje urbano/i);
    assert.match(response.body.data.answer, /ruta|indicaciones/i);
  });

  it('no responde con una ruta regional cuando preguntan por estacionamiento', async () => {
    const source = await createSource({
      sourceId: 'S-028',
      level: 'D',
      usagePolicy: 'final',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-028#caracas',
      text: 'Para llegar en carro desde Caracas hay autopista de cuatro carriles por Valencia y Morón.',
      questions: [
        '¿Dónde estacionar el carro de forma segura si voy a caminar por la zona colonial de Coro?',
      ],
    });

    const response = await askTourist(
      '¿Dónde estacionar el carro de forma segura si voy a caminar por la zona colonial de Coro?',
    );

    assert.equal(response.body.data.abstained, true);
    assert.doesNotMatch(response.body.data.answer, /Caracas|autopista/i);
    assert.match(response.body.data.answer, /estacion/i);
  });

  it('no responde con Paraguaná cuando preguntan por visitas guiadas nocturnas', async () => {
    const source = await createSource({
      sourceId: 'S-028',
      level: 'D',
      usagePolicy: 'final',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-028#paraguana',
      text: 'La Península de Paraguaná es otro destino cercano a Coro, con playas.',
      questions: [
        '¿Hay visitas guiadas nocturnas o recorridos de leyendas en el casco histórico de Coro?',
      ],
    });

    const response = await askTourist(
      '¿Hay visitas guiadas nocturnas o recorridos de leyendas en el casco histórico de Coro?',
    );

    assert.equal(response.body.data.abstained, true);
    assert.doesNotMatch(response.body.data.answer, /Paraguaná/i);
    assert.match(response.body.data.answer, /nocturn|visitas guiadas/i);
  });

  it('mantiene la ruta registrada cuando la evidencia sí contiene acceso', async () => {
    await createPoi({ title: 'Médanos de Coro', slug: 'medanos-de-coro' });
    const source = await createSource({
      sourceId: 'S-028',
      level: 'D',
      usagePolicy: 'final',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-028#medanos-autobus',
      text: 'Para los Médanos, tome el bus Carabobo en la esquina de las avenidas Falcón y Manaure; el parque queda a cinco minutos a pie.',
      questions: ['¿Cómo llego en bus a los Médanos de Coro?'],
    });

    const response = await askTourist('¿Cómo llego en bus a los Médanos de Coro?');

    assert.equal(response.body.data.abstained, false);
    assert.match(response.body.data.answer, /bus Carabobo/i);
    assert.doesNotMatch(response.body.data.answer, /^No tengo una ruta verificada/i);
    assert.match(response.body.data.answer, /Datos de acceso registrados/i);
  });

  it('no contradice un horario publicado con el aviso genérico de datos no verificados', async () => {
    await createFinalCorpus();
    await createPoi({ title: 'Catedral de Coro', slug: 'catedral-de-coro' });
    const source = await createSource({
      sourceId: 'S-031',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-031#catedral-horario',
      text: 'Horario de misas publicado para la Catedral de Coro: lunes a sábado a las 6 p.m. y domingo a las 7:30 a.m. y 6:00 p.m. Historia, horarios y estado actual no están verificados en el corpus.',
      claimType: 'current_status',
      poiSlugs: ['catedral-de-coro'],
      questions: ['¿Cuál es el horario de misas de la Catedral de Coro?'],
    });

    const response = await askTourist('¿Cuál es el horario de misas de la Catedral de Coro?');

    assert.equal(response.body.data.abstained, false);
    assert.match(response.body.data.answer, /6 p\.m\./);
    assert.doesNotMatch(
      response.body.data.answer,
      /Historia, horarios y estado actual no están verificados/i,
    );
  });

  it('responde «construir con tapia» sin tratarlo como orientación técnica', async () => {
    await createFinalCorpus();
    const source = await createSource({
      sourceId: 'S-025',
      level: 'C',
      usagePolicy: 'context',
      indexingPolicy: 'full_text',
    });
    await createChunk(source, {
      chunkKey: 'S-025#generalidades.tapial',
      text: 'La técnica del tapial consiste en rellenar un encofrado con capas de tierra compactada.',
      questions: ['¿Cómo construir con tapia?'],
    });

    const response = await request(app)
      .post('/api/assistant/tourist/query')
      .send({ question: 'como construir con tapia' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.abstained, false);
    assert.notEqual(response.body.data.abstentionReason, 'OUT_OF_SCOPE');
    assert.match(response.body.data.answer, /encofrado/i);
  });
});
