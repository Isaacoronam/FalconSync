import mongoose from 'mongoose';

export const INTERVENTION_TYPES = [
  'repair',
  'stabilization',
  'cleaning',
  'restoration',
  'monitoring',
  'other',
];

export const INTERVENTION_STATES = [
  'proposed',
  'approved',
  'in_progress',
  'completed',
  'verified',
  'rejected',
];

const interventionSchema = new mongoose.Schema(
  {
    inspectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inspection',
      required: true,
      index: true,
    },
    findingIds: {
      type: [String],
      default: [],
      validate: (value) => value.length > 0 && value.length <= 50,
    },
    type: { type: String, enum: INTERVENTION_TYPES, required: true },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    state: {
      type: String,
      enum: INTERVENTION_STATES,
      default: 'proposed',
      required: true,
      index: true,
    },
    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    executorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    approvedAt: Date,
    startedAt: Date,
    completedAt: Date,
    verifiedAt: Date,
    evidenceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
      default: [],
      validate: (value) => value.length <= 10,
    },
    version: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

interventionSchema.index({ inspectionId: 1, state: 1 });

interventionSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.__v;
    return returned;
  },
});

const Intervention = mongoose.model('Intervention', interventionSchema);

export default Intervention;
