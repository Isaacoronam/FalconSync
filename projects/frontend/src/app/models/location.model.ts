export const LOCATION_CATEGORIES = [
  'architecture',
  'monument',
  'nature',
  'religious',
  'urban',
  'museum',
  'viewpoint',
  'commerce',
  'service',
] as const;

export type LocationCategory = (typeof LOCATION_CATEGORIES)[number];

export const LOCATION_CIRCUITS = [
  'casco-historico',
  'museos',
  'naturaleza-miradores',
  'espacios-urbanos',
  'la-vela',
  'comercio-servicios',
] as const;

export type LocationCircuit = (typeof LOCATION_CIRCUITS)[number];

export const LOCATION_TAGS = [
  'colonial',
  'unesco',
  'gastronomy',
  'theater',
  'sports',
  'promenade',
  'market',
  'crafts',
  'family',
  'photogenic',
  'free-entry',
  'guided-tour',
] as const;

export type LocationTag = (typeof LOCATION_TAGS)[number];

export const LOCATION_VERIFICATION_LEVELS = [
  'unverified',
  'single-source',
  'verified',
] as const;

export type LocationVerificationLevel =
  (typeof LOCATION_VERIFICATION_LEVELS)[number];

export type ConservationStatus = 'good' | 'fair' | 'poor' | 'unknown';

export type LocationStatus = 'draft' | 'published' | 'archived';

export interface ImageCredit {
  url: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string;
}

export interface FalconLocation {
  id: string;
  title: string;
  slug: string;
  category: LocationCategory;
  description: string;
  address?: string;
  circuits: LocationCircuit[];
  tags: LocationTag[];
  historicalPeriod?: string;
  historicalStory?: string;
  interestingFacts?: string[];
  visitorInfo?: string;
  contentSources?: string[];
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  images: string[];
  imageCredits?: ImageCredit[];
  audioGuideUrl?: string;
  conservationStatus: ConservationStatus;
  sourceUrl?: string;
  coordinateSource?: string;
  coordinateVerifiedAt?: string | null;
  verificationLevel: LocationVerificationLevel;
  isProvisional: boolean;
  isCatalogVisible?: boolean;
  checkInTokenConfigured?: boolean;
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
