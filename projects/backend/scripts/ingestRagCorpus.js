import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../databases/db.js';
import AuditLog from '../databases/models/AuditLog.js';
import Location from '../databases/models/Location.js';
import SourceChunk from '../databases/models/SourceChunk.js';
import SourceDocument from '../databases/models/SourceDocument.js';
import User from '../databases/models/User.js';
import { CLAIM_TYPES } from '../databases/models/ragContract.js';
import { config } from '../helpers/env.js';
import { hasCapability } from '../microservices/authorizationService.js';
import {
  embedTexts,
  modelIdentity,
} from '../microservices/embeddingService.js';

const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const MAX_CHUNKS = 5000;
const EMBEDDING_BATCH_SIZE = 32;
const TEXT_INDEX_NAME = 'source_chunk_text_es';

const sourceFields = [
  'sourceId',
  'title',
  'institution',
  'version',
  'publicationDate',
  'retrievedAt',
  'verifiedAt',
  'url',
  'level',
  'sourceLabel',
  'usagePolicy',
  'indexingPolicy',
  'credibilityNotes',
  'license',
  'rights',
  'rightsVerified',
  'rightsVerifiedAt',
  'rightsVerifiedBy',
  'accessLevel',
  'checksum',
  'checksumScope',
  'language',
  'topics',
  'poiSlugs',
  'status',
];

const chunkFields = [
  'chunkKey',
  'ordinal',
  'page',
  'section',
  'claimType',
  'factKey',
  'factValue',
  'contradictionGroup',
  'validAsOf',
  'text',
  'assistantScopes',
  'topics',
  'poiSlugs',
  'questions',
  'checksum',
];

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} debe ser un objeto JSON`);
  }
}

function assertKnownFields(value, allowedFields, label) {
  const unknown = Object.keys(value).filter(
    (field) => !allowedFields.includes(field),
  );
  if (unknown.length) {
    throw new TypeError(
      `${label} contiene campos no admitidos: ${unknown.join(', ')}`,
    );
  }
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex').toUpperCase();
}

function wordCount(value) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function normalizedDate(value, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new TypeError(`${field} es obligatorio`);
    }
    return null;
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${field} debe ser una fecha ISO válida`);
  }

  return new Date(value);
}

function normalizedStringArray(value, field) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new TypeError(`${field} debe ser una lista de textos`);
  }
  const normalized = value.map((entry) => entry.trim()).filter(Boolean);
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${field} no puede contener valores duplicados`);
  }
  return normalized;
}

async function embedInBatches(texts, embed) {
  const vectors = [];

  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    vectors.push(...(await embed(texts.slice(start, start + EMBEDDING_BATCH_SIZE))));
  }

  if (vectors.length !== texts.length) {
    throw new Error('El modelo de embeddings no devolvió un vector por texto');
  }

  return vectors;
}

async function embedChunks(chunks, embed) {
  const vectors = await embedInBatches(
    chunks.flatMap((chunk) => [chunk.text, ...(chunk.questions ?? [])]),
    embed,
  );
  let offset = 0;

  return chunks.map((chunk) => {
    const text = vectors[offset];
    offset += 1;
    const questions = (chunk.questions ?? []).map(() => {
      const vector = vectors[offset];
      offset += 1;

      return vector;
    });

    return { model: modelIdentity(), text, questions };
  });
}

export function normalizeManifest(input) {
  assertObject(input, 'El manifiesto');
  assertKnownFields(
    input,
    ['schemaVersion', 'source', 'supersedesSourceId', 'chunks'],
    'El manifiesto',
  );
  if (input.schemaVersion !== 1) {
    throw new TypeError('schemaVersion debe ser 1');
  }
  assertObject(input.source, 'source');
  assertKnownFields(input.source, sourceFields, 'source');
  if (!Array.isArray(input.chunks) || input.chunks.length > MAX_CHUNKS) {
    throw new TypeError(`chunks debe ser una lista de hasta ${MAX_CHUNKS} elementos`);
  }

  const source = {
    ...input.source,
    retrievedAt: normalizedDate(input.source.retrievedAt, 'source.retrievedAt', true),
    publicationDate: normalizedDate(
      input.source.publicationDate,
      'source.publicationDate',
    ),
    verifiedAt: normalizedDate(input.source.verifiedAt, 'source.verifiedAt'),
    rightsVerifiedAt: normalizedDate(
      input.source.rightsVerifiedAt,
      'source.rightsVerifiedAt',
    ),
    language: input.source.language ?? 'es',
    status: input.source.status ?? 'draft',
    topics: normalizedStringArray(input.source.topics, 'source.topics'),
    poiSlugs: normalizedStringArray(
      input.source.poiSlugs,
      'source.poiSlugs',
    ).map((slug) => slug.toLowerCase()),
  };

  if (!['draft', 'active'].includes(source.status)) {
    throw new TypeError('La ingesta solo admite fuentes draft o active');
  }
  if (source.language !== 'es') {
    throw new TypeError('El corpus v1 solo admite fuentes en español');
  }
  if (source.level === 'E' && source.usagePolicy !== 'context') {
    throw new TypeError('Las fuentes E solo pueden tener usagePolicy=context');
  }
  if (source.usagePolicy === 'pointer' && input.chunks.length > 0) {
    throw new TypeError('Las fuentes pointer no pueden incluir fragmentos');
  }
  if (source.usagePolicy !== 'pointer' && input.chunks.length === 0) {
    throw new TypeError('Una fuente no pointer requiere al menos un fragmento');
  }
  if (
    source.rightsVerified &&
    (!source.rightsVerifiedAt || !source.rightsVerifiedBy)
  ) {
    throw new TypeError(
      'Los derechos verificados requieren fecha y actor verificador',
    );
  }

  let supersedesSourceId = null;
  if (input.supersedesSourceId !== undefined) {
    if (
      typeof input.supersedesSourceId !== 'string' ||
      !/^S-[0-9]{3}$/.test(input.supersedesSourceId) ||
      input.supersedesSourceId === source.sourceId ||
      source.status !== 'active'
    ) {
      throw new TypeError('supersedesSourceId no es válido para esta fuente');
    }
    supersedesSourceId = input.supersedesSourceId;
  }

  const seenChunkKeys = new Set();
  const seenOrdinals = new Set();
  const chunks = input.chunks.map((rawChunk, index) => {
    assertObject(rawChunk, `chunks[${index}]`);
    assertKnownFields(rawChunk, chunkFields, `chunks[${index}]`);
    const text = typeof rawChunk.text === 'string' ? rawChunk.text.trim() : '';
    const chunkKey =
      typeof rawChunk.chunkKey === 'string' ? rawChunk.chunkKey.trim() : '';
    if (!chunkKey.startsWith(`${source.sourceId}#`)) {
      throw new TypeError(
        `chunks[${index}].chunkKey debe comenzar con ${source.sourceId}#`,
      );
    }
    if (seenChunkKeys.has(chunkKey)) {
      throw new TypeError(`chunkKey duplicado: ${chunkKey}`);
    }
    seenChunkKeys.add(chunkKey);

    const ordinal = rawChunk.ordinal;
    if (!Number.isInteger(ordinal) || ordinal < 0 || seenOrdinals.has(ordinal)) {
      throw new TypeError(`chunks[${index}].ordinal debe ser único y no negativo`);
    }
    seenOrdinals.add(ordinal);

    if (!text) {
      throw new TypeError(`chunks[${index}].text no puede estar vacío`);
    }
    if (
      source.indexingPolicy === 'short_quotes_only' &&
      wordCount(text) > 25
    ) {
      throw new TypeError(
        `El fragmento ${chunkKey} excede el límite de 25 palabras`,
      );
    }
    const assistantScopes = normalizedStringArray(
      rawChunk.assistantScopes,
      `chunks[${index}].assistantScopes`,
    );
    if (
      assistantScopes.length === 0 ||
      assistantScopes.some((scope) => !['tourist', 'technical'].includes(scope))
    ) {
      throw new TypeError(
        `chunks[${index}].assistantScopes debe incluir tourist o technical`,
      );
    }

    const questions = normalizedStringArray(
      rawChunk.questions,
      `chunks[${index}].questions`,
    );
    if (questions.length > 5) {
      throw new TypeError(`chunks[${index}].questions admite hasta 5 preguntas`);
    }
    if (questions.some((question) => question.length > 200)) {
      throw new TypeError(
        `chunks[${index}].questions admite hasta 200 caracteres por pregunta`,
      );
    }

    const checksum = digest(text);
    if (rawChunk.checksum && rawChunk.checksum.toUpperCase() !== checksum) {
      throw new TypeError(`El checksum no coincide para ${chunkKey}`);
    }

    const chunk = {
      chunkKey,
      ordinal,
      page: rawChunk.page ?? null,
      section: rawChunk.section?.trim() ?? null,
      claimType: rawChunk.claimType ?? null,
      factKey: rawChunk.factKey?.trim() ?? null,
      factValue: rawChunk.factValue?.trim() ?? null,
      contradictionGroup: rawChunk.contradictionGroup?.trim() ?? null,
      validAsOf: normalizedDate(
        rawChunk.validAsOf,
        `chunks[${index}].validAsOf`,
      ),
      language: 'es',
      text,
      indexingPolicy: source.indexingPolicy,
      assistantScopes,
      topics: normalizedStringArray(rawChunk.topics, `chunks[${index}].topics`),
      poiSlugs: normalizedStringArray(
        rawChunk.poiSlugs,
        `chunks[${index}].poiSlugs`,
      ).map((slug) => slug.toLowerCase()),
      questions,
      checksum,
    };
    if (chunk.claimType && !CLAIM_TYPES.includes(chunk.claimType)) {
      throw new TypeError(`chunks[${index}].claimType no es válido`);
    }
    if (Boolean(chunk.factKey) !== Boolean(chunk.factValue)) {
      throw new TypeError(
        `chunks[${index}] debe incluir factKey y factValue juntos`,
      );
    }
    if (
      chunk.factValue &&
      !text
        .replace(/\s+/gu, ' ')
        .includes(chunk.factValue.replace(/\s+/gu, ' '))
    ) {
      throw new TypeError(
        `chunks[${index}].factValue debe aparecer en el texto del fragmento`,
      );
    }
    if (chunk.factValue && wordCount(chunk.factValue) > 25) {
      throw new TypeError(
        `chunks[${index}].factValue excede el límite de 25 palabras`,
      );
    }
    return chunk;
  });

  chunks.sort((left, right) => left.ordinal - right.ordinal);
  if (chunks.some((chunk, index) => chunk.ordinal !== index)) {
    throw new TypeError('Los ordinales de chunks deben ser contiguos desde 0');
  }

  if (source.checksumScope === 'curated_text') {
    const curatedChecksum = digest(chunks.map(({ text }) => text).join('\n'));
    if (!source.checksum || source.checksum.toUpperCase() !== curatedChecksum) {
      throw new TypeError(
        'El checksum de curated_text no coincide con los fragmentos',
      );
    }
  }

  return { source, supersedesSourceId, chunks };
}

function assertAuthorizedActor(actor) {
  if (
    !actor ||
    !actor.isActive ||
    actor.mustChangePassword ||
    !hasCapability(actor, 'source.manage')
  ) {
    throw new Error('El actor debe ser un administrador activo con source.manage');
  }
}

async function validateReferences(
  { source, supersedesSourceId, chunks },
  { allowExisting = false } = {},
) {
  const referencedSlugs = new Set([
    ...source.poiSlugs,
    ...chunks.flatMap(({ poiSlugs }) => poiSlugs),
  ]);
  if (referencedSlugs.size) {
    const publishedLocations = await Location.find({
      slug: { $in: [...referencedSlugs] },
      status: 'published',
      deletedAt: null,
    })
      .select('slug')
      .lean();
    const foundSlugs = new Set(publishedLocations.map(({ slug }) => slug));
    const missingSlugs = [...referencedSlugs].filter(
      (slug) => !foundSlugs.has(slug),
    );
    if (missingSlugs.length) {
      throw new Error(
        `POI inexistente o no publicado: ${missingSlugs.join(', ')}`,
      );
    }
  }

  if (source.rightsVerifiedBy) {
    const verifierExists = await User.exists({
      _id: source.rightsVerifiedBy,
      role: 'historian',
      isActive: true,
    });
    if (!verifierExists) {
      throw new Error(
        'rightsVerifiedBy debe identificar a un historiador activo',
      );
    }
  }

  if (supersedesSourceId) {
    const oldSource = await SourceDocument.findOne({
      sourceId: supersedesSourceId,
      status: 'active',
    });
    if (!oldSource) {
      throw new Error(
        `La fuente activa que se quiere sustituir no existe: ${supersedesSourceId}`,
      );
    }
  }

  // La activación de un borrador sí permite que el ID ya exista: el
  // contenido no cambia, solo los metadatos de revisión y estado.
  if (
    !allowExisting &&
    (await SourceDocument.exists({ sourceId: source.sourceId }))
  ) {
    throw new Error(
      `${source.sourceId} ya existe; crea un nuevo ID para conservar versiones`,
    );
  }

  const chunkKeys = chunks.map(({ chunkKey }) => chunkKey);
  if (chunkKeys.length) {
    // En activación los fragmentos propios ya existen: solo se considera
    // colisión una clave ajena a esta fuente.
    const ownDocument = await SourceDocument.findOne({
      sourceId: source.sourceId,
    })
      .select('_id')
      .lean();
    const collision = await SourceChunk.exists({
      chunkKey: { $in: chunkKeys },
      ...(ownDocument ? { documentId: { $ne: ownDocument._id } } : {}),
    });
    if (collision) {
      throw new Error('Uno o más chunkKey ya existen');
    }
  }

  const sourceRecord = new SourceDocument({
    ...source,
    supersedes: null,
  });
  await sourceRecord.validate();

  for (const chunk of chunks) {
    const chunkRecord = new SourceChunk({
      ...chunk,
      documentId: new mongoose.Types.ObjectId(),
    });
    await chunkRecord.validate();
  }

}

function summaryForPlan({ source, supersedesSourceId, chunks }) {
  return {
    sourceId: source.sourceId,
    status: source.status,
    usagePolicy: source.usagePolicy,
    indexingPolicy: source.indexingPolicy,
    chunkCount: chunks.length,
    supersedesSourceId,
    poiCount: new Set([
      ...source.poiSlugs,
      ...chunks.flatMap(({ poiSlugs }) => poiSlugs),
    ]).size,
  };
}

export async function ingestManifest({
  input,
  actor,
  apply = false,
  manifestHash = digest(JSON.stringify(input)),
  embed = embedTexts,
}) {
  assertAuthorizedActor(actor);
  const manifest = normalizeManifest(input);
  await validateReferences(manifest);
  const summary = summaryForPlan(manifest);

  if (!apply) {
    return { applied: false, summary };
  }

  const embeddings = await embedChunks(manifest.chunks, embed);
  await Promise.all([
    SourceDocument.createIndexes(),
    SourceChunk.createIndexes(),
    AuditLog.createIndexes(),
  ]);
  const session = await mongoose.startSession();
  let sourceId;
  try {
    await session.withTransaction(async () => {
      let supersededSource = null;
      if (manifest.supersedesSourceId) {
        supersededSource = await SourceDocument.findOne({
          sourceId: manifest.supersedesSourceId,
          status: 'active',
        }).session(session);
        if (!supersededSource) {
          throw new Error(
            `La fuente activa que se quiere sustituir ya no existe: ${manifest.supersedesSourceId}`,
          );
        }
        supersededSource.status = 'superseded';
        supersededSource.statusReason = `Reemplazada por ${manifest.source.sourceId}`;
        await supersededSource.save({ session });
      }

      const sourceRecord = new SourceDocument({
        ...manifest.source,
        supersedes: supersededSource?._id ?? null,
      });
      await sourceRecord.save({ session });

      const chunkRecords = manifest.chunks.map(
        (chunk, position) =>
          new SourceChunk({
            ...chunk,
            documentId: sourceRecord._id,
            embeddings: embeddings[position],
          }),
      );
      for (const chunk of chunkRecords) {
        await chunk.save({ session });
      }

      const auditEvents = [
        {
          action: 'source.created',
          actor: actor._id,
          actorEmail: actor.email,
          entityType: 'SourceDocument',
          entityId: sourceRecord._id,
          summary: `Registró ${manifest.source.sourceId} (${manifest.chunks.length} fragmentos)`,
          metadata: {
            sourceId: manifest.source.sourceId,
            status: manifest.source.status,
            manifestHash,
          },
        },
      ];
      if (supersededSource) {
        auditEvents.push({
          action: 'source.superseded',
          actor: actor._id,
          actorEmail: actor.email,
          entityType: 'SourceDocument',
          entityId: supersededSource._id,
          summary: `Sustituyó ${manifest.supersedesSourceId} por ${manifest.source.sourceId}`,
          metadata: {
            sourceId: manifest.supersedesSourceId,
            replacementSourceId: manifest.source.sourceId,
            manifestHash,
          },
        });
      }
      await AuditLog.create(auditEvents, { session, ordered: true });
      sourceId = sourceRecord.sourceId;
    });
  } finally {
    await session.endSession();
  }

  return { applied: true, sourceId, summary };
}

// Metadatos que la revisión puede actualizar al activar un borrador. El
// contenido de los fragmentos no se toca: un cambio de texto exige un ID
// nuevo para conservar versiones.
const ACTIVATION_SOURCE_FIELDS = [
  'status',
  'verifiedAt',
  'rightsVerified',
  'rightsVerifiedAt',
  'rightsVerifiedBy',
  'credibilityNotes',
  'license',
  'rights',
];

/**
 * Activa un manifiesto en draft sin re-ingresar contenido: exige que los
 * fragmentos almacenados coincidan exactamente con el manifiesto y solo
 * actualiza metadatos de revisión, dejando traza de auditoría.
 */
export async function activateManifest({
  input,
  actor,
  apply = false,
  manifestHash = digest(JSON.stringify(input)),
}) {
  assertAuthorizedActor(actor);
  const manifest = normalizeManifest(input);

  if (manifest.source.status !== 'active') {
    throw new TypeError('La activación requiere status=active en el manifiesto');
  }

  await validateReferences(manifest, { allowExisting: true });

  const existing = await SourceDocument.findOne({
    sourceId: manifest.source.sourceId,
  });
  if (!existing) {
    throw new Error(
      `${manifest.source.sourceId} no existe; ingresa el manifiesto primero`,
    );
  }
  if (existing.status !== 'draft') {
    throw new Error(
      `${manifest.source.sourceId} no está en draft (estado actual: ${existing.status})`,
    );
  }

  const storedChunks = await SourceChunk.find({ documentId: existing._id })
    .sort({ ordinal: 1 })
    .lean();
  const sameContent =
    storedChunks.length === manifest.chunks.length &&
    manifest.chunks.every((chunk, index) => {
      const stored = storedChunks[index];

      return Boolean(
        stored &&
          stored.chunkKey === chunk.chunkKey &&
          stored.ordinal === chunk.ordinal &&
          stored.text === chunk.text &&
          JSON.stringify(stored.questions ?? []) ===
            JSON.stringify(chunk.questions ?? []),
      );
    });
  if (!sameContent) {
    throw new Error(
      `${manifest.source.sourceId} difiere de los fragmentos almacenados; crea un nuevo ID para conservar versiones`,
    );
  }

  const summary = {
    sourceId: manifest.source.sourceId,
    from: existing.status,
    to: 'active',
    chunkCount: manifest.chunks.length,
  };

  if (!apply) {
    return { applied: false, summary };
  }

  for (const field of ACTIVATION_SOURCE_FIELDS) {
    existing[field] = manifest.source[field];
  }
  await existing.save();

  await AuditLog.create({
    action: 'source.activated',
    actor: actor._id,
    actorEmail: actor.email,
    entityType: 'SourceDocument',
    entityId: existing._id,
    summary: `Activó ${manifest.source.sourceId} (${manifest.chunks.length} fragmentos)`,
    metadata: {
      sourceId: manifest.source.sourceId,
      status: 'active',
      manifestHash,
    },
  });

  return { applied: true, sourceId: existing.sourceId, summary };
}

export async function verifyCorpus() {
  const [documents, chunks] = await Promise.all([
    SourceDocument.find().lean(),
    SourceChunk.find().select('+embeddings').lean(),
  ]);
  const problems = [];
  const documentsById = new Map(
    documents.map((document) => [document._id.toString(), document]),
  );

  if (documents.length === 0) {
    problems.push('No hay fuentes registradas');
  }
  if (chunks.length === 0) {
    problems.push('No hay fragmentos registrados');
  }

  for (const document of documents) {
    if (
      document.status === 'active' &&
      (!document.verifiedAt ||
        !document.rightsVerified ||
        !document.rightsVerifiedAt ||
        !document.rightsVerifiedBy)
    ) {
      problems.push(`${document.sourceId}: fuente activa sin verificación completa`);
    }
    if (
      document.status === 'active' &&
      document.usagePolicy !== 'pointer' &&
      !chunks.some(
        (chunk) => chunk.documentId.toString() === document._id.toString(),
      )
    ) {
      problems.push(`${document.sourceId}: fuente activa sin fragmentos`);
    }
    if (
      document.status === 'active' &&
      document.rightsVerifiedBy &&
      !(await User.exists({
        _id: document.rightsVerifiedBy,
        role: 'historian',
        isActive: true,
      }))
    ) {
      problems.push(`${document.sourceId}: verificador de derechos no válido`);
    }
    if (document.checksumScope === 'curated_text') {
      const sourceChunks = chunks
        .filter(
          (chunk) => chunk.documentId.toString() === document._id.toString(),
        )
        .sort((left, right) => left.ordinal - right.ordinal);
      if (
        digest(sourceChunks.map(({ text }) => text).join('\n')) !==
        document.checksum
      ) {
        problems.push(`${document.sourceId}: checksum del texto curado no coincide`);
      }
    }
  }

  if (!documents.some(({ status }) => status === 'active')) {
    problems.push('No hay fuentes activas');
  }

  for (const chunk of chunks) {
    const document = documentsById.get(chunk.documentId.toString());
    if (!document) {
      problems.push(`${chunk.chunkKey}: referencia a fuente inexistente`);
      continue;
    }
    if (chunk.indexingPolicy !== document.indexingPolicy) {
      problems.push(`${chunk.chunkKey}: indexingPolicy no coincide con la fuente`);
    }
    if (digest(chunk.text) !== chunk.checksum) {
      problems.push(`${chunk.chunkKey}: checksum del fragmento no coincide`);
    }
    if (chunk.embeddings?.model !== modelIdentity()) {
      problems.push(`${chunk.chunkKey}: sin embedding del modelo vigente`);
    } else if (
      (chunk.embeddings.questions?.length ?? 0) !== (chunk.questions?.length ?? 0)
    ) {
      problems.push(`${chunk.chunkKey}: embeddings de preguntas incompletos`);
    }
    if (
      chunk.indexingPolicy === 'short_quotes_only' &&
      wordCount(chunk.text) > 25
    ) {
      problems.push(`${chunk.chunkKey}: supera el límite de 25 palabras`);
    }
  }

  return {
    ok: problems.length === 0,
    documentCount: documents.length,
    chunkCount: chunks.length,
    problems,
  };
}

export async function rebuildTextIndex(actor) {
  assertAuthorizedActor(actor);
  const auditTarget = await SourceDocument.findOne().sort({ updatedAt: -1 });
  if (!auditTarget) {
    throw new Error('No hay una fuente para asociar la auditoría del índice');
  }

  await AuditLog.createIndexes();
  const collectionExists = await mongoose.connection.db
    .listCollections({ name: SourceChunk.collection.name }, { nameOnly: true })
    .hasNext();
  if (!collectionExists) {
    await SourceChunk.createCollection();
  }
  const indexes = await SourceChunk.collection.indexes();
  const textIndexes = indexes.filter((index) =>
    Object.values(index.key).includes('text'),
  );
  for (const index of textIndexes) {
    await SourceChunk.collection.dropIndex(index.name);
  }
  await SourceChunk.createIndexes();

  await AuditLog.create({
    action: 'source.index.rebuilt',
    actor: actor._id,
    actorEmail: actor.email,
    entityType: 'SourceDocument',
    entityId: auditTarget._id,
    summary: 'Reconstruyó el índice léxico del corpus RAG',
    metadata: {
      sourceId: auditTarget.sourceId,
      indexName: TEXT_INDEX_NAME,
      textIndexCount: textIndexes.length,
    },
  });

  return { rebuilt: true, textIndex: TEXT_INDEX_NAME };
}

export async function backfillChunkEmbeddings(
  actor,
  { embed = embedTexts } = {},
) {
  assertAuthorizedActor(actor);
  const model = modelIdentity();
  const pending = await SourceChunk.find({
    $or: [{ embeddings: null }, { 'embeddings.model': { $ne: model } }],
  })
    .select('+embeddings')
    .lean();

  if (pending.length === 0) {
    return { updated: 0, model };
  }

  for (let start = 0; start < pending.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = pending.slice(start, start + EMBEDDING_BATCH_SIZE);
    const embedded = await embedChunks(
      batch.map((chunk) => ({
        text: chunk.text,
        questions: chunk.questions ?? [],
      })),
      embed,
    );

    await Promise.all(
      batch.map((chunk, position) =>
        SourceChunk.updateOne(
          { _id: chunk._id },
          { $set: { embeddings: embedded[position] } },
        ),
      ),
    );
  }

  const auditTarget = await SourceDocument.findOne().sort({ updatedAt: -1 });
  if (auditTarget) {
    await AuditLog.create({
      action: 'source.embeddings.rebuilt',
      actor: actor._id,
      actorEmail: actor.email,
      entityType: 'SourceDocument',
      entityId: auditTarget._id,
      summary: 'Calculó los embeddings pendientes del corpus RAG',
      metadata: {
        sourceId: auditTarget.sourceId,
        model,
        updated: pending.length,
      },
    });
  }

  return { updated: pending.length, model };
}

export function parseArguments(args) {
  const parsed = {
    mode: null,
    manifestPath: null,
    actorId: null,
    allowProduction: false,
    activate: false,
    help: false,
  };
  const modes = new Map([
    ['--dry-run', 'dry-run'],
    ['--apply', 'apply'],
    ['--verify', 'verify'],
    ['--rebuild-index', 'rebuild-index'],
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (modes.has(argument)) {
      if (parsed.mode) {
        throw new TypeError('Selecciona exactamente un modo de ejecución');
      }
      parsed.mode = modes.get(argument);
      continue;
    }
    if (argument === '--allow-production') {
      parsed.allowProduction = true;
      continue;
    }
    if (argument === '--activate') {
      parsed.activate = true;
      continue;
    }
    if (argument === '--manifest' || argument === '--actor-id') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new TypeError(`${argument} requiere un valor`);
      }
      parsed[argument === '--manifest' ? 'manifestPath' : 'actorId'] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--manifest=')) {
      parsed.manifestPath = argument.slice('--manifest='.length);
      continue;
    }
    if (argument.startsWith('--actor-id=')) {
      parsed.actorId = argument.slice('--actor-id='.length);
      continue;
    }
    throw new TypeError(`Argumento no reconocido: ${argument}`);
  }

  if (!parsed.help && !parsed.mode) {
    throw new TypeError('Indica --dry-run, --apply, --verify o --rebuild-index');
  }
  if (!parsed.help && !parsed.actorId) {
    throw new TypeError('Indica --actor-id con un administrador autorizado');
  }
  if (
    !parsed.help &&
    ['dry-run', 'apply'].includes(parsed.mode) &&
    !parsed.manifestPath
  ) {
    throw new TypeError(`${parsed.mode} requiere --manifest`);
  }
  if (!parsed.help && parsed.activate && !['dry-run', 'apply'].includes(parsed.mode)) {
    throw new TypeError('--activate solo aplica con --dry-run o --apply');
  }
  if (
    !parsed.help &&
    ['verify', 'rebuild-index'].includes(parsed.mode) &&
    parsed.manifestPath
  ) {
    throw new TypeError(`${parsed.mode} no acepta --manifest`);
  }

  return parsed;
}

async function readManifest(manifestPath) {
  const resolvedPath = path.resolve(manifestPath);
  const fileStats = await stat(resolvedPath);
  if (!fileStats.isFile() || fileStats.size > MAX_MANIFEST_BYTES) {
    throw new Error('El manifiesto debe ser un archivo de hasta 5 MB');
  }
  const raw = await readFile(resolvedPath, 'utf8');
  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON inválido en el manifiesto: ${error.message}`);
  }
  return { input, manifestHash: digest(raw) };
}

async function resolveActor(actorId) {
  if (!mongoose.isValidObjectId(actorId)) {
    throw new TypeError('--actor-id no contiene un ObjectId válido');
  }
  const actor = await User.findOne({
    _id: actorId,
    isActive: true,
    mustChangePassword: false,
  });
  assertAuthorizedActor(actor);
  return actor;
}

function printHelp() {
  console.log(
    [
      'Ingesta RAG desde manifiestos JSON curados (sin carga ni parseo de PDF).',
      '  node scripts/ingestRagCorpus.js --dry-run --manifest <archivo.json> --actor-id <ObjectId>',
      '  node scripts/ingestRagCorpus.js --apply --manifest <archivo.json> --actor-id <ObjectId>',
      '  node scripts/ingestRagCorpus.js --dry-run --activate --manifest <archivo.json> --actor-id <ObjectId>',
      '  node scripts/ingestRagCorpus.js --apply --activate --manifest <archivo.json> --actor-id <ObjectId>',
      '  node scripts/ingestRagCorpus.js --verify --actor-id <ObjectId>',
      '  node scripts/ingestRagCorpus.js --rebuild-index --actor-id <ObjectId>',
      '--activate activa un manifiesto en draft sin cambiar fragmentos: solo metadatos de revisión y auditoría.',
      '--rebuild-index reconstruye el índice léxico y calcula los embeddings que falten del modelo vigente.',
      'Añade --allow-production para escribir en NODE_ENV=production.',
    ].join('\n'),
  );
}

export async function runIngestionCommand(args) {
  const options = parseArguments(args);
  if (options.help) {
    printHelp();
    return;
  }
  if (
    config.nodeEnv === 'production' &&
    ['apply', 'rebuild-index'].includes(options.mode) &&
    !options.allowProduction
  ) {
    throw new Error(
      'En producción se requiere la confirmación explícita --allow-production',
    );
  }

  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  await connectDB();
  try {
    const actor = await resolveActor(options.actorId);
    if (options.mode === 'verify') {
      const result = await verifyCorpus();
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exitCode = 1;
      }
      return result;
    }
    if (options.mode === 'rebuild-index') {
      const textIndex = await rebuildTextIndex(actor);
      const embeddings = await backfillChunkEmbeddings(actor);
      const result = { ...textIndex, embeddings };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }

    const { input, manifestHash } = await readManifest(options.manifestPath);
    const result = options.activate
      ? await activateManifest({
          input,
          actor,
          apply: options.mode === 'apply',
          manifestHash,
        })
      : await ingestManifest({
          input,
          actor,
          apply: options.mode === 'apply',
          manifestHash,
        });
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await disconnectDB();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  runIngestionCommand(process.argv.slice(2)).catch((error) => {
    console.error('[rag:ingest] Error:', error.message);
    process.exitCode = 1;
  });
}
