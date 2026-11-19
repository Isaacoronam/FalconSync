import mongoose from 'mongoose';

export const ADVENTURE_STATUSES = ['draft', 'published', 'archived'];

export const ADVENTURE_DIFFICULTIES = ['easy', 'moderate', 'challenging'];

const ASSET_URL_PATTERN =
  /^(?:https?:\/\/[^\s]+|\/api\/uploads\/locations\/[A-Za-z0-9._-]+|\/images\/locations\/[A-Za-z0-9._-]+)$/i;

const badgeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la insignia es obligatorio'],
      trim: true,
      maxlength: [80, 'El nombre de la insignia no puede superar 80 caracteres'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [
        280,
        'La descripción de la insignia no puede superar 280 caracteres',
      ],
    },
    image: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: {
        validator: (value) => !value || ASSET_URL_PATTERN.test(value),
        message: 'La imagen de la insignia debe ser una URL http(s) o una ruta local permitida',
      },
    },
  },
  { _id: false },
);

const adventureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título de la aventura es obligatorio'],
      trim: true,
      maxlength: [140, 'El título no puede superar 140 caracteres'],
    },
    slug: {
      type: String,
      required: [true, 'El slug de la aventura es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'El slug solo admite minúsculas, números y guiones',
      ],
    },
    summary: {
      type: String,
      required: [true, 'El resumen de la aventura es obligatorio'],
      trim: true,
      maxlength: [280, 'El resumen no puede superar 280 caracteres'],
    },
    description: {
      type: String,
      required: [true, 'La descripción de la aventura es obligatoria'],
      trim: true,
      maxlength: [10000, 'La descripción no puede superar 10000 caracteres'],
    },
    difficulty: {
      type: String,
      enum: {
        values: ADVENTURE_DIFFICULTIES,
        message: 'La dificultad no es válida',
      },
      default: 'easy',
      index: true,
    },
    estimatedMinutes: {
      type: Number,
      min: [1, 'La duración estimada debe ser al menos 1 minuto'],
      max: [1440, 'La duración estimada no puede superar 1440 minutos'],
      default: 60,
    },
    coverImage: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: {
        validator: (value) => !value || ASSET_URL_PATTERN.test(value),
        message: 'La portada debe ser una URL http(s) o una ruta local permitida',
      },
    },
    badge: {
      type: badgeSchema,
      default: undefined,
    },
    status: {
      type: String,
      enum: {
        values: ADVENTURE_STATUSES,
        message: 'El estado de publicación de la aventura no es válido',
      },
      default: 'draft',
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

adventureSchema.index({ status: 1, deletedAt: 1, title: 1 });

adventureSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.createdBy;
    delete returned.updatedBy;
    delete returned.deletedBy;
    return returned;
  },
});

const Adventure = mongoose.model('Adventure', adventureSchema);

export default Adventure;
