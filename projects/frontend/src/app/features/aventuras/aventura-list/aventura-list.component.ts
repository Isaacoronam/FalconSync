import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdventureApiService } from '../../../core/services/adventure-api.service';
import { Adventure, difficultyLabel, statusLabel } from '../../../core/models/adventure.model';

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Component({
  selector: 'app-aventura-list',
  imports: [RouterLink],
  templateUrl: './aventura-list.component.html',
  styleUrl: './aventura-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AventuraListComponent implements OnInit {
  private readonly adventuresApi = inject(AdventureApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly adventures = signal<Adventure[]>([]);
  protected readonly meta = signal<ListMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly difficultyLabel = difficultyLabel;
  protected readonly statusLabel = statusLabel;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adventuresApi
      .list(this.meta().page, this.meta().limit)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.adventures.set(response.data);
          this.meta.set(response.meta);
          this.loading.set(false);
        },
        error: () => {
          this.adventures.set([]);
          this.error.set(
            'No se pudieron cargar las aventuras. Verifica que la API esté disponible.',
          );
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
