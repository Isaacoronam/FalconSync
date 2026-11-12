import User from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';
import { verifyAccessToken } from '../services/authService.js';

export async function authenticate(request, _response, next) {
  const header = request.get('authorization');

  if (!header?.startsWith('Bearer ')) {
    return next(
      new HttpError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Debes iniciar sesión para continuar',
      ),
    );
  }

  const payload = verifyAccessToken(header.slice(7).trim());
  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    return next(
      new HttpError(
        401,
        'ACCOUNT_UNAVAILABLE',
        'La cuenta no existe o está desactivada',
      ),
    );
  }

  if (user.tokenVersion !== payload.ver) {
    return next(
      new HttpError(
        401,
        'SESSION_REVOKED',
        'La sesión fue revocada. Inicia sesión de nuevo',
      ),
    );
  }

  request.user = user;
  request.auth = { role: payload.role };
  next();
}

export function requireRole(...roles) {
  return (request, _response, next) => {
    if (!request.user) {
      return next(
        new HttpError(
          401,
          'AUTHENTICATION_REQUIRED',
          'Debes iniciar sesión para continuar',
        ),
      );
    }

    if (request.user.mustChangePassword) {
      return next(
        new HttpError(
          403,
          'PASSWORD_CHANGE_REQUIRED',
          'Debes cambiar la contraseña antes de continuar',
        ),
      );
    }

    if (!roles.includes(request.user.role)) {
      return next(
        new HttpError(
          403,
          'FORBIDDEN',
          'No tienes permisos para realizar esta acción',
        ),
      );
    }

    next();
  };
}
