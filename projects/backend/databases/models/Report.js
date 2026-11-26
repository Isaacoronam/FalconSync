import mongoose from 'mongoose';

export const DAMAGE_CATEGORIES = [
  'structural',
  'moisture',
  'cracks',
  'material_loss',
  'vandalism',
  'vegetation',
  'fire',
  'collapse_risk',
  'other',
];

export const REPORT_STATES = [
  'received',
  'triaged',
  'accepted',
  'rejected',
  'converted',
  'closed',
];

export const REPORT_SOURCE_CHANNELS = ['web', 'telegram'];

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    heritageAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HeritageAsset',
      default: null,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: DAMAGE_CATEGORIES,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    capturedAt: {
      type: Date,
      required: true,
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
          message: 'Las coordenadas GPS no son válidas',
        },
      },
    },
    accuracyMeters: {
      type: Number,
      min: 0,
      max: 10000,
    },
    sourceChannel: {
      type: String,
      enum: {
        values: REPORT_SOURCE_CHANNELS,
        message: 'El canal del reporte no es válido',
      },
      default: 'web',
      index: true,
    },
    // Clave interna de idempotencia del canal. No se expone en la API pública.
    // Las altas web no escriben el campo: el índice único es sparse y así
    // admite muchos reportes sin clave.
    sourceActionKey: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    state: {
      type: String,
      enum: REPORT_STATES,
      default: 'received',
      required: true,
      index: true,
    },
    triage: {
      decision: {
        type: String,
        enum: ['accept', 'reject', 'close'],
      },
      triagedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      triagedAt: Date,
      notes: { type: String, trim: true, maxlength: 500 },
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    inspectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inspection',
    },
    evidenceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
      default: [],
      validate: (value) => value.length <= 10,
    },
    version: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

reportSchema.index({ state: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ inspectionId: 1 }, { unique: true, sparse: true });
reportSchema.index({ gps: '2dsphere' });
reportSchema.index({ sourceActionKey: 1 }, { unique: true, sparse: true });

reportSchema.pre('validate', function validateDestination() {
  if (!this.heritageAssetId && !this.locationId) {
    this.invalidate(
      'heritageAssetId',
      'El reporte debe identificar un activo patrimonial o un POI',
    );
  }

  if (this.capturedAt && this.capturedAt.getTime() > Date.now() + 5 * 60_000) {
    this.invalidate('capturedAt', 'La fecha de captura no puede ser futura');
  }

});

reportSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    returned.inspectionId = returned.inspectionId ?? null;
    delete returned._id;
    delete returned.__v;
    return returned;
  },
});

const Report = mongoose.model('Report', reportSchema);

export default Report;
