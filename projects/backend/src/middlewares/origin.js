import { config } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

/**
 * Refuerza la protección CSRF de los endpoints que usan la cookie de
 * renovación. SameSite=Strict ya bloquea el envío entre sitios; además se
 * valida el origen cuando el navegador lo envía.
 */
export function requireTrustedOrigin(request, _response, next) {
  const origin = request.get('origin');

  if (!origin || config.corsOrigins.includes(origin)) {
    return next();
  }

  next(
    new HttpError(
      403,
      'UNTRUSTED_ORIGIN',
      'El origen de la solicitud no está autorizado',
    ),
  );
}
