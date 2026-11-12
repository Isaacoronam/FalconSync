import mongoose from 'mongoose';

const adventureStopSchema = new mongoose.Schema(
  {
    adventure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Adventure',
      required: [true, 'La aventura es obligatoria'],
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'El punto de interés es obligatorio'],
      index: true,
    },
    order: {
      type: Number,
      required: [true, 'El orden de la parada es obligatorio'],
      min: [1, 'El orden de la parada debe ser al menos 1'],
    },
    didacticText: {
      type: String,
      trim: true,
      maxlength: [2000, 'El texto didáctico no puede superar 2000 caracteres'],
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [2000, 'Las instrucciones no pueden superar 2000 caracteres'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

adventureStopSchema.index({ adventure: 1, order: 1 }, { unique: true });
adventureStopSchema.index({ adventure: 1, location: 1 }, { unique: true });

adventureStopSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  },
});

const AdventureStop = mongoose.model('AdventureStop', adventureStopSchema);

export default AdventureStop;
