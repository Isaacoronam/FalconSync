const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;

export function normalizeUsername(value) {
  return typeof value === 'string'
    ? value.trim().replace(/^@+/, '').toLowerCase()
    : '';
}

export function usernameFromIdentity({ name, surname, email } = {}) {
  const fullName = [name, surname]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
  const source =
    fullName ||
    (typeof email === 'string' ? email.split('@')[0] : '');
  const base = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/[._-]{2,}/g, '.')
    .slice(0, 24)
    .replace(/[._-]+$/g, '');

  if (base.length >= 3) {
    return base;
  }

  return `${base ? `${base}.coro` : 'explorador'}`.slice(0, 24);
}

export function validateUsername(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return ['El nombre de usuario es obligatorio'];
  }

  const username = normalizeUsername(value);
  const issues = [];

  if (username.length < 3) {
    issues.push('El nombre de usuario debe tener al menos 3 caracteres');
  }

  if (username.length > 30) {
    issues.push('El nombre de usuario no puede superar 30 caracteres');
  }

  if (!USERNAME_PATTERN.test(username)) {
    issues.push(
      'El nombre de usuario solo admite minúsculas, números, puntos, guiones y guiones bajos; debe empezar y terminar con letra o número',
    );
  }

  return issues;
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateName(value) {
  if (typeof value !== 'string') {
    return ['El nombre es obligatorio'];
  }

  const name = value.trim();
  const issues = [];

  if (name.length < 2) {
    issues.push('El nombre debe tener al menos 2 caracteres');
  }

  if (name.length > 80) {
    issues.push('El nombre no puede superar 80 caracteres');
  }

  return issues;
}

export function normalizePersonName(value) {
  return typeof value === 'string'
    ? value.normalize('NFC').trim().replace(/\s+/g, ' ')
    : '';
}

export function validatePersonName(
  value,
  { field = 'El nombre', maxLength = 16 } = {},
) {
  if (typeof value !== 'string') {
    return [`${field} es obligatorio`];
  }

  const name = normalizePersonName(value);
  const issues = [];

  if (!name) {
    issues.push(`${field} es obligatorio`);
    return issues;
  }

  if (name.length < 2) {
    issues.push(`${field} debe tener al menos 2 letras`);
  }

  if (name.length > maxLength) {
    issues.push(`${field} no puede superar ${maxLength} caracteres`);
  }

  if (!PERSON_NAME_PATTERN.test(name)) {
    issues.push(
      `${field} solo puede contener letras, espacios, guiones y apóstrofes`,
    );
  }

  return issues;
}

export function validateEmail(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return ['El correo es obligatorio'];
  }

  const email = normalizeEmail(value);
  const issues = [];

  if (email.length > 254) {
    issues.push('El correo no puede superar 254 caracteres');
  }

  if (!EMAIL_PATTERN.test(email)) {
    issues.push('El correo electrónico no tiene un formato válido');
  }

  return issues;
}

export function validatePassword(value, { minimumLength = 10 } = {}) {
  if (typeof value !== 'string') {
    return ['La contraseña es obligatoria'];
  }

  const issues = [];

  if (value.length < minimumLength) {
    issues.push(`La contraseña debe tener al menos ${minimumLength} caracteres`);
  }

  if (value.length > 128) {
    issues.push('La contraseña no puede superar 128 caracteres');
  }

  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value)) {
    issues.push('La contraseña debe incluir al menos una letra');
  }

  if (!/\d/.test(value)) {
    issues.push('La contraseña debe incluir al menos un número');
  }

  return issues;
}
