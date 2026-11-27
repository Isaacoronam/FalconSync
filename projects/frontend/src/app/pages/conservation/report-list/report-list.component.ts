import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import {
  DAMAGE_CATEGORIES,
  DamageCategory,
  HeritageAsset,
  Report,
} from '../../../models/conservation.model';
import { FalconLocation } from '../../../models/location.model';
import { AuthService } from '../../../services/auth.service';
import { ConservationApiService } from '../../../services/conservation-api.service';
import { LocationApiService } from '../../../services/location-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import {
  DAMAGE_CATEGORY_LABELS,
  REPORT_STATE_LABELS,
} from '../../../services/utils/conservation-labels';

@Component({
  selector: 'app-report-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, PageSkeletonComponent],
  templateUrl: './report-list.component.html',
  styleUrl: './report-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportListComponent implements OnInit {
  private readonly conservationApi = inject(ConservationApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly auth = inject(AuthService);
  protected readonly categories = DAMAGE_CATEGORIES;
  protected readonly categoryLabels = DAMAGE_CATEGORY_LABELS;
  protected readonly stateLabels = REPORT_STATE_LABELS;

  protected readonly reports = signal<Report[]>([]);
  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly assets = signal<HeritageAsset[]>([]);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly page = signal(1);

  protected readonly form = this.formBuilder.group({
    targetType: ['location'],
    locationId: [''],
    assetId: [''],
    category: ['cracks' as DamageCategory],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    capturedAt: [''],
    latitude: [''],
    longitude: [''],
    accuracyMeters: [''],
  });

  ngOnInit(): void {
    this.loadReports(1);
    this.loadOptions();
  }

  protected loadReports(page: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.conservationApi
      .listMyReports(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.reports.update((current) =>
            page === 1 ? response.data : [...current, ...response.data],
          );
          this.page.set(response.meta.page);
          this.hasMore.set(response.meta.hasMore);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error, 'No se pudieron cargar tus reportes.'));
          this.loading.set(false);
        },
      });
  }

  protected submit(): void {
    const values = this.form.getRawValue();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Completa la categoría y una descripción de al menos 10 caracteres.');
      return;
    }

    if (values.targetType === 'location' && !values.locationId) {
      this.formError.set('Selecciona el punto de interés sobre el que reportas.');
      return;
    }

    if (values.targetType === 'asset' && !values.assetId) {
      this.formError.set('Selecciona el activo patrimonial sobre el que reportas.');
      return;
    }

    if (Boolean(values.latitude) !== Boolean(values.longitude)) {
      this.formError.set('Envía latitud y longitud juntas o deja ambas vacías.');
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    const latitude = values.latitude ? Number(values.latitude) : undefined;
    const longitude = values.longitude ? Number(values.longitude) : undefined;

    this.conservationApi
      .createReport({
        locationId: values.targetType === 'location' ? values.locationId : undefined,
        heritageAssetId: values.targetType === 'asset' ? values.assetId : undefined,
        category: values.category,
        description: values.description.trim(),
        capturedAt: values.capturedAt ? new Date(values.capturedAt).toISOString() : undefined,
        gps:
          latitude !== undefined && longitude !== undefined
            ? { type: 'Point', coordinates: [longitude, latitude] }
            : undefined,
        accuracyMeters: values.accuracyMeters ? Number(values.accuracyMeters) : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          void this.router.navigate(['/reportes', response.data.id]);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.formError.set(apiErrorMessage(error, 'No se pudo crear el reporte.'));
        },
      });
  }

  protected stateClass(state: string): string {
    return `conservation-badge conservation-badge--${state}`;
  }

  protected targetLabel(report: Report): string {
    if (report.heritageAssetId) {
      const asset = this.assets().find((item) => item.id === report.heritageAssetId);
      return asset?.name ?? 'Activo patrimonial';
    }

    const location = this.locations().find((item) => item.id === report.locationId);
    return location?.title ?? 'Punto de interés';
  }

  private loadOptions(): void {
    this.locationApi
      .list({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.locations.set(response.data),
        error: () => this.locations.set([]),
      });

    this.conservationApi
      .listAssets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.assets.set(response.data),
        error: () => this.assets.set([]),
      });
  }
}
