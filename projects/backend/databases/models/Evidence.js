import mongoose from 'mongoose';

export const EVIDENCE_OWNER_TYPES = ['Report', 'Inspection', 'Intervention'];

export const EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const EVIDENCE_SCAN_STATUSES = [
  'uploaded',
  'pending_scan',
  'available',
  'quarantined',
  'superseded',
  'deleted',
];

const evidenceSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      enum: EVIDENCE_OWNER_TYPES,
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    findingId: {
      type: String,
      default: null,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },
    mimeType: {
      type: String,
      enum: EVIDENCE_MIME_TYPES,
      required: true,
    },
    bytes: {
      type: Number,
      required: true,
      min: 1,
    },
    width: {
      type: Number,
      default: null,
      min: 1,
    },
    height: {
      type: Number,
      default: null,
      min: 1,
    },
    sha256: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      index: true,
    },
    capturedAt: {
      type: Date,
      default: null,
    },
    gps: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (value) =>
            !value ||
            (value.length === 2 &&
              Number.isFinite(value[0]) &&
              Number.isFinite(value[1]) &&
              value[0] >= -180 &&
              value[0] <= 180 &&
              value[1] >= -90 &&
              value[1] <= 90),
          message: 'Las coordenadas GPS de la evidencia no son válidas',
        },
      },
    },
    accuracyMeters: {
      type: Number,
      min: 0,
      max: 10000,
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 300,
    },
    scanStatus: {
      type: String,
      enum: EVIDENCE_SCAN_STATUSES,
      default: 'pending_scan',
      required: true,
      index: true,
    },
    exifStripped: {
      type: Boolean,
      default: false,
      required: true,
    },
    retentionUntil: {
      type: Date,
      default: null,
      index: true,
    },
    legalHold: {
      type: Boolean,
      default: false,
      required: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true, versionKey: false },
);

evidenceSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
evidenceSchema.index(
  { uploadedBy: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
evidenceSchema.index({ gps: '2dsphere' });

evidenceSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.__v;
    delete returned.storageKey;
    delete returned.idempotencyKey;
    return returned;
  },
});

const Evidence = mongoose.model('Evidence', evidenceSchema);

export default Evidence;
