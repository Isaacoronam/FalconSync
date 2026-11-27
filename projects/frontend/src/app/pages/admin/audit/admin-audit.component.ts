import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import { AuditEntry } from '../../../models/admin.model';
import { AdminApiService } from '../../../services/admin-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import { AUDIT_ACTION_LABELS } from '../../../services/utils/location-labels';

@Component({
  selector: 'app-admin-audit',
  imports: [PageSkeletonComponent],
  templateUrl: './admin-audit.component.html',
  styleUrl: './admin-audit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly meta = signal({ page: 1, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page = this.meta().page): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi
      .listAudit(page, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.entries.set(response.data);
          this.meta.set({
            page: response.meta.page,
            total: response.meta.total,
            totalPages: response.meta.totalPages,
          });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.entries.set([]);
          this.error.set(apiErrorMessage(error, 'No se pudo cargar la auditoría.'));
          this.loading.set(false);
        },
      });
  }

  protected actionLabel(action: string): string {
    return AUDIT_ACTION_LABELS[action] ?? action;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value));
  }
}
