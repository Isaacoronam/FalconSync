import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { passwordsMatchValidator } from '../../../core/validators/password-match.validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?=.*\d).+$/;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
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
    const control = this.form.controls.name;

    if (!control.touched || control.valid) {
      return null;
    }

    return control.hasError('required')
      ? 'El nombre es obligatorio.'
      : 'El nombre debe tener entre 2 y 80 caracteres.';
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

    const { name, email, password } = this.form.getRawValue();

    this.auth.register({ name, email, password }).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error, 'No se pudo crear la cuenta. Inténtalo de nuevo.'));
        this.submitting.set(false);
      },
    });
  }
}
