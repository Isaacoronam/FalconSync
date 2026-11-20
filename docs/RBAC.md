# Matriz de roles, capacidades y autorización — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.1 |
| Fecha | 2026-11-13 |
| Estado | Autorización por capacidades aplicada a los endpoints de conservación implementados; las capacidades de módulos aún no construidos son política objetivo. D-16 y D-18 a D-23 siguen pendientes de ratificación formal. |
| Documentos relacionados | [`REQUISITOS.md`](./REQUISITOS.md), [`PLAN-IMPLEMENTACION.md`](./PLAN-IMPLEMENTACION.md), [`SEGURIDAD.md`](./SEGURIDAD.md) |

> La autorización se aplica en el servidor. Un guard de Angular solo mejora la experiencia;
> nunca es el control de acceso. Ocultar un botón no impide invocar la API.

## 1. Roles

| Rol de sistema | Etiqueta visible | Propósito | Estado |
|---|---|---|---|
| `user` | Turista | Consulta, check-in y reporte de daños. | Vigente |
| `historian` | Historiador | Historia, fuentes y contenido editorial. | Rol asignable; permisos aplicados por capacidad donde existe endpoint |
| `inspector` | Inspector | Triaje, inspección, hallazgos e intervenciones. | Rol asignable; permisos aplicados por capacidad y asignación del recurso |
| `admin` | Administrador | Cuentas, roles, configuración no secreta y auditoría. | Vigente |
| `moderator` | Moderador | Solo compatibilidad durante la migración. Sin capacidades nuevas. | Legacy temporal |

`moderator` no se elimina del enum hasta completar la migración y verificar cero cuentas con
ese rol. No se crea un rol `tourist`: “Turista” es la etiqueta de `user`.

## 2. Catálogo de capacidades

| ID | Capacidad | Descripción |
|---|---|---|
| CAP-01 | `report.create` | Crear un reporte propio con evidencia opcional. |
| CAP-02 | `report.read.own` | Leer los reportes propios y su historial. |
| CAP-03 | `report.read.all` | Leer reportes de terceros para triaje. |
| CAP-04 | `report.triage` | Aceptar, rechazar o cerrar un reporte con motivo. |
| CAP-05 | `inspection.create` | Crear y planificar una inspección. |
| CAP-06 | `inspection.read.assigned` | Leer inspecciones asignadas. |
| CAP-07 | `inspection.read.audit` | Leer metadatos y eventos de inspección para auditoría, sin evidencia binaria. |
| CAP-08 | `inspection.execute` | Iniciar, ejecutar y enviar una inspección asignada. |
| CAP-09 | `inspection.review` | Revisar una inspección enviada y confirmar severidad. |
| CAP-10 | `inspection.close` | Cerrar una inspección revisada con intervención verificada o justificación. |
| CAP-11 | `finding.propose` | Añadir hallazgos y severidad propuesta. |
| CAP-12 | `finding.confirm` | Confirmar, descartar o reabrir hallazgos y severidad. |
| CAP-13 | `intervention.propose` | Proponer una intervención. |
| CAP-14 | `intervention.verify` | Verificar una intervención ejecutada por otra persona. |
| CAP-15 | `evidence.upload` | Subir evidencia privada al recurso autorizado. |
| CAP-16 | `evidence.read.assigned` | Leer evidencia de un recurso asignado. |
| CAP-17 | `evidence.read.audit` | Leer metadatos y registro de acceso, no el binario, para auditoría. |
| CAP-18 | `asset.read` | Consultar activos patrimoniales. |
| CAP-19 | `asset.manage` | Crear y mantener activos patrimoniales. |
| CAP-20 | `content.edit` | Editar historia, fuentes y contenido editorial. |
| CAP-21 | `content.review` | Revisar y aprobar contenido editorial. |
| CAP-22 | `account.manage` | Gestionar cuentas, roles y estado. |
| CAP-23 | `audit.read` | Consultar auditoría y eventos de dominio. |
| CAP-24 | `source.read` | Consultar el registro de fuentes RAG. |
| CAP-25 | `source.manage` | Registrar, versionar y retirar fuentes RAG. |
| CAP-26 | `panorama.publish` | Aprobar y publicar panoramas 360°. |
| CAP-27 | `panorama.manage` | Gestionar la configuración técnica de panoramas. |
| CAP-28 | `break_glass.inspection` | Excepción temporal y auditada para una acción de inspección. |
| CAP-29 | `notification.read.own` | Leer y marcar notificaciones propias. |
| CAP-30 | `realtime.connect` | Abrir una conexión Socket.IO autenticada. |
| CAP-31 | `assistant.tourist` | Usar la guía turística. |
| CAP-32 | `assistant.inspection` | Usar el asistente técnico de inspección. |

## 3. Matriz rol × capacidad

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

Notas:

- “Sí, asignada” exige pertenencia al recurso, no solo el rol.
- “Consulta” del historiador en el asistente técnico es lectura de fuentes; no confirma
  severidad ni cierra inspecciones.
- `asset.manage` para admin es una propuesta de Fase 0: administra inventario, no realiza
  inspecciones. Si se rechaza, la capacidad queda solo para inspector.
- `panorama.publish` para historiador está implementada: el contenido 360° es editorial. La
  configuración técnica y los panoramas de inspección quedan en admin (`panorama.manage`).

## 4. Reglas de autorización por recurso

| Recurso | Regla |
|---|---|
| Reporte | Dueño, inspector con `report.read.all` o admin con `audit.read` (solo metadatos y eventos; sin descripción, identidad del reportante ni GPS). |
| Inspección | Inspector/revisor asignado o admin con `inspection.read.audit` (solo metadatos y eventos; sin alcance, hallazgos ni intervenciones). |
| Hallazgo | Pertenece a una inspección; hereda su autorización. |
| Intervención | Pertenece a una inspección; el ejecutor no puede verificarla. |
| Evidencia | Se autoriza por `ownerType` + `ownerId`; nunca por URL pública. |
| Notificación | Solo el `userId` destinatario. |
| Conversación | Solo el `userId` dueño; admin solo metadatos de auditoría. |
| Panorama público | Solo `published` + `visibility=public`; se sirve por `/api/panoramas` y por la ficha del POI publicado. |
| Panorama de inspección | Nunca se expone por la API turística ni a la curaduría; solo lo gestiona `panorama.manage`. |
| Activo patrimonial | Lectura pública solo de campos publicados; datos técnicos solo internos. |

Reglas adicionales:

- Un inspector no puede revisar su propia inspección. La única excepción es
  `break_glass.inspection`, con motivo, aprobador, vigencia y evento.
- Cada inspección exige al crearla un revisor activo distinto del inspector; solo ese revisor
  puede revisarla y cerrarla.
- Un inspector no puede verificar una intervención que él mismo ejecutó.
- Solo el inspector asignado puede iniciar una intervención y solo su ejecutor puede
  completarla.
- Un admin no puede usar su rol para inspeccionar, confirmar severidad ni cerrar una
  inspección. Si necesita una excepción, usa `break-glass`.
- El historiador no puede aprobar diagnósticos técnicos ni modificar severidades.
- La administración no puede aprobar, publicar ni archivar panoramas turísticos; esa
  decisión es editorial y requiere `panorama.publish`.
- El historiador no puede crear, editar ni gestionar panoramas de inspección.
- El turista no accede a recursos internos ni a evidencia de terceros.

## 5. Mapa de endpoints y capacidades

### 5.1 Endpoints vigentes

| Método y ruta | Acceso | Regla |
|---|---|---|
| `POST /api/auth/register`, `/login`, `/refresh`, `/logout` | Público o cookie | Sin cambio. |
| `GET /api/auth/me` | Autenticado | Usuario actual. |
| `GET /api/locations`, `/near`, `/:slug` | Público | Catálogo publicado. |
| `POST /api/check-ins` | `user` autenticado | Check-in turístico, separado de conservación. |
| `GET/PATCH /api/profile/me`, `/avatar`, `/check-ins` | Dueño | Recurso privado. |
| `GET /api/panoramas`, `/:id`, `/:id/image`, `/:id/thumbnail` | Público | Solo `published` + `visibility=public`; el resto responde `404`. |
| `/api/admin/panoramas*` | `panorama.manage` o `panorama.publish` | Admin gestiona todo; historiador solo públicos. Las transiciones de inspección exigen `panorama.manage`; las turísticas, `panorama.publish`. |
| `/api/admin/*` | `admin` | Se amplía con roles, estado y fuentes. |
| `/api/adventures/*` | Público/autenticado | Compatibilidad heredada. |

### 5.2 Endpoints implementados del dominio

| Método y ruta | Capacidad | Regla de recurso |
|---|---|---|
| `POST /api/reports` | `report.create` | Autenticado; evidencia opcional. |
| `GET /api/reports/mine` | `report.read.own` | Solo propios. |
| `GET /api/reports/:id` | `report.read.own` o `report.read.all` | Dueño o inspector autorizado. |
| `PATCH /api/reports/:id/triage` | `report.triage` | Inspector; motivo obligatorio. |
| `POST /api/reports/:id/convert` | `report.triage` | Idempotente; crea inspección. |
| `GET /api/inspections` | `inspection.read.assigned` o `inspection.read.audit` | Bandeja filtrada por asignación. |
| `POST /api/inspections` | `inspection.create` | Inspector. |
| `GET /api/inspections/:id` | `inspection.read.assigned` o `inspection.read.audit` | Asignado o auditoría. |
| `POST /api/inspections/:id/start` | `inspection.execute` | Asignado. |
| `POST /api/inspections/:id/submit` | `inspection.execute` | Asignado; exige hallazgo o “sin hallazgos”. |
| `POST /api/inspections/:id/review` | `inspection.review` | Revisor distinto del emisor. |
| `POST /api/inspections/:id/close` | `inspection.close` | Intervención verificada o justificación. |
| `POST /api/inspections/:id/findings` | `finding.propose` | Asignado. |
| `PATCH /api/inspections/:id/findings/:findingId` | `finding.confirm` | Revisor. |
| `POST /api/inspections/:id/interventions` | `intervention.propose` | Inspector. |
| `PATCH /api/interventions/:id` | `intervention.verify` | Distinto del ejecutor. |
| `POST /api/evidence` | `evidence.upload` | Alcance del recurso. |
| `GET /api/evidence` | `evidence.read.assigned` o `evidence.read.audit` | Alcance por propietario. |
| `GET /api/evidence/:id` | `evidence.read.assigned` o `evidence.read.audit` | Registro de acceso. |
| `PATCH /api/admin/users/:id/role` | `account.manage` | Reautenticación; protecciones. |
| `PATCH /api/admin/users/:id/status` | `account.manage` | Reautenticación; protecciones. |
| `POST /api/admin/users/:id/revoke-sessions` | `account.manage` | Revoca sesiones. |

### 5.3 Endpoints planificados

| Método y ruta | Capacidad | Regla de recurso |
|---|---|---|
| `GET /api/notifications` | `notification.read.own` | Solo propias. |
| `POST /api/notifications/:id/read` | `notification.read.own` | Solo propias. |
| `POST /api/realtime/ticket` | `realtime.connect` | Ticket de 60 s, un solo uso. |
| `POST /api/assistant/tourist/query` | `assistant.tourist` | Público con rate limit. |
| `POST /api/assistant/inspection/query` | `assistant.inspection` | Inspector o historiador en consulta. |
| `GET /api/admin/sources` | `source.read` / `source.manage` | Registro de fuentes. |

## 6. Migración expand-contract

| Paso | Acción | Verificación |
|---|---|---|
| 1. Expand | Añadir `historian` e `inspector` al enum; mantener `moderator`. | El modelo acepta los tres valores. |
| 2. Desplegar | Código que entiende ambos esquemas; `moderator` sin capacidades nuevas. | Pruebas de auth y admin verdes. |
| 3. Simular | `scripts/migrateRoles.js --dry-run` cuenta cuentas `moderator`. | Reporte con IDs y conteo. |
| 4. Respaldar | Backup de `User` y de la base. | Restauración verificable. |
| 5. Aplicar | `--apply` convierte `moderator` a `historian`. | Cero errores; auditoría por cuenta. |
| 6. Revocar | Incrementar `tokenVersion` de las cuentas migradas. | Sesiones anteriores rechazadas. |
| 7. Verificar | `scripts/verifyRoles.js` confirma cero `moderator` y último admin. | Reporte verde. |
| 8. Contract | Retirar `moderator` del enum en una liberación posterior. | Búsqueda sin referencias. |

Precondiciones:

- No ejecutar `--apply` sin backup reciente y revisión del dry-run.
- No asignar `inspector` automáticamente: los inspectores se crean explícitamente.
- Si una cuenta `moderator` debe ser inspector, se decide caso por caso con aprobación.
- El rollback de código conserva los datos; no se hace un `down` destructivo. Si la
  migración debe revertirse, se restaura el backup y se documenta el incidente.

### 6.1 Estado de implementación

| Elemento | Estado | Evidencia |
|---|---|---|
| Enum `historian` e `inspector` | Implementado | `User.js`, `ASSIGNABLE_USER_ROLES` |
| Cambio de rol con reautenticación | Implementado | `PATCH /api/admin/users/:id/role` |
| Cambio de estado con reautenticación | Implementado | `PATCH /api/admin/users/:id/status` |
| Revocación de sesiones | Implementado | `POST /api/admin/users/:id/revoke-sessions` |
| Protección del último admin | Implementado | `LAST_ADMIN_PROTECTED` |
| Prohibición de autodegradación/autodesactivación | Implementado | `SELF_DEMOTION_FORBIDDEN`, `SELF_DEACTIVATION_FORBIDDEN` |
| Auditoría obligatoria con compensación | Implementado; las sesiones revocadas no se restauran | `recordAudit({ required: true })` |
| Script de migración | Implementado, no ejecutado | `npm run migrate:roles -- --dry-run` |
| Verificación de roles | Implementado | `npm run verify:roles` |
| Pruebas de autorización | Implementado | `test/roles.test.js` y `test/authorization.test.js`; aislamiento de conservación en `test/conservation.test.js` |
| Migración de datos | Pendiente | Requiere backup y autorización |
| UI de gestión | Implementado | Diálogo de rol, estado y revocación; E2E `admin-users.spec.ts` |
| `requireAnyCapability` y matriz rol-capacidad | Implementado para rutas actuales de conservación | `services/authorizationService.js`; rol legacy y roles desconocidos fallan cerrados |
| Lectura de reportes e inspecciones para auditoría | Implementado con proyección reducida | `getReport`, `listInspections`, `getInspection`; sin contenido sensible |
| Revisor asignado distinto del inspector | Implementado | Validación en creación/conversión y revisión/cierre |
| Aislamiento de inspección e intervención | Implementado | ID del inspector/revisor/executor verificado en servicios |
| `panorama.publish` / `panorama.manage` | Implementado | `adminPanoramaRoutes.js`, `panoramaService.js`; separación editorial verificada en `test/panorama.test.js` |
| API pública 360 y curaduría | Implementado | `/api/panoramas`, `/api/admin/panoramas`, galería, visor y `/curaduria/panoramas`; E2E `panoramas.spec.ts` |
| Capacidades para módulos futuros | Política declarada; endpoints pendientes | No existe todavía notificaciones, realtime, RAG ni fuentes |
| `break_glass.inspection` | No concedida | Denegada hasta implementar motivo, aprobador, vigencia y auditoría |
| Contract de `moderator` | Pendiente | Liberación posterior |

## 7. Protecciones administrativas

| Protección | Regla | Error |
|---|---|---|
| Último admin | No se puede degradar ni desactivar al último `admin` activo. | `LAST_ADMIN_PROTECTED` |
| Autodegradación | Un admin no puede quitarse su propio rol. | `SELF_DEMOTION_FORBIDDEN` |
| Autodesactivación | Un admin no puede desactivar su propia cuenta. | `SELF_DEACTIVATION_FORBIDDEN` |
| Reautenticación | Cambios de rol, estado o revocación exigen contraseña actual. | `REAUTHENTICATION_REQUIRED` |
| Revocación | Todo cambio sensible incrementa `tokenVersion`. | `SESSION_REVOKED` |
| Auditoría | El evento se registra antes de confirmar la operación. | `AUDIT_REQUIRED` |
| Break-glass | Motivo, aprobador, vigencia y evento obligatorios. | `BREAK_GLASS_DENIED` |

## 8. Matriz de pruebas de autorización

### 8.1 Permitido / denegado

| Caso | Rol | Resultado esperado |
|---|---|---|
| Crear reporte propio | `user` | 201 |
| Leer reporte ajeno | `user` | 403/404 |
| Triar reporte | `historian` | 403 |
| Triar reporte | `inspector` | 200 |
| Confirmar severidad | `historian` | 403 |
| Confirmar severidad | `inspector` revisor | 200 |
| Revisar inspección propia | `inspector` emisor | 403 |
| Cerrar sin intervención verificada | `inspector` | 409 `INVALID_TRANSITION` |
| Ver evidencia asignada | `inspector` asignado | 200 |
| Ver evidencia ajena | `inspector` no asignado | 403/404 |
| Ver evidencia binaria | `admin` | 403; solo metadatos/auditoría |
| Cambiar rol | `admin` | 200 con reautenticación |
| Degradar último admin | `admin` | 409 `LAST_ADMIN_PROTECTED` |
| Autodegradarse | `admin` | 409 `SELF_DEMOTION_FORBIDDEN` |
| Gestionar cuentas | `inspector` | 403 |
| Editar contenido editorial | `inspector` | 403 |
| Editar contenido editorial | `historian` | 200 |
| Inspeccionar por defecto | `admin` | 403 |
| Entrar a sala Socket.IO ajena | `user` | Conexión/evento denegado |
| Reutilizar ticket realtime | Cualquiera | 401 |
| Consultar asistente técnico | `user` | 403 |
| Consultar asistente turístico | Visitante | 200 con rate limit |
| Crear panorama | `admin` | 201 con `panorama.manage` |
| Crear panorama | `historian` | 403 |
| Aprobar panorama turístico | `admin` | 403 |
| Aprobar panorama turístico | `historian` | 200 |
| Aprobar sin derechos completos | `historian` | 409 `RIGHTS_INCOMPLETE` |
| Ver panorama de inspección en curaduría | `historian` | 404 |
| Gestionar panorama de inspección | `admin` | 200 |
| Editar panorama | `historian` | 403 |

### 8.2 IDOR y aislamiento

- `user` A no lee reportes, evidencia, notificaciones ni conversaciones de `user` B.
- `inspector` A no lee la inspección asignada a `inspector` B.
- `historian` no lee evidencia de inspección.
- `admin` no lee el binario de evidencia por su rol; solo auditoría.
- Un cliente Socket.IO no entra en `user:<otro>`, `role:inspector` sin ser inspector ni
  `inspection:<id>` sin asignación.
- Un ticket de realtime expira, se consume una vez y no se acepta en query string.
- Un panorama de inspección no aparece en `/api/panoramas`.
- El historiador recibe `404` al consultar un panorama de inspección por la API
  administrativa o al intentar una transición sobre él.
- La administración recibe `403` al intentar aprobar, publicar o archivar un panorama
  turístico; no puede saltarse la curaduría.

### 8.3 Migración

- `--dry-run` no escribe.
- `--apply` convierte solo `moderator` y no toca `user`, `inspector` ni `admin`.
- Una cuenta migrada pierde sus sesiones anteriores.
- El último admin sigue siendo admin después de la migración.
- `verifyRoles` falla si queda un `moderator`.

## 9. Frontend

- `auth.service.ts` expone `isHistorian`, `isInspector`, `can(capability)`, `canPublishPanoramas()`
  y las comprobaciones de administración.
- `capability.guard.ts` y `auth.guard.ts` protegen rutas; no sustituyen al servidor.
  `curatorGuard` (`canCuratePanoramas()`) habilita `/curaduria/panoramas` para historiador y
  admin; la API sigue decidiendo qué transiciones permite a cada uno.
- `/admin` queda para admin; `/inspecciones` para inspector/revisor; `/reportes` para
  autenticados; `/curaduria/panoramas` para el historiador.
- El menú y los botones se ocultan por capacidad, pero la API vuelve a verificar.
- Los mensajes de denegación no revelan la existencia de recursos ajenos.

## 10. Decisiones pendientes

| ID | Decisión | Impacto |
|---|---|---|
| D-09 | Replica set de un nodo para transacciones. | Cierre atómico y eventos. |
| D-13 | `/admin` separado de `/inspecciones`. | Ya propuesto; confirmar. |
| D-15 | Admin no es inspector implícito. | Ya propuesto; confirmar. |
| D-16 | `asset.manage` para inspector y admin. | Se conserva el acceso de inventario ya existente; ratificación formal pendiente. Admin no obtiene capacidades de inspección. |
| D-17 | Identidad del reportante visible a inspector/revisor, nunca pública. | Privacidad y triaje. |
| D-18 | Audio e idiomas condicionales. | Contenido 360°. |
