import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const CHECK_IN_TOKEN_BYTES = 32;

const CHECK_IN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Genera un token opaco de 32 bytes en base64url.
 * El valor en claro solo se devuelve en la respuesta de rotación y nunca se persiste.
 */
export function createCheckInToken() {
  return randomBytes(CHECK_IN_TOKEN_BYTES).toString('base64url');
}

export function hashCheckInToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Compara en tiempo constante el hash SHA-256 del token recibido con el hash
 * almacenado. El formato se valida antes para evitar comparar longitudes distintas.
 */
export function verifyCheckInToken(token, expectedHash) {
  if (
    typeof token !== 'string' ||
    !CHECK_IN_TOKEN_PATTERN.test(token) ||
    typeof expectedHash !== 'string' ||
    !SHA256_HEX_PATTERN.test(expectedHash)
  ) {
    return false;
  }

  const actual = Buffer.from(hashCheckInToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
