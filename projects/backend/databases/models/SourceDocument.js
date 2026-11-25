import mongoose from 'mongoose';

export const SOURCE_LEVELS = ['A', 'B', 'C', 'D', 'E'];
export const SOURCE_USAGE_POLICIES = ['final', 'pointer', 'context'];
export const SOURCE_INDEXING_POLICIES = ['full_text', 'short_quotes_only'];
export const SOURCE_STATUSES = [
  'draft',
  'active',
  'superseded',
  'retracted',
];
export const SOURCE_LABELS = [
  'Oficial UNESCO',
  'Oficial estatal',
  'Oficial local',
  'Histórico 2008',
  'Académico',
  'Referencia',
  'Externo',
  'No verificado',
  'Tradición local',
];

const sourceDocumentSchema = new mongoose.Schema(
  {
    sourceId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^S-[0-9]{3}$/,
      unique: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    institution: { type: String, required: true, trim: true, maxlength: 160 },
    version: { type: String, required: true, trim: true, maxlength: 120 },
    publicationDate: { type: Date, default: null },
    retrievedAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    url: { type: String, trim: true, maxlength: 1000, default: null },
    level: { type: String, enum: SOURCE_LEVELS, required: true },
    sourceLabel: { type: String, enum: SOURCE_LABELS, required: true },
    usagePolicy: {
      type: String,
      enum: SOURCE_USAGE_POLICIES,
      required: true,
    },
    indexingPolicy: {
      type: String,
      enum: SOURCE_INDEXING_POLICIES,
      required: true,
    },
    credibilityNotes: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    license: { type: String, required: true, trim: true, maxlength: 300 },
    rights: { type: String, required: true, trim: true, maxlength: 1000 },
    rightsVerified: { type: Boolean, required: true, default: false },
    rightsVerifiedAt: { type: Date, default: null },
    rightsVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    accessLevel: {
      type: String,
      enum: ['public', 'internal', 'restricted'],
      required: true,
    },
    checksum: { type: String, default: null, match: /^[A-Fa-f0-9]{64}$/ },
    checksumScope: {
      type: String,
      enum: ['original_file', 'curated_text'],
      default: null,
    },
    storageKey: { type: String, default: null, select: false },
    language: { type: String, required: true, enum: ['es'] },
    topics: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
    },
    poiSlugs: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
      default: [],
    },
    status: {
      type: String,
      enum: SOURCE_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },
    statusReason: { type: String, trim: true, maxlength: 1000, default: null },
    supersedes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SourceDocument',
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

sourceDocumentSchema.index({ sourceId: 1, status: 1 });
sourceDocumentSchema.index({ level: 1, usagePolicy: 1, status: 1 });
sourceDocumentSchema.index(
  { checksum: 1 },
  { unique: true, partialFilterExpression: { checksum: { $type: 'string' } } },
);

sourceDocumentSchema.pre('validate', function validateActiveSource() {
  if (this.status === 'active' && !this.verifiedAt) {
    this.invalidate('verifiedAt', 'Una fuente activa requiere verificación');
  }

  if (this.status === 'active' && !this.rightsVerified) {
    this.invalidate(
      'rightsVerified',
      'Una fuente activa requiere derechos verificados',
    );
  }

  if (this.checksum && !this.checksumScope) {
    this.invalidate(
      'checksumScope',
      'El checksum requiere indicar su alcance',
    );
  }

  if (
    ['superseded', 'retracted'].includes(this.status) &&
    !this.statusReason
  ) {
    this.invalidate(
      'statusReason',
      'Una fuente sustituida o retirada requiere un motivo',
    );
  }
});

const SourceDocument = mongoose.model('SourceDocument', sourceDocumentSchema);

export default SourceDocument;
