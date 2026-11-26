import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PanoramaSummary } from '../../../models/panorama.model';
import { PanoramaApiService } from '../../../services/panorama-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import { formatPanoramaDate } from '../../../services/utils/panorama-labels';

@Component({
  selector: 'app-panorama-list',
  imports: [RouterLink],
  templateUrl: './panorama-list.component.html',
  styleUrl: './panorama-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanoramaListComponent implements OnInit {
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly panoramas = signal<PanoramaSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly formatDate = formatPanoramaDate;

  ngOnInit(): void {
    this.panoramaApi
      .list({ limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.panoramas.set(data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            apiErrorMessage(
              error,
              'No se pudieron cargar las visitas 360°. Inténtalo de nuevo más tarde.',
            ),
          );
          this.loading.set(false);
        },
      });
  }

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }
}
