import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminLocation } from '../../../core/models/admin.model';
import {
  LocationCategory,
  LocationCircuit,
  LocationStatus,
  LocationTag,
} from '../../../core/models/location.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import {
  LOCATION_CATEGORY_FILTER_OPTIONS,
  LOCATION_CATEGORY_LABELS,
  LOCATION_CIRCUIT_FILTER_OPTIONS,
  LOCATION_STATUS_LABELS,
  LOCATION_TAG_FILTER_OPTIONS,
} from '../../../core/utils/location-labels';

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS: Array<{ value: LocationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'published', label: 'Publicados' },
  { value: 'draft', label: 'Borradores' },
  { value: 'archived', label: 'Archivados' },
];

@Component({
  selector: 'app-admin-poi-list',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-poi-list.component.html',
  styleUrl: './admin-poi-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPoiListComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly statuses = STATUS_OPTIONS;
  protected readonly categories = LOCATION_CATEGORY_FILTER_OPTIONS;
  protected readonly circuits = LOCATION_CIRCUIT_FILTER_OPTIONS;
  protected readonly tags = LOCATION_TAG_FILTER_OPTIONS;
  protected readonly filters = this.formBuilder.group({
    q: [''],
    status: ['all'],
    category: ['all'],
    circuit: ['all'],
    tag: ['all'],
  });

  protected readonly locations = signal<AdminLocation[]>([]);
  protected readonly meta = signal<ListMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly pendingArchive = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page = this.meta().page): void {
    const values = this.filters.getRawValue();

    this.loading.set(true);
    this.error.set(null);
    this.pendingArchive.set(null);

    this.adminApi
      .listLocations({
        q: values.q.trim(),
        status: values.status as LocationStatus | 'all',
        category: values.category as LocationCategory | 'all',
        circuit: values.circuit as LocationCircuit | 'all',
        tag: values.tag as LocationTag | 'all',
        page,
        limit: 20,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.data.length === 0 && response.meta.total > 0 && page > 1) {
            this.load(page - 1);
            return;
          }

          this.locations.set(response.data);
          this.meta.set(response.meta);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.locations.set([]);
          this.error.set(apiErrorMessage(error, 'No se pudieron cargar los puntos de interés.'));
          this.loading.set(false);
        },
      });
  }

  protected applyFilters(): void {
    this.notice.set(null);
    this.load(1);
  }

  protected clearFilters(): void {
    this.filters.reset({
      q: '',
      status: 'all',
      category: 'all',
      circuit: 'all',
      tag: 'all',
    });
    this.notice.set(null);
    this.load(1);
  }

  protected requestArchive(location: AdminLocation): void {
    this.pendingArchive.set(location.id);
  }

  protected cancelArchive(): void {
    this.pendingArchive.set(null);
  }

  protected archive(location: AdminLocation): void {
    this.busy.set(location.id);
    this.error.set(null);

    this.adminApi
      .archiveLocation(location.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingArchive.set(null);
          this.busy.set(null);
          this.notice.set(`«${location.title}» se archivó. Puedes restaurarlo desde el filtro Archivados.`);
          this.load(this.meta().page);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.error.set(apiErrorMessage(error, 'No se pudo archivar el punto de interés.'));
        },
      });
  }

  protected restore(location: AdminLocation): void {
    this.busy.set(location.id);
    this.error.set(null);

    this.adminApi
      .restoreLocation(location.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set(`«${location.title}» se restauró como borrador.`);
          this.load(this.meta().page);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.error.set(apiErrorMessage(error, 'No se pudo restaurar el punto de interés.'));
        },
      });
  }

  protected categoryLabel(category: LocationCategory): string {
    return LOCATION_CATEGORY_LABELS[category];
  }

  protected statusLabel(status: LocationStatus): string {
    return LOCATION_STATUS_LABELS[status];
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
