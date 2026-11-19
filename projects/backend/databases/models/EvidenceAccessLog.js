import mongoose from 'mongoose';

export const EVIDENCE_ACCESS_ACTIONS = [
  'view',
  'download',
  'metadata',
  'delete',
  'legal_hold',
];

const evidenceAccessLogSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: EVIDENCE_ACCESS_ACTIONS,
      required: true,
    },
    ip: {
      type: String,
      default: null,
      maxlength: 100,
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 500,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

evidenceAccessLogSchema.index({ evidenceId: 1, createdAt: -1 });

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  evidenceAccessLogSchema.pre(operation, function immutableEvidenceAccessLog() {
    throw new Error('EvidenceAccessLog is append-only');
  });
}

evidenceAccessLogSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.__v;
    return returned;
  },
});

const EvidenceAccessLog = mongoose.model(
  'EvidenceAccessLog',
  evidenceAccessLogSchema,
);

export default EvidenceAccessLog;
