import mongoose from 'mongoose';

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

const checkInSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es obligatorio'],
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'El punto de interés es obligatorio'],
      index: true,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: [true, 'Las coordenadas del check-in son obligatorias'],
        validate: {
          validator: validateCoordinates,
          message:
            'Las coordenadas del check-in deben ser [longitud, latitud] dentro de rangos válidos',
        },
      },
    },
    distanceMeters: {
      type: Number,
      required: true,
      min: [0, 'La distancia no puede ser negativa'],
    },
    tokenVersion: {
      type: Number,
      required: true,
      min: [0, 'La versión del token no puede ser negativa'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

checkInSchema.index({ user: 1, location: 1 }, { unique: true });
checkInSchema.index({ location: 1, createdAt: -1 });
checkInSchema.index({ user: 1, createdAt: -1 });

checkInSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  },
});

const CheckIn = mongoose.model('CheckIn', checkInSchema);

export default CheckIn;
