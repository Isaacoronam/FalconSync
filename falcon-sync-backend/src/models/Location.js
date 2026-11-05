import mongoose from 'mongoose';

export const LOCATION_CATEGORIES = [
  'architecture',
  'monument',
  'nature',
  'religious',
  'urban',
];

export const CONSERVATION_STATUSES = ['good', 'fair', 'poor', 'unknown'];

function validateCoordinates(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const [longitude, latitude] = value;

  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

const locationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      trim: true,
      maxlength: [120, 'El título no puede superar 120 caracteres'],
    },
    slug: {
      type: String,
      required: [true, 'El slug es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'El slug solo admite minúsculas, números y guiones',
      ],
    },
    category: {
      type: String,
      required: [true, 'La categoría es obligatoria'],
      enum: {
        values: LOCATION_CATEGORIES,
        message: 'Categoría no válida',
      },
      index: true,
    },
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
      maxlength: [5000, 'La descripción no puede superar 5000 caracteres'],
    },
    historicalPeriod: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: [true, 'Las coordenadas son obligatorias'],
        validate: {
          validator: validateCoordinates,
          message:
            'Las coordenadas deben ser [longitud, latitud] dentro de rangos válidos',
        },
      },
    },
    images: {
      type: [String],
      default: [],
    },
    audioGuideUrl: {
      type: String,
      trim: true,
    },
    conservationStatus: {
      type: String,
      enum: {
        values: CONSERVATION_STATUSES,
        message: 'Estado de conservación no válido',
      },
      default: 'unknown',
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    isProvisional: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

locationSchema.index({ location: '2dsphere' });
locationSchema.index({ category: 1, title: 1 });

locationSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  },
});

const Location = mongoose.model('Location', locationSchema);

export default Location;
