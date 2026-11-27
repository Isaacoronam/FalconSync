import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatchValidator } from './password-match.validator';

describe('passwordsMatchValidator', () => {
  it('acepta contraseñas iguales', () => {
    const form = new FormGroup(
      {
        password: new FormControl('UsuarioSegura123'),
        confirmPassword: new FormControl('UsuarioSegura123'),
      },
      { validators: passwordsMatchValidator() },
    );

    expect(form.valid).toBe(true);
  });

  it('rechaza contraseñas distintas', () => {
    const form = new FormGroup(
      {
        password: new FormControl('UsuarioSegura123'),
        confirmPassword: new FormControl('OtraClave456'),
      },
      { validators: passwordsMatchValidator() },
    );

    expect(form.hasError('passwordsMismatch')).toBe(true);
  });
});
