const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
