import mongoose from 'mongoose';
import {
  ABSTENTION_REASONS,
  ANSWER_TYPES,
  CLAIM_TYPES,
  CITATION_KINDS,
} from './ragContract.js';

const citationSchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true },
    chunkId: { type: String, required: true },
    sourceId: { type: String, required: true },
    title: { type: String, required: true },
    institution: { type: String, required: true },
    kind: { type: String, enum: CITATION_KINDS, required: true },
    page: { type: String, default: null },
    section: { type: String, default: null },
    quote: { type: String, required: true, maxlength: 300 },
    claimType: { type: String, enum: CLAIM_TYPES, default: null },
    factKey: { type: String, default: null },
    factValue: { type: String, default: null },
    contradictionGroup: { type: String, default: null },
    validAsOf: { type: Date, default: null },
    sourceLevel: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E'],
      required: true,
    },
    sourceLabel: { type: String, required: true, maxlength: 40 },
    url: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: { type: String, required: true, maxlength: 2000 },
    citations: { type: [citationSchema], default: [] },
    answerType: { type: String, enum: ANSWER_TYPES, default: null },
    abstained: { type: Boolean, required: true, default: false },
    abstentionReason: {
      type: String,
      enum: ABSTENTION_REASONS,
      default: null,
    },
    latencyMs: { type: Number, min: 0, default: null },
    retrieval: {
      chunkIds: { type: [String], default: [] },
      scores: { type: [Number], default: [] },
      topK: { type: Number, min: 0, default: 0 },
      corpusVersion: { type: String, required: true, maxlength: 40 },
    },
    retentionUntil: { type: Date, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ retentionUntil: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
