# ADR-002 — Roles por capacidades y migración expand-contract

| Campo | Valor |
|---|---|
| Estado | Propuesta |
| Fecha | 2026-11-13 |
| Decisores | Responsable del proyecto |
| Relacionados | [`../RBAC.md`](../RBAC.md), [`../REQUISITOS.md`](../REQUISITOS.md) |

## Contexto

Al redactar esta propuesta, los roles eran `user`, `moderator` y `admin`. `moderator` no
tenía rutas propias y la lista de usuarios del panel era de solo lectura. El plan requiere
separar historiador, inspector y administrador, y evitar que `admin` inspeccione por defecto.

## Decisión

- Roles de producto: `user` (Turista), `historian`, `inspector`, `admin`.
- `moderator` se conserva solo durante la migración, sin capacidades nuevas.
- La autorización se implementa por capacidades en el servidor.
- Migración expand-contract: añadir roles, desplegar código compatible, simular, respaldar,
  convertir `moderator` a `historian`, revocar sesiones y verificar cero `moderator`.
- El último admin activo no puede degradarse ni desactivarse; un admin no puede
  autodegradarse.
- Los cambios sensibles exigen reautenticación y auditoría.
- `break-glass` solo para admin, con motivo, aprobación, vigencia y evento.

## Consecuencias

- Hay que actualizar `User`, autenticación, administración, contadores, filtros, etiquetas,
  guards, pruebas y documentación.
- No se migra `RefreshSession`: el rol vive en `User`.
- El frontend oculta acciones por capacidad, pero el servidor vuelve a verificar.
- `moderator` no se retira del enum hasta la liberación de contract.

### Estado de implementación (2026-11-13)

- Expand completado: `historian` e `inspector` están en el enum y son asignables desde la
  API; `moderator` se conserva como legacy temporal.
- La API administrativa cambia rol, estado y revoca sesiones con reautenticación,
  protecciones y auditoría obligatoria.
- La migración de datos de `moderator` a `historian` no se ejecutó: requiere backup,
  dry-run revisado y autorización.
- La UI de gestión de cuentas está implementada; las capacidades por recurso siguen
  pendientes de las fases siguientes.

## Alternativas consideradas

- Renombrar `moderator` a `historian` directamente: se rechaza por riesgo de cuentas y
  sesiones inconsistentes.
- Crear `tourist` separado de `user`: se rechaza por duplicar identidad y permisos.
- Dar `inspector` a `admin`: se rechaza por romper la separación de funciones.

## Referencias

- Plan, sección 6.
- RBAC, secciones 1 a 8.
