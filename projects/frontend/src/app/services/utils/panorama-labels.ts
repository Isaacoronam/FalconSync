import type {
  HotspotType,
  PanoramaStatus,
  PanoramaVisibility,
} from '../../models/panorama.model';

export const PANORAMA_STATUS_LABELS: Record<PanoramaStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  published: 'Publicado',
  archived: 'Archivado',
};

export const PANORAMA_VISIBILITY_LABELS: Record<PanoramaVisibility, string> = {
  public: 'Visita turística',
  inspection: 'Inspección interna',
};

export const HOTSPOT_TYPE_LABELS: Record<HotspotType, string> = {
  scene: 'Otra escena',
  location: 'Ficha de un lugar',
  info: 'Información interna',
};

export function panoramaStatusBadgeClass(status: PanoramaStatus): string {
  switch (status) {
    case 'draft':
      return 'admin-badge--draft';
    case 'approved':
      return 'admin-badge--approved';
    case 'published':
      return 'admin-badge--published';
    case 'archived':
      return 'admin-badge--archived';
  }
}

export function panoramaVisibilityBadgeClass(
  visibility: PanoramaVisibility,
): string {
  return visibility === 'public'
    ? 'admin-badge--published'
    : 'admin-badge--inspection';
}

export function formatPanoramaDate(value: string | null | undefined): string {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatPanoramaBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
