const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Distancia ortodrómica entre dos coordenadas [latitud, longitud] en metros.
 * Se usa Haversine porque las distancias del proyecto son urbanas y no se
 * requiere la precisión de una proyección geodésica completa.
 */
export function haversineDistanceMeters(
  latitudeA,
  longitudeA,
  latitudeB,
  longitudeB,
) {
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;

  const clamped = Math.min(1, Math.max(0, a));

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(clamped));
}
