import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { passwordsMatchValidator } from '../../../core/validators/password-match.validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?=.*\d).+$/;

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordComponent {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly completed = signal(false);
  protected readonly form = this.formBuilder.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: [
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
    { validators: passwordsMatchValidator('newPassword', 'confirmPassword') },
  );

  private readonly requestedReturnUrl = this.safeReturnUrl();
  protected readonly targetUrl = computed(
    () => this.requestedReturnUrl ?? (this.auth.isAdmin() ? '/admin' : '/'),
  );

  protected currentPasswordError(): string | null {
    const control = this.form.controls.currentPassword;

    return control.touched && control.invalid ? 'La contraseña actual es obligatoria.' : null;
  }

  protected newPasswordError(): string | null {
    const control = this.form.controls.newPassword;

    if (!control.touched || control.valid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'La nueva contraseña es obligatoria.';
    }

    if (control.hasError('minlength')) {
      return 'La nueva contraseña debe tener al menos 10 caracteres.';
    }

    if (control.hasError('maxlength')) {
      return 'La nueva contraseña no puede superar 128 caracteres.';
    }

    return 'Incluye al menos una letra y un número.';
  }

  protected confirmPasswordError(): string | null {
    const control = this.form.controls.confirmPassword;

    if (!control.touched || (control.valid && !this.form.hasError('passwordsMismatch'))) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Confirma la nueva contraseña.';
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

    const { currentPassword, newPassword } = this.form.getRawValue();

    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.completed.set(true);
      },
      error: (error: unknown) => {
        this.error.set(
          apiErrorMessage(error, 'No se pudo cambiar la contraseña. Inténtalo de nuevo.'),
        );
        this.submitting.set(false);
      },
    });
  }

  private safeReturnUrl(): string | null {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');

    return requested?.startsWith('/') && !requested.startsWith('//') ? requested : null;
  }
}
