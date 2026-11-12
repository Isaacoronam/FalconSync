import User from '../models/User.js';
import { usernameFromIdentity } from '../utils/validation.js';

/**
 * Genera un nombre de usuario legible y único a partir del nombre o el correo.
 * No se usa como identificador público: el perfil solo lo consulta su dueño.
 */
export async function generateUniqueUsername({ name, email, excludeUserId } = {}) {
  const base = usernameFromIdentity({ name, email });
  let candidate = base;
  let suffix = 2;

  while (
    await User.exists({
      username: candidate,
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    })
  ) {
    candidate = `${base.slice(0, 25)}-${suffix}`;
    suffix += 1;

    if (suffix > 10000) {
      throw new Error('No se pudo generar un nombre de usuario único');
    }
  }

  return candidate;
}
