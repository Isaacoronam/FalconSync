import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import {
  CORO_INITIAL_ZOOM,
  CORO_VIEW,
  FALCON_BOUNDS,
  FALCON_MIN_ZOOM,
  LOCATION_DETAIL_ZOOM,
} from '../../core/config/falcon-bounds';
import {
  ConservationStatus,
  FalconLocation,
  LOCATION_CATEGORIES,
  LocationCategory,
} from '../../core/models/location.model';
import { LocationApiService } from '../../core/services/location-api.service';

type CategoryFilter = LocationCategory | 'all';

const CATEGORY_LABELS: Record<LocationCategory, string> = {
  architecture: 'Arquitectura civil',
  monument: 'Monumento',
  nature: 'Espacio natural',
  religious: 'Monumento religioso',
  urban: 'Espacio urbano',
};

const CONSERVATION_LABELS: Record<ConservationStatus, string> = {
  good: 'Bueno',
  fair: 'Regular',
  poor: 'Deteriorado',
  unknown: 'Sin dato',
};

@Component({
  selector: 'app-coro-map',
  templateUrl: './coro-map.component.html',
  styleUrl: './coro-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoroMapComponent implements AfterViewInit, OnDestroy {
  private readonly locationsApi = inject(LocationApiService);
  private readonly destroyRef = inject(DestroyRef);

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private readonly markers = new Map<string, L.Marker>();

  protected readonly categories = LOCATION_CATEGORIES;
  protected readonly selectedCategory = signal<CategoryFilter>('all');
  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly total = computed(() => this.locations().length);
  protected readonly hasLocations = computed(() => this.locations().length > 0);

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadLocations();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      delete (window as Window & { __falconsyncMap?: L.Map }).__falconsyncMap;
    }

    this.map?.remove();
  }

  protected selectCategory(category: CategoryFilter): void {
    if (this.selectedCategory() === category) {
      return;
    }

    this.selectedCategory.set(category);
    this.loadLocations();
  }

  protected loadLocations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.locationsApi
      .list(this.selectedCategory())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.locations.set(response.data);
          this.renderMarkers();
          this.loading.set(false);
        },
        error: () => {
          this.locations.set([]);
          this.renderMarkers();
          this.error.set(
            'No se pudieron cargar los puntos de interés. Verifica que la API esté disponible.',
          );
          this.loading.set(false);
        },
      });
  }

  protected focusLocation(location: FalconLocation): void {
    if (!this.map) {
      return;
    }

    const [longitude, latitude] = location.location.coordinates;
    this.map.flyTo([latitude, longitude], LOCATION_DETAIL_ZOOM, { duration: 0.8 });
    this.markers.get(location.slug)?.openPopup();
  }

  protected showFalconOverview(): void {
    if (!this.map) {
      return;
    }

    this.map.closePopup();
    this.map.fitBounds(FALCON_BOUNDS, {
      padding: [24, 24],
    });
  }

  protected categoryLabel(category: LocationCategory): string {
    return CATEGORY_LABELS[category];
  }

  protected conservationLabel(status: ConservationStatus): string {
    return CONSERVATION_LABELS[status];
  }

  protected hideBrokenThumbnail(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  private initializeMap(): void {
    this.map = L.map('coro-map', {
      zoomControl: true,
      scrollWheelZoom: true,
      maxBounds: FALCON_BOUNDS,
      maxBoundsViscosity: 1,
      minZoom: FALCON_MIN_ZOOM,
    }).setView(CORO_VIEW, CORO_INITIAL_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
    this.exposeMapForDiagnostics();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  /**
   * Expone la instancia de Leaflet solo en desarrollo para que la suite E2E
   * pueda comprobar los límites reales del mapa. No se incluye en producción.
   */
  private exposeMapForDiagnostics(): void {
    if (!isDevMode() || typeof window === 'undefined') {
      return;
    }

    (window as Window & { __falconsyncMap?: L.Map }).__falconsyncMap = this.map;
  }

  private renderMarkers(): void {
    if (!this.markerLayer) {
      return;
    }

    this.markerLayer.clearLayers();
    this.markers.clear();

    for (const location of this.locations()) {
      const [longitude, latitude] = location.location.coordinates;
      const marker = L.marker([latitude, longitude], {
        icon: this.createIcon(location.category),
        title: location.title,
        alt: location.title,
        keyboard: true,
      }).bindPopup(this.createPopup(location), {
        maxWidth: 340,
        minWidth: 260,
      });

      marker.addTo(this.markerLayer);
      this.markers.set(location.slug, marker);
    }

    this.fitMapToLocations();
  }

  private fitMapToLocations(): void {
    if (!this.map || this.locations().length === 0) {
      return;
    }

    this.map.invalidateSize();

    if (this.locations().length === 1) {
      const [longitude, latitude] = this.locations()[0].location.coordinates;
      this.map.setView([latitude, longitude], LOCATION_DETAIL_ZOOM - 1);
      return;
    }

    if (this.selectedCategory() === 'all') {
      this.map.setView(CORO_VIEW, CORO_INITIAL_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(
      this.locations().map((location) => {
        const [longitude, latitude] = location.location.coordinates;
        return [latitude, longitude] as L.LatLngTuple;
      }),
    );

    this.map.fitBounds(bounds, {
      padding: [48, 48],
      maxZoom: LOCATION_DETAIL_ZOOM,
    });
  }

  private createIcon(category: LocationCategory): L.DivIcon {
    return L.divIcon({
      className: 'heritage-marker',
      html: `<span class="heritage-marker__dot heritage-marker__dot--${category}"></span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  }

  private createPopup(location: FalconLocation): HTMLElement {
    const container = document.createElement('article');
    container.className = 'heritage-popup';

    const imageUrl = location.images[0];

    if (imageUrl) {
      const image = document.createElement('img');
      image.className = 'heritage-popup__image';
      image.src = imageUrl;
      image.alt = `Imagen de ${location.title}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => image.remove(), { once: true });
      container.append(image);
    }

    const eyebrow = document.createElement('p');
    eyebrow.className = 'heritage-popup__eyebrow';
    eyebrow.textContent = this.categoryLabel(location.category);

    const title = document.createElement('h3');
    title.className = 'heritage-popup__title';
    title.textContent = location.title;

    const description = document.createElement('p');
    description.className = 'heritage-popup__text';
    description.textContent = location.description;

    const meta = document.createElement('div');
    meta.className = 'heritage-popup__meta';

    if (location.historicalPeriod) {
      const period = document.createElement('span');
      period.className = 'heritage-popup__tag';
      period.textContent = location.historicalPeriod;
      meta.append(period);
    }

    const conservation = document.createElement('span');
    conservation.className = 'heritage-popup__tag';
    conservation.textContent = `Conservación: ${this.conservationLabel(location.conservationStatus)}`;
    if (location.conservationStatus === 'unknown') {
      conservation.classList.add('heritage-popup__tag--warning');
    }
    meta.append(conservation);

    if (location.isProvisional) {
      const provisional = document.createElement('span');
      provisional.className = 'heritage-popup__tag heritage-popup__tag--warning';
      provisional.textContent = 'Ubicación provisional';
      meta.append(provisional);
    }

    container.append(eyebrow, title, description, meta);

    if (location.sourceUrl) {
      const source = document.createElement('a');
      source.className = 'heritage-popup__source';
      source.href = location.sourceUrl;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = 'Ver fuente del dato';
      container.append(source);
    }

    return container;
  }
}
