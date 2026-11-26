import mongoose from 'mongoose';

/**
 * Deduplicación de actualizaciones de Telegram.
 *
 * Telegram puede reintentar la misma actualización. El bot reclama el
 * update_id antes de procesarlo y libera la marca si el procesamiento falla.
 */
const telegramUpdateSchema = new mongoose.Schema(
  {
    updateId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    chatId: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

telegramUpdateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TelegramUpdate = mongoose.model('TelegramUpdate', telegramUpdateSchema);

export default TelegramUpdate;
