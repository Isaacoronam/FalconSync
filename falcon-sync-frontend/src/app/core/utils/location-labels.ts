import type {
  ConservationStatus,
  LocationCategory,
  LocationStatus,
} from '../models/location.model';

export const LOCATION_CATEGORY_LABELS: Record<LocationCategory, string> = {
  architecture: 'Arquitectura civil',
  monument: 'Monumento',
  nature: 'Espacio natural',
  religious: 'Monumento religioso',
  urban: 'Espacio urbano',
};

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

export const CONSERVATION_LABELS: Record<ConservationStatus, string> = {
  good: 'Bueno',
  fair: 'Regular',
  poor: 'Deteriorado',
  unknown: 'Sin dato',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'location.created': 'POI creado',
  'location.updated': 'POI actualizado',
  'location.deleted': 'POI archivado',
  'location.restored': 'POI restaurado',
  'location.image.uploaded': 'Imagen añadida',
  'location.image.removed': 'Imagen eliminada',
};
