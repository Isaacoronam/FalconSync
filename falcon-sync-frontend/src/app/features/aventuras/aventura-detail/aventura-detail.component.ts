import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdventureApiService } from '../../../core/services/adventure-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { Adventure, AdventureStop, difficultyLabel, statusLabel } from '../../../core/models/adventure.model';

@Component({
  selector: 'app-aventura-detail',
  imports: [RouterLink],
  templateUrl: './aventura-detail.component.html',
  styleUrl: './aventura-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AventuraDetailComponent implements OnInit {
  private readonly adventuresApi = inject(AdventureApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly adventure = signal<Adventure | null>(null);
  protected readonly stops = signal<AdventureStop[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);

  protected readonly difficultyLabel = difficultyLabel;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.load(slug);
  }

  protected load(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);

    this.adventuresApi
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.adventure.set(response.data);
          this.stops.set(response.data.stops ?? []);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const status = (error as { status?: number }).status;

          if (status === 404) {
            this.notFound.set(true);
          } else {
            this.error.set(
              apiErrorMessage(error, 'No se pudo cargar la aventura. Inténtalo de nuevo.'),
            );
          }
          this.loading.set(false);
        },
      });
  }

  protected onCoverError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  protected durationLabel(minutes: number): string {
    const horas = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (horas > 0 && mins > 0) {
      return `${horas} h ${mins} min`;
    }

    if (horas > 0) {
      return `${horas} h`;
    }

    return `${mins} min`;
  }
}
