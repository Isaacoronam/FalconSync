import User from '../models/User.js';
import { hashPassword } from './authService.js';
import { generateUniqueUsername } from './usernameService.js';
import { HttpError } from '../utils/HttpError.js';
import {
  normalizeEmail,
  validateEmail,
  validateName,
  validatePassword,
} from '../utils/validation.js';

export async function ensureAdmin({ email, password, name }) {
  const normalizedEmail = normalizeEmail(email);
  const issues = [
    ...validateName(name),
    ...validateEmail(normalizedEmail),
    ...validatePassword(password, { minimumLength: 12 }),
  ];

  if (issues.length > 0) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Los datos del administrador no son válidos',
      issues,
    );
  }

  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    let updated = false;

    if (existing.role !== 'admin') {
      existing.role = 'admin';
      updated = true;
    }

    if (!existing.isActive) {
      existing.isActive = true;
      updated = true;
    }

    if (!existing.username) {
      existing.username = await generateUniqueUsername({
        name: existing.name,
        email: normalizedEmail,
        excludeUserId: existing._id,
      });
      updated = true;
    }

    if (updated) {
      await existing.save();
    }

    return { user: existing, created: false, updated };
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    username: await generateUniqueUsername({
      name: name.trim(),
      email: normalizedEmail,
    }),
    passwordHash: await hashPassword(password),
    role: 'admin',
    mustChangePassword: true,
  });

  return { user, created: true, updated: false };
}
