import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';

/**
 * Límite operativo rectangular del estado Falcón.
 *
 * No es el polígono oficial del estado: para el contorno exacto se necesita un
 * GeoJSON verificado de OSM/INE con su atribución correspondiente.
 */
export const FALCON_BOUNDS: LatLngBoundsExpression = [
  [10.3, -71.35],
  [12.19, -68.18],
];

export const CORO_VIEW: LatLngTuple = [11.4078, -69.6785];

export const CORO_INITIAL_ZOOM = 13;

export const FALCON_MIN_ZOOM = 8;

export const LOCATION_DETAIL_ZOOM = 17;
