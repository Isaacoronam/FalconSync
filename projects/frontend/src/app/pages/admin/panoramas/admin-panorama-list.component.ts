import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import {
  AdminPanoramaSummary,
  PanoramaStatus,
  PanoramaVisibility,
} from '../../../models/panorama.model';
import { PanoramaApiService } from '../../../services/panorama-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import {
  PANORAMA_STATUS_LABELS,
  PANORAMA_VISIBILITY_LABELS,
  formatPanoramaDate,
  panoramaStatusBadgeClass,
  panoramaVisibilityBadgeClass,
} from '../../../services/utils/panorama-labels';

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Component({
  selector: 'app-admin-panorama-list',
  imports: [ReactiveFormsModule, RouterLink, PageSkeletonComponent],
  templateUrl: './admin-panorama-list.component.html',
  styleUrl: './admin-panorama-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPanoramaListComponent implements OnInit {
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly mode: 'manage' | 'curate' =
    this.route.snapshot.data['mode'] === 'curate' ? 'curate' : 'manage';
  protected readonly statusLabels = PANORAMA_STATUS_LABELS;
  protected readonly visibilityLabels = PANORAMA_VISIBILITY_LABELS;
  protected readonly formatDate = formatPanoramaDate;
  protected readonly statusBadgeClass = panoramaStatusBadgeClass;
  protected readonly visibilityBadgeClass = panoramaVisibilityBadgeClass;
  protected readonly statusOptions: Array<{ value: PanoramaStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'draft', label: PANORAMA_STATUS_LABELS.draft },
    { value: 'approved', label: PANORAMA_STATUS_LABELS.approved },
    { value: 'published', label: PANORAMA_STATUS_LABELS.published },
    { value: 'archived', label: PANORAMA_STATUS_LABELS.archived },
  ];
  protected readonly visibilityOptions: Array<{
    value: PanoramaVisibility | 'all';
    label: string;
  }> = [
    { value: 'all', label: 'Todas las visibilidades' },
    { value: 'public', label: PANORAMA_VISIBILITY_LABELS.public },
    { value: 'inspection', label: PANORAMA_VISIBILITY_LABELS.inspection },
  ];

  protected readonly filters = this.formBuilder.group({
    q: [''],
    status: ['all' as PanoramaStatus | 'all'],
    visibility: ['all' as PanoramaVisibility | 'all'],
  });
  protected readonly panoramas = signal<AdminPanoramaSummary[]>([]);
  protected readonly meta = signal<ListMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    const notice = this.route.snapshot.queryParamMap.get('aviso');

    if (notice) {
      this.notice.set(notice);
    }

    this.load(1);
  }

  protected isCurate(): boolean {
    return this.mode === 'curate';
  }

  protected baseLink(): string {
    return this.isCurate() ? '/curaduria/panoramas' : '/admin/panoramas';
  }

  protected applyFilters(): void {
    this.load(1);
  }

  protected clearFilters(): void {
    this.filters.reset({ q: '', status: 'all', visibility: 'all' });
    this.load(1);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.meta().totalPages || page === this.meta().page) {
      return;
    }

    this.load(page);
  }

  private load(page: number): void {
    const { q, status, visibility } = this.filters.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    this.panoramaApi
      .listAdmin({
        q: q.trim() || undefined,
        status,
        visibility,
        page,
        limit: this.meta().limit,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, meta }) => {
          this.panoramas.set(data);
          this.meta.set(meta);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            apiErrorMessage(error, 'No se pudieron cargar los panoramas. Vuelve a intentarlo.'),
          );
          this.loading.set(false);
        },
      });
  }
}
