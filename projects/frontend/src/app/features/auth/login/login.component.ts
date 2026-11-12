import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

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

    return 'La contraseña es obligatoria.';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        if (user.mustChangePassword) {
          const returnUrl = this.returnUrl();

          void this.router.navigate(
            ['/cambiar-contrasena'],
            returnUrl === '/' ? {} : { queryParams: { returnUrl } },
          );
          return;
        }

        void this.router.navigateByUrl(this.returnUrl());
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error, 'No se pudo iniciar sesión. Inténtalo de nuevo.'));
        this.submitting.set(false);
      },
    });
  }

  private returnUrl(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');

    return requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/';
  }
}
