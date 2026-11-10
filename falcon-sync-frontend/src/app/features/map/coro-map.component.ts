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
import { Router, RouterLink } from '@angular/router';
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
  ImageCredit,
  LocationCategory,
  LocationCircuit,
  LocationTag,
  LocationVerificationLevel,
} from '../../core/models/location.model';
import { LocationApiService } from '../../core/services/location-api.service';
import {
  CONSERVATION_LABELS,
  LOCATION_CATEGORY_FILTER_OPTIONS,
  LOCATION_CATEGORY_LABELS,
  LOCATION_CIRCUIT_LABELS,
  LOCATION_TAG_LABELS,
  LOCATION_VERIFICATION_LABELS,
} from '../../core/utils/location-labels';

type CategoryFilter = LocationCategory | 'all';

interface LocationCluster {
  locations: FalconLocation[];
  center: L.LatLng;
}

const CLUSTER_RADIUS_PX = 52;

@Component({
  selector: 'app-coro-map',
  imports: [RouterLink],
  templateUrl: './coro-map.component.html',
  styleUrl: './coro-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoroMapComponent implements AfterViewInit, OnDestroy {
  private readonly locationsApi = inject(LocationApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private readonly markers = new Map<string, L.Marker>();
  private popupCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly hoverAwarePopups = new WeakSet<HTMLElement>();
  private popupOpen = false;
  private renderingMarkers = false;

  protected readonly categories = LOCATION_CATEGORY_FILTER_OPTIONS;
  protected readonly selectedCategory = signal<CategoryFilter>('all');
  protected readonly selectedSlug = signal<string | null>(null);
  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly total = computed(() => this.locations().length);
  protected readonly hasLocations = computed(() => this.locations().length > 0);

  private readonly handleMapMove = (): void => {
    if (!this.popupOpen) {
      this.renderMarkers();
    }
  };

  private readonly handlePopupOpen = (): void => {
    this.popupOpen = true;
  };

  private readonly handlePopupClose = (): void => {
    this.popupOpen = false;

    if (this.renderingMarkers) {
      return;
    }

    queueMicrotask(() => {
      if (!this.popupOpen) {
        this.renderMarkers();
      }
    });
  };

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadLocations();
  }

  ngOnDestroy(): void {
    this.clearPopupCloseTimeout();

    if (typeof window !== 'undefined') {
      delete (window as Window & { __falconsyncMap?: L.Map }).__falconsyncMap;
    }

    this.map?.off('moveend', this.handleMapMove);
    this.map?.off('popupopen', this.handlePopupOpen);
    this.map?.off('popupclose', this.handlePopupClose);
    this.map?.remove();
  }

  protected selectCategory(category: CategoryFilter): void {
    if (this.selectedCategory() === category) {
      return;
    }

    this.selectedSlug.set(null);
    this.selectedCategory.set(category);
    this.loadLocations();
  }

  protected loadLocations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.locationsApi
      .list({
        category: this.selectedCategory(),
        includeProvisional: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.locations.set(response.data);
          this.renderMarkers(true);
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

    this.selectedSlug.set(location.slug);
    this.renderMarkers();
    this.map.once('moveend', () => {
      this.markers.get(location.slug)?.openPopup();
    });
    this.map.flyTo([latitude, longitude], LOCATION_DETAIL_ZOOM, { duration: 0.8 });
  }

  protected showFalconOverview(): void {
    if (!this.map) {
      return;
    }

    this.map.closePopup();
    this.selectedSlug.set(null);
    this.renderMarkers();
    this.map.fitBounds(FALCON_BOUNDS, {
      padding: [24, 24],
    });
  }

  protected categoryLabel(category: LocationCategory): string {
    return LOCATION_CATEGORY_LABELS[category];
  }

  protected circuitLabel(circuit: LocationCircuit): string {
    return LOCATION_CIRCUIT_LABELS[circuit];
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
    this.map.on('moveend', this.handleMapMove);
    this.map.on('popupopen', this.handlePopupOpen);
    this.map.on('popupclose', this.handlePopupClose);
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

  private renderMarkers(fit = false): void {
    if (!this.markerLayer) {
      return;
    }

    this.renderingMarkers = true;

    try {
      this.markerLayer.clearLayers();
      this.markers.clear();

      const selected = this.selectedSlug();
      const locations = this.locations();
      const clusteredLocations = selected
        ? locations.filter((location) => location.slug !== selected)
        : locations;
      const clusters = this.clusterLocations(clusteredLocations);

      for (const cluster of clusters) {
        if (cluster.locations.length === 1) {
          this.addLocationMarker(cluster.locations[0]);
        } else {
          this.addClusterMarker(cluster);
        }
      }

      if (selected) {
        const selectedLocation = locations.find(
          (location) => location.slug === selected,
        );

        if (selectedLocation) {
          this.addLocationMarker(selectedLocation, true);
        }
      }

      if (fit) {
        this.fitMapToLocations();
      }
    } finally {
      this.renderingMarkers = false;
    }
  }

  /**
   * Agrupación propia en coordenadas de píxel del mapa actual. Evita añadir
   * una dependencia de clustering y se recalcula en cada movimiento del mapa.
   */
  private clusterLocations(locations: FalconLocation[]): LocationCluster[] {
    if (!this.map || locations.length === 0) {
      return [];
    }

    const zoom = this.map.getZoom();
    const clusters: Array<{
      locations: FalconLocation[];
      x: number;
      y: number;
    }> = [];

    for (const location of locations) {
      const [longitude, latitude] = location.location.coordinates;
      const point = this.map.project([latitude, longitude], zoom);
      const target = clusters.find(
        (cluster) =>
          Math.hypot(cluster.x - point.x, cluster.y - point.y) <=
          CLUSTER_RADIUS_PX,
      );

      if (target) {
        target.locations.push(location);
        continue;
      }

      clusters.push({
        locations: [location],
        x: point.x,
        y: point.y,
      });
    }

    return clusters.map((cluster) => ({
      locations: cluster.locations,
      center: L.latLng(
        cluster.locations.reduce(
          (sum, location) => sum + location.location.coordinates[1],
          0,
        ) / cluster.locations.length,
        cluster.locations.reduce(
          (sum, location) => sum + location.location.coordinates[0],
          0,
        ) / cluster.locations.length,
      ),
    }));
  }

  private addLocationMarker(location: FalconLocation, selected = false): void {
    if (!this.markerLayer) {
      return;
    }

    const [longitude, latitude] = location.location.coordinates;
    const marker = L.marker([latitude, longitude], {
      icon: this.createIcon(location.category, location.isProvisional),
      title: location.title,
      alt: location.title,
      keyboard: true,
      zIndexOffset: selected ? 1000 : 0,
    }).bindPopup(this.createPopup(location), {
      maxWidth: 340,
      minWidth: 260,
      maxHeight: Math.max(160, ((this.map?.getSize().y ?? 0) * 0.6) - 40),
      autoPanPadding: [20, 20],
    });

    marker.on('mouseover', () => {
      this.clearPopupCloseTimeout();
      marker.openPopup();
    });
    marker.on('mouseout', () => this.schedulePopupClose(marker));
    marker.on('popupopen', () => this.bindPopupHoverEvents(marker));

    marker.addTo(this.markerLayer);
    this.markers.set(location.slug, marker);
  }

  private bindPopupHoverEvents(marker: L.Marker): void {
    const popupElement = marker.getPopup()?.getElement();

    if (!popupElement || this.hoverAwarePopups.has(popupElement)) {
      return;
    }

    this.hoverAwarePopups.add(popupElement);
    popupElement.addEventListener('mouseenter', this.clearPopupCloseTimeout);
    popupElement.addEventListener('mouseleave', () =>
      this.schedulePopupClose(marker),
    );
  }

  private schedulePopupClose(marker: L.Marker): void {
    this.clearPopupCloseTimeout();
    this.popupCloseTimeout = setTimeout(() => {
      marker.closePopup();
      this.popupCloseTimeout = null;
    }, 120);
  }

  private readonly clearPopupCloseTimeout = (): void => {
    if (this.popupCloseTimeout !== null) {
      clearTimeout(this.popupCloseTimeout);
      this.popupCloseTimeout = null;
    }
  };

  private addClusterMarker(cluster: LocationCluster): void {
    if (!this.markerLayer) {
      return;
    }

    const count = cluster.locations.length;
    const marker = L.marker(cluster.center, {
      icon: L.divIcon({
        className: `heritage-cluster${
          cluster.locations.some((location) => location.isProvisional)
            ? ' heritage-cluster--provisional'
            : ''
        }`,
        html: `<span class="heritage-cluster__count">${count}</span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
      title: `${count} puntos de interés`,
      alt: `${count} puntos de interés`,
      keyboard: true,
    });

    marker.on('click', () => this.zoomToCluster(cluster.locations));
    marker.addTo(this.markerLayer);
  }

  private zoomToCluster(locations: FalconLocation[]): void {
    if (!this.map) {
      return;
    }

    const bounds = L.latLngBounds(
      locations.map((location) => {
        const [longitude, latitude] = location.location.coordinates;
        return [latitude, longitude] as L.LatLngTuple;
      }),
    );

    if (!bounds.isValid()) {
      return;
    }

    this.map.fitBounds(bounds, {
      padding: [48, 48],
      maxZoom: Math.min(19, this.map.getZoom() + 2),
    });
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

  private createIcon(
    category: LocationCategory,
    isProvisional = false,
  ): L.DivIcon {
    return L.divIcon({
      className: `heritage-marker${
        isProvisional ? ' heritage-marker--provisional' : ''
      }`,
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

      const credit = location.imageCredits?.find(
        (item) => item.url === imageUrl,
      );

      if (credit) {
        container.append(this.createImageCredit(credit));
      }
    }

    const eyebrow = document.createElement('p');
    eyebrow.className = 'heritage-popup__eyebrow';
    eyebrow.textContent = this.categoryLabel(location.category);

    const title = document.createElement('h3');
    title.className = 'heritage-popup__title';
    title.textContent = location.title;

    container.append(eyebrow, title);

    if (location.address) {
      const address = document.createElement('p');
      address.className = 'heritage-popup__address';
      address.textContent = location.address;
      container.append(address);
    }

    const description = document.createElement('p');
    description.className = 'heritage-popup__text';
    description.textContent = location.description;

    const meta = document.createElement('div');
    meta.className = 'heritage-popup__meta';

    for (const circuit of location.circuits ?? []) {
      meta.append(
        this.createChip(this.circuitLabel(circuit), 'heritage-popup__tag--circuit'),
      );
    }

    for (const tag of location.tags ?? []) {
      meta.append(this.createChip(this.tagLabel(tag)));
    }

    meta.append(
      this.createChip(
        `Verificación: ${this.verificationLabel(
          location.verificationLevel ?? 'unverified',
        )}`,
        location.verificationLevel === 'verified' ||
          location.verificationLevel === 'single-source'
          ? 'heritage-popup__tag--verified'
          : 'heritage-popup__tag--warning',
      ),
    );

    if (location.historicalPeriod) {
      meta.append(this.createChip(location.historicalPeriod));
    }

    meta.append(
      this.createChip(
        `Conservación: ${this.conservationLabel(location.conservationStatus)}`,
        location.conservationStatus === 'unknown'
          ? 'heritage-popup__tag--warning'
          : '',
      ),
    );

    container.append(description, meta);

    const detail = document.createElement('a');
    detail.className = 'heritage-popup__detail';
    detail.href = `/lugares/${encodeURIComponent(location.slug)}`;
    detail.textContent = 'Leer la historia y los detalles del lugar';
    detail.addEventListener('click', (event) => {
      event.preventDefault();
      void this.router.navigate(['/lugares', location.slug]);
    });
    container.append(detail);

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

  private createChip(text: string, modifier = ''): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.className = `heritage-popup__tag${modifier ? ` ${modifier}` : ''}`;
    chip.textContent = text;
    return chip;
  }

  private createImageCredit(credit: ImageCredit): HTMLParagraphElement {
    const container = document.createElement('p');
    container.className = 'heritage-popup__credit';

    if (credit.author) {
      container.append(`Foto: ${credit.author}`);
    } else {
      container.append('Foto: autoría pendiente de confirmar');
    }

    if (credit.license) {
      container.append(' · ');
      const license = document.createElement(credit.licenseUrl ? 'a' : 'span');
      license.textContent = credit.license;

      if (license instanceof HTMLAnchorElement) {
        license.href = credit.licenseUrl!;
        license.target = '_blank';
        license.rel = 'noopener noreferrer';
      }

      container.append(license);
    }

    if (credit.sourceUrl) {
      container.append(' · ');
      const source = document.createElement('a');
      source.href = credit.sourceUrl;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = 'Ver original';
      container.append(source);
    }

    return container;
  }

  private verificationLabel(level: LocationVerificationLevel): string {
    return LOCATION_VERIFICATION_LABELS[level];
  }

  protected tagLabel(tag: LocationTag): string {
    return LOCATION_TAG_LABELS[tag];
  }
}
