import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminUser } from '../../../core/models/admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

@Component({
  selector: 'app-admin-usuarios',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsuariosComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly filters = this.formBuilder.group({
    q: [''],
    role: ['all'],
    active: ['all'],
  });
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly meta = signal({ page: 1, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

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
          this.error.set(apiErrorMessage(error, 'No se pudieron cargar los usuarios.'));
          this.loading.set(false);
        },
      });
  }

  protected clearFilters(): void {
    this.filters.reset({ q: '', role: 'all', active: 'all' });
    this.load(1);
  }

  protected roleLabel(role: AdminUser['role']): string {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'moderator':
        return 'Moderador';
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
}
