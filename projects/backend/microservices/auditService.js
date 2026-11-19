import AuditLog from '../databases/models/AuditLog.js';

export async function recordAudit({
  request,
  action,
  entityType = 'Location',
  entityId,
  summary,
  metadata = {},
  required = false,
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
    // La auditoría no debe impedir la operación principal, salvo que la
    // transición sea crítica y el llamador exija el registro obligatorio.
    console.error('[FalconSync] No se pudo registrar la auditoría:', error);

    if (required) {
      throw error;
    }

    return null;
  }
}
