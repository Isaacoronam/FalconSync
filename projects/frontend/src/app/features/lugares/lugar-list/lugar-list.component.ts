import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FalconLocation } from '../../../core/models/location.model';
import { LocationApiService } from '../../../core/services/location-api.service';
import {
  LOCATION_CATEGORY_LABELS,
  LOCATION_CIRCUIT_LABELS,
} from '../../../core/utils/location-labels';

@Component({
  selector: 'app-lugar-list',
  imports: [RouterLink],
  templateUrl: './lugar-list.component.html',
  styleUrl: './lugar-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LugarListComponent implements OnInit {
  private readonly locationsApi = inject(LocationApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.locationsApi
      .list({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.locations.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            'No se pudieron cargar los lugares. Verifica que la API esté disponible.',
          );
          this.loading.set(false);
        },
      });
  }

  protected categoryLabel(category: FalconLocation['category']): string {
    return LOCATION_CATEGORY_LABELS[category];
  }

  protected circuitLabel(circuit: FalconLocation['circuits'][number]): string {
    return LOCATION_CIRCUIT_LABELS[circuit];
  }

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }
}
