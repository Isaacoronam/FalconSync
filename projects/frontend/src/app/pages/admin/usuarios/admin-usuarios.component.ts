import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Observable } from 'rxjs';
import {
  AdminUser,
  AssignableUserRole,
} from '../../../models/admin.model';
import { UserRole } from '../../../models/auth.model';
import { AdminApiService } from '../../../services/admin-api.service';
import { AuthService } from '../../../services/auth.service';
import { apiErrorMessage } from '../../../services/utils/api-error';

type AccountAction = 'role' | 'status' | 'revoke';

@Component({
  selector: 'app-admin-usuarios',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsuariosComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly accountDialog =
    viewChild<ElementRef<HTMLDialogElement>>('accountDialog');
  private readonly accountPasswordInput =
    viewChild<ElementRef<HTMLInputElement>>('accountPassword');

  protected readonly filters = this.formBuilder.group({
    q: [''],
    role: ['all'],
    active: ['all'],
  });
  protected readonly accountForm = this.formBuilder.group({
    role: this.formBuilder.control<UserRole>('user'),
    currentPassword: [
      '',
      [Validators.required, Validators.maxLength(128)],
    ],
  });
  protected readonly assignableRoles: AssignableUserRole[] = [
    'user',
    'historian',
    'inspector',
    'admin',
  ];
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly meta = signal({ page: 1, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly selectedUser = signal<AdminUser | null>(null);
  protected readonly accountAction = signal<AccountAction | null>(null);
  protected readonly accountError = signal<string | null>(null);
  protected readonly accountBusy = signal(false);

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page = this.meta().page): void {
    const values = this.filters.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    this.adminApi
      .listUsers({
        q: values.q.trim(),
        role: values.role as AdminUser['role'] | 'all',
        active: values.active as 'true' | 'false' | 'all',
        page,
        limit: 20,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.data);
          this.meta.set({
            page: response.meta.page,
            total: response.meta.total,
            totalPages: response.meta.totalPages,
          });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.users.set([]);
          this.error.set(
            apiErrorMessage(error, 'No se pudieron cargar los usuarios.'),
          );
          this.loading.set(false);
        },
      });
  }

  protected clearFilters(): void {
    this.filters.reset({ q: '', role: 'all', active: 'all' });
    this.notice.set(null);
    this.load(1);
  }

  protected openAccountDialog(
    user: AdminUser,
    action: AccountAction,
  ): void {
    this.selectedUser.set(user);
    this.accountAction.set(action);
    this.accountForm.reset({
      role: user.role,
      currentPassword: '',
    });
    this.accountError.set(null);
    this.accountBusy.set(false);

    const dialog = this.accountDialog()?.nativeElement;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    setTimeout(() => this.accountPasswordInput()?.nativeElement.focus(), 0);
  }

  protected closeAccountDialog(): void {
    this.accountDialog()?.nativeElement.close();
  }

  protected resetAccountDialog(): void {
    this.selectedUser.set(null);
    this.accountAction.set(null);
    this.accountError.set(null);
    this.accountBusy.set(false);
    this.accountForm.reset({ role: 'user', currentPassword: '' });
  }

  protected onDialogBackdropClick(event: MouseEvent): void {
    if (event.target === this.accountDialog()?.nativeElement) {
      this.closeAccountDialog();
    }
  }

  protected submitAccountAction(): void {
    const user = this.selectedUser();
    const action = this.accountAction();

    if (!user || !action) {
      return;
    }

    this.accountForm.markAllAsTouched();

    if (this.accountForm.controls.currentPassword.invalid) {
      return;
    }

    const currentPassword =
      this.accountForm.controls.currentPassword.value;
    const role = this.accountForm.controls.role.value;

    if (action === 'role' && role === 'moderator') {
      this.accountError.set(
        'Selecciona un rol distinto de Moderador (legacy).',
      );
      return;
    }

    this.accountBusy.set(true);
    this.accountError.set(null);

    const request$: Observable<unknown> =
      action === 'role'
        ? this.adminApi.updateUserRole(user.id, {
            role: role as AssignableUserRole,
            currentPassword,
          })
        : action === 'status'
          ? this.adminApi.updateUserStatus(user.id, {
              isActive: !user.isActive,
              currentPassword,
            })
          : this.adminApi.revokeUserSessions(user.id, {
              currentPassword,
            });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.accountBusy.set(false);
        this.closeAccountDialog();
        this.notice.set(this.successMessage(action, user));
        this.load(this.meta().page);
      },
      error: (error: unknown) => {
        this.accountBusy.set(false);
        this.accountError.set(
          apiErrorMessage(
            error,
            'No se pudo completar la acción. Inténtalo de nuevo.',
          ),
        );
      },
    });
  }

  protected accountTitle(): string {
    const user = this.selectedUser();
    const action = this.accountAction();

    if (!user || !action) {
      return 'Gestión de cuenta';
    }

    switch (action) {
      case 'role':
        return `Cambiar rol de ${user.name}`;
      case 'status':
        return user.isActive
          ? `Desactivar a ${user.name}`
          : `Activar a ${user.name}`;
      case 'revoke':
        return `Revocar sesiones de ${user.name}`;
    }
  }

  protected accountDescription(): string {
    const user = this.selectedUser();
    const action = this.accountAction();

    if (!user || !action) {
      return '';
    }

    switch (action) {
      case 'role':
        return `El cambio de rol de ${user.email} revoca sus sesiones y queda auditado. No puedes asignar Moderador (legacy).`;
      case 'status':
        return user.isActive
          ? `La cuenta de ${user.email} quedará desactivada y se revocarán sus sesiones. Podrás reactivarla después.`
          : `La cuenta de ${user.email} volverá a estar activa. El usuario deberá iniciar sesión de nuevo.`;
      case 'revoke':
        return `Se cerrarán todas las sesiones de ${user.email}. El rol y el estado de la cuenta no cambian.`;
    }
  }

  protected confirmLabel(): string {
    const user = this.selectedUser();

    switch (this.accountAction()) {
      case 'role':
        return 'Guardar rol';
      case 'status':
        return user?.isActive ? 'Desactivar cuenta' : 'Activar cuenta';
      case 'revoke':
        return 'Revocar sesiones';
      default:
        return 'Confirmar';
    }
  }

  protected isDangerAction(): boolean {
    const user = this.selectedUser();
    const action = this.accountAction();

    return (
      action === 'revoke' || (action === 'status' && user?.isActive === true)
    );
  }

  protected isSelf(user: AdminUser): boolean {
    return this.auth.currentUser()?.id === user.id;
  }

  protected roleLabel(role: AdminUser['role']): string {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'historian':
        return 'Historiador';
      case 'inspector':
        return 'Inspector';
      case 'moderator':
        return 'Moderador (legacy)';
      default:
        return 'Turista';
    }
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return 'Nunca';
    }

    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private successMessage(action: AccountAction, user: AdminUser): string {
    switch (action) {
      case 'role':
        return `Rol de ${user.name} actualizado. Se revocaron sus sesiones.`;
      case 'status':
        return user.isActive
          ? `Cuenta de ${user.name} desactivada. Sus sesiones fueron revocadas.`
          : `Cuenta de ${user.name} activada.`;
      case 'revoke':
        return `Sesiones de ${user.name} revocadas.`;
    }
  }
}
