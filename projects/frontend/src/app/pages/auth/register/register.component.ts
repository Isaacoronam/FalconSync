import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthBrandComponent } from '../../../components/auth-brand/auth-brand.component';
import { AuthService } from '../../../services/auth.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import { passwordsMatchValidator } from '../../../services/validators/password-match.validator';
import {
  PERSON_NAME_MAX_LENGTH,
  normalizePersonName,
  personNameValidator,
} from '../../../services/validators/person-name.validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?=.*\d).+$/;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthBrandComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly maxNameLength = PERSON_NAME_MAX_LENGTH;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly form = this.formBuilder.group(
    {
      name: ['', [Validators.required, personNameValidator()]],
      surname: ['', [Validators.required, personNameValidator()]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(128),
          Validators.pattern(PASSWORD_PATTERN),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator() },
  );

  protected nameError(): string | null {
    return this.personNameError('name', 'El nombre');
  }

  protected surnameError(): string | null {
    return this.personNameError('surname', 'El apellido');
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;

    if (!control.touched || control.valid) {
      return null;
    }

    return control.hasError('required')
      ? 'El correo es obligatorio.'
      : 'Introduce un correo electrónico válido.';
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;

    if (!control.touched || control.valid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'La contraseña es obligatoria.';
    }

    if (control.hasError('minlength')) {
      return 'La contraseña debe tener al menos 10 caracteres.';
    }

    if (control.hasError('maxlength')) {
      return 'La contraseña no puede superar 128 caracteres.';
    }

    return 'Incluye al menos una letra y un número.';
  }

  protected hasPasswordLength(): boolean {
    return this.form.controls.password.value.length >= 10;
  }

  protected hasPasswordLetter(): boolean {
    return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(this.form.controls.password.value);
  }

  protected hasPasswordDigit(): boolean {
    return /\d/.test(this.form.controls.password.value);
  }

  protected confirmPasswordError(): string | null {
    const control = this.form.controls.confirmPassword;

    if (!control.touched || (control.valid && !this.form.hasError('passwordsMismatch'))) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Confirma tu contraseña.';
    }

    return 'Las contraseñas no coinciden.';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const { name, surname, email, password } = this.form.getRawValue();

    this.auth
      .register({
        name: normalizePersonName(name),
        surname: normalizePersonName(surname),
        email,
        password,
      })
      .subscribe({
        next: () => void this.router.navigateByUrl('/'),
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error, 'No se pudo crear la cuenta. Inténtalo de nuevo.'));
          this.submitting.set(false);
        },
      });
  }

  private personNameError(controlName: 'name' | 'surname', label: string): string | null {
    const control = this.form.controls[controlName];

    if (!control.touched || control.valid) {
      return null;
    }

    if (control.hasError('required')) {
      return `${label} es obligatorio.`;
    }

    if (control.hasError('personNameMin')) {
      return `${label} debe tener al menos 2 letras.`;
    }

    if (control.hasError('personNameMax')) {
      return `${label} no puede superar ${PERSON_NAME_MAX_LENGTH} caracteres.`;
    }

    return `${label} solo puede contener letras, espacios, guiones y apóstrofes.`;
  }
}
