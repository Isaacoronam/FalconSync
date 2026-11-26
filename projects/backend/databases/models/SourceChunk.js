import mongoose from 'mongoose';
import { CLAIM_TYPES } from './ragContract.js';

const sourceChunkSchema = new mongoose.Schema(
  {
    chunkKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      unique: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SourceDocument',
      required: true,
      index: true,
    },
    ordinal: { type: Number, required: true, min: 0 },
    page: { type: String, trim: true, maxlength: 40, default: null },
    section: { type: String, trim: true, maxlength: 240, default: null },
    claimType: { type: String, enum: CLAIM_TYPES, default: null },
    factKey: { type: String, trim: true, maxlength: 120, default: null },
    factValue: { type: String, trim: true, maxlength: 300, default: null },
    contradictionGroup: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },
    validAsOf: { type: Date, default: null },
    language: { type: String, required: true, enum: ['es'], default: 'es' },
    text: { type: String, required: true, trim: true, maxlength: 12000 },
    indexingPolicy: {
      type: String,
      enum: ['full_text', 'short_quotes_only'],
      required: true,
    },
    assistantScopes: {
      type: [{ type: String, enum: ['tourist', 'technical'] }],
      required: true,
      validate: (value) => value.length > 0,
    },
    topics: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
    },
    poiSlugs: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
      default: [],
    },
    questions: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      default: [],
      validate: (value) => value.length <= 5,
    },
    embeddings: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },
    checksum: { type: String, required: true, match: /^[A-Fa-f0-9]{64}$/ },
  },
  { timestamps: true, versionKey: false },
);

sourceChunkSchema.index(
  { text: 'text' },
  {
    name: 'source_chunk_text_es',
    default_language: 'spanish',
    language_override: 'language',
  },
);
sourceChunkSchema.index({ documentId: 1, ordinal: 1 }, { unique: true });
sourceChunkSchema.index({ documentId: 1, page: 1 });
sourceChunkSchema.index({ assistantScopes: 1 });
sourceChunkSchema.index({ poiSlugs: 1 });
sourceChunkSchema.index({ 'embeddings.model': 1 });

sourceChunkSchema.pre('validate', function validateRestrictedChunk() {
  if (Boolean(this.factKey) !== Boolean(this.factValue)) {
    this.invalidate(
      'factValue',
      'factKey y factValue deben estar presentes juntos',
    );
  }

  if (
    this.factValue &&
    this.factValue.split(/\s+/u).filter(Boolean).length > 25
  ) {
    this.invalidate('factValue', 'Un hecho citado no puede superar 25 palabras');
  }
  if (
    this.factValue &&
    !this.text.replace(/\s+/gu, ' ').includes(this.factValue.replace(/\s+/gu, ' '))
  ) {
    this.invalidate('factValue', 'El valor debe aparecer en el texto del fragmento');
  }

  if (
    this.indexingPolicy === 'short_quotes_only' &&
    this.text.split(/\s+/u).filter(Boolean).length > 25
  ) {
    this.invalidate(
      'text',
      'Una fuente de citas breves no admite fragmentos de más de 25 palabras',
    );
  }
});

const SourceChunk = mongoose.model('SourceChunk', sourceChunkSchema);

export default SourceChunk;
