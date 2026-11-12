import AuditLog from '../models/AuditLog.js';

export async function recordAudit({
  request,
  action,
  entityType = 'Location',
  entityId,
  summary,
  metadata = {},
}) {
  try {
    return await AuditLog.create({
      action,
      actor: request.user._id,
      actorEmail: request.user.email,
      entityType,
      entityId,
      summary,
      metadata,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  } catch (error) {
    // La auditoría no debe impedir la operación principal, pero el fallo
    // queda registrado para poder investigarlo.
    console.error('[FalconSync] No se pudo registrar la auditoría:', error);
    return null;
  }
}
