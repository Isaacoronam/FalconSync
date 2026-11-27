import mongoose from 'mongoose';

export const ACHIEVEMENT_TYPES = ['location', 'adventure'];

const userAchievementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es obligatorio'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ACHIEVEMENT_TYPES,
        message: 'El tipo de insignia no es válido',
      },
      required: [true, 'El tipo de insignia es obligatorio'],
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'El origen de la insignia es obligatorio'],
      index: true,
    },
    sourceSlug: {
      type: String,
      required: [true, 'El slug del origen es obligatorio'],
      trim: true,
      maxlength: [140, 'El slug del origen no puede superar 140 caracteres'],
    },
    name: {
      type: String,
      required: [true, 'El nombre de la insignia es obligatorio'],
      trim: true,
      maxlength: [140, 'El nombre de la insignia no puede superar 140 caracteres'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [
        280,
        'La descripción de la insignia no puede superar 280 caracteres',
      ],
      default: '',
    },
    image: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },
    awardedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sourceCheckIn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CheckIn',
      default: null,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: false },
    versionKey: false,
  },
);

userAchievementSchema.index(
  { user: 1, type: 1, sourceId: 1 },
  { unique: true },
);
userAchievementSchema.index({ user: 1, awardedAt: -1 });

userAchievementSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    returned.sourceId = returned.sourceId.toString();
    delete returned._id;
    delete returned.user;
    delete returned.sourceCheckIn;
    return returned;
  },
});

const UserAchievement = mongoose.model(
  'UserAchievement',
  userAchievementSchema,
);

export default UserAchievement;
