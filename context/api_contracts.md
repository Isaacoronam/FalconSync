# Contratos HTTP

La API usa el prefijo `/api`. Esta lista es un índice de las rutas registradas; los
controladores y validadores son la referencia para payloads, errores y permisos.

| Prefijo | Uso | Rutas principales |
|---|---|---|
| `/api/health` | Estado de API y conexión a base de datos | `GET /` |
| `/api/auth` | Registro, inicio/cierre de sesión, refresh y cambio de contraseña | `POST /register`, `/login`, `/refresh`, `/logout`, `/change-password`; `GET /me` |
| `/api/locations` | Catálogo público | `GET /`, `/near`, `/:slug` |
| `/api/check-ins` | Registrar una visita | `POST /` |
| `/api/profile` | Perfil, avatar, check-ins y fotos privadas | `GET/PATCH /me`, rutas `/avatar` y `/check-ins` |
| `/api/admin` | Administración de POI, usuarios, QR y auditoría | Restringido a administradores |
| `/api/adventures` | API heredada de recorridos | `GET /`, `/:slug` y `/:slug/progress` |
| `/api/heritage-assets` | Activos patrimoniales | `GET /` público; `POST /` con `asset.manage` |
| `/api/reports` | Reportes ciudadanos de conservación | `POST /`; `GET /mine`, `/queue`, `/:id`; `PATCH /:id/triage`; `POST /:id/convert` |
| `/api/inspections` | Inspecciones de campo | `GET /`, `/inspectors`, `/:id`; `POST /`, `/:id/start`, `/resume`, `/findings`, `/submit`, `/review`, `/close`, `/:id/interventions` |
| `/api/interventions` | Transiciones de intervenciones | `PATCH /:id` |
| `/api/evidence` | Evidencia privada con autorización por recurso | `POST /`, `GET /`, `GET /:id` |

Las rutas de detalle son:

- Auth: `POST /register`, `/login`, `/refresh`, `/logout`, `/change-password`;
  `GET /me`.
- POI: `GET /`, `/near`, `/:slug`.
- Check-in: `POST /`.
- Perfil (autenticado): `GET/PATCH /me`, `GET/POST/DELETE /avatar`,
  `GET /check-ins`, `GET/PUT/DELETE /check-ins/:checkInId/photo`.
- Administración (admin): `GET /summary`, `/users`, `/locations`, `/audit`; `PATCH
  /users/:id/role`, `PATCH /users/:id/status` y `POST /users/:id/revoke-sessions` con
  reautenticación; CRUD y restauración de `/locations`; carga/borrado de imágenes y rotación
  de QR; administración heredada de `/adventures`.
- Conservación (autenticado, según capacidad): `POST /reports`; `GET /reports/mine`,
  `/reports/queue`, `/reports/:id`; `PATCH /reports/:id/triage`; `POST /reports/:id/convert`;
  `GET /inspections`, `/inspectors`, `/inspections/:id`; `POST /inspections`,
  `/inspections/:id/start`, `/resume`, `/findings`, `/submit`, `/review`, `/close`,
  `/inspections/:id/interventions`; `PATCH /interventions/:id`.
- Evidencia (autenticado y autorizado por recurso): `POST /evidence`, `GET /evidence`,
  `GET /evidence/:id`. La evidencia se guarda en `uploads/documents/` y no se sirve por
  `/api/uploads`.
- Administración de evidencia: `GET /admin/evidence/:id/access-log`.

El check-in y la foto pueden guardarse en fases separadas. Los tokens de QR no deben
guardarse ni registrarse en claro fuera del flujo de rotación.

Las rutas de conservación están implementadas. El contrato OpenAPI conserva diferencias
conocidas con el código (por ejemplo, `/reports/queue`, `/inspectors` y
`/inspections/:id/resume` no están documentadas, y las rutas de intervenciones no coinciden);
se alinearán en la Fase 1. Hasta entonces, la fuente de verdad de las rutas es
`projects/backend/api/`.

Socket.IO, RAG y visita 360° no están implementados y sus contratos en
[`docs/openapi.yaml`](../docs/openapi.yaml) llevan `x-falconsync-status: planned`. No deben
tratarse como contratos vigentes.

## Fuentes de verdad

- Rutas: `projects/backend/api/`
- Contratos del frontend: `projects/frontend/src/app/models/`
- Documentación funcional: [POI](../docs/POI.md), [autenticación](../docs/AUTENTICACION.md)
  y [check-in](../docs/AVENTURAS.md).
