import {
  DamageCategory,
  HeritageAssetType,
  InspectionResult,
  InspectionState,
  InspectionType,
  InterventionState,
  InterventionType,
  ReportState,
  Severity,
} from '../../models/conservation.model';

export const DAMAGE_CATEGORY_LABELS: Record<DamageCategory, string> = {
  structural: 'Estructural',
  moisture: 'Humedad',
  cracks: 'Fisuras',
  material_loss: 'Pérdida de material',
  vandalism: 'Vandalismo',
  vegetation: 'Vegetación',
  fire: 'Fuego',
  collapse_risk: 'Riesgo de colapso',
  other: 'Otro',
};

export const REPORT_STATE_LABELS: Record<ReportState, string> = {
  received: 'Recibido',
  triaged: 'En triaje',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  converted: 'Convertido',
  closed: 'Cerrado',
};

export const INSPECTION_STATE_LABELS: Record<InspectionState, string> = {
  planned: 'Planificada',
  in_progress: 'En ejecución',
  submitted: 'En revisión',
  returned: 'Devuelta',
  reviewed: 'Revisada',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  routine: 'Rutinaria',
  follow_up: 'Seguimiento',
  emergency: 'Emergencia',
  post_intervention: 'Post-intervención',
};

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  good: 'Bueno',
  fair: 'Regular',
  poor: 'Deficiente',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export const INTERVENTION_STATE_LABELS: Record<InterventionState, string> = {
  proposed: 'Propuesta',
  approved: 'Aprobada',
  in_progress: 'En ejecución',
  completed: 'Completada',
  verified: 'Verificada',
  rejected: 'Rechazada',
};

export const INTERVENTION_TYPE_LABELS: Record<InterventionType, string> = {
  repair: 'Reparación',
  stabilization: 'Estabilización',
  cleaning: 'Limpieza',
  restoration: 'Restauración',
  monitoring: 'Monitoreo',
  other: 'Otra',
};

export const ASSET_TYPE_LABELS: Record<HeritageAssetType, string> = {
  building: 'Edificación',
  monument: 'Monumento',
  urban_space: 'Espacio urbano',
  archaeological_site: 'Sitio arqueológico',
  museum: 'Museo',
  natural_site: 'Sitio natural',
  other: 'Otro',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EVENT_LABELS: Record<string, string> = {
  'report.created': 'Reporte creado',
  'report.triaged': 'Reporte en triaje',
  'report.accepted': 'Reporte aceptado',
  'report.rejected': 'Reporte rechazado',
  'report.closed': 'Reporte cerrado',
  'report.converted': 'Reporte convertido en inspección',
  'inspection.created': 'Inspección creada',
  'inspection.started': 'Inspección iniciada',
  'inspection.resumed': 'Inspección reanudada',
  'inspection.submitted': 'Inspección enviada a revisión',
  'inspection.returned': 'Inspección devuelta',
  'inspection.reviewed': 'Inspección revisada',
  'inspection.closed': 'Inspección cerrada',
  'finding.proposed': 'Hallazgo propuesto',
  'intervention.proposed': 'Intervención propuesta',
  'intervention.approved': 'Intervención aprobada',
  'intervention.rejected': 'Intervención rechazada',
  'intervention.started': 'Intervención iniciada',
  'intervention.completed': 'Intervención completada',
  'intervention.verified': 'Intervención verificada',
  'evidence.uploaded': 'Evidencia cargada',
  'evidence.integrity_failed': 'Fallo de integridad de evidencia',
};

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replaceAll('.', ' ');
}

export function shortId(value: string | null | undefined): string {
  return value ? value.slice(-6) : '—';
}
