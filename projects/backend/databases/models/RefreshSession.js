import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      unique: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByTokenId: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
    ip: {
      type: String,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshSession = mongoose.model(
  'RefreshSession',
  refreshSessionSchema,
);

export default RefreshSession;
