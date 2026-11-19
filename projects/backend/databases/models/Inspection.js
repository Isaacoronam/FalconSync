import mongoose from 'mongoose';
import { DAMAGE_CATEGORIES } from './Report.js';

export const INSPECTION_TYPES = [
  'routine',
  'follow_up',
  'emergency',
  'post_intervention',
];

export const INSPECTION_STATES = [
  'planned',
  'in_progress',
  'submitted',
  'returned',
  'reviewed',
  'closed',
  'cancelled',
];

export const INSPECTION_RESULTS = ['good', 'fair', 'poor'];
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const findingSchema = new mongoose.Schema(
  {
    findingId: { type: String, required: true },
    category: { type: String, enum: DAMAGE_CATEGORIES, required: true },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    severityProposed: { type: String, enum: SEVERITIES, required: true },
    severityConfirmed: { type: String, enum: SEVERITIES, default: null },
    requiresIntervention: { type: Boolean, required: true, default: false },
    state: {
      type: String,
      enum: ['proposed', 'confirmed', 'discarded', 'reopened', 'resolved'],
      default: 'proposed',
      required: true,
    },
    evidenceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
      default: [],
      validate: (value) => value.length <= 10,
    },
    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: Date,
  },
  { _id: false },
);

const historySchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    occurredAt: { type: Date, required: true },
    fromState: String,
    toState: String,
    reason: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const inspectionSchema = new mongoose.Schema(
  {
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HeritageAsset',
      required: true,
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    },
    inspectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: INSPECTION_TYPES, required: true },
    state: {
      type: String,
      enum: INSPECTION_STATES,
      default: 'planned',
      required: true,
      index: true,
    },
    scope: { type: String, required: true, trim: true, maxlength: 4000 },
    scheduledAt: Date,
    startedAt: Date,
    submittedAt: Date,
    reviewedAt: Date,
    closedAt: Date,
    returnedAt: Date,
    reviewNotes: { type: String, trim: true, maxlength: 2000 },
    result: { type: String, enum: INSPECTION_RESULTS, default: null },
    noFindingsDeclared: { type: Boolean, default: false, required: true },
    findings: { type: [findingSchema], default: [], validate: (value) => value.length <= 50 },
    evidenceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
      default: [],
      validate: (value) => value.length <= 50,
    },
    history: { type: [historySchema], default: [] },
    closureJustification: { type: String, trim: true, maxlength: 2000 },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    version: { type: Number, default: 0, min: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

inspectionSchema.index({ assetId: 1, state: 1 });
inspectionSchema.index({ inspectorId: 1, state: 1 });
inspectionSchema.index({ reportId: 1 }, { unique: true, sparse: true });

inspectionSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    returned.reportId = returned.reportId ?? null;
    delete returned._id;
    delete returned.__v;
    return returned;
  },
});

const Inspection = mongoose.model('Inspection', inspectionSchema);

export default Inspection;
