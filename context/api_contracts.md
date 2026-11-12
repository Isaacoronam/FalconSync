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

Las rutas de detalle son:

- Auth: `POST /register`, `/login`, `/refresh`, `/logout`, `/change-password`;
  `GET /me`.
- POI: `GET /`, `/near`, `/:slug`.
- Check-in: `POST /`.
- Perfil (autenticado): `GET/PATCH /me`, `GET/POST/DELETE /avatar`,
  `GET /check-ins`, `GET/PUT/DELETE /check-ins/:checkInId/photo`.
- Administración (admin): `GET /summary`, `/users`, `/locations`, `/audit`; CRUD y
  restauración de `/locations`; carga/borrado de imágenes y rotación de QR; administración
  heredada de `/adventures`.

El check-in y la foto pueden guardarse en fases separadas. Los tokens de QR no deben
guardarse ni registrarse en claro fuera del flujo de rotación.

No se documentan WebSockets, Socket.IO, email ni rutas de inspección patrimonial porque no
están implementados en las rutas actuales.

## Fuentes de verdad

- Rutas: `projects/backend/src/routes/`
- Contratos del frontend: `projects/frontend/src/app/core/models/`
- Documentación funcional: [POI](../docs/POI.md), [autenticación](../docs/AUTENTICACION.md)
  y [check-in](../docs/AVENTURAS.md).
