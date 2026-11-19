export const DAMAGE_CATEGORIES = [
  'structural',
  'moisture',
  'cracks',
  'material_loss',
  'vandalism',
  'vegetation',
  'fire',
  'collapse_risk',
  'other',
] as const;

export type DamageCategory = (typeof DAMAGE_CATEGORIES)[number];

export const REPORT_STATES = [
  'received',
  'triaged',
  'accepted',
  'rejected',
  'converted',
  'closed',
] as const;

export type ReportState = (typeof REPORT_STATES)[number];

export const INSPECTION_TYPES = ['routine', 'follow_up', 'emergency', 'post_intervention'] as const;

export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const INSPECTION_STATES = [
  'planned',
  'in_progress',
  'submitted',
  'returned',
  'reviewed',
  'closed',
  'cancelled',
] as const;

export type InspectionState = (typeof INSPECTION_STATES)[number];

export const INSPECTION_RESULTS = ['good', 'fair', 'poor'] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INTERVENTION_TYPES = [
  'repair',
  'stabilization',
  'cleaning',
  'restoration',
  'monitoring',
  'other',
] as const;

export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const INTERVENTION_STATES = [
  'proposed',
  'approved',
  'in_progress',
  'completed',
  'verified',
  'rejected',
] as const;

export type InterventionState = (typeof INTERVENTION_STATES)[number];

export const HERITAGE_ASSET_TYPES = [
  'building',
  'monument',
  'urban_space',
  'archaeological_site',
  'museum',
  'natural_site',
  'other',
] as const;

export type HeritageAssetType = (typeof HERITAGE_ASSET_TYPES)[number];

export interface ConservationListMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ConservationListResponse<T> {
  data: T[];
  meta: ConservationListMeta;
}

export interface HeritageAsset {
  id: string;
  code: string;
  name: string;
  type: HeritageAssetType;
  locationId?: string | null;
  unescoStatus: string;
  protectionLevel: string;
  address?: string;
  description?: string;
  geometry?: {
    type: 'Point' | 'Polygon';
    coordinates: unknown;
  } | null;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ConservationHistoryEvent {
  id: string;
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  actorId: string;
  occurredAt: string;
  fromState?: string;
  toState?: string;
  reason?: string;
}

export interface ReportTriage {
  decision?: 'accept' | 'reject' | 'close';
  triagedBy?: string;
  triagedAt?: string;
}

export interface Report {
  id: string;
  reporterId: string;
  heritageAssetId?: string | null;
  locationId?: string | null;
  category: DamageCategory;
  description: string;
  capturedAt: string;
  gps?: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  accuracyMeters?: number | null;
  state: ReportState;
  triage?: ReportTriage;
  rejectionReason?: string;
  inspectionId?: string | null;
  evidenceIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  history?: ConservationHistoryEvent[];
}

export interface InspectionFinding {
  findingId: string;
  category: DamageCategory;
  description: string;
  severityProposed: Severity;
  severityConfirmed?: Severity | null;
  requiresIntervention: boolean;
  state: 'proposed' | 'confirmed' | 'discarded' | 'reopened' | 'resolved';
  evidenceIds: string[];
  proposedBy: string;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
}

export interface Inspection {
  id: string;
  assetId: string;
  reportId?: string | null;
  inspectorId: string;
  reviewerId?: string | null;
  type: InspectionType;
  state: InspectionState;
  scope: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  closedAt?: string | null;
  returnedAt?: string | null;
  reviewNotes?: string;
  result?: InspectionResult | null;
  noFindingsDeclared: boolean;
  findings: InspectionFinding[];
  evidenceIds: string[];
  history: ConservationHistoryEvent[];
  closureJustification?: string;
  cancellationReason?: string;
  version: number;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  interventions?: Intervention[];
}

export interface Intervention {
  id: string;
  inspectionId: string;
  findingIds: string[];
  type: InterventionType;
  description: string;
  state: InterventionState;
  proposedBy: string;
  approvedBy?: string | null;
  executorId?: string | null;
  verifierId?: string | null;
  rejectionReason?: string;
  approvedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  verifiedAt?: string | null;
  evidenceIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceOwnerType = 'Report' | 'Inspection' | 'Intervention';

export interface Evidence {
  id: string;
  ownerType: EvidenceOwnerType;
  ownerId: string;
  findingId?: string | null;
  mimeType: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  sha256: string;
  capturedAt?: string | null;
  gps?: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  accuracyMeters?: number | null;
  uploadedBy: string;
  purpose: string;
  scanStatus: string;
  exifStripped: boolean;
  retentionUntil?: string | null;
  legalHold: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspectorOption {
  id: string;
  name: string;
}

export interface CreateReportPayload {
  heritageAssetId?: string;
  locationId?: string;
  category: DamageCategory;
  description: string;
  capturedAt?: string;
  gps?: {
    type: 'Point';
    coordinates: [number, number];
  };
  accuracyMeters?: number;
}

export interface TriageReportPayload {
  decision?: 'accept' | 'reject' | 'close';
  reason?: string;
  notes?: string;
}

export interface ConvertReportPayload {
  assetId?: string;
  inspectorId?: string;
  reviewerId: string;
  type?: InspectionType;
  scope: string;
  scheduledAt?: string;
}

export interface CreateInspectionPayload {
  assetId: string;
  inspectorId?: string;
  reviewerId: string;
  type: InspectionType;
  scope: string;
  scheduledAt?: string;
}

export interface AddFindingPayload {
  category: DamageCategory;
  description: string;
  severityProposed: Severity;
  requiresIntervention: boolean;
}

export interface ReviewInspectionPayload {
  decision: 'approve' | 'return';
  result?: InspectionResult;
  findings?: Record<string, Severity>;
  notes?: string;
}

export interface ProposeInterventionPayload {
  findingIds: string[];
  type: InterventionType;
  description: string;
}

export interface TransitionInterventionPayload {
  action: 'approve' | 'reject' | 'start' | 'complete' | 'verify';
  reason?: string;
}

export interface CreateAssetPayload {
  code: string;
  name: string;
  type: HeritageAssetType;
  status: 'active';
  locationId?: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  address?: string;
  description?: string;
}
