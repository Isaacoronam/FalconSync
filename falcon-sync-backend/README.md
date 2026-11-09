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

Si el puerto ya está ocupado, el arranque se detiene con un mensaje explícito. Detén la
instancia anterior (`netstat -ano | findstr :3000`) antes de iniciar una nueva. El log de
arranque incluye el PID de la instancia que queda escuchando.

## Comandos

```bash
npm run dev          # servidor con recarga
npm start            # servidor normal
npm run seed         # inserta los POI ausentes (23 publicados)
npm run seed:sync    # actualiza fichas, verificación y radios; conserva estado e isProvisional
npm run seed:verify  # comprueba existencia, publicación y desviación de coordenadas
npm run seed:adventures        # crea o actualiza la Ruta del Casco Histórico
npm run seed:adventures:verify # verifica publicación, orden y paradas disponibles
npm run backfill:usernames     # asigna username a cuentas anteriores al perfil
npm run publish:pois # publica los POI del seed que sigan en borrador; usa --apply para guardar
npm run qr:generate  # rota QR de POI publicados sin token y guarda SVG en .qr-codes; usa --apply
npm run create-admin # bootstrap idempotente del administrador
npm test             # suite de backend
```

## Endpoints

Lectura pública:

- `GET /api/health`
- `GET /api/locations?page=1&limit=50&category=religious&circuit=casco-historico&tag=unesco`
- `GET /api/locations?includeProvisional=true` (compatibilidad del mapa; ya no hay borradores)
- `GET /api/locations/near?lat=11.4075&lng=-69.6778&radius=500`
- `GET /api/locations/:slug`
- `GET /api/adventures?page=1&limit=20`
- `GET /api/adventures/:slug`

Autenticación:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

Aventuras y check-in (autenticado):

- `GET /api/adventures/:slug/progress`
- `POST /api/check-ins` (JSON o `multipart/form-data` con `image` opcional)

Perfil privado (autenticado):

- `GET /api/profile/me`
- `PATCH /api/profile/me` (`{ name?, username?, bio? }`)
- `GET /api/profile/avatar`
- `POST /api/profile/avatar` (`multipart/form-data`, campo `image`)
- `DELETE /api/profile/avatar`
- `GET /api/profile/check-ins/:checkInId/photo`

Administración (rol `admin`):

- `GET /api/admin/summary`
- `GET /api/admin/locations?q=&status=&category=&circuit=&tag=&page=&limit=`
- `GET /api/admin/locations/:id`
- `POST /api/admin/locations`
- `PATCH /api/admin/locations/:id`
- `DELETE /api/admin/locations/:id` (borrado lógico)
- `POST /api/admin/locations/:id/restore`
- `POST /api/admin/locations/:id/images` (`multipart/form-data`, campo `image`)
- `DELETE /api/admin/locations/:id/images` (`{ "url": "..." }`)
- `POST /api/admin/locations/:id/qr/rotate?format=svg|png`
- `GET /api/admin/adventures?q=&status=&page=&limit=`
- `GET /api/admin/adventures/:id`
- `POST /api/admin/adventures`
- `PATCH /api/admin/adventures/:id`
- `DELETE /api/admin/adventures/:id` (borrado lógico)
- `POST /api/admin/adventures/:id/publish`
- `POST /api/admin/adventures/:id/archive`
- `POST /api/admin/adventures/:id/restore`
- `POST /api/admin/adventures/:id/stops`
- `PATCH /api/admin/adventures/:id/stops/:stopId`
- `DELETE /api/admin/adventures/:id/stops/:stopId`
- `PUT /api/admin/adventures/:id/stops/reorder` (`{ "order": ["stopId1", "stopId2"] }`)
- `GET /api/admin/audit?page=&limit=&action=&entityId=`

Las imágenes públicas de POI se sirven desde `/api/uploads/...`. Los avatares y las fotos de
check-in se guardan en `uploads-private/` y solo se sirven por los endpoints autenticados de
perfil.

El detalle de cookies, rotación de refresh, roles y límites está en
[`../docs/AUTENTICACION.md`](../docs/AUTENTICACION.md). El CRUD de POI, imágenes y auditoría
está documentado en [`../docs/ADMINISTRACION.md`](../docs/ADMINISTRACION.md). El diseño de
aventuras, QR, geocercas y check-in está en [`../docs/AVENTURAS.md`](../docs/AVENTURAS.md).
El perfil privado, avatar, fotos y seed de aventura están en
[`../docs/PERFIL.md`](../docs/PERFIL.md).

## Seguridad

- Access token de 15 minutos en memoria; refresh de 7 días en cookie `httpOnly`,
  `SameSite=Strict` y `Path=/api/auth`.
- Refresh con rotación y hash persistido en `RefreshSession`.
- `tokenVersion` por usuario para revocar sesiones al cambiar la contraseña.
- `bcryptjs` con coste 12.
- Rate limit en registro, login, refresh y cambio de contraseña.
- `CORS` con credenciales y comprobación de origen en endpoints con cookie.
- El administrador creado por bootstrap debe cambiar la contraseña en el primer acceso.
- El CRUD administrativo exige rol `admin`; la lista y el detalle normal devuelven los 23
  POI publicados. `includeProvisional=true` sigue disponible por compatibilidad, pero ya no
  hay borradores en el catálogo. Los 23 habilitan detalle, aventura y check-in.
- Los QR de check-in se generan con `npm run qr:generate -- --apply` y quedan en
  `.qr-codes/`, fuera de Git porque contienen tokens.
- Las imágenes públicas se validan por firma binaria (JPEG/PNG/WebP), con límite de 5 MB y 8
  por POI. El adaptador local vive en `src/services/storage/` y puede sustituirse por otro
  almacenamiento.
- Los avatares y las fotos de check-in se validan por MIME y firma binaria, se limitan a 5 MB
  y se guardan en `uploads-private/`, fuera del prefijo público.
- Las fotos de check-in solo se sirven al dueño del check-in; otro usuario recibe `404`.
- El perfil es privado: no hay rutas públicas por `username` ni directorio de usuarios.
- El QR de check-in es opaco: token de 32 bytes, hash SHA-256 persistido con `select: false`,
  comparación en tiempo constante y rotación que invalida los QR anteriores.
- La geocerca Haversine se valida solo en servidor; el radio por POI es configurable entre 10
  y 500 m (50 m por defecto).
- El check-in tiene rate limit propio (30 intentos por IP cada 15 minutos) y no registra
  tokens en logs ni en auditoría.

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

El seed de aventura crea la «Ruta del Casco Histórico de Coro» con cinco paradas reales y es
idempotente. Sus paradas deben estar publicadas, visibles y no provisionales.

## Variables de entorno

Copia `.env.example` a `.env` y ajusta:

- `PORT`, `MONGODB_URI`, `CORS_ORIGIN`, `TRUST_PROXY`.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `BCRYPT_COST`.
- `REFRESH_COOKIE_NAME`, `COOKIE_SECURE`.
- `UPLOAD_DIR` para las imágenes públicas de POI.
- `UPLOAD_PRIVATE_DIR` para avatares y fotos de check-in.
- `UPLOAD_MAX_IMAGE_BYTES` para el límite de carga.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` para `create-admin`.

No se incluyen secretos reales en el repositorio. `.env` está ignorado por Git.

## Pruebas

`npm test` ejecuta las pruebas de ubicaciones, autenticación, administración de POI, perfil,
insignias, galería, seed y CoroAventura (aventuras, QR, check-in y progreso) con `node --test`
y `supertest`, usando bases de datos locales de prueba. Resultado de la última corrida:
73/73.

La suite E2E permanente vive en `../falcon-sync-frontend/e2e` y arranca esta API con
`scripts/e2eServer.js` sobre la base `falconsync_e2e`.
