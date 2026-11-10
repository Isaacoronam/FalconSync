import type {
  ConservationStatus,
  FalconLocation,
  LocationCategory,
  LocationCircuit,
  LocationStatus,
  LocationTag,
  LocationVerificationLevel,
} from './location.model';

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  actorEmail: string;
  entityType: 'Location';
  entityId: string;
  summary: string;
  metadata: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AdminSummary {
  users: number;
  locations: number;
  locationsByStatus: {
    published: number;
    draft: number;
    archived: number;
  };
  byRole: {
    admin: number;
    moderator: number;
    user: number;
  };
  recentActivity: AuditEntry[];
  generatedAt: string;
}

export interface AdminLocation extends FalconLocation {
  status: LocationStatus;
  deletedAt: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedBy?: string | null;
}

export interface AdminLocationsResponse {
  data: AdminLocation[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminLocationFilters {
  q?: string;
  status?: LocationStatus | 'all';
  category?: LocationCategory | 'all';
  circuit?: LocationCircuit | 'all';
  tag?: LocationTag | 'all';
  page?: number;
  limit?: number;
}

export interface AdminLocationPayload {
  title: string;
  slug?: string;
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
  conservationStatus: ConservationStatus;
  sourceUrl?: string;
  coordinateSource?: string;
  coordinateVerifiedAt?: string | null;
  verificationLevel: LocationVerificationLevel;
  audioGuideUrl?: string;
  status: Exclude<LocationStatus, 'archived'>;
  isProvisional: boolean;
  isCatalogVisible: boolean;
  latitude: number;
  longitude: number;
  images?: string[];
}

export interface AuditResponse {
  data: AuditEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
