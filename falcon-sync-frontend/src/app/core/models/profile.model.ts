import type { Adventure } from './adventure.model';

export interface Profile {
  id: string;
  name: string;
  username: string | null;
  email: string;
  bio: string;
  role: 'user' | 'moderator' | 'admin';
  isActive: boolean;
  mustChangePassword: boolean;
  hasAvatar: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStats {
  totalCheckIns: number;
  uniqueLocations: number;
  totalAdventures: number;
  startedAdventures: number;
  completedAdventures: number;
  totalStops: number;
  visitedStops: number;
}

export interface ProfileAdventure extends Adventure {
  totalStops: number;
  visitedStops: number;
  percentage: number;
  completed: boolean;
  lastVisitAt: string | null;
}

export interface ProfileCheckIn {
  id: string;
  createdAt: string;
  distanceMeters: number;
  photoAvailable: boolean;
  photoUrl: string | null;
  location: {
    id: string;
    title: string;
    slug: string;
    images: string[];
    coordinates: [number, number] | null;
  };
}

export interface ProfileResponse {
  data: {
    profile: Profile;
    stats: ProfileStats;
    adventures: ProfileAdventure[];
    recentCheckIns: ProfileCheckIn[];
  };
}

export interface ProfileUpdatePayload {
  name?: string;
  username?: string;
  bio?: string;
}

export interface ProfileUpdateResponse {
  data: {
    profile: Profile;
  };
}
