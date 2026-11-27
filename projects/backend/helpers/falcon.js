/**
 * Límite operativo rectangular del estado Falcón.
 *
 * No es el polígono oficial del estado. Se usa para rechazar coordenadas
 * claramente fuera del ámbito del proyecto mientras se incorpora un GeoJSON
 * verificado de OSM/INE.
 */
export const FALCON_BOUNDS = {
  south: 10.3,
  west: -71.35,
  north: 12.19,
  east: -68.18,
};

export function isInsideFalcon(longitude, latitude) {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= FALCON_BOUNDS.west &&
    longitude <= FALCON_BOUNDS.east &&
    latitude >= FALCON_BOUNDS.south &&
    latitude <= FALCON_BOUNDS.north
  );
}
