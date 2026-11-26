import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FalconLocation } from '../../../models/location.model';
import { PanoramaSummary } from '../../../models/panorama.model';
import { LocationApiService } from '../../../services/location-api.service';
import { PanoramaApiService } from '../../../services/panorama-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import {
  CONSERVATION_LABELS,
  LOCATION_CATEGORY_LABELS,
  LOCATION_TAG_LABELS,
} from '../../../services/utils/location-labels';
import { formatPanoramaDate } from '../../../services/utils/panorama-labels';

@Component({
  selector: 'app-lugar-detail',
  imports: [RouterLink],
  templateUrl: './lugar-detail.component.html',
  styleUrl: './lugar-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LugarDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly locationsApi = inject(LocationApiService);
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly location = signal<FalconLocation | null>(null);
  protected readonly panoramas = signal<PanoramaSummary[]>([]);
  protected readonly panoramasLoading = signal(false);
  protected readonly panoramasError = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly categoryLabels = LOCATION_CATEGORY_LABELS;
  protected readonly tagLabels = LOCATION_TAG_LABELS;
  protected readonly conservationLabels = CONSERVATION_LABELS;
  protected readonly formatPanoramaDate = formatPanoramaDate;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.error.set('No se indicó el lugar que quieres consultar.');
      this.loading.set(false);
      return;
    }

    this.locationsApi
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.location.set(data);
          this.loading.set(false);
          this.loadPanoramas(data.id);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error, 'No se pudo cargar este punto de interés.'));
          this.loading.set(false);
        },
      });
  }

  protected locationLabel(location: FalconLocation): string {
    return this.categoryLabels[location.category];
  }

  protected coverCredit(location: FalconLocation) {
    return location.imageCredits?.find((credit) => credit.url === location.images[0]);
  }

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  private loadPanoramas(locationId: string): void {
    this.panoramasLoading.set(true);
    this.panoramasError.set(null);

    this.panoramaApi
      .list({ locationId, limit: 12 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.panoramas.set(data);
          this.panoramasLoading.set(false);
        },
        error: (error: unknown) => {
          this.panoramas.set([]);
          this.panoramasError.set(
            apiErrorMessage(
              error,
              'No se pudieron consultar las visitas 360° de este lugar.',
            ),
          );
          this.panoramasLoading.set(false);
        },
      });
  }
}
