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
import { FalconLocation } from '../../../core/models/location.model';
import { LocationApiService } from '../../../core/services/location-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import {
  CONSERVATION_LABELS,
  LOCATION_CATEGORY_LABELS,
  LOCATION_TAG_LABELS,
} from '../../../core/utils/location-labels';

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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly location = signal<FalconLocation | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly categoryLabels = LOCATION_CATEGORY_LABELS;
  protected readonly tagLabels = LOCATION_TAG_LABELS;
  protected readonly conservationLabels = CONSERVATION_LABELS;

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
}
