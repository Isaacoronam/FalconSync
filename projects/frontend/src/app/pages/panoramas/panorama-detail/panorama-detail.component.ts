import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PanoramaViewerComponent } from '../../../components/panoramas/panorama-viewer/panorama-viewer.component';
import { PanoramaDetail } from '../../../models/panorama.model';
import { PanoramaApiService } from '../../../services/panorama-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import { formatPanoramaDate } from '../../../services/utils/panorama-labels';

@Component({
  selector: 'app-panorama-detail',
  imports: [RouterLink, PanoramaViewerComponent],
  templateUrl: './panorama-detail.component.html',
  styleUrl: './panorama-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanoramaDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly panorama = signal<PanoramaDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly formatDate = formatPanoramaDate;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('No se indicó la visita 360° que quieres consultar.');
      this.loading.set(false);
      return;
    }

    this.panoramaApi
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.panorama.set(data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            apiErrorMessage(
              error,
              'Esta visita 360° no existe, ya no está publicada o no tienes acceso.',
            ),
          );
          this.loading.set(false);
        },
      });
  }
}
