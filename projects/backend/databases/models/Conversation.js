import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assistant: {
      type: String,
      enum: ['inspection'],
      required: true,
    },
    startedAt: { type: Date, required: true },
    lastMessageAt: { type: Date, required: true },
    retentionUntil: { type: Date, required: true },
    corpusVersion: { type: String, required: true, maxlength: 40 },
  },
  { timestamps: false, versionKey: false },
);

conversationSchema.index({ userId: 1, startedAt: -1 });
conversationSchema.index({ retentionUntil: 1 }, { expireAfterSeconds: 0 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
