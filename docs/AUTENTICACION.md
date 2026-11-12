# Autenticación y autorización — Cortes 1, 2 y 5

Fecha de verificación: 2026-11-07.

## Modelo de sesión

| Elemento | Decisión implementada |
|---|---|
| Access token | JWT de 15 minutos, guardado solo en memoria del frontend. Nunca en `localStorage`. |
| Refresh token | JWT de 7 días en cookie `httpOnly`, `SameSite=Strict`, `Secure` en producción y `Path=/api/auth`. |
| Rotación | Cada refresh revoca la sesión anterior y emite un token nuevo con un `jti` distinto. |
| Persistencia de sesión | Colección `RefreshSession` con hash SHA-256 del refresh token, expiración y estado de revocación. |
| Revocación global | `User.tokenVersion` se incrementa al cambiar la contraseña; el backend lo compara en cada petición autenticada. |
| Hash de contraseña | `bcryptjs` con coste 12 en desarrollo/producción y 10 en pruebas. |
| Roles | `user`, `moderator`, `admin`. `moderator` queda previsto para el corte de moderación. |
| Bootstrap admin | `scripts/createAdmin.js` con variables `ADMIN_*`; idempotente y sin credenciales por defecto. |
| Cambio obligatorio | El admin creado por bootstrap recibe `mustChangePassword=true`; el backend bloquea rutas de rol hasta el cambio. |
| Nombre de usuario | `User.username` único, generado al registrar o crear el admin. Se edita desde el perfil privado y no se expone como ruta pública. |

La cookie limita su envío a `/api/auth`, no a toda la API. El frontend la usa solo en
`refresh` y `logout`; el resto de peticiones usan el access token en memoria.

`SameSite=Strict` y la comprobación de `Origin` protegen los endpoints con cookie. No se
implementó un token CSRF independiente; si el despliegue separa frontend y API en sitios
distintos, la cookie dejará de enviarse y habrá que revisar el diseño.

## Endpoints

| Método | Ruta | Acceso | Resultado |
|---|---|---|---|
| `POST` | `/api/auth/register` | Público, rate limit | Crea usuario `user`, sesión y cookie. |
| `POST` | `/api/auth/login` | Público, rate limit | Devuelve access token, usuario y cookie. |
| `POST` | `/api/auth/refresh` | Cookie + origen confiable | Rota la sesión y devuelve un access token nuevo. |
| `POST` | `/api/auth/logout` | Cookie | Revoca la sesión y borra la cookie. |
| `GET` | `/api/auth/me` | Bearer | Devuelve el usuario autenticado. |
| `POST` | `/api/auth/change-password` | Bearer | Cambia la contraseña, incrementa `tokenVersion` y revoca las demás sesiones. |
| `GET` | `/api/profile/me` | Bearer | Perfil privado, estadísticas y últimos check-in. |
| `PATCH` | `/api/profile/me` | Bearer | Edita nombre, `username` y biografía. |
| `GET` | `/api/profile/avatar` | Bearer | Sirve el avatar del usuario autenticado. |
| `POST` | `/api/profile/avatar` | Bearer + rate limit | Sube o reemplaza el avatar (`multipart/form-data`, campo `image`). |
| `DELETE` | `/api/profile/avatar` | Bearer | Elimina el avatar. |
| `GET` | `/api/profile/check-ins/:checkInId/photo` | Bearer | Sirve la foto de un check-in propio. |
| `GET` | `/api/admin/summary` | Bearer + rol `admin` | Métricas del panel y actividad reciente. |
| `*` | `/api/admin/locations/*` | Bearer + rol `admin` | CRUD de POI, imágenes, archivo y restauración. |
| `GET` | `/api/admin/audit` | Bearer + rol `admin` | Historial de acciones administrativas. |

Errores relevantes: `INVALID_CREDENTIALS`, `EMAIL_IN_USE`, `AUTHENTICATION_REQUIRED`,
`INVALID_ACCESS_TOKEN`, `SESSION_REVOKED`, `PASSWORD_CHANGE_REQUIRED`, `FORBIDDEN`,
`RATE_LIMITED`.

## Flujo del frontend

1. `provideAppInitializer` intenta `/api/auth/refresh` al arrancar. Si no hay cookie,
   continúa como visitante.
2. El interceptor añade el access token solo a peticiones `/api`.
3. Ante un `401`, el interceptor comparte una única petición de refresh, reintenta la
   petición original y, si el refresh falla, limpia la sesión local.
4. Los guards protegen `/admin` y las rutas autenticadas. Un admin con cambio pendiente
   es redirigido a `/cambiar-contrasena`.
5. El header muestra la cuenta, el enlace de administración cuando corresponde y el
   botón de salida. El nombre de la cuenta enlaza a `/perfil`.
6. Al guardar el nombre desde el perfil, `AuthService.updateCurrentUser` actualiza el header
   sin necesidad de recargar la sesión.

## Configuración

Variables nuevas en `projects/backend/.env.example`:

- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`: obligatorias, mínimo 32 caracteres.
- `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `BCRYPT_COST`.
- `REFRESH_COOKIE_NAME`, `COOKIE_SECURE`, `TRUST_PROXY`.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: solo para el script de bootstrap.

El `.env` local está ignorado por Git y fue generado con secretos aleatorios. El
administrador local se creó con `npm run create-admin`; su contraseña está en ese archivo
y debe cambiarse en el primer acceso.

## Verificación

- 12 pruebas backend de autenticación y autorización.
- 67 pruebas backend en total, incluidas las 6 del perfil privado.
- 29 pruebas frontend en total.
- 15 pruebas E2E con navegador real, incluyendo registro, persistencia tras recarga,
  logout, acceso admin, cambio obligatorio, bloqueo de usuario normal, CRUD de POI, perfil,
  avatar y check-in con foto.
- `npm audit --omit=dev`: 0 vulnerabilidades en backend y frontend.

El contrato detallado del perfil, el avatar y las fotos está en [`PERFIL.md`](./PERFIL.md).

## Límites conocidos

- No hay verificación de correo, recuperación de contraseña, MFA ni listado/cierre de
  sesiones desde la interfaz.
- La detección de reutilización de un refresh token rechaza el token viejo, pero no
  revoca automáticamente toda la familia de sesiones.
- El rate limit se desactiva cuando `NODE_ENV=test`; sus umbrales no están cubiertos por
  una prueba automatizada.
- `moderator` existe en el modelo y en los guards, pero todavía no tiene rutas propias.
- La administración de usuarios (roles, desactivación) sigue pendiente; el Corte 2 cubrió
  el CRUD de POI, las imágenes y la auditoría.
- No hay perfiles públicos por `username`; el nombre de usuario solo se usa dentro del
  perfil privado en este corte.
- No hay lista de nombres de usuario reservados ni historial de cambios.
