export const PANORAMA_STATUSES = ['draft', 'approved', 'published', 'archived'] as const;

export type PanoramaStatus = (typeof PANORAMA_STATUSES)[number];

export const PANORAMA_VISIBILITIES = ['public', 'inspection'] as const;

export type PanoramaVisibility = (typeof PANORAMA_VISIBILITIES)[number];

export type PanoramaProjection = 'equirectangular';

export const HOTSPOT_TYPES = ['scene', 'location', 'info'] as const;

export type HotspotType = (typeof HOTSPOT_TYPES)[number];

export interface PanoramaHotspot {
  hotspotId: string;
  label: string;
  type: HotspotType;
  yaw: number;
  pitch: number;
  targetPanoramaId: string | null;
  targetPanoramaTitle: string | null;
  targetLocationId: string | null;
  targetLocationSlug: string | null;
  targetUrl: string | null;
  ariaLabel: string;
}

export interface PanoramaLocationRef {
  id: string;
  title: string;
  slug: string | null;
  status: string | null;
}

export interface PanoramaAssetRef {
  id: string;
  code: string | null;
  name: string | null;
  status: string | null;
}

export interface PanoramaSummary {
  id: string;
  title: string;
  locationId: string | null;
  assetId: string | null;
  thumbnailUrl: string | null;
  projection: PanoramaProjection;
  capturedAt: string | null;
  credits: string;
  width: number;
  height: number;
  location: PanoramaLocationRef | null;
  asset: PanoramaAssetRef | null;
}

export interface PanoramaFallback {
  imageUrl: string;
  alt: string;
  description: string;
  transcript: string | null;
}

export interface PanoramaDetail extends PanoramaSummary {
  description: string;
  imageUrl: string;
  hotspots: PanoramaHotspot[];
  fallback: PanoramaFallback;
  license: string;
  licenseUrl: string | null;
  author: string;
  status: 'published';
  visibility: 'public';
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PanoramaListResponse {
  data: PanoramaSummary[];
  meta: PageMeta;
}

export interface PanoramaResponse {
  data: PanoramaDetail;
}

export interface AdminPanoramaSummary {
  id: string;
  title: string;
  locationId: string | null;
  assetId: string | null;
  thumbnailUrl: string | null;
  projection: PanoramaProjection;
  capturedAt: string | null;
  credits: string;
  width: number;
  height: number;
  status: PanoramaStatus;
  visibility: PanoramaVisibility;
  version: number;
  hasDerivative: boolean;
  createdAt: string;
  updatedAt: string;
  location: PanoramaLocationRef | null;
  asset: PanoramaAssetRef | null;
}

export interface AdminPanoramaDetail extends AdminPanoramaSummary {
  description: string;
  imageUrl: string | null;
  hotspots: PanoramaHotspot[];
  fallbackAlt: string;
  fallbackDescription: string;
  transcript: string | null;
  license: string;
  licenseUrl: string | null;
  author: string;
  credit: string;
  rightsDocumented: boolean;
  permitDocumented: boolean;
  rightsNotes: string | null;
  peopleBlurred: boolean;
  consentDocumented: boolean;
  consentNotes: string | null;
  checksum: string;
  derivativeChecksum: string | null;
  thumbnailChecksum: string | null;
  bytes: number;
  derivativeBytes: number | null;
  approvedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface AdminPanoramaListResponse {
  data: AdminPanoramaSummary[];
  meta: PageMeta;
}

export interface AdminPanoramaResponse {
  data: AdminPanoramaDetail;
}

export interface PanoramaFilters {
  locationId?: string;
  assetId?: string;
  page?: number;
  limit?: number;
}

export interface AdminPanoramaFilters extends PanoramaFilters {
  status?: PanoramaStatus | 'all';
  visibility?: PanoramaVisibility | 'all';
  q?: string;
}

export interface PanoramaHotspotPayload {
  hotspotId?: string;
  label: string;
  type: HotspotType;
  yaw: number;
  pitch: number;
  targetPanoramaId?: string | null;
  targetLocationId?: string | null;
  targetUrl?: string | null;
  ariaLabel: string;
}

export interface PanoramaCreatePayload {
  title: string;
  description: string;
  locationId: string;
  visibility: PanoramaVisibility;
  capturedAt: string | null;
  author: string;
  license: string;
  licenseUrl: string | null;
  credit: string;
  rightsDocumented: boolean;
  permitDocumented: boolean;
  rightsNotes: string | null;
  peopleBlurred: boolean;
  consentDocumented: boolean;
  consentNotes: string | null;
  fallbackAlt: string;
  fallbackDescription: string;
  transcript: string | null;
  hotspots: PanoramaHotspotPayload[];
}

export interface PanoramaUpdatePayload {
  title?: string;
  description?: string;
  locationId?: string | null;
  visibility?: PanoramaVisibility;
  capturedAt?: string | null;
  author?: string;
  license?: string;
  licenseUrl?: string | null;
  credit?: string;
  rightsDocumented?: boolean;
  permitDocumented?: boolean;
  rightsNotes?: string | null;
  peopleBlurred?: boolean;
  consentDocumented?: boolean;
  consentNotes?: string | null;
  fallbackAlt?: string;
  fallbackDescription?: string;
  transcript?: string | null;
  hotspots?: PanoramaHotspotPayload[];
}
