export type AdventureDifficulty = 'easy' | 'moderate' | 'challenging';
export type AdventureStatus = 'draft' | 'published' | 'archived';

export const ADVENTURE_DIFFICULTIES: AdventureDifficulty[] = [
  'easy',
  'moderate',
  'challenging',
];

export interface AdventureBadge {
  name: string;
  description?: string;
  image?: string;
}

export interface Adventure {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  difficulty: AdventureDifficulty;
  estimatedMinutes: number;
  coverImage?: string;
  badge: AdventureBadge | null;
  status: AdventureStatus;
  stopsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdventureLocation {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  images: string[];
  conservationStatus: string;
  location: { type: 'Point'; coordinates: [number, number] };
}

export interface AdventureStop {
  id: string;
  order: number;
  didacticText?: string;
  instructions?: string;
  location: AdventureLocation;
}

export interface AdventureProgressStop {
  id: string;
  order: number;
  didacticText?: string;
  instructions?: string;
  visited: boolean;
  checkInAt: string | null;
  location: AdventureLocation;
}

export interface AdventureProgress {
  adventure: Adventure;
  stops: AdventureProgressStop[];
  totalStops: number;
  visitedStops: number;
  remainingStops: number;
  percentage: number;
  nextStop: AdventureProgressStop | null;
  completed: boolean;
  completedAt: string | null;
}

export interface CheckInPayload {
  locationId: string;
  token: string;
  latitude: number;
  longitude: number;
  photo?: File;
}

export interface CheckInPhoto {
  filename: string;
  mimeType: string;
  size: number;
}

export interface CheckIn {
  id: string;
  user: string;
  location: string;
  coordinates: { type: 'Point'; coordinates: [number, number] };
  distanceMeters: number;
  tokenVersion: number;
  photo?: CheckInPhoto | null;
  createdAt: string;
}

export interface QrRotateResponse {
  data: {
    location: { id: string; title: string };
    token: string;
    tokenVersion: number;
    rotatedAt: string;
    format: 'svg' | 'png';
    qrDataUrl: string;
  };
}

export interface AdminAdventureFilters {
  q?: string;
  status?: AdventureStatus | 'all';
  page?: number;
  limit?: number;
}

export interface AdminAdventuresResponse {
  data: Adventure[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminAdventurePayload {
  title: string;
  slug?: string;
  summary: string;
  description: string;
  difficulty: AdventureDifficulty;
  estimatedMinutes: number;
  coverImage?: string;
  badge?: AdventureBadge | null;
}

export interface AdminAdventureStopPayload {
  locationId: string;
  order?: number;
  didacticText?: string;
  instructions?: string;
}

export interface AdminAdventureStop {
  id: string;
  order: number;
  didacticText?: string;
  instructions?: string;
  location: {
    id: string;
    title: string;
    slug: string;
    status: string;
    deletedAt: string | null;
  };
}

export interface ReorderPayload {
  order: string[];
}

export const ADVENTURE_DIFFICULTY_LABELS: Record<AdventureDifficulty, string> = {
  easy: 'Fácil',
  moderate: 'Moderada',
  challenging: 'Difícil',
};

export const ADVENTURE_STATUS_LABELS: Record<AdventureStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  archived: 'Archivada',
};

export function difficultyLabel(difficulty: AdventureDifficulty): string {
  return ADVENTURE_DIFFICULTY_LABELS[difficulty];
}

export function statusLabel(status: AdventureStatus): string {
  return ADVENTURE_STATUS_LABELS[status];
}
