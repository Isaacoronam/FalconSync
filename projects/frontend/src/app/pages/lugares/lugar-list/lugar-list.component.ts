import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import { FalconLocation, LocationCategory, LocationCircuit } from '../../../models/location.model';
import { LocationApiService } from '../../../services/location-api.service';
import {
  LOCATION_CATEGORY_FILTER_OPTIONS,
  LOCATION_CATEGORY_LABELS,
  LOCATION_CIRCUIT_FILTER_OPTIONS,
  LOCATION_CIRCUIT_LABELS,
} from '../../../services/utils/location-labels';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-lugar-list',
  imports: [RouterLink, PageSkeletonComponent],
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
  protected readonly query = signal('');
  protected readonly category = signal<LocationCategory | 'all'>('all');
  protected readonly circuit = signal<LocationCircuit | 'all'>('all');
  protected readonly categoryOptions = LOCATION_CATEGORY_FILTER_OPTIONS;
  protected readonly circuitOptions = LOCATION_CIRCUIT_FILTER_OPTIONS;
  protected readonly filteredLocations = computed(() => {
    const query = normalize(this.query());
    const category = this.category();
    const circuit = this.circuit();

    return this.locations().filter((location) => {
      if (category !== 'all' && location.category !== category) {
        return false;
      }

      if (circuit !== 'all' && !location.circuits.includes(circuit)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = normalize(
        [
          location.title,
          location.description,
          location.whatIs ?? '',
          location.historicalPeriod ?? '',
          location.address ?? '',
          ...location.tags,
          ...location.circuits,
        ].join(' '),
      );

      return haystack.includes(query);
    });
  });
  protected readonly hasFilters = computed(
    () => this.query().trim().length > 0 || this.category() !== 'all' || this.circuit() !== 'all',
  );

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
          this.error.set('No se pudieron cargar los lugares. Verifica que la API esté disponible.');
          this.loading.set(false);
        },
      });
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onCategory(event: Event): void {
    this.category.set((event.target as HTMLSelectElement).value as LocationCategory | 'all');
  }

  protected onCircuit(event: Event): void {
    this.circuit.set((event.target as HTMLSelectElement).value as LocationCircuit | 'all');
  }

  protected clearFilters(): void {
    this.query.set('');
    this.category.set('all');
    this.circuit.set('all');
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
