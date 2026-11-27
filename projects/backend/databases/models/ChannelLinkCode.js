import mongoose from 'mongoose';

/**
 * Código de un solo uso para vincular un canal externo.
 *
 * Solo se guarda el hash SHA-256. El TTL elimina los códigos vencidos; además
 * la validación comprueba expiresAt para no depender del monitor de TTL.
 */
const channelLinkCodeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

channelLinkCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
channelLinkCodeSchema.index({ user: 1, createdAt: -1 });

const ChannelLinkCode = mongoose.model(
  'ChannelLinkCode',
  channelLinkCodeSchema,
);

export default ChannelLinkCode;
