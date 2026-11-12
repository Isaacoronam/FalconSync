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

export function achievementCategoryLabel(
  achievement: UserAchievement,
): string {
  if (achievement.type === 'adventure') {
    return 'Insignia anterior';
  }

  return LOCATION_CATEGORY_LABELS[achievement.category ?? ''] ?? 'Lugar';
}
