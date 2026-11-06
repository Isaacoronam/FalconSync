# FalconSync Backend

API REST para los puntos de interés patrimonial de Coro, con autenticación y permisos.

## Requisitos

- Node.js 26.13.0
- MongoDB 9.0.4 local en `127.0.0.1:27017`

## Puesta en marcha

```bash
npm install
cp .env.example .env
# Completar JWT_ACCESS_SECRET, JWT_REFRESH_SECRET y ADMIN_* en .env
npm run seed
npm run create-admin
npm run dev
```

En Windows, crear `.env` manualmente a partir de `.env.example` si `cp` no está disponible.
Los secretos JWT deben tener al menos 32 caracteres y no deben reutilizarse.

La API queda en `http://localhost:3000`.

## Comandos

```bash
npm run dev          # servidor con recarga
npm start            # servidor normal
npm run seed         # upsert idempotente de los 6 POI
npm run create-admin # bootstrap idempotente del administrador
npm test             # suite de backend
```

## Endpoints

Lectura pública:

- `GET /api/health`
- `GET /api/locations?page=1&limit=50&category=religious`
- `GET /api/locations/near?lat=11.4075&lng=-69.6778&radius=500`
- `GET /api/locations/:slug`

Autenticación:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

Administración (rol `admin`):

- `GET /api/admin/summary`
- `GET /api/admin/locations?q=&status=&category=&page=&limit=`
- `GET /api/admin/locations/:id`
- `POST /api/admin/locations`
- `PATCH /api/admin/locations/:id`
- `DELETE /api/admin/locations/:id` (borrado lógico)
- `POST /api/admin/locations/:id/restore`
- `POST /api/admin/locations/:id/images` (`multipart/form-data`, campo `image`)
- `DELETE /api/admin/locations/:id/images` (`{ "url": "..." }`)
- `GET /api/admin/audit?page=&limit=&action=&entityId=`

Las imágenes se sirven desde `/api/uploads/...`.

El detalle de cookies, rotación de refresh, roles y límites está en
[`../docs/AUTENTICACION.md`](../docs/AUTENTICACION.md). El CRUD de POI, imágenes y auditoría
está documentado en [`../docs/ADMINISTRACION.md`](../docs/ADMINISTRACION.md).

## Seguridad

- Access token de 15 minutos en memoria; refresh de 7 días en cookie `httpOnly`,
  `SameSite=Strict` y `Path=/api/auth`.
- Refresh con rotación y hash persistido en `RefreshSession`.
- `tokenVersion` por usuario para revocar sesiones al cambiar la contraseña.
- `bcryptjs` con coste 12.
- Rate limit en registro, login, refresh y cambio de contraseña.
- `CORS` con credenciales y comprobación de origen en endpoints con cookie.
- El administrador creado por bootstrap debe cambiar la contraseña en el primer acceso.
- El CRUD administrativo exige rol `admin`; el API público solo devuelve POI publicados.
- Las imágenes se validan por firma binaria (JPEG/PNG/WebP), con límite de 5 MB y 8 por POI.
  El adaptador local vive en `src/services/storage/` y puede sustituirse por otro
  almacenamiento.

## Seed y fuentes

El seed es idempotente y actualiza los documentos por `slug`. Las coordenadas se obtuvieron
de OpenStreetMap, Wikidata/Wikipedia y un Plus Code verificable. El estado de conservación
se deja como `unknown` porque no se dispone de una fuente verificada.

Cada POI incluye en `images` una ruta pública con el formato
`/images/locations/<slug>.jpg`. La API devuelve ese campo tal cual; los archivos los sirve
el frontend desde su carpeta `public/images/locations/`. Las imágenes fueron suministradas
por el responsable del proyecto y su autoría y licencia están pendientes de verificación.

La **Cruz de los Enconchados** no se incluyó: no se encontró una fuente cartográfica o
documental confiable que permita ubicarla sin inventar datos.

## Variables de entorno

Copia `.env.example` a `.env` y ajusta:

- `PORT`, `MONGODB_URI`, `CORS_ORIGIN`, `TRUST_PROXY`.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `BCRYPT_COST`.
- `REFRESH_COOKIE_NAME`, `COOKIE_SECURE`.
- `UPLOAD_DIR` y `UPLOAD_MAX_IMAGE_BYTES` para las imágenes locales.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` para `create-admin`.

No se incluyen secretos reales en el repositorio. `.env` está ignorado por Git.

## Pruebas

`npm test` ejecuta las pruebas de ubicaciones, autenticación y administración de POI con
`node --test` y `supertest`, usando bases de datos locales de prueba. En total se verificaron
33 pruebas.

La suite E2E permanente vive en `../falcon-sync-frontend/e2e` y arranca esta API con
`scripts/e2eServer.js` sobre la base `falconsync_e2e`.
