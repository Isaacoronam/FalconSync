import { FormControl } from '@angular/forms';
import { normalizePersonName, personNameValidator } from './person-name.validator';

function validate(value: string) {
  return personNameValidator()(new FormControl(value));
}

describe('personNameValidator', () => {
  it('acepta letras, acentos, espacios internos, guiones y apóstrofes', () => {
    for (const value of ['Ana', 'María José', 'Pérez-Jiménez', "O'Brien", 'Ñandú']) {
      expect(validate(value), value).toBeNull();
    }
  });

  it('rechaza números y símbolos', () => {
    for (const value of ['Ana2', 'Pérez!', 'Ana@', 'Ana_', '123']) {
      expect(validate(value)?.['personNamePattern'], value).toBe(true);
    }
  });

  it('rechaza menos de 2 letras y más de 16 caracteres', () => {
    expect(validate('A')?.['personNameMin']).toBe(true);
    expect(validate('a'.repeat(17))?.['personNameMax']).toEqual({ maxLength: 16 });
  });

  it('ignora el vacío para que required conserve el mensaje principal', () => {
    expect(validate('')).toBeNull();
    expect(validate('   ')).toBeNull();
  });

  it('normaliza espacios y forma Unicode', () => {
    expect(normalizePersonName('  María   José  ')).toBe('María José');
    expect(normalizePersonName('Pe\u0301rez')).toBe('Pérez');
  });
});
