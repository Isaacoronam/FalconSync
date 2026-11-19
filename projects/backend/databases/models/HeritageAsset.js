import mongoose from 'mongoose';

export const HERITAGE_ASSET_TYPES = [
  'building',
  'monument',
  'urban_space',
  'archaeological_site',
  'museum',
  'natural_site',
  'other',
];

export const UNESCO_STATUSES = [
  'inscribed',
  'buffer_zone',
  'not_listed',
  'unknown',
];

export const PROTECTION_LEVELS = [
  'national',
  'state',
  'municipal',
  'none',
  'unknown',
];

export const HERITAGE_ASSET_STATUSES = ['draft', 'active', 'archived'];

const heritageAssetSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9][A-Z0-9-]{2,39}$/,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    type: {
      type: String,
      required: true,
      enum: HERITAGE_ASSET_TYPES,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    unescoStatus: {
      type: String,
      enum: UNESCO_STATUSES,
      default: 'unknown',
      required: true,
      index: true,
    },
    protectionLevel: {
      type: String,
      enum: PROTECTION_LEVELS,
      default: 'unknown',
      required: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },
    geometry: {
      type: {
        type: String,
        enum: ['Point', 'Polygon'],
      },
      coordinates: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    sourceRefs: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 500,
          match: /^https?:\/\/\S+$/i,
        },
      ],
      default: [],
      validate: (value) => value.length <= 10,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
      select: false,
    },
    status: {
      type: String,
      enum: HERITAGE_ASSET_STATUSES,
      default: 'draft',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

heritageAssetSchema.index({ geometry: '2dsphere' });
heritageAssetSchema.index(
  { locationId: 1 },
  { unique: true, sparse: true },
);
heritageAssetSchema.index({ type: 1, status: 1 });

heritageAssetSchema.pre('validate', function validateActiveAsset() {
  if (this.status === 'active' && !this.geometry?.type) {
    this.invalidate('geometry', 'Un activo activo requiere una geometría');
  }

  if (
    ['inscribed', 'buffer_zone'].includes(this.unescoStatus) &&
    this.sourceRefs.length === 0
  ) {
    this.invalidate(
      'sourceRefs',
      'El estado UNESCO requiere al menos una fuente verificable',
    );
  }

});

heritageAssetSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.__v;
    delete returned.notes;
    return returned;
  },
});

const HeritageAsset = mongoose.model('HeritageAsset', heritageAssetSchema);

export default HeritageAsset;
