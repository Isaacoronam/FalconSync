import mongoose from 'mongoose';

export const PANORAMA_STATUSES = ['draft', 'approved', 'published', 'archived'];
export const PANORAMA_VISIBILITY = ['public', 'inspection'];
export const PANORAMA_PROJECTIONS = ['equirectangular'];
export const HOTSPOT_TYPES = ['scene', 'location', 'info'];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hotspotSchema = new mongoose.Schema(
  {
    hotspotId: {
      type: String,
      required: true,
      match: [UUID_PATTERN, 'El identificador del hotspot debe ser un UUID'],
    },
    label: {
      type: String,
      required: [true, 'La etiqueta del hotspot es obligatoria'],
      trim: true,
      maxlength: [80, 'La etiqueta del hotspot no puede superar 80 caracteres'],
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: HOTSPOT_TYPES,
        message: 'Tipo de hotspot no válido',
      },
    },
    yaw: {
      type: Number,
      required: true,
      min: [-180, 'La orientación horizontal debe estar entre -180 y 180'],
      max: [180, 'La orientación horizontal debe estar entre -180 y 180'],
    },
    pitch: {
      type: Number,
      required: true,
      min: [-90, 'La orientación vertical debe estar entre -90 y 90'],
      max: [90, 'La orientación vertical debe estar entre -90 y 90'],
    },
    targetPanoramaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Panorama',
      default: null,
    },
    targetLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    targetUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'La URL del hotspot no puede superar 500 caracteres'],
    },
    ariaLabel: {
      type: String,
      required: [true, 'La descripción accesible del hotspot es obligatoria'],
      trim: true,
      maxlength: [
        120,
        'La descripción accesible del hotspot no puede superar 120 caracteres',
      ],
    },
  },
  { _id: false },
);

const consentSchema = new mongoose.Schema(
  {
    peopleBlurred: {
      type: Boolean,
      default: false,
    },
    consentDocumented: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'Las notas de consentimiento no pueden superar 500 caracteres'],
    },
  },
  { _id: false },
);

const fallbackSchema = new mongoose.Schema(
  {
    alt: {
      type: String,
      required: [true, 'El texto alternativo del fallback es obligatorio'],
      trim: true,
      maxlength: [200, 'El texto alternativo no puede superar 200 caracteres'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'La descripción del fallback no puede superar 2000 caracteres'],
    },
    transcript: {
      type: String,
      default: null,
      trim: true,
      maxlength: [10000, 'La transcripción no puede superar 10000 caracteres'],
    },
  },
  { _id: false },
);

const panoramaSchema = new mongoose.Schema(
  {
    assetId: {
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
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      trim: true,
      maxlength: [160, 'El título no puede superar 160 caracteres'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'La descripción no puede superar 2000 caracteres'],
    },
    imageKey: {
      type: String,
      required: true,
      select: false,
    },
    derivativeKey: {
      type: String,
      default: null,
      select: false,
    },
    thumbnailKey: {
      type: String,
      default: null,
      select: false,
    },
    projection: {
      type: String,
      required: true,
      enum: {
        values: PANORAMA_PROJECTIONS,
        message: 'Proyección no válida',
      },
      default: 'equirectangular',
    },
    width: {
      type: Number,
      required: true,
      min: [1, 'El ancho debe ser positivo'],
    },
    height: {
      type: Number,
      required: true,
      min: [1, 'La altura debe ser positiva'],
    },
    checksum: {
      type: String,
      required: true,
      match: [/^[a-f0-9]{64}$/, 'El checksum debe ser SHA-256 en hexadecimal'],
    },
    derivativeChecksum: {
      type: String,
      default: null,
      match: [/^[a-f0-9]{64}$/, 'El checksum del derivado debe ser SHA-256'],
    },
    thumbnailChecksum: {
      type: String,
      default: null,
      match: [/^[a-f0-9]{64}$/, 'El checksum de la miniatura debe ser SHA-256'],
    },
    bytes: {
      type: Number,
      required: true,
      min: 1,
    },
    derivativeBytes: {
      type: Number,
      default: null,
      min: 1,
    },
    thumbnailBytes: {
      type: Number,
      default: null,
      min: 1,
    },
    license: {
      type: String,
      required: [true, 'La licencia es obligatoria'],
      trim: true,
      maxlength: [200, 'La licencia no puede superar 200 caracteres'],
    },
    licenseUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'El enlace de la licencia no puede superar 500 caracteres'],
      match: [/^https?:\/\/[^\s]+$/i, 'El enlace de la licencia debe ser http(s)'],
    },
    author: {
      type: String,
      required: [true, 'La autoría es obligatoria'],
      trim: true,
      maxlength: [160, 'La autoría no puede superar 160 caracteres'],
    },
    credit: {
      type: String,
      required: [true, 'El crédito visible es obligatorio'],
      trim: true,
      maxlength: [300, 'El crédito no puede superar 300 caracteres'],
    },
    capturedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: PANORAMA_STATUSES,
        message: 'Estado de panorama no válido',
      },
      default: 'draft',
      index: true,
    },
    visibility: {
      type: String,
      required: true,
      enum: {
        values: PANORAMA_VISIBILITY,
        message: 'Visibilidad de panorama no válida',
      },
      default: 'public',
      index: true,
    },
    hotspots: {
      type: [hotspotSchema],
      default: [],
      validate: {
        validator: (value) =>
          !Array.isArray(value) ||
          new Set(value.map((hotspot) => hotspot.hotspotId)).size === value.length,
        message: 'Los identificadores de hotspot no pueden repetirse',
      },
    },
    fallback: {
      type: fallbackSchema,
      required: true,
    },
    rightsDocumented: {
      type: Boolean,
      default: false,
    },
    permitDocumented: {
      type: Boolean,
      default: false,
    },
    rightsNotes: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'Las notas de derechos no pueden superar 500 caracteres'],
    },
    consent: {
      type: consentSchema,
      default: () => ({}),
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

panoramaSchema.index({ status: 1, visibility: 1, createdAt: -1 });
panoramaSchema.index({ locationId: 1, status: 1, visibility: 1 });
panoramaSchema.index({ assetId: 1, status: 1, visibility: 1 });

panoramaSchema.pre('validate', function ensurePanoramaInvariants() {
  if (!this.assetId && !this.locationId) {
    this.invalidate(
      'locationId',
      'El panorama debe asociarse al menos a un POI o activo patrimonial',
    );
  }

  if (this.width > 0 && this.height > 0) {
    const ratio = this.width / this.height;

    if (Math.abs(ratio - 2) > 0.02) {
      this.invalidate(
        'width',
        'Un panorama equirectangular debe mantener una relación 2:1',
      );
    }
  }

  const peopleCleared =
    this.consent?.peopleBlurred === true ||
    this.consent?.consentDocumented === true;

  if (this.status === 'approved' && !this.rightsDocumented) {
    this.invalidate(
      'rightsDocumented',
      'No se aprueba un panorama sin derechos documentados',
    );
  }

  if (this.status === 'published') {
    if (!this.rightsDocumented) {
      this.invalidate(
        'rightsDocumented',
        'No se publica un panorama sin derechos documentados',
      );
    }

    if (!peopleCleared) {
      this.invalidate(
        'consent',
        'Debes confirmar el difuminado de personas o el consentimiento documentado',
      );
    }

    if (!this.fallback?.alt?.trim()) {
      this.invalidate(
        'fallback.alt',
        'El fallback necesita un texto alternativo para publicarse',
      );
    }

    if (!this.fallback?.description?.trim()) {
      this.invalidate(
        'fallback.description',
        'El fallback necesita una descripción para publicarse',
      );
    }

    if (
      !this.derivativeKey ||
      !this.derivativeChecksum ||
      !this.thumbnailKey ||
      !this.thumbnailChecksum
    ) {
      this.invalidate(
        'derivativeKey',
        'El panorama no tiene derivados íntegros para publicarse',
      );
    }

    if (!this.approvedAt) {
      this.invalidate(
        'approvedAt',
        'El panorama debe aprobarse antes de publicarse',
      );
    }
  }
});

panoramaSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.__v;
    delete returned.imageKey;
    delete returned.derivativeKey;
    delete returned.thumbnailKey;
    return returned;
  },
});

const Panorama = mongoose.model('Panorama', panoramaSchema);

export default Panorama;
