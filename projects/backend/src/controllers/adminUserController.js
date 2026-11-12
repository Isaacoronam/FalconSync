import User, { USER_ROLES } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validationError(details) {
  return new HttpError(
    400,
    'VALIDATION_ERROR',
    'Los filtros enviados no son válidos',
    details,
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username ?? null,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

export async function listAdminUsers(request, response) {
  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const filter = {};
  const issues = [];

  if (request.query.q !== undefined) {
    if (typeof request.query.q !== 'string' || request.query.q.length > 100) {
      issues.push('q debe ser texto de hasta 100 caracteres');
    } else if (request.query.q.trim()) {
      const query = escapeRegex(request.query.q.trim());
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
      ];
    }
  }

  if (request.query.role !== undefined) {
    if (!USER_ROLES.includes(request.query.role)) {
      issues.push(`role debe ser uno de: ${USER_ROLES.join(', ')}`);
    } else {
      filter.role = request.query.role;
    }
  }

  if (request.query.active !== undefined) {
    if (!['true', 'false'].includes(request.query.active)) {
      issues.push('active solo admite true o false');
    } else {
      filter.isActive = request.query.active === 'true';
    }
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name username email role isActive createdAt lastLoginAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  response.json({
    data: users.map(serializeUser),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
