export type AchievementType = 'location' | 'adventure';

export interface UserAchievement {
  id: string;
  type: AchievementType;
  sourceId: string;
  sourceSlug: string;
  name: string;
  description: string;
  image: string | null;
  category: string | null;
  awardedAt: string;
  sourceActive: boolean;
}

export const LOCATION_CATEGORY_LABELS: Record<string, string> = {
  architecture: 'Arquitectura',
  monument: 'Monumento',
  nature: 'Naturaleza',
  religious: 'Religioso',
  urban: 'Espacio urbano',
  museum: 'Museo',
  viewpoint: 'Mirador',
  commerce: 'Comercio',
  service: 'Servicio',
};

const CATEGORY_ICONS: Record<string, string> = {
  architecture: '⌂',
  monument: '▲',
  nature: '❧',
  religious: '✦',
  urban: '▦',
  museum: '▣',
  viewpoint: '◉',
  commerce: '◆',
  service: '●',
};

export function achievementIcon(achievement: UserAchievement): string {
  if (achievement.type === 'adventure') {
    return '★';
  }

  return CATEGORY_ICONS[achievement.category ?? ''] ?? '✧';
}

const CATEGORY_BADGES: Record<string, string> = {
  architecture: 'images/badges/architecture.svg',
  monument: 'images/badges/monument.svg',
  nature: 'images/badges/nature.svg',
  religious: 'images/badges/religious.svg',
  urban: 'images/badges/urban.svg',
  museum: 'images/badges/museum.svg',
  viewpoint: 'images/badges/viewpoint.svg',
  commerce: 'images/badges/commerce.svg',
  service: 'images/badges/service.svg',
};

/**
 * La insignia persistida puede no tener imagen (los registros anteriores a
 * esta iteración guardan `null`). En ese caso se usa el medallón de la
 * categoría real; nunca se inventa el nombre ni la descripción.
 */
export function achievementBadgeImage(achievement: UserAchievement): string {
  if (achievement.image) {
    return achievement.image;
  }

  if (achievement.type === 'adventure') {
    return 'images/badges/adventure.svg';
  }

  return CATEGORY_BADGES[achievement.category ?? ''] ?? 'images/badges/default.svg';
}

export function achievementCategoryLabel(achievement: UserAchievement): string {
  if (achievement.type === 'adventure') {
    return 'Insignia anterior';
  }

  return LOCATION_CATEGORY_LABELS[achievement.category ?? ''] ?? 'Lugar';
}
