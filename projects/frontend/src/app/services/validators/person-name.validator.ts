import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const PERSON_NAME_MAX_LENGTH = 16;
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;

export function normalizePersonName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function personNameValidator(maxLength = PERSON_NAME_MAX_LENGTH): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;

    if (typeof raw !== 'string' || !raw.trim()) {
      return null;
    }

    const value = normalizePersonName(raw);

    if (value.length < 2) {
      return { personNameMin: true };
    }

    if (value.length > maxLength) {
      return { personNameMax: { maxLength } };
    }

    if (!PERSON_NAME_PATTERN.test(value)) {
      return { personNamePattern: true };
    }

    return null;
  };
}
