import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminSummary } from '../../../core/models/admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { AUDIT_ACTION_LABELS } from '../../../core/utils/location-labels';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly auth = inject(AuthService);
  protected readonly summary = signal<AdminSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.summary.set(response.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            apiErrorMessage(error, 'No se pudieron cargar las métricas del panel.'),
          );
          this.loading.set(false);
        },
      });
  }

  protected generatedAt(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected chartDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  }

  protected chartDay(value: string): string {
    return value.slice(8, 10);
  }

  protected barHeight(visits: number, data: AdminSummary): number {
    const peak = Math.max(...data.tourism.visitsByDay.map((day) => day.visits), 1);
    return visits === 0 ? 2 : Math.max((visits / peak) * 100, 8);
  }

  protected chartLabel(data: AdminSummary): string {
    return `Visitas diarias durante los últimos 30 días. ${data.tourism.checkInsLast30Days} visitas en total.`;
  }

  protected actionLabel(action: string): string {
    return AUDIT_ACTION_LABELS[action] ?? action;
  }
}
