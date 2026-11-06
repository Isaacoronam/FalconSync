import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
    },
  });
}

export const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Demasiados registros desde esta dirección. Intenta más tarde.',
});

export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Demasiados intentos de acceso. Espera 15 minutos.',
});

export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: 'Demasiadas renovaciones de sesión. Espera unos minutos.',
});

export const passwordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Demasiados cambios de contraseña. Espera 15 minutos.',
});

export const checkInLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Demasiados intentos de check-in. Espera 15 minutos.',
});
