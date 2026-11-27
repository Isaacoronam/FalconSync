# Autenticación y autorización — Cortes 1, 2 y 5

Fecha de verificación: 2026-11-26.

## Modelo de sesión

| Elemento | Decisión implementada |
|---|---|
| Access token | JWT de 15 minutos, guardado solo en memoria del frontend. Nunca en `localStorage`. |
| Refresh token | JWT de 7 días en cookie `httpOnly`, `SameSite=Strict`, `Secure` en producción y `Path=/api/auth`. |
| Rotación | Cada refresh revoca la sesión anterior y emite un token nuevo con un `jti` distinto. |
| Persistencia de sesión | Colección `RefreshSession` con hash SHA-256 del refresh token, expiración y estado de revocación. |
| Revocación global | `User.tokenVersion` se incrementa al cambiar la contraseña; el backend lo compara en cada petición autenticada. |
| Hash de contraseña | `bcryptjs` con coste 12 en desarrollo/producción y 10 en pruebas. |
| Roles | `user`, `moderator` (legacy temporal), `historian`, `inspector` y `admin`. La migración de `moderator` a `historian` aún no se ejecutó. |
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
| `POST` | `/api/auth/register` | Público, rate limit | Crea usuario `user` con nombre y apellido, sesión y cookie. |
| `POST` | `/api/auth/login` | Público, rate limit | Devuelve access token, usuario y cookie. |
| `POST` | `/api/auth/refresh` | Cookie + origen confiable | Rota la sesión y devuelve un access token nuevo. |
| `POST` | `/api/auth/logout` | Cookie | Revoca la sesión y borra la cookie. |
| `GET` | `/api/auth/me` | Bearer | Devuelve el usuario autenticado. |
| `POST` | `/api/auth/change-password` | Bearer | Cambia la contraseña, incrementa `tokenVersion` y revoca las demás sesiones. |
| `GET` | `/api/profile/me` | Bearer | Perfil privado, estadísticas y últimos check-in. |
| `PATCH` | `/api/profile/me` | Bearer | Edita nombre, apellido, `username` y biografía. |
| `GET` | `/api/profile/avatar` | Bearer | Sirve el avatar del usuario autenticado. |
| `POST` | `/api/profile/avatar` | Bearer + rate limit | Sube o reemplaza el avatar (`multipart/form-data`, campo `image`). |
| `DELETE` | `/api/profile/avatar` | Bearer | Elimina el avatar. |
| `GET` | `/api/profile/check-ins/:checkInId/photo` | Bearer | Sirve la foto de un check-in propio. |
| `GET` | `/api/admin/summary` | Bearer + rol `admin` | Métricas del panel y actividad reciente. |
| `GET` | `/api/admin/users` | Bearer + rol `admin` | Usuarios paginados y filtrables; sin datos sensibles. |
| `PATCH` | `/api/admin/users/:id/role` | Bearer + rol `admin` + reautenticación | Cambia el rol, revoca sesiones y audita. |
| `PATCH` | `/api/admin/users/:id/status` | Bearer + rol `admin` + reautenticación | Activa o desactiva la cuenta, revoca sesiones y audita. |
| `POST` | `/api/admin/users/:id/revoke-sessions` | Bearer + rol `admin` + reautenticación | Revoca sesiones e incrementa `tokenVersion`. |
| `*` | `/api/admin/locations/*` | Bearer + rol `admin` | CRUD de POI, imágenes, archivo y restauración. |
| `GET` | `/api/admin/audit` | Bearer + rol `admin` | Historial de acciones administrativas. |

Errores relevantes: `INVALID_CREDENTIALS`, `EMAIL_IN_USE`, `AUTHENTICATION_REQUIRED`,
`INVALID_ACCESS_TOKEN`, `SESSION_REVOKED`, `PASSWORD_CHANGE_REQUIRED`, `FORBIDDEN`,
`RATE_LIMITED`.

### Registro con nombre y apellido

`POST /api/auth/register` recibe `name`, `surname`, `email` y `password`:

- `name` y `surname` son obligatorios, se normalizan con NFC, se recortan y se colapsan
  espacios internos.
- Cada uno admite entre 2 y 16 caracteres y solo letras Unicode, espacios internos,
  guiones y apóstrofes. Se rechazan números, emojis y otros símbolos.
- Se aceptan formas como `María José`, `Pérez-Jiménez` y `O'Brien`.
- El `username` generado parte de `name + surname` y conserva el mecanismo de sufijos
  para evitar colisiones.
- Las cuentas creadas antes de esta regla conservan `surname` vacío; la interfaz muestra
  el nombre disponible y permite completar el apellido desde el perfil.

## Flujo del frontend

1. `provideAppInitializer` intenta `/api/auth/refresh` al arrancar con un tiempo máximo de
   12 segundos. Si no hay cookie o la API no responde, continúa como visitante.
2. El interceptor añade el access token solo a peticiones `/api`.
3. Ante un `401`, el interceptor comparte una única petición de refresh, reintenta la
   petición original y, si el refresh falla, limpia la sesión local.
4. Los guards protegen `/admin` y las rutas autenticadas. Un admin con cambio pendiente
   es redirigido a `/cambiar-contrasena`.
5. El header flotante mantiene la marca centrada, agrupa las áreas por rol en «Áreas» y
   ofrece un menú de cuenta con perfil, cambio de contraseña y salida. En móvil usa una
   hoja a pantalla completa con foco atrapado y retorno al botón de menú.
6. Al guardar nombre o apellido desde el perfil, `AuthService.updateCurrentUser` actualiza
   el header sin necesidad de recargar la sesión.

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

- 15 pruebas backend de autenticación y autorización.
- 190 pruebas backend en total, incluidas las del perfil privado, roles, conservación,
  evidencias, panoramas y seeds (verificado el 2026-11-26).
- 111 pruebas frontend en total (verificado el 2026-11-26).
- 48 pruebas E2E con navegador real. En modo rápido: 42 aprobadas y 6 omitidas (las cinco
  del corpus RAG y el caso de los 23 lugares). En modo `npm run e2e:rag`: 47 aprobadas y
  1 omitida (el caso que valida el estado sin corpus). Incluyen registro con
  nombre/apellido, validación de caracteres, persistencia tras recarga, logout, acceso
  admin, cambio obligatorio, bloqueo de usuario normal, CRUD de POI, perfil, avatar,
  check-in con foto, gestión de rol/estado/sesiones, navegación móvil accesible, skeletons,
  sticky header, catálogo con búsqueda/filtros/galería y las respuestas de los 23 lugares.
- `npm run verify` completo en verde el 2026-11-26: backend 190, frontend 111, build y E2E.
- `npm run e2e:rag` en verde el 2026-11-26: 47/48 con S-033 y una omisión esperada.
- `npm audit --omit=dev`: 0 vulnerabilidades en backend y frontend (verificación previa).

El contrato detallado del perfil, el avatar y las fotos está en [`PERFIL.md`](./PERFIL.md).

## Límites conocidos

- No hay verificación de correo, recuperación de contraseña ni MFA. El usuario no puede
  listar ni cerrar sus propias sesiones; solo un administrador puede revocarlas.
- La detección de reutilización de un refresh token rechaza el token viejo, pero no
  revoca automáticamente toda la familia de sesiones.
- El rate limit se desactiva cuando `NODE_ENV=test`; sus umbrales no están cubiertos por
  una prueba automatizada.
- `moderator` existe en el modelo y en los guards, pero todavía no tiene rutas propias.
- La API y la interfaz administrativas permiten cambiar rol, activar/desactivar cuentas y
  revocar sesiones con reautenticación, protecciones y auditoría obligatoria. La migración
  de datos de `moderator` sigue pendiente de ejecución.
- No hay perfiles públicos por `username`; el nombre de usuario solo se usa dentro del
  perfil privado en este corte.
- No hay lista de nombres de usuario reservados ni historial de cambios.
