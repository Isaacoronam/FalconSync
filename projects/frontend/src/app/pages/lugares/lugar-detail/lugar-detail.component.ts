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
import { DOCUMENT } from '@angular/common';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import { FalconLocation, ImageCredit } from '../../../models/location.model';
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
  imports: [RouterLink, PageSkeletonComponent],
  templateUrl: './lugar-detail.component.html',
  styleUrl: './lugar-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LugarDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly locationsApi = inject(LocationApiService);
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly location = signal<FalconLocation | null>(null);
  protected readonly panoramas = signal<PanoramaSummary[]>([]);
  protected readonly panoramasLoading = signal(false);
  protected readonly panoramasError = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly shareStatus = signal<string | null>(null);
  protected readonly shareError = signal<string | null>(null);
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

  protected coverCredit(location: FalconLocation): ImageCredit | undefined {
    return location.imageCredits?.find((credit) => credit.url === location.images[0]);
  }

  protected creditFor(location: FalconLocation, url: string): ImageCredit | undefined {
    return location.imageCredits?.find((credit) => credit.url === url);
  }

  protected galleryImages(location: FalconLocation): string[] {
    return location.images.slice(1);
  }

  protected sourceHost(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  protected reviewedAt(location: FalconLocation): string | null {
    if (!location.contentReviewedAt) {
      return null;
    }

    const date = new Date(location.contentReviewedAt);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(date);
  }

  protected mapUrl(location: FalconLocation): string {
    const [longitude, latitude] = location.location.coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  protected async share(location: FalconLocation): Promise<void> {
    this.shareStatus.set(null);
    this.shareError.set(null);

    const url = this.document.location?.href ?? '';
    const data = {
      title: location.title,
      text: location.description,
      url,
    };

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(data);
        this.shareStatus.set('Lugar compartido.');
        return;
      }

      await navigator.clipboard.writeText(url);
      this.shareStatus.set('Enlace copiado al portapapeles.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      this.shareError.set('No se pudo compartir el enlace. Copia la dirección del navegador.');
    }
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
            apiErrorMessage(error, 'No se pudieron consultar las visitas 360° de este lugar.'),
          );
          this.panoramasLoading.set(false);
        },
      });
  }
}
