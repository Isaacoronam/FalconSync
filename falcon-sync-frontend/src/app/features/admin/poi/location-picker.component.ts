import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
} from '@angular/core';
import * as L from 'leaflet';
import {
  CORO_INITIAL_ZOOM,
  CORO_VIEW,
  FALCON_BOUNDS,
  FALCON_MIN_ZOOM,
} from '../../../core/config/falcon-bounds';

export interface PickerCoordinates {
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-location-picker',
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPickerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  readonly coordinatesChange = output<PickerCoordinates>();

  private map?: L.Map;
  private marker?: L.Marker;

  constructor() {
    effect(() => {
      const latitude = this.latitude();
      const longitude = this.longitude();

      if (!this.map || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      this.placeMarker(latitude, longitude);
    });
  }

  ngAfterViewInit(): void {
    const latitude = this.latitude();
    const longitude = this.longitude();
    const hasValidPoint = Number.isFinite(latitude) && Number.isFinite(longitude);

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      scrollWheelZoom: true,
      maxBounds: FALCON_BOUNDS,
      maxBoundsViscosity: 1,
      minZoom: FALCON_MIN_ZOOM,
    }).setView(hasValidPoint ? [latitude, longitude] : CORO_VIEW, CORO_INITIAL_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.emitCoordinates(event.latlng.lat, event.latlng.lng);
    });

    if (hasValidPoint) {
      this.placeMarker(latitude, longitude);
    }

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private placeMarker(latitude: number, longitude: number): void {
    if (!this.map) {
      return;
    }

    const point = L.latLng(latitude, longitude);

    if (!this.marker) {
      this.marker = L.marker(point, {
        draggable: true,
        keyboard: true,
        title: 'Ubicación del punto de interés',
        alt: 'Ubicación del punto de interés',
        icon: L.divIcon({
          className: 'heritage-marker',
          html: '<span class="heritage-marker__dot"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        }),
      }).addTo(this.map);

      this.marker.on('dragend', () => {
        const position = this.marker?.getLatLng();

        if (position) {
          this.emitCoordinates(position.lat, position.lng);
        }
      });
    } else {
      this.marker.setLatLng(point);
    }

    if (!this.map.getBounds().contains(point)) {
      this.map.panTo(point);
    }
  }

  private emitCoordinates(latitude: number, longitude: number): void {
    this.coordinatesChange.emit({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  }
}
