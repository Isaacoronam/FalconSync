import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdventureApiService } from '../../../../core/services/adventure-api.service';
import { Adventure, AdminAdventuresResponse, AdventureStatus, statusLabel } from '../../../../core/models/adventure.model';
import { apiErrorMessage } from '../../../../core/utils/api-error';

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicada' },
  { value: 'archived', label: 'Archivada' },
];

@Component({
  selector: 'app-admin-aventura-list',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-aventura-list.component.html',
  styleUrl: './admin-aventura-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAventuraListComponent implements OnInit {
  private readonly adventuresApi = inject(AdventureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly statuses = STATUS_OPTIONS;
  protected readonly statusLabel = statusLabel;
  protected readonly filters = this.formBuilder.group({
    q: [''],
    status: ['all'],
  });

  protected readonly adventures = signal<Adventure[]>([]);
  protected readonly meta = signal<ListMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page = this.meta().page): void {
    const values = this.filters.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    this.adventuresApi
      .listAdmin({
        q: values.q.trim(),
        status: values.status as AdventureStatus | 'all',
        page,
        limit: 20,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: AdminAdventuresResponse) => {
          this.adventures.set(response.data);
          this.meta.set(response.meta);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.adventures.set([]);
          this.error.set(apiErrorMessage(error, 'No se pudieron cargar las aventuras.'));
          this.loading.set(false);
        },
      });
  }

  protected applyFilters(): void {
    this.notice.set(null);
    this.load(1);
  }

  protected clearFilters(): void {
    this.filters.reset({ q: '', status: 'all' });
    this.notice.set(null);
    this.load(1);
  }

  protected publish(adventure: { id: string; title: string; status: string }): void {
    this.busy.set(adventure.id);
    this.error.set(null);

    this.adventuresApi
      .publishAdmin(adventure.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set(`«${adventure.title}» se publicó.`);
          this.load(this.meta().page);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.error.set(apiErrorMessage(error, 'No se pudo publicar la aventura.'));
        },
      });
  }

  protected archive(adventure: { id: string; title: string; status: string }): void {
    this.busy.set(adventure.id);
    this.error.set(null);

    this.adventuresApi
      .archiveAdmin(adventure.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set(`«${adventure.title}» se archivó.`);
          this.load(this.meta().page);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.error.set(apiErrorMessage(error, 'No se pudo archivar la aventura.'));
        },
      });
  }

  protected restore(adventure: { id: string; title: string; status: string }): void {
    this.busy.set(adventure.id);
    this.error.set(null);

    this.adventuresApi
      .restoreAdmin(adventure.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set(`«${adventure.title}» se restauró como borrador.`);
          this.load(this.meta().page);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.error.set(apiErrorMessage(error, 'No se pudo restaurar la aventura.'));
        },
      });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
