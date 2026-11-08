# Perfil privado, avatar y fotos de check-in

Fecha de verificación: 2026-11-07.

Este documento describe el perfil privado del turista en FalconSync, el avatar, la foto
opcional de cada check-in y el seed de la primera aventura. No atribuye el diseño a una
unidad académica: las transcripciones de las Unidades 2 a 7 todavía no están incorporadas en
`.opencode/knowledge/`. Las decisiones se justifican por el estado real del repositorio y por
buenas prácticas de ingeniería.

## Alcance implementado

- Perfil visible únicamente para su dueño. No existe directorio público ni ruta por
  `username`.
- Edición de nombre, nombre de usuario y biografía.
- Avatar privado con carga, reemplazo y eliminación.
- Foto opcional en cada check-in, almacenada fuera del prefijo público.
- Endpoints autenticados para servir el avatar y las fotos de check-in.
- Estadísticas reales de check-in y progreso de aventuras para el perfil.
- Bloque de Chivito en el frontend con mensajes derivados de esas estadísticas.
- Seed idempotente de la aventura «Ruta del Casco Histórico de Coro».

## Privacidad por diseño

- `GET /api/profile/me` siempre resuelve el usuario autenticado; no acepta un identificador
  de otro usuario.
- No se creó `/api/profile/:username` ni una página pública de perfil.
- El avatar y las fotos de check-in se guardan en `uploads-private/`, no en `uploads/`.
- `/api/uploads/...` solo sirve las imágenes públicas de los POI. No existe una URL estática
  para avatares o fotos de check-in.
- Las fotos de check-in se sirven solo si el check-in pertenece al usuario autenticado. Si
  pertenece a otra cuenta, la respuesta es `404` para no revelar su existencia.
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
| `GET` | `/api/profile/me` | Perfil, estadísticas, aventuras y últimos check-in. |
| `PATCH` | `/api/profile/me` | Actualiza `name`, `username` y/o `bio`. |
| `GET` | `/api/profile/avatar` | Devuelve el avatar del usuario autenticado. |
| `POST` | `/api/profile/avatar` | Sube o reemplaza el avatar (`multipart/form-data`, campo `image`). |
| `DELETE` | `/api/profile/avatar` | Elimina el avatar y su archivo. |
| `GET` | `/api/profile/check-ins/:checkInId/photo` | Devuelve la foto del check-in si pertenece al usuario. |

### Respuesta de `GET /api/profile/me`

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
      "completedAdventures": 0,
      "totalStops": 5,
      "visitedStops": 5
    },
    "adventures": [],
    "recentCheckIns": []
  }
}
```

`uniqueLocations` coincide con `totalCheckIns` porque el índice único `(user, location)`
impide repetir un POI. `recentCheckIns` devuelve como máximo 8 registros, con
`photoAvailable` y `photoUrl` cuando existe foto.

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

## Foto opcional de check-in

`POST /api/check-ins` sigue aceptando JSON, pero también admite `multipart/form-data`:

| Campo | Tipo | Obligatorio |
|---|---|---|
| `locationId` | texto | Sí |
| `token` | texto | Sí |
| `latitude` | número | Sí |
| `longitude` | número | Sí |
| `image` | archivo | No |

- La validación del QR, la geocerca y el duplicado se ejecutan antes de persistir la foto.
- La foto se guarda en `uploads-private/check-ins/` con nombre aleatorio.
- `CheckIn.photo` guarda `{ filename, mimeType, size }`, sin URL pública.
- Si el check-in falla después de guardar la foto, el archivo se elimina.
- La foto solo se sirve mediante `/api/profile/check-ins/:checkInId/photo`.
- El frontend valida tipo y tamaño, muestra vista previa y permite quitarla antes de enviar.
- No existe todavía un endpoint para reemplazar o eliminar la foto de un check-in ya
  registrado.

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
- Modelos `core/models/profile.model.ts`.
- El cambio de contraseña se enlaza desde el perfil.
- Las imágenes privadas se solicitan como `Blob` y se muestran con URLs de objeto; el
  componente las revoca al destruirse.
- Chivito es un bloque local de mensajes; no llama a un servicio externo ni inventa datos.
  Sus mensajes se derivan de `totalCheckIns`, `completedAdventures`, `startedAdventures`,
  `visitedStops` y `totalStops`.
- Al guardar el nombre, el header se actualiza mediante `AuthService.updateCurrentUser`.

## Verificación ejecutada

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas de perfil | `node --test test/profile.test.js` | 6/6 aprobadas |
| Pruebas del seed de aventura | `node --test test/seedAdventures.test.js` | 2/2 aprobadas |
| Suite backend completa | `npm test` en `falcon-sync-backend` | 67/67 aprobadas |
| Pruebas frontend | `npm test -- --watch=false` | 29/29 aprobadas |
| Build de producción | `npm run build` | Correcto |
| E2E completo | `npm run e2e` | 15/15 aprobadas |
| E2E completo con Chromium | `$env:CI=1; npm run e2e` | 15/15 aprobadas |
| E2E de perfil | `npx playwright test e2e/perfil.spec.ts` | 1/1 aprobada |
| Seed local | `npm run seed:adventures` + `--verify` | Aventura con 5 paradas, publicada y verificada |
| Backfill local | `npm run backfill:usernames` | 2 usuarios actualizados |

La prueba E2E de perfil cubre: registro, apertura de `/perfil`, edición de nombre, usuario y
biografía, actualización del header, carga de avatar, check-in con foto en la Catedral de
Coro, confirmación con vista previa y aparición del check-in con foto en el perfil privado.

## Límites y pendientes

- No hay perfiles públicos por decisión de alcance; si se agregan, requieren revisión de
  privacidad, moderación y consentimiento.
- No hay galería completa de fotos: el perfil muestra los últimos 8 check-in.
- No se redimensionan imágenes ni se eliminan metadatos EXIF, no hay antivirus y no se
  generan miniaturas.
- El almacenamiento es local y no está replicado. En producción debe incluirse en respaldos
  y evaluarse un almacenamiento de objetos.
- Las fotos son privadas para otros usuarios, pero no están cifradas de extremo a extremo;
  quien administre el servidor y el sistema de archivos puede acceder a ellas.
- No hay endpoint para eliminar o reemplazar una foto de check-in existente.
- No hay lista de nombres de usuario reservados, historial de cambios ni verificación de
  disponibilidad en tiempo real.
- No se implementó moderación de avatares o fotos.
- La autoría y licencia de las imágenes públicas de los POI sigue pendiente de verificación.
