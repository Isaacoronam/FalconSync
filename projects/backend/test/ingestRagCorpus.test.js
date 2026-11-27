import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27018/falconsync_rag_ingest_test?replicaSet=falconsyncTest';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';

const {
  activateManifest,
  backfillChunkEmbeddings,
  ingestManifest,
  normalizeManifest,
  parseArguments,
  rebuildTextIndex,
  verifyCorpus,
} = await import('../scripts/ingestRagCorpus.js');
const { connectDB, disconnectDB } = await import('../databases/db.js');
const { default: AuditLog } = await import(
  '../databases/models/AuditLog.js'
);
const { default: SourceChunk } = await import(
  '../databases/models/SourceChunk.js'
);
const { default: SourceDocument } = await import(
  '../databases/models/SourceDocument.js'
);
const { default: User } = await import('../databases/models/User.js');
const { hashPassword } = await import('../microservices/authService.js');
const { modelIdentity } = await import(
  '../microservices/embeddingService.js'
);

const PASSWORD = 'UsuarioSegura123';

async function createUser(email, role) {
  return User.create({
    name: `Usuario ${role}`,
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
    mustChangePassword: false,
  });
}

// Doble determinista: no carga el modelo real durante la suite.
async function fakeEmbed(texts) {
  return texts.map((text) => {
    const vector = new Array(8).fill(0);
    let hash = 0;
    for (const character of text.slice(0, 40)) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    vector[hash % 8] = 1;

    return vector;
  });
}

function manifest(sourceId, extra = {}) {
  const { rightsVerifiedBy, supersedesSourceId } = extra;
  return {
    schemaVersion: 1,
    ...(supersedesSourceId ? { supersedesSourceId } : {}),
    source: {
      sourceId,
      title: 'Ficha de prueba de Coro',
      institution: 'UNESCO',
      version: '2026',
      retrievedAt: '2026-11-20T00:00:00.000Z',
      verifiedAt: '2026-11-20T00:00:00.000Z',
      level: 'A',
      sourceLabel: 'Oficial UNESCO',
      usagePolicy: 'final',
      indexingPolicy: 'short_quotes_only',
      credibilityNotes: 'Registro de prueba',
      license: 'Cita breve autorizada',
      rights: 'Uso limitado a citas',
      rightsVerified: true,
      rightsVerifiedAt: '2026-11-20T00:00:00.000Z',
      rightsVerifiedBy,
      accessLevel: 'public',
      language: 'es',
      status: 'active',
    },
    chunks: [
      {
        chunkKey: `${sourceId}#p1.01`,
        ordinal: 0,
        page: '1',
        section: 'Inscripción',
        text: 'Coro y su Puerto fueron inscritos en 1993.',
        assistantScopes: ['tourist'],
      },
    ],
  };
}

describe('Ingesta del corpus RAG', () => {
  let admin;
  let historian;

  before(async () => {
    await connectDB();
    await Promise.all([
      User.init(),
      AuditLog.init(),
      SourceDocument.init(),
      SourceChunk.init(),
    ]);
  });

  beforeEach(async () => {
    await Promise.all([
      SourceChunk.deleteMany({}),
      SourceDocument.deleteMany({}),
      AuditLog.deleteMany({}),
      User.deleteMany({}),
    ]);
    admin = await createUser('admin@rag.local', 'admin');
    historian = await createUser('historian@rag.local', 'historian');
  });

  after(async () => {
    await Promise.all([
      SourceChunk.deleteMany({}),
      SourceDocument.deleteMany({}),
      AuditLog.deleteMany({}),
      User.deleteMany({}),
    ]);
    await disconnectDB();
  });

  it('valida modos excluyentes y exige actor y manifiesto', () => {
    assert.deepEqual(
      parseArguments([
        '--dry-run',
        '--manifest',
        'fuente.json',
        '--actor-id',
        admin._id.toString(),
      ]),
      {
        mode: 'dry-run',
        manifestPath: 'fuente.json',
        actorId: admin._id.toString(),
        allowProduction: false,
        activate: false,
        help: false,
      },
    );
    assert.throws(
      () => parseArguments(['--dry-run', '--apply', '--actor-id=123']),
      /exactamente un modo/,
    );
    assert.throws(
      () => parseArguments(['--apply', '--actor-id=123']),
      /requiere --manifest/,
    );

    assert.deepEqual(
      parseArguments(['--verify', '--actor-id=123']),
      {
        mode: 'verify',
        manifestPath: null,
        actorId: '123',
        allowProduction: false,
        activate: false,
        help: false,
      },
    );
    assert.throws(
      () =>
        parseArguments([
          '--rebuild-index',
          '--actor-id=123',
          '--manifest',
          'fuente.json',
        ]),
      /no acepta --manifest/,
    );
    assert.throws(
      () => parseArguments(['--verify', '--activate', '--actor-id=123']),
      /--activate solo aplica/,
    );
  });

  it('valida citas, idioma y límites del manifiesto', () => {
    const valid = manifest('S-090', {
      rightsVerifiedBy: new User()._id.toString(),
    });
    assert.equal(normalizeManifest(valid).chunks.length, 1);

    const longQuote = structuredClone(valid);
    longQuote.chunks[0].text =
      'Este fragmento de texto de prueba excede claramente el máximo permitido de veinticinco palabras para fuentes que solo permiten citas breves según las reglas vigentes de la ingesta del corpus.';
    assert.throws(() => normalizeManifest(longQuote), /25 palabras/);

    const english = structuredClone(valid);
    english.source.language = 'en';
    assert.throws(() => normalizeManifest(english), /solo admite fuentes en español/);

    const mismatchedFact = structuredClone(valid);
    mismatchedFact.chunks[0].factKey = 'inscriptionYear';
    mismatchedFact.chunks[0].factValue = '1994';
    assert.throws(
      () => normalizeManifest(mismatchedFact),
      /debe aparecer en el texto/,
    );

    const missingFactValue = structuredClone(valid);
    missingFactValue.chunks[0].factKey = 'inscriptionYear';
    assert.throws(
      () => normalizeManifest(missingFactValue),
      /factKey y factValue juntos/,
    );
  });

  it('valida las preguntas asociadas a un fragmento', () => {
    const valid = manifest('S-090', {
      rightsVerifiedBy: new User()._id.toString(),
    });
    valid.chunks[0].questions = ['¿Qué es Coro?', '¿Dónde está Coro?'];
    assert.equal(normalizeManifest(valid).chunks[0].questions.length, 2);

    const tooMany = structuredClone(valid);
    tooMany.chunks[0].questions = Array.from(
      { length: 6 },
      (_, index) => `¿Pregunta ${index}?`,
    );
    assert.throws(() => normalizeManifest(tooMany), /hasta 5 preguntas/);

    const tooLong = structuredClone(valid);
    tooLong.chunks[0].questions = ['x'.repeat(201)];
    assert.throws(() => normalizeManifest(tooLong), /200 caracteres/);

    const duplicated = structuredClone(valid);
    duplicated.chunks[0].questions = ['¿Qué es Coro?', '¿Qué es Coro?'];
    assert.throws(() => normalizeManifest(duplicated), /duplicados/);
  });

  it('hace dry-run sin escribir y aplica fuente, fragmentos y auditoría', async () => {
    const input = manifest('S-090', {
      rightsVerifiedBy: historian._id.toString(),
    });

    const dryRun = await ingestManifest({
      input,
      actor: admin,
      embed: fakeEmbed,
    });
    assert.equal(dryRun.applied, false);
    assert.equal(await SourceDocument.countDocuments({}), 0);
    assert.equal(await SourceChunk.countDocuments({}), 0);
    assert.equal(await AuditLog.countDocuments({}), 0);

    const result = await ingestManifest({
      input,
      actor: admin,
      apply: true,
      embed: fakeEmbed,
    });
    assert.equal(result.applied, true);
    assert.equal(result.sourceId, 'S-090');
    assert.equal(await SourceChunk.countDocuments({ documentId: (await SourceDocument.findOne())._id }), 1);
    assert.equal(await AuditLog.countDocuments({ action: 'source.created' }), 1);
    assert.deepEqual(await verifyCorpus(), {
      ok: true,
      documentCount: 1,
      chunkCount: 1,
      problems: [],
    });
  });

  it('activa un borrador sin cambiar fragmentos y deja auditoría', async () => {
    const draftInput = manifest('S-090', {});
    draftInput.source.status = 'draft';
    draftInput.source.rightsVerified = false;
    delete draftInput.source.rightsVerifiedAt;
    delete draftInput.source.rightsVerifiedBy;

    await ingestManifest({
      input: draftInput,
      actor: admin,
      apply: true,
      embed: fakeEmbed,
    });

    const activation = structuredClone(draftInput);
    activation.source.status = 'active';
    activation.source.verifiedAt = '2026-11-23T00:00:00.000Z';
    activation.source.rightsVerified = true;
    activation.source.rightsVerifiedAt = '2026-11-23T00:00:00.000Z';
    activation.source.rightsVerifiedBy = historian._id.toString();

    const preview = await activateManifest({
      input: activation,
      actor: admin,
    });
    assert.equal(preview.applied, false);
    assert.equal(
      (await SourceDocument.findOne({ sourceId: 'S-090' })).status,
      'draft',
    );

    const changed = structuredClone(activation);
    changed.chunks[0].text =
      'Otro texto de contenido distinto para el mismo identificador.';
    await assert.rejects(
      activateManifest({ input: changed, actor: admin, apply: true }),
      /difiere de los fragmentos almacenados/,
    );

    const result = await activateManifest({
      input: activation,
      actor: admin,
      apply: true,
    });
    assert.equal(result.applied, true);
    const activated = await SourceDocument.findOne({ sourceId: 'S-090' });
    assert.equal(activated.status, 'active');
    assert.equal(activated.rightsVerified, true);
    assert.equal(
      activated.rightsVerifiedBy.toString(),
      historian._id.toString(),
    );
    assert.equal(
      await AuditLog.countDocuments({ action: 'source.activated' }),
      1,
    );
    assert.deepEqual(await verifyCorpus(), {
      ok: true,
      documentCount: 1,
      chunkCount: 1,
      problems: [],
    });

    await assert.rejects(
      activateManifest({ input: activation, actor: admin, apply: true }),
      /no está en draft/,
    );
  });

  it('calcula los embeddings de texto y de preguntas al aplicar el manifiesto', async () => {
    const input = manifest('S-090', {
      rightsVerifiedBy: historian._id.toString(),
    });
    input.chunks[0].questions = ['¿En qué año inscribieron a Coro?'];

    const result = await ingestManifest({
      input,
      actor: admin,
      apply: true,
      embed: fakeEmbed,
    });
    assert.equal(result.applied, true);

    const chunk = await SourceChunk.findOne({
      chunkKey: 'S-090#p1.01',
    }).select('+embeddings');
    assert.equal(chunk.embeddings.model, modelIdentity());
    assert.equal(chunk.embeddings.text.length, 8);
    assert.equal(chunk.embeddings.questions.length, 1);
    assert.equal(chunk.embeddings.questions[0].length, 8);
  });

  it('detecta en verify los fragmentos sin embeddings vigentes', async () => {
    const input = manifest('S-090', {
      rightsVerifiedBy: historian._id.toString(),
    });
    input.chunks[0].questions = ['¿En qué año inscribieron a Coro?'];
    await ingestManifest({
      input,
      actor: admin,
      apply: true,
      embed: fakeEmbed,
    });

    const clean = await verifyCorpus();
    assert.equal(clean.ok, true);
    assert.equal(clean.chunkCount, 1);

    await SourceChunk.updateOne(
      { chunkKey: 'S-090#p1.01' },
      { $set: { 'embeddings.model': 'modelo-antiguo@f16' } },
    );
    const stale = await verifyCorpus();
    assert.equal(stale.ok, false);
    assert.match(stale.problems.join('\n'), /sin embedding del modelo vigente/);

    await SourceChunk.updateOne(
      { chunkKey: 'S-090#p1.01' },
      {
        $set: {
          'embeddings.model': modelIdentity(),
          'embeddings.questions': [],
        },
      },
    );
    const incomplete = await verifyCorpus();
    assert.equal(incomplete.ok, false);
    assert.match(
      incomplete.problems.join('\n'),
      /embeddings de preguntas incompletos/,
    );
  });

  it('calcula con backfill los embeddings que falten o estén obsoletos', async () => {
    const input = manifest('S-090', {
      rightsVerifiedBy: historian._id.toString(),
    });
    input.chunks[0].questions = ['¿En qué año inscribieron a Coro?'];
    await ingestManifest({
      input,
      actor: admin,
      apply: true,
      embed: fakeEmbed,
    });

    await SourceChunk.updateOne(
      { chunkKey: 'S-090#p1.01' },
      { $set: { embeddings: null } },
    );

    const result = await backfillChunkEmbeddings(admin, { embed: fakeEmbed });
    assert.equal(result.updated, 1);
    assert.equal(result.model, modelIdentity());
    assert.equal(
      await AuditLog.countDocuments({ action: 'source.embeddings.rebuilt' }),
      1,
    );

    const chunk = await SourceChunk.findOne({
      chunkKey: 'S-090#p1.01',
    }).select('+embeddings');
    assert.equal(chunk.embeddings.model, modelIdentity());
    assert.equal(chunk.embeddings.questions.length, 1);

    const again = await backfillChunkEmbeddings(admin, { embed: fakeEmbed });
    assert.equal(again.updated, 0);
  });

  it('rechaza actores sin source.manage y conserva las versiones sustituidas', async () => {
    const input = manifest('S-090', {
      rightsVerifiedBy: historian._id.toString(),
    });
    await assert.rejects(
      ingestManifest({ input, actor: historian, apply: true, embed: fakeEmbed }),
      /source.manage/,
    );
    await ingestManifest({ input, actor: admin, apply: true, embed: fakeEmbed });

    const replacement = manifest('S-091', {
      rightsVerifiedBy: historian._id.toString(),
      supersedesSourceId: 'S-090',
    });
    await ingestManifest({
      input: replacement,
      actor: admin,
      apply: true,
      embed: fakeEmbed,
    });

    const previous = await SourceDocument.findOne({ sourceId: 'S-090' });
    const current = await SourceDocument.findOne({ sourceId: 'S-091' });
    assert.equal(previous.status, 'superseded');
    assert.equal(previous.statusReason, 'Reemplazada por S-091');
    assert.equal(current.supersedes.toString(), previous._id.toString());
    assert.equal(await AuditLog.countDocuments({ action: 'source.superseded' }), 1);
  });

  it('reconstruye solo el índice de texto y registra la operación', async () => {
    const input = manifest('S-090', {
      rightsVerifiedBy: historian._id.toString(),
    });
    await ingestManifest({ input, actor: admin, apply: true, embed: fakeEmbed });
    await SourceChunk.collection.dropIndex('source_chunk_text_es');
    await SourceChunk.collection.createIndex(
      { text: 'text' },
      {
        name: 'source_chunk_text_es',
        default_language: 'english',
        language_override: 'language',
      },
    );

    const result = await rebuildTextIndex(admin);
    assert.equal(result.textIndex, 'source_chunk_text_es');
    const indexes = await SourceChunk.collection.indexes();
    const textIndex = indexes.find(
      (index) => index.name === 'source_chunk_text_es',
    );
    assert.equal(textIndex.default_language, 'spanish');
    assert.equal(await AuditLog.countDocuments({ action: 'source.index.rebuilt' }), 1);
  });
});
