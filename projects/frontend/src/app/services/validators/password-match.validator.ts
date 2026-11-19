import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordsMatchValidator(
  passwordKey = 'password',
  confirmKey = 'confirmPassword',
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordKey)?.value;
    const confirmation = control.get(confirmKey)?.value;

    if (!password || !confirmation) {
      return null;
    }

    return password === confirmation ? null : { passwordsMismatch: true };
  };
}
