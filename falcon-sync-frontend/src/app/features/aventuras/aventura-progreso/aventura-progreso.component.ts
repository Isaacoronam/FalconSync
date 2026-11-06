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
import { AdventureProgress } from '../../../core/models/adventure.model';

@Component({
  selector: 'app-aventura-progreso',
  imports: [RouterLink],
  templateUrl: './aventura-progreso.component.html',
  styleUrl: './aventura-progreso.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AventuraProgresoComponent implements OnInit {
  private readonly adventuresApi = inject(AdventureApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly progress = signal<AdventureProgress | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);

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
      .getProgress(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.progress.set(response.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const status = (error as { status?: number }).status;

          if (status === 404) {
            this.notFound.set(true);
          } else {
            this.error.set(
              apiErrorMessage(error, 'No se pudo cargar el progreso. Inténtalo de nuevo.'),
            );
          }
          this.loading.set(false);
        },
      });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected stopStatus(stop: AdventureProgress['stops'][number]): string {
    return stop.visited ? 'Visitada' : 'Pendiente';
  }
}
