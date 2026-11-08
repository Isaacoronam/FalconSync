import {
  ConservationStatus,
  LOCATION_CATEGORIES,
  LOCATION_CIRCUITS,
  LOCATION_TAGS,
  LOCATION_VERIFICATION_LEVELS,
  LocationCategory,
  LocationCircuit,
  LocationStatus,
  LocationTag,
  LocationVerificationLevel,
} from '../models/location.model';

export interface FilterOption<T extends string> {
  value: T | 'all';
  label: string;
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export const LOCATION_CATEGORY_LABELS: Record<LocationCategory, string> = {
  architecture: 'Arquitectura civil',
  monument: 'Monumento',
  nature: 'Espacio natural',
  religious: 'Monumento religioso',
  urban: 'Espacio urbano',
  museum: 'Museo',
  viewpoint: 'Mirador',
  commerce: 'Comercio',
  service: 'Servicio',
};

export const LOCATION_CIRCUIT_LABELS: Record<LocationCircuit, string> = {
  'casco-historico': 'Casco histórico',
  museos: 'Museos',
  'naturaleza-miradores': 'Naturaleza y miradores',
  'espacios-urbanos': 'Espacios urbanos',
  'la-vela': 'La Vela',
  'comercio-servicios': 'Comercio y servicios',
};

export const LOCATION_TAG_LABELS: Record<LocationTag, string> = {
  colonial: 'Colonial',
  unesco: 'Patrimonio UNESCO',
  gastronomy: 'Gastronomía',
  theater: 'Teatro',
  sports: 'Deportes',
  promenade: 'Paseo',
  market: 'Mercado',
  crafts: 'Artesanía',
  family: 'Familiar',
  photogenic: 'Fotogénico',
  'free-entry': 'Entrada libre',
  'guided-tour': 'Visita guiada',
};

export const LOCATION_VERIFICATION_LABELS: Record<
  LocationVerificationLevel,
  string
> = {
  unverified: 'Sin verificar',
  'single-source': 'Fuente única',
  verified: 'Verificado en campo',
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

export const LOCATION_CATEGORY_FILTER_OPTIONS: FilterOption<LocationCategory>[] = [
  { value: 'all', label: 'Todas las categorías' },
  ...LOCATION_CATEGORIES.map((value) => ({
    value,
    label: LOCATION_CATEGORY_LABELS[value],
  })),
];

export const LOCATION_CIRCUIT_FILTER_OPTIONS: FilterOption<LocationCircuit>[] = [
  { value: 'all', label: 'Todos los circuitos' },
  ...LOCATION_CIRCUITS.map((value) => ({
    value,
    label: LOCATION_CIRCUIT_LABELS[value],
  })),
];

export const LOCATION_TAG_FILTER_OPTIONS: FilterOption<LocationTag>[] = [
  { value: 'all', label: 'Todas las etiquetas' },
  ...LOCATION_TAGS.map((value) => ({
    value,
    label: LOCATION_TAG_LABELS[value],
  })),
];

export const LOCATION_CIRCUIT_CHOICES: ChoiceOption<LocationCircuit>[] =
  LOCATION_CIRCUITS.map((value) => ({
    value,
    label: LOCATION_CIRCUIT_LABELS[value],
  }));

export const LOCATION_TAG_CHOICES: ChoiceOption<LocationTag>[] =
  LOCATION_TAGS.map((value) => ({
    value,
    label: LOCATION_TAG_LABELS[value],
  }));

export const LOCATION_VERIFICATION_CHOICES: ChoiceOption<LocationVerificationLevel>[] =
  LOCATION_VERIFICATION_LEVELS.map((value) => ({
    value,
    label: LOCATION_VERIFICATION_LABELS[value],
  }));

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'location.created': 'POI creado',
  'location.updated': 'POI actualizado',
  'location.deleted': 'POI archivado',
  'location.restored': 'POI restaurado',
  'location.image.uploaded': 'Imagen añadida',
  'location.image.removed': 'Imagen eliminada',
};
