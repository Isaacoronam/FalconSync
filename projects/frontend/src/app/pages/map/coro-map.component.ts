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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { PanoramaDetail, PanoramaSummary } from '../../models/panorama.model';
import {
  CORO_INITIAL_ZOOM,
  CORO_VIEW,
  FALCON_BOUNDS,
  FALCON_MIN_ZOOM,
  LOCATION_DETAIL_ZOOM,
} from '../../services/utils/falcon-bounds';
import {
  ConservationStatus,
  FalconLocation,
  ImageCredit,
  LocationCategory,
  LocationCircuit,
  LocationTag,
  LocationVerificationLevel,
} from '../../models/location.model';
import { LocationApiService } from '../../services/location-api.service';
import { PanoramaApiService } from '../../services/panorama-api.service';
import { PanoramaViewerComponent } from '../../components/panoramas/panorama-viewer/panorama-viewer.component';
import {
  CONSERVATION_LABELS,
  LOCATION_CATEGORY_FILTER_OPTIONS,
  LOCATION_CATEGORY_LABELS,
  LOCATION_CIRCUIT_LABELS,
  LOCATION_TAG_LABELS,
  LOCATION_VERIFICATION_LABELS,
} from '../../services/utils/location-labels';

type CategoryFilter = LocationCategory | 'all';
type TourState = 'closed' | 'loading' | 'choices' | 'empty' | 'error' | 'active';

interface LocationCluster {
  locations: FalconLocation[];
  center: L.LatLng;
}

const CLUSTER_RADIUS_PX = 52;

@Component({
  selector: 'app-coro-map',
  imports: [PanoramaViewerComponent, RouterLink],
  templateUrl: './coro-map.component.html',
  styleUrl: './coro-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoroMapComponent implements AfterViewInit, OnDestroy {
  private readonly locationsApi = inject(LocationApiService);
  private readonly panoramasApi = inject(PanoramaApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private readonly markers = new Map<string, L.Marker>();
  private popupCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly hoverAwarePopups = new WeakSet<HTMLElement>();
  protected readonly popupOpen = signal(false);
  private renderingMarkers = false;
  private requestedPanoramaId: string | null = null;
  private panoramaRequestToken = 0;
  private centeredPanoramaId: string | null = null;
  private layoutFrame: number | null = null;

  protected readonly categories = LOCATION_CATEGORY_FILTER_OPTIONS;
  protected readonly selectedCategory = signal<CategoryFilter>('all');
  protected readonly selectedSlug = signal<string | null>(null);
  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tourState = signal<TourState>('closed');
  protected readonly tourLocation = signal<FalconLocation | null>(null);
  protected readonly availablePanoramas = signal<PanoramaSummary[]>([]);
  protected readonly activePanorama = signal<PanoramaDetail | null>(null);
  protected readonly tourError = signal<string | null>(null);
  protected readonly total = computed(() => this.locations().length);
  protected readonly hasLocations = computed(() => this.locations().length > 0);

  private readonly handleMapMove = (): void => {
    if (!this.popupOpen()) {
      this.renderMarkers();
    }
  };

  private readonly handlePopupOpen = (event: L.PopupEvent): void => {
    this.popupOpen.set(true);
    this.decoratePopup(event.popup);

    const popupElement = event.popup.getElement();
    const activeElement = document.activeElement;

    if (
      popupElement &&
      activeElement instanceof HTMLElement &&
      activeElement.classList.contains('heritage-marker') &&
      activeElement.matches(':focus-visible')
    ) {
      popupElement.setAttribute('tabindex', '-1');
      popupElement.focus({ preventScroll: true });
    }
  };

  private readonly handlePopupClose = (): void => {
    const focusWasInsidePopup = Boolean(document.activeElement?.closest('.leaflet-popup'));

    this.popupOpen.set(false);

    if (focusWasInsidePopup) {
      this.map?.getContainer().focus({ preventScroll: true });
    }

    if (this.renderingMarkers) {
      return;
    }

    queueMicrotask(() => {
      if (!this.popupOpen()) {
        this.renderMarkers();
      }
    });
  };

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadLocations();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const panoramaId = params.get('panorama');

      if (panoramaId === this.requestedPanoramaId) {
        return;
      }

      this.requestedPanoramaId = panoramaId;

      if (panoramaId) {
        this.loadPanorama(panoramaId);
      } else {
        this.resetTour();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearPopupCloseTimeout();
    this.cancelLayoutFrame();

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
          this.syncPanoramaLocation();
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

  protected openLocationPanoramas(location: FalconLocation): void {
    const requestToken = ++this.panoramaRequestToken;

    this.requestedPanoramaId = null;
    this.tourLocation.set(location);
    this.availablePanoramas.set([]);
    this.activePanorama.set(null);
    this.tourError.set(null);
    this.tourState.set('loading');
    this.selectedSlug.set(location.slug);
    this.map?.closePopup();
    this.renderMarkers();
    this.invalidateMapAfterLayout();

    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { panorama: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      })
      .catch(() => {
        if (requestToken !== this.panoramaRequestToken) {
          return;
        }

        this.tourError.set('No se pudo actualizar el enlace de la visita.');
        this.tourState.set('error');
      });

    this.panoramasApi
      .list({ locationId: location.id, limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          if (requestToken !== this.panoramaRequestToken) {
            return;
          }

          this.availablePanoramas.set(data);

          if (data.length === 0) {
            this.tourState.set('empty');
            this.invalidateMapAfterLayout();
            return;
          }

          if (data.length === 1) {
            void this.selectPanorama(data[0].id);
            return;
          }

          this.tourState.set('choices');
          this.invalidateMapAfterLayout();
        },
        error: () => {
          if (requestToken !== this.panoramaRequestToken) {
            return;
          }

          this.tourError.set(
            'No se pudieron consultar las escenas publicadas de este lugar. Inténtalo de nuevo.',
          );
          this.tourState.set('error');
          this.invalidateMapAfterLayout();
        },
      });
  }

  protected async selectPanorama(id: string): Promise<void> {
    try {
      const navigated = await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { panorama: id },
        queryParamsHandling: 'merge',
      });

      if (!navigated && this.requestedPanoramaId !== id) {
        this.tourError.set('No se pudo abrir esta escena 360°.');
        this.tourState.set('error');
      }
    } catch {
      this.tourError.set('No se pudo abrir esta escena 360°.');
      this.tourState.set('error');
    }
  }

  protected async closeTour(): Promise<void> {
    if (!this.route.snapshot.queryParamMap.has('panorama')) {
      this.resetTour();
      return;
    }

    try {
      const navigated = await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { panorama: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });

      if (navigated || !this.route.snapshot.queryParamMap.has('panorama')) {
        this.requestedPanoramaId = null;
        this.resetTour();
        return;
      }

      this.tourError.set('No se pudo volver al mapa.');
      this.tourState.set('error');
    } catch {
      if (!this.route.snapshot.queryParamMap.has('panorama')) {
        this.requestedPanoramaId = null;
        this.resetTour();
        return;
      }

      this.tourError.set('No se pudo volver al mapa.');
      this.tourState.set('error');
    }
  }

  protected requestPanoramaScene(id: string): void {
    void this.selectPanorama(id);
  }

  protected requestPanoramaLocation(slug: string): void {
    const location = this.locations().find((item) => item.slug === slug);

    if (!location) {
      this.tourError.set('Este lugar no está disponible en los filtros actuales del mapa.');
      this.tourState.set('error');
      return;
    }

    this.openLocationPanoramas(location);
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
      const locations = [...this.locations()];
      const tourLocation = this.tourLocation();

      if (tourLocation && !locations.some((location) => location.id === tourLocation.id)) {
        locations.push(tourLocation);
      }

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
        const selectedLocation = locations.find((location) => location.slug === selected);

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
        (cluster) => Math.hypot(cluster.x - point.x, cluster.y - point.y) <= CLUSTER_RADIUS_PX,
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
        cluster.locations.reduce((sum, location) => sum + location.location.coordinates[1], 0) /
          cluster.locations.length,
        cluster.locations.reduce((sum, location) => sum + location.location.coordinates[0], 0) /
          cluster.locations.length,
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
      maxWidth: 360,
      minWidth: 248,
      maxHeight: this.popupMaxHeight(),
      autoPanPaddingTopLeft: [16, 56],
      autoPanPaddingBottomRight: [16, 24],
      className: 'heritage-popup-shell',
    });

    if (this.supportsHover()) {
      marker.on('mouseover', () => {
        this.clearPopupCloseTimeout();
        marker.openPopup();
      });
      marker.on('mouseout', () => this.schedulePopupClose(marker));
    }

    marker.on('popupopen', () => this.bindPopupHoverEvents(marker));

    marker.addTo(this.markerLayer);
    this.markers.set(location.slug, marker);
  }

  private bindPopupHoverEvents(marker: L.Marker): void {
    const popup = marker.getPopup();
    const popupElement = popup?.getElement();

    if (!popup || !popupElement) {
      return;
    }

    this.refreshPopupMaxHeight(popup);

    if (this.hoverAwarePopups.has(popupElement)) {
      return;
    }

    this.hoverAwarePopups.add(popupElement);

    if (this.supportsHover()) {
      popupElement.addEventListener('mouseenter', this.clearPopupCloseTimeout);
      popupElement.addEventListener('mouseleave', () => this.schedulePopupClose(marker));
    }

    popupElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      marker.closePopup();
      this.map?.getContainer().focus();
    });
  }

  private decoratePopup(popup: L.Popup): void {
    const popupElement = popup.getElement();

    if (!popupElement) {
      return;
    }

    const title = popupElement.querySelector<HTMLElement>('.heritage-popup__title');

    if (title?.id) {
      popupElement.setAttribute('role', 'dialog');
      popupElement.setAttribute('aria-labelledby', title.id);
    }

    const closeButton = popupElement.querySelector<HTMLAnchorElement>(
      '.leaflet-popup-close-button',
    );

    if (!closeButton) {
      return;
    }

    const titleText = title?.textContent?.trim();
    closeButton.setAttribute(
      'aria-label',
      titleText ? `Cerrar ficha de ${titleText}` : 'Cerrar ficha',
    );
    closeButton.title = 'Cerrar ficha';
  }

  private refreshPopupMaxHeight(popup: L.Popup): void {
    const maxHeight = this.popupMaxHeight();

    if (popup.options.maxHeight === maxHeight) {
      return;
    }

    popup.options.maxHeight = maxHeight;
    popup.update();
  }

  private popupMaxHeight(): number {
    return Math.max(240, Math.min(420, (this.map?.getSize().y ?? 0) - 64));
  }

  private supportsHover(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  }

  private schedulePopupClose(marker: L.Marker): void {
    this.clearPopupCloseTimeout();
    this.popupCloseTimeout = setTimeout(() => {
      const popupElement = marker.getPopup()?.getElement();

      if (popupElement?.contains(document.activeElement)) {
        this.popupCloseTimeout = null;
        return;
      }

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

  private createIcon(category: LocationCategory, isProvisional = false): L.DivIcon {
    return L.divIcon({
      className: `heritage-marker${isProvisional ? ' heritage-marker--provisional' : ''}`,
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
      const media = document.createElement('figure');
      media.className = 'heritage-popup__media';

      const image = document.createElement('img');
      image.className = 'heritage-popup__image';
      image.src = imageUrl;
      image.alt = `Fotografía de ${location.title}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener(
        'error',
        () => {
          media.remove();
          container.classList.add('heritage-popup--no-media');
        },
        { once: true },
      );
      media.append(image);

      const credit = location.imageCredits?.find((item) => item.url === imageUrl);

      if (credit) {
        media.append(this.createImageCredit(credit));
      }

      container.append(media);
    } else {
      container.classList.add('heritage-popup--no-media');
    }

    const body = document.createElement('div');
    body.className = 'heritage-popup__body';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'heritage-popup__eyebrow';
    eyebrow.textContent = this.categoryLabel(location.category);

    if (location.historicalPeriod) {
      const period = document.createElement('span');
      period.className = 'heritage-popup__period';
      period.textContent = ` · ${location.historicalPeriod}`;
      eyebrow.append(period);
    }

    const title = document.createElement('h3');
    title.className = 'heritage-popup__title';
    title.id = `heritage-popup-title-${location.slug}`;
    title.textContent = location.title;

    body.append(eyebrow, title);

    if (location.address) {
      const address = document.createElement('p');
      address.className = 'heritage-popup__address';
      address.textContent = location.address;
      body.append(address);
    }

    if (location.description) {
      const description = document.createElement('p');
      description.className = 'heritage-popup__text';
      description.textContent = location.description;
      body.append(description);
    }

    const taxonomy = [
      ...(location.circuits ?? []).map((circuit) => ({
        label: this.circuitLabel(circuit),
        modifier: 'heritage-popup__tag--circuit',
      })),
      ...(location.tags ?? []).map((tag) => ({
        label: this.tagLabel(tag),
        modifier: '',
      })),
    ];

    if (taxonomy.length > 0) {
      const meta = document.createElement('ul');
      meta.className = 'heritage-popup__meta';
      meta.setAttribute('aria-label', 'Circuitos y etiquetas');

      for (const item of taxonomy.slice(0, 4)) {
        const listItem = document.createElement('li');
        listItem.append(this.createChip(item.label, item.modifier));
        meta.append(listItem);
      }

      const hiddenItems = taxonomy.slice(4);

      if (hiddenItems.length > 0) {
        const hiddenLabels = hiddenItems.map((item) => item.label).join(', ');
        const listItem = document.createElement('li');
        const more = this.createChip(`+${hiddenItems.length}`);
        more.classList.add('heritage-popup__tag--more');
        more.title = hiddenLabels;
        more.setAttribute('aria-hidden', 'true');

        const accessible = document.createElement('span');
        accessible.className = 'heritage-popup__sr';
        accessible.textContent = `Etiquetas adicionales: ${hiddenLabels}`;

        listItem.append(more, accessible);
        meta.append(listItem);
      }

      body.append(meta);
    }

    const facts = document.createElement('dl');
    facts.className = 'heritage-popup__facts';
    facts.append(
      this.createFact(
        'Verificación',
        this.verificationLabel(location.verificationLevel ?? 'unverified'),
      ),
      this.createFact('Conservación', this.conservationLabel(location.conservationStatus)),
    );
    body.append(facts);

    const footer = document.createElement('footer');
    footer.className = 'heritage-popup__footer';

    const actions = document.createElement('div');
    actions.className = 'heritage-popup__actions';

    const detail = document.createElement('a');
    detail.className = 'heritage-popup__detail';
    detail.href = `/lugares/${encodeURIComponent(location.slug)}`;
    detail.setAttribute('aria-label', `Leer la historia de ${location.title}`);

    const detailLabel = document.createElement('span');
    detailLabel.textContent = 'Leer la historia';

    const detailArrow = document.createElement('span');
    detailArrow.className = 'heritage-popup__arrow';
    detailArrow.setAttribute('aria-hidden', 'true');
    detailArrow.textContent = '→';

    detail.append(detailLabel, detailArrow);
    detail.addEventListener('click', (event) => {
      event.preventDefault();
      void this.router.navigate(['/lugares', location.slug]);
    });

    const panoramaAction = document.createElement('button');
    panoramaAction.type = 'button';
    panoramaAction.className = 'heritage-popup__panorama';
    panoramaAction.textContent = 'Explorar en 360°';
    panoramaAction.setAttribute('aria-label', `Explorar en 360° junto al mapa: ${location.title}`);
    panoramaAction.addEventListener('click', () => this.openLocationPanoramas(location));

    actions.append(detail, panoramaAction);

    if (location.sourceUrl) {
      const source = document.createElement('a');
      source.className = 'heritage-popup__source';
      source.href = location.sourceUrl;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.setAttribute(
        'aria-label',
        `Fuente del dato de ${location.title} (se abre en una nueva pestaña)`,
      );

      const sourceLabel = document.createElement('span');
      sourceLabel.textContent = 'Fuente del dato';

      const sourceArrow = document.createElement('span');
      sourceArrow.className = 'heritage-popup__arrow';
      sourceArrow.setAttribute('aria-hidden', 'true');
      sourceArrow.textContent = '↗';

      source.append(sourceLabel, sourceArrow);
      footer.append(actions, source);
    } else {
      footer.append(actions);
    }

    container.append(body, footer);

    return container;
  }

  private loadPanorama(id: string): void {
    const requestToken = ++this.panoramaRequestToken;

    this.tourState.set('loading');
    this.tourError.set(null);
    this.tourLocation.set(null);
    this.availablePanoramas.set([]);
    this.activePanorama.set(null);
    this.invalidateMapAfterLayout();

    this.panoramasApi
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          if (requestToken !== this.panoramaRequestToken) {
            return;
          }

          this.activePanorama.set(data);
          this.tourState.set('active');
          this.syncPanoramaLocation();
          this.invalidateMapAfterLayout();
        },
        error: () => {
          if (requestToken !== this.panoramaRequestToken) {
            return;
          }

          this.tourError.set(
            'Esta escena no existe, ya no está publicada o no se puede consultar.',
          );
          this.tourState.set('error');
          this.invalidateMapAfterLayout();
        },
      });
  }

  private syncPanoramaLocation(): void {
    const panorama = this.activePanorama();

    if (!panorama?.locationId || !this.map) {
      return;
    }

    const location =
      this.locations().find((item) => item.id === panorama.locationId) ??
      (this.tourLocation()?.id === panorama.locationId ? this.tourLocation() : null);

    if (!location) {
      return;
    }

    this.tourLocation.set(location);
    this.selectedSlug.set(location.slug);
    this.renderMarkers();

    if (this.centeredPanoramaId !== panorama.id) {
      this.centeredPanoramaId = panorama.id;
      const [longitude, latitude] = location.location.coordinates;
      this.map.flyTo([latitude, longitude], LOCATION_DETAIL_ZOOM, {
        duration: 0.8,
      });
    }
  }

  private resetTour(): void {
    this.panoramaRequestToken += 1;
    this.centeredPanoramaId = null;
    this.tourState.set('closed');
    this.tourLocation.set(null);
    this.availablePanoramas.set([]);
    this.activePanorama.set(null);
    this.tourError.set(null);
    this.renderMarkers();
    this.invalidateMapAfterLayout();
  }

  private invalidateMapAfterLayout(): void {
    this.cancelLayoutFrame();
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = null;
      this.map?.invalidateSize({ pan: false });
    });
  }

  private cancelLayoutFrame(): void {
    if (this.layoutFrame === null) {
      return;
    }

    cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = null;
  }

  private createChip(text: string, modifier = ''): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.className = `heritage-popup__tag${modifier ? ` ${modifier}` : ''}`;
    chip.textContent = text;
    return chip;
  }

  private createFact(label: string, value: string): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'heritage-popup__fact';

    const term = document.createElement('dt');
    term.textContent = label;

    const description = document.createElement('dd');
    description.textContent = value;

    item.append(term, description);
    return item;
  }

  private createImageCredit(credit: ImageCredit): HTMLElement {
    const container = document.createElement('figcaption');
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
        license.setAttribute('aria-label', `${credit.license} (se abre en una nueva pestaña)`);
      }

      container.append(license);
    }

    if (credit.sourceUrl) {
      container.append(' · ');
      const source = document.createElement('a');
      source.href = credit.sourceUrl;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.setAttribute('aria-label', 'Ver original (se abre en una nueva pestaña)');
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
