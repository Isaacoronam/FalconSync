import mongoose from 'mongoose';

export const DOMAIN_AGGREGATE_TYPES = [
  'Report',
  'Inspection',
  'Intervention',
  'HeritageAsset',
];

const domainEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    aggregateType: { type: String, enum: DOMAIN_AGGREGATE_TYPES, required: true },
    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    eventType: { type: String, required: true, maxlength: 100 },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    occurredAt: { type: Date, required: true, default: Date.now },
    fromState: { type: String, maxlength: 40 },
    toState: { type: String, maxlength: 40 },
    reason: { type: String, maxlength: 500 },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    correlationId: { type: String, maxlength: 100 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

domainEventSchema.index({ aggregateType: 1, aggregateId: 1, occurredAt: 1 });

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  domainEventSchema.pre(operation, function immutableDomainEvent() {
    throw new Error('DomainEvent is append-only');
  });
}

domainEventSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.__v;
    return returned;
  },
});

const DomainEvent = mongoose.model('DomainEvent', domainEventSchema);

export default DomainEvent;
