import mongoose from 'mongoose';

export const USER_ROLES = ['user', 'moderator', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
      maxlength: [80, 'El nombre no puede superar 80 caracteres'],
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres'],
      maxlength: [30, 'El nombre de usuario no puede superar 30 caracteres'],
      match: [
        /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/,
        'El nombre de usuario solo admite minúsculas, números, puntos, guiones y guiones bajos',
      ],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [280, 'La biografía no puede superar 280 caracteres'],
      default: '',
    },
    avatarFilename: {
      type: String,
      select: false,
    },
    avatarMimeType: {
      type: String,
      select: false,
    },
    avatarSize: {
      type: Number,
      min: 0,
      select: false,
    },
    avatarUpdatedAt: {
      type: Date,
      select: false,
    },
    email: {
      type: String,
      required: [true, 'El correo es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'El correo no puede superar 254 caracteres'],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'El correo electrónico no tiene un formato válido',
      ],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: 'Rol no válido',
      },
      default: 'user',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.set('toJSON', {
  transform: (_document, returned) => {
    returned.id = returned._id.toString();
    delete returned._id;
    delete returned.passwordHash;
    delete returned.tokenVersion;
    return returned;
  },
});

const User = mongoose.model('User', userSchema);

export default User;
