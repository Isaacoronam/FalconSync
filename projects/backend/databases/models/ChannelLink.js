import mongoose from 'mongoose';

export const CHANNEL_NAMES = ['telegram'];

/**
 * Vínculo entre una cuenta de FalconSync y una identidad externa.
 *
 * Se elimina al desvincular: el historial queda en AuditLog. Los índices
 * únicos impiden que un usuario tenga dos Telegram activos o que un Telegram
 * quede asociado a dos cuentas.
 */
const channelLinkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: {
        values: CHANNEL_NAMES,
        message: 'El canal no es válido',
      },
      required: true,
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
      maxlength: [64, 'El identificador externo no puede superar 64 caracteres'],
    },
    chatId: {
      type: String,
      required: true,
      trim: true,
      maxlength: [64, 'El identificador de chat no puede superar 64 caracteres'],
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

channelLinkSchema.index({ channel: 1, externalId: 1 }, { unique: true });
channelLinkSchema.index({ user: 1, channel: 1 }, { unique: true });

channelLinkSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  },
});

const ChannelLink = mongoose.model('ChannelLink', channelLinkSchema);

export default ChannelLink;
