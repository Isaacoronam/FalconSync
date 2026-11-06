import mongoose from 'mongoose';

export const AUDIT_ACTIONS = [
  'location.created',
  'location.updated',
  'location.deleted',
  'location.restored',
  'location.image.uploaded',
  'location.image.removed',
  'location.qr.rotated',
  'adventure.created',
  'adventure.updated',
  'adventure.published',
  'adventure.archived',
  'adventure.restored',
  'adventure.stop.added',
  'adventure.stop.updated',
  'adventure.stop.removed',
  'adventure.stops.reordered',
];

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: {
        values: AUDIT_ACTIONS,
        message: 'Acción de auditoría no válida',
      },
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorEmail: {
      type: String,
      required: true,
      trim: true,
      maxlength: 254,
    },
    entityType: {
      type: String,
      required: true,
      default: 'Location',
      enum: ['Location', 'Adventure', 'AdventureStop'],
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 280,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 90,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

auditLogSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  },
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
