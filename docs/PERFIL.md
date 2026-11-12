# Perfil privado, insignias de lugares, avatar y fotos de check-in

Fecha de verificación: 2026-11-08.

Este documento describe el perfil privado del turista en FalconSync, las insignias
persistentes por lugar, el avatar y la galería de visitas con foto. El progreso de recorridos
se conserva únicamente como compatibilidad heredada y ya no se presenta en el perfil. No
atribuye el diseño a una unidad académica: las transcripciones de las Unidades 2 a 7 todavía
no están incorporadas en `.opencode/knowledge/`. Las decisiones se justifican por el estado
real del repositorio y por buenas prácticas de ingeniería.

## Alcance implementado

- Perfil visible únicamente para su dueño. No existe directorio público ni ruta por
  `username`.
- Edición de nombre, nombre de usuario y biografía.
- Avatar privado con carga, reemplazo y eliminación.
- Insignias persistentes por punto de interés, con otorgamiento idempotente.
- Galería privada paginada de visitas con filtro por presencia de foto.
- Foto opcional en cada check-in, almacenada fuera del prefijo público; se puede añadir,
  reemplazar o eliminar después del check-in.
- Endpoints autenticados para servir el avatar y las fotos de check-in.
- Estadísticas de lugares visitados, check-ins e insignias para el perfil.
- Bloque de Chivito que celebra las visitas y anima a explorar otros lugares.

## Privacidad por diseño

- `GET /api/profile/me` siempre resuelve el usuario autenticado; no acepta un identificador
  de otro usuario.
- No se creó `/api/profile/:username` ni una página pública de perfil.
- El avatar y las fotos de check-in se guardan en `uploads-private/`, no en `uploads/`.
- `/api/uploads/...` solo sirve las imágenes públicas de los POI. No existe una URL estática
  para avatares o fotos de check-in.
- Las fotos de check-in se sirven solo si el check-in pertenece al usuario autenticado. Si
  pertenece a otra cuenta, la respuesta es `404` para no revelar su existencia.
- La galería y las insignias se resuelven siempre desde el usuario autenticado; no aceptan
  un identificador de otro usuario.
- El nombre de usuario se muestra solo dentro del perfil privado. No se usa como URL ni
  como identificador de sesión.
- Las respuestas privadas usan `Cache-Control: private, max-age=300, must-revalidate`.

## Modelo de usuario

`User` incorpora estos campos:

| Campo | Uso |
|---|---|
| `username` | Nombre de usuario único, en minúsculas. No público en este corte. |
| `bio` | Biografía opcional, máximo 280 caracteres. |
| `avatarFilename` | Nombre del archivo privado. `select: false`. |
| `avatarMimeType` | MIME validado del avatar. `select: false`. |
| `avatarSize` | Tamaño en bytes. `select: false`. |
| `avatarUpdatedAt` | Fecha de la última carga; se usa para versionar la URL. |

El JSON de usuario elimina `passwordHash` y `tokenVersion`. Los campos del avatar no se
serializan directamente; el perfil devuelve `hasAvatar` y una URL autenticada con versión:

```json
{
  "hasAvatar": true,
  "avatarUrl": "/api/profile/avatar?v=1762560000000"
}
```

## Nombre de usuario

- Se genera al registrar una cuenta a partir del nombre o del correo.
- Se normaliza a minúsculas y solo admite letras sin tilde, números, puntos, guiones y
  guiones bajos.
- Debe tener entre 3 y 30 caracteres, empezar y terminar con letra o número.
- El índice es único y disperso.
- `npm run backfill:usernames` asigna un `username` a las cuentas existentes que no lo
  tengan. Se ejecutó sobre la base local: 2 usuarios actualizados.
- Cambiar el nombre de usuario comprueba duplicados y responde `409 USERNAME_IN_USE`.
- Todavía no hay lista de nombres reservados ni historial de cambios.

## Endpoints

Todos requieren `Authorization: Bearer <access-token>`.

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/profile/me` | Perfil, estadísticas, aventuras, insignias y últimos check-in. |
| `PATCH` | `/api/profile/me` | Actualiza `name`, `username` y/o `bio`. |
| `GET` | `/api/profile/avatar` | Devuelve el avatar del usuario autenticado. |
| `POST` | `/api/profile/avatar` | Sube o reemplaza el avatar (`multipart/form-data`, campo `image`). |
| `DELETE` | `/api/profile/avatar` | Elimina el avatar y su archivo. |
| `GET` | `/api/profile/check-ins` | Galería paginada de visitas del usuario; admite `page`, `limit` y `hasPhoto`. |
| `GET` | `/api/profile/check-ins/:checkInId/photo` | Devuelve la foto del check-in si pertenece al usuario. |
| `PUT` | `/api/profile/check-ins/:checkInId/photo` | Añade o reemplaza la foto de un check-in propio (`multipart/form-data`, campo `image`). |
| `DELETE` | `/api/profile/check-ins/:checkInId/photo` | Elimina la foto del check-in sin borrar la visita ni sus insignias. |

### Galería paginada

```http
GET /api/profile/check-ins?page=1&limit=9&hasPhoto=true
```

- `page`: entero positivo, por defecto `1`.
- `limit`: entero positivo, por defecto `9`, máximo `48`.
- `hasPhoto`: opcional; solo admite `true` o `false`. Cualquier otro valor responde
  `400 VALIDATION_ERROR`.

```json
{
  "data": [
    {
      "id": "...",
      "createdAt": "2026-11-08T10:00:00.000Z",
      "distanceMeters": 18,
      "photoAvailable": true,
      "photoUrl": "/api/profile/check-ins/.../photo?v=1762596000000",
      "photoUpdatedAt": "2026-11-08T10:03:00.000Z",
      "location": {
        "id": "...",
        "title": "Catedral de Coro",
        "slug": "catedral-de-coro",
        "images": [],
        "coordinates": [-69.6778, 11.4075]
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 9,
    "total": 1,
    "totalPages": 1
  }
}
```

Las visitas se ordenan por `createdAt` descendente. `photoUrl` incluye la versión de la
foto; al reemplazarla cambia el valor de `v` y el navegador no reutiliza la imagen anterior.

### Respuesta de `GET /api/profile/me`

El siguiente ejemplo documenta el contrato heredado de la API. Sus contadores y logros de
aventura pueden seguir apareciendo para compatibilidad; la interfaz actual solo presenta
estadísticas e insignias de lugares.

```json
{
  "data": {
    "profile": {
      "id": "...",
      "name": "Isaac Corona",
      "username": "isaac",
      "email": "isaac@example.com",
      "bio": "Explorador del casco histórico.",
      "role": "user",
      "isActive": true,
      "mustChangePassword": false,
      "hasAvatar": true,
      "avatarUrl": "/api/profile/avatar?v=1762560000000",
      "createdAt": "2026-11-01T12:00:00.000Z",
      "updatedAt": "2026-11-07T12:00:00.000Z"
    },
    "stats": {
      "totalCheckIns": 5,
      "uniqueLocations": 5,
      "totalAdventures": 1,
      "startedAdventures": 1,
      "completedAdventures": 1,
      "totalStops": 5,
      "visitedStops": 5,
      "totalAchievements": 6,
      "locationAchievements": 5,
      "adventureAchievements": 1
    },
    "adventures": [],
    "achievements": [
      {
        "id": "...",
        "type": "adventure",
        "sourceId": "...",
        "sourceSlug": "ruta-del-casco-historico-de-coro",
        "name": "Explorador de Coro",
        "description": "Completaste todas las paradas del recorrido.",
        "image": null,
        "category": null,
        "awardedAt": "2026-11-08T10:05:00.000Z",
        "sourceActive": true
      }
    ],
    "recentCheckIns": []
  }
}
```

`uniqueLocations` coincide con `totalCheckIns` porque el índice único `(user, location)`
impide repetir un POI. `recentCheckIns` devuelve como máximo 8 registros, con
`photoAvailable` y `photoUrl` cuando existe foto.

`completedAdventures` se calcula a partir de las insignias de tipo `adventure`
persistidas, no de un recuento efímero del progreso. Las insignias de tipo `location`
conservan el nombre y la categoría del POI; las de tipo `adventure` usan la insignia del
recorrido si existe o un nombre genérico derivado del título. `sourceActive` indica si el
POI o el recorrido de origen sigue publicado; una insignia con `sourceActive: false` se
conserva y se marca como archivada en el perfil.

### Actualización del perfil

```http
PATCH /api/profile/me
Content-Type: application/json

{
  "name": "Isaac Corona",
  "username": "isaac.coro",
  "bio": "Explorador del casco histórico."
}
```

Reglas principales:

- `name`: 2–80 caracteres.
- `username`: 3–30 caracteres y formato permitido.
- `bio`: máximo 280 caracteres.
- Se puede enviar solo uno de los campos.
- Si no se envía ningún campo editable, responde `400 VALIDATION_ERROR`.
- Un `username` ocupado responde `409 USERNAME_IN_USE`.

## Avatar

- Campo multipart: `image`.
- Formatos: JPEG, PNG o WebP, validados por MIME declarado y firma binaria.
- Tamaño máximo: 5 MB (`UPLOAD_MAX_IMAGE_BYTES`).
- El archivo se guarda en `uploads-private/avatars/` con nombre aleatorio.
- Al reemplazar el avatar se elimina el archivo anterior después de guardar el nuevo.
- Si falla la persistencia del usuario, se elimina el archivo recién escrito.
- Rate limit: 30 cargas por IP cada 15 minutos; se desactiva en `NODE_ENV=test`.

El frontend valida tipo y tamaño antes de enviar, muestra una vista previa mediante un
`blob:` URL y revoca ese URL al cambiar de avatar o destruir el componente.

## Insignias persistentes

`UserAchievement` guarda una instantánea de la insignia para que el perfil no dependa de que
el POI o el recorrido sigan existiendo:

| Campo | Uso |
|---|---|
| `user` | Dueño de la insignia. |
| `type` | `location` o `adventure`. |
| `sourceId` | Identificador del POI o del recorrido. |
| `sourceSlug` | Slug del lugar o del origen histórico. |
| `name` | Nombre visible de la insignia. |
| `description` | Descripción breve. |
| `image` | Imagen de la insignia, si existe. |
| `category` | Categoría del POI para las insignias de lugar. |
| `awardedAt` | Fecha de otorgamiento. |
| `sourceCheckIn` | Check-in que disparó el otorgamiento, si aplica. |

El índice único `(user, type, sourceId)` garantiza la idempotencia. El otorgamiento usa
`updateOne` con `$setOnInsert` y trata el error `11000` como «ya otorgada».

- Cada check-in válido otorga únicamente la insignia del lugar visitado.
- Los datos y las insignias de recorridos ya existentes se conservan, pero los check-ins y el
  backfill actuales no generan nuevas insignias de recorrido.
- El perfil presenta insignias de lugares; las insignias históricas de recorridos no se
  muestran en la interfaz.
- `npm run backfill:achievements` reconstruye insignias de lugares desde los check-ins.
  Es una simulación por defecto; `--apply` escribe los cambios y `--user=`
  limita la ejecución a una cuenta. En producción exige `--allow-production`.

## Foto opcional de check-in

El check-in y la foto se separan en dos fases para que un fallo de imagen no revierta la
visita ni las insignias:

1. `POST /api/check-ins` registra la visita y devuelve `{ data, achievementsAwarded }`.
2. `PUT /api/profile/check-ins/:checkInId/photo` añade o reemplaza la foto.
3. `DELETE /api/profile/check-ins/:checkInId/photo` la elimina sin borrar el check-in.

La primera petición acepta JSON:

```http
POST /api/check-ins
Content-Type: application/json

{
  "locationId": "...",
  "token": "...",
  "latitude": 11.4075246,
  "longitude": -69.6778073
}
```

Se conserva temporalmente la compatibilidad con `multipart/form-data` y el campo `image`
para clientes anteriores. En ese caso la validación del QR, la geocerca y el duplicado se
ejecutan antes de persistir la foto; si el check-in falla después de guardar la foto, el
archivo se elimina.

Reglas de la foto:

- Formatos: JPEG, PNG o WebP, validados por MIME declarado y firma binaria.
- Tamaño máximo: 5 MB.
- Se guarda en `uploads-private/check-ins/` con nombre aleatorio.
- `CheckIn.photo` guarda `{ filename, mimeType, size, updatedAt, visibility, moderationStatus }`,
  sin URL pública. Los campos `visibility` y `moderationStatus` quedan reservados para la
  fase de moderación.
- La foto solo se sirve mediante `/api/profile/check-ins/:checkInId/photo` y solo si el
  check-in pertenece al usuario autenticado.
- Al reemplazar la foto se elimina el archivo anterior después de guardar el nuevo; si falla
  la persistencia, se elimina el archivo recién escrito.
- El frontend valida tipo y tamaño, muestra vista previa y permite reintentar o descartar la
  subida sin repetir el check-in.

## Seed de aventura

El seed crea o actualiza la aventura publicada «Ruta del Casco Histórico de Coro» con cinco
paradas reales del catálogo:

1. Catedral de Coro.
2. Casa de las Ventanas de Hierro.
3. Casa del Sol.
4. Plaza Bolívar de Coro.
5. Arco de la Federación.

Comandos:

```bash
npm run seed:adventures
npm run seed:adventures:verify
```

El seed es idempotente:

- resuelve las paradas por `slug` y exige que estén publicadas, visibles y no provisionales;
- reasigna órdenes temporales negativas para evitar colisiones del índice único;
- actualiza la aventura y sus paradas sin duplicarlas;
- omite aventuras archivadas o con borrado lógico;
- registra auditoría si existe un administrador;
- `--verify` comprueba publicación, cantidad, orden y disponibilidad de las paradas.

Si falta un POI o no está disponible, el script falla y pide publicar primero el catálogo.

## Almacenamiento

| Carpeta | Contenido | Acceso |
|---|---|---|
| `uploads/locations/` | Imágenes de POI | Público en `/api/uploads/locations/...` |
| `uploads-private/avatars/` | Avatares | Endpoint autenticado del dueño |
| `uploads-private/check-ins/` | Fotos de check-in | Endpoint autenticado del dueño |

`UPLOAD_DIR` define la carpeta pública y `UPLOAD_PRIVATE_DIR` la privada. Ambas están
ignoradas por Git. En la suite E2E se usan `test-results/e2e-uploads` y
`test-results/e2e-uploads-private` para no contaminar el entorno de desarrollo.

## Frontend

- Ruta protegida `/perfil`; el nombre del header enlaza a ella.
- Componente `features/perfil/perfil.component.ts`.
- Servicio `core/services/profile-api.service.ts`.
- Modelos `core/models/profile.model.ts` y `core/models/achievement.model.ts`.
- El cambio de contraseña se enlaza desde el perfil.
- Las imágenes privadas se solicitan como `Blob` y se muestran con URLs de objeto; el
  componente las revoca al destruirse, al reemplazarlas o al eliminarlas.
- Sección «Mis insignias» con insignias de lugares, descripción, fecha e imagen opcional.
  Cada insignia activa enlaza a la ficha del lugar; los orígenes archivados se muestran con
  una marca y sin enlace.
- Galería de visitas paginada (9 por página) con filtros «Todas», «Con foto» y «Sin foto».
  Cada tarjeta permite añadir o cambiar la foto y eliminarla con confirmación explícita.
  Eliminar la foto no borra el check-in ni las insignias.
- Visor ampliado accesible: `role="dialog"`, cierre con `Escape`, navegación con flechas,
  contador de posición y foco inicial en el botón de cierre.
- Chivito es un bloque local de mensajes; no llama a un servicio externo ni inventa datos.
  Celebra lugares descubiertos e insignias de POI con los datos del perfil.
- Al guardar el nombre, el header se actualiza mediante `AuthService.updateCurrentUser`.

## Verificación ejecutada

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas de perfil y logros | `node --test test/achievements.test.js` | Aprobadas |
| Suite backend completa | `npm test` en `projects/backend` | 75/75 aprobadas |
| Pruebas del seed de aventura | `node --test test/seedAdventures.test.js` | 2/2 aprobadas |
| Pruebas frontend | `npm test -- --watch=false` | 51/51 aprobadas |
| Build de producción | `npm run build` | Correcto, sin advertencias |
| E2E de perfil | `npx playwright test e2e/perfil.spec.ts` | Ver `docs/FALCONSYNC.md` |
| Seed local | `npm run seed:adventures` + `--verify` | Aventura con 5 paradas, publicada y verificada |
| Backfill local | `npm run backfill:usernames` | 2 usuarios actualizados |

La prueba E2E de perfil cubre: registro, apertura de `/perfil`, edición de nombre, usuario y
biografía, actualización del header, carga de avatar, check-in con foto en la Catedral de
Coro, insignia en pantalla de éxito, aparición de la insignia y la visita con foto en el
perfil, visor ampliado con `Escape`, reemplazo de la foto, eliminación con confirmación y
filtros de la galería.

## Límites y pendientes

- No hay perfiles públicos por decisión de alcance; si se agregan, requieren revisión de
  privacidad, moderación y consentimiento.
- La galería está paginada y solo muestra las visitas del usuario autenticado.
- No se redimensionan imágenes ni se eliminan metadatos EXIF, no hay antivirus y no se
  generan miniaturas.
- El almacenamiento es local y no está replicado. En producción debe incluirse en respaldos
  y evaluarse un almacenamiento de objetos.
- Las fotos son privadas para otros usuarios, pero no están cifradas de extremo a extremo;
  quien administre el servidor y el sistema de archivos puede acceder a ellas.
- `visibility` y `moderationStatus` están reservados, pero no existe todavía un flujo de
  moderación ni roles de revisión.
- No hay lista de nombres de usuario reservados, historial de cambios ni verificación de
  disponibilidad en tiempo real.
- La autoría y licencia de las imágenes públicas de los POI sigue pendiente de verificación.
