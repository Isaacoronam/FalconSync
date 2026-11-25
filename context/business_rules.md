# Reglas de negocio vigentes

Estas reglas se resumen de la implementación y documentación del proyecto; no se atribuyen
a una unidad académica.

> **Migración en curso:** el backend ya acepta `historian` e `inspector`; `moderator` se
> conserva como legacy temporal y la migración de datos aún no se ejecutó. La matriz
> objetivo está en [`docs/RBAC.md`](../docs/RBAC.md).

## Usuarios y permisos

- Los roles definidos son `user`, `moderator` (legacy temporal), `historian`, `inspector`
  y `admin`. Solo `admin` accede a `/api/admin`; las rutas de conservación y evidencia se
  autorizan por capacidad y, además, por propietario o asignación del recurso.
- Las rutas bajo `/api/admin` requieren autenticación y rol `admin`.
- La interfaz `/admin/usuarios` permite cambiar rol, activar o desactivar cuentas y revocar
  sesiones. Exige la contraseña actual del administrador, revoca las sesiones del afectado y
  audita de forma obligatoria. El último admin y la propia cuenta están protegidos.
- Las rutas privadas de perfil y check-in requieren autenticación.
- El perfil y sus imágenes privadas pertenecen al usuario autenticado; no son recursos
  públicos.

## Roles y matriz RBAC

Detalle completo, reglas por recurso y migración en [`docs/RBAC.md`](../docs/RBAC.md) (versión 1.2). La autorización se aplica en el servidor; los guards de Angular solo mejoran la experiencia.

| Rol de sistema | Etiqueta visible | Propósito | Estado |
|---|---|---|---|
| `user` | Turista | Consulta, check-in y reporte de daños. | Vigente |
| `historian` | Historiador | Historia, fuentes y contenido editorial. | Rol asignable; permisos aplicados por capacidad donde existe endpoint |
| `inspector` | Inspector | Triaje, inspección, hallazgos e intervenciones. | Rol asignable; permisos aplicados por capacidad y asignación del recurso |
| `admin` | Administrador | Cuentas, roles, configuración no secreta y auditoría. | Vigente |
| `moderator` | Moderador | Solo compatibilidad durante la migración. Sin capacidades nuevas. | Legacy temporal |

Matriz rol × capacidad (política objetivo; el estado de implementación está en `docs/RBAC.md` §6.1):

| Capacidad | Visitante | `user` | `historian` | `inspector` | `admin` |
|---|---:|---:|---:|---:|---:|
| CAP-01 `report.create` | No | Sí | Sí | Sí | Sí |
| CAP-02 `report.read.own` | No | Sí | Sí | Sí | Sí |
| CAP-03 `report.read.all` | No | No | No | Sí | No |
| CAP-04 `report.triage` | No | No | No | Sí | No |
| CAP-05 `inspection.create` | No | No | No | Sí | No |
| CAP-06 `inspection.read.assigned` | No | No | No | Sí | No |
| CAP-07 `inspection.read.audit` | No | No | No | No | Sí, solo metadatos |
| CAP-08 `inspection.execute` | No | No | No | Sí, asignada | No |
| CAP-09 `inspection.review` | No | No | No | Sí, asignada y distinta del emisor | No |
| CAP-10 `inspection.close` | No | No | No | Sí, revisada | No |
| CAP-11 `finding.propose` | No | No | No | Sí, asignada | No |
| CAP-12 `finding.confirm` | No | No | No | Sí, como revisor | No |
| CAP-13 `intervention.propose` | No | No | No | Sí | No |
| CAP-14 `intervention.verify` | No | No | No | Sí, distinto del ejecutor | No |
| CAP-15 `evidence.upload` | No | Sí, a su reporte | No | Sí, a su recurso | No |
| CAP-16 `evidence.read.assigned` | No | Sí, a su reporte | No | Sí, asignada | No |
| CAP-17 `evidence.read.audit` | No | No | No | No | Sí, metadatos y accesos |
| CAP-18 `asset.read` | Sí, datos públicos | Sí | Sí | Sí | Sí |
| CAP-19 `asset.manage` | No | No | No | Sí | Sí, inventario; no inspección |
| CAP-20 `content.edit` | No | No | Sí | No | No |
| CAP-21 `content.review` | No | No | Sí | No | No |
| CAP-22 `account.manage` | No | No | No | No | Sí |
| CAP-23 `audit.read` | No | No | No | No | Sí |
| CAP-24 `source.read` | No | No | Sí | Sí | Sí |
| CAP-25 `source.manage` | No | No | No | No | Sí |
| CAP-26 `panorama.publish` | No | No | Sí | No | No |
| CAP-27 `panorama.manage` | No | No | No | No | Sí |
| CAP-28 `break_glass.inspection` | No | No | No | No | Excepcional |
| CAP-29 `notification.read.own` | No | Sí | Sí | Sí | Sí |
| CAP-30 `realtime.connect` | No | Sí | Sí | Sí | Sí |
| CAP-31 `assistant.tourist` | Sí, con rate limit | Sí | Sí | Sí | Sí |
| CAP-32 `assistant.inspection` | No | No | Consulta | Sí | No |

Un admin no puede usar su rol para inspeccionar, confirmar severidad ni cerrar una inspección. Un inspector no puede revisar su propia inspección ni verificar una intervención que él mismo ejecutó.

## Puntos de interés

- El catálogo público debe excluir POI archivados, eliminados, provisionales y excluidos
  del catálogo.
- Para publicar un POI, no debe ser provisional y debe tener fecha de verificación de
  coordenadas.
- La fecha de revisión documental no equivale a una inspección o verificación en campo.
- La historia editorial y sus fuentes deben gestionarse separadas de la fuente cartográfica.
- No asignar un estado de conservación como hecho verificado sin evidencia; los POI del
  catálogo documentado están en estado `unknown`.
- La clasificación patrimonial se registra en `patrimonialStatus` (D-24, aceptada el
  2026-11-20); la etiqueta `unesco` no prueba pertenencia al bien y `sin_clasificar` no
  autoriza afirmar patrimonio.

## Check-in

- Un check-in se asocia a un POI y a un usuario, con QR y geocerca validados por el servidor.
- Un usuario no puede registrar dos veces el mismo POI.
- La foto del check-in es opcional y se almacena como contenido privado.

## Asistentes RAG (planificados, no implementados)

- RAG v1 es extractivo y sin proveedor externo: responde con citas literales de máximo 25
  palabras o hechos estructurados verificados, o se abstiene.
- El asistente técnico usa fuentes A/B/C técnicas y no datos de inspección en v1; el turístico
  usa A–D y E etiquetada, sin búsqueda externa en vivo.
- La ingesta es por CLI y manifiestos; no hay subida de PDF en v1.
- El asistente turístico anónimo no persiste conversaciones; el técnico conserva 90 días.

## Referencias de detalle

- [Reglas editoriales y publicación de POI](../docs/POI.md)
- [Autenticación y sesiones](../docs/AUTENTICACION.md)
- [Check-in y QR](../docs/AVENTURAS.md)
- Implementación de permisos: `projects/backend/api/admin/adminRoutes.js` y
  `projects/backend/middlewares/auth.js`.
