export type LocationCategory = 'architecture' | 'monument' | 'nature' | 'religious' | 'urban';

export type ConservationStatus = 'good' | 'fair' | 'poor' | 'unknown';

export type LocationStatus = 'draft' | 'published' | 'archived';

export interface LocationCategoryOption {
  value: LocationCategory | 'all';
  label: string;
}

export interface FalconLocation {
  id: string;
  title: string;
  slug: string;
  category: LocationCategory;
  description: string;
  historicalPeriod?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  images: string[];
  audioGuideUrl?: string;
  conservationStatus: ConservationStatus;
  sourceUrl?: string;
  isProvisional: boolean;
  status?: LocationStatus;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationsResponse {
  data: FalconLocation[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const LOCATION_CATEGORIES: LocationCategoryOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'architecture', label: 'Arquitectura civil' },
  { value: 'monument', label: 'Monumentos' },
  { value: 'religious', label: 'Religiosos' },
  { value: 'nature', label: 'Naturaleza' },
  { value: 'urban', label: 'Espacios urbanos' },
];
