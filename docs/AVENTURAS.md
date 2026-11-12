# CoroAventura — infraestructura heredada de recorridos, QR e insignias

Fecha de verificación: 2026-11-08.

Este documento conserva la referencia técnica del backend de recorridos que existía antes
del cambio de producto. Los datos y las APIs se mantienen temporalmente por compatibilidad,
pero las rutas, el progreso y las paradas ya no forman parte de la experiencia turística.
La navegación pública `/aventuras` redirige al catálogo de lugares; la administración de
rutas también se retiró de la interfaz. La experiencia vigente se describe en
[`POI.md`](./POI.md). QR, check-in global por POI e insignias por lugar siguen activos.
Las secciones siguientes documentan el comportamiento histórico de las APIs; actualmente
los check-ins y el backfill solo otorgan insignias por POI, y los logros antiguos de rutas se
conservan sin mostrarse en el perfil.

No atribuye el diseño a una unidad académica: las transcripciones de las Unidades 2 a 7
todavía no están incorporadas en `.opencode/knowledge/`. Las decisiones se justifican por
el estado real del repositorio y por buenas prácticas de ingeniería.

## Alcance implementado

- Modelos `Adventure`, `AdventureStop`, `CheckIn` y `UserAchievement`.
- Extensión de `Location` con hash de token QR, versión, fecha de rotación y radio de
  check-in.
- CRUD administrativo de aventuras, publicación, archivo y restauración.
- Gestión y reordenamiento de paradas.
- Rotación de token QR por POI con salida SVG o PNG.
- Check-in global por POI con validación de token y geocerca en servidor.
- Insignias persistentes por parada y por recorrido, idempotentes y con backfill.
- Foto opcional por check-in, almacenada de forma privada y gestionable después del check-in.
- Progreso de aventura con paradas visitadas, siguiente parada, cierre e insignia persistida.
- Auditoría de cambios de aventura y rotaciones de QR.
- Bloqueo de archivado de un POI que es parada activa de una aventura publicada.
- Seed idempotente de la aventura «Ruta del Casco Histórico de Coro» con cinco paradas reales.

Desde el 2026-11-07 los 23 POI del catálogo están publicados y habilitados para check-in.
La publicación se hizo con revisión documental; la verificación en campo sigue pendiente.

El frontend de aventuras se implementó en el Corte 4 (`docs/COROAVENTURA-FRONTEND.md`),
incluido el escáner QR con cámara y entrada manual. La moderación de contenido sigue
pendiente.

## Decisiones de diseño

### 1. Check-in global por POI

`CheckIn` relaciona un usuario con un POI, no con una aventura. El índice único es
`(user, location)`.

El progreso de cada aventura se calcula consultando los POI visitados por el usuario y
cruzando esa información con las paradas de la aventura. Esto permite:

- imprimir un único QR por POI;
- reutilizar el mismo POI en varias aventuras;
- registrar la visita aunque el POI todavía no pertenezca a una aventura publicada;
- evitar duplicados globales sin importar cuántas rutas incluyan el lugar.

### 2. Token QR opaco con rotación

- Token aleatorio de 32 bytes en base64url (43 caracteres).
- Se persiste únicamente su hash SHA-256 en `Location.checkInTokenHash`.
- El hash tiene `select: false` en Mongoose y además se elimina en `toJSON`.
- El token en claro solo se devuelve en la respuesta de rotación. No existe un endpoint para
  recuperarlo.
- Cada rotación incrementa `checkInTokenVersion`, actualiza `checkInTokenRotatedAt` e
  invalida cualquier QR impreso o compartido anteriormente.
- La comparación se hace en tiempo constante con `crypto.timingSafeEqual` sobre los hashes
  SHA-256.
- `CheckIn.tokenVersion` guarda la versión vigente al registrar la visita, para trazabilidad.

El QR codifica este JSON:

```json
{
  "type": "falconsync-check-in",
  "locationId": "64f0c2...",
  "token": "token-opaco-de-43-caracteres"
}
```

La rotación devuelve el token y una imagen en `data:` URL:

```http
POST /api/admin/locations/:id/qr/rotate?format=svg
Authorization: Bearer <access-token>
```

```json
{
  "data": {
    "location": { "id": "...", "title": "Catedral de Coro" },
    "token": "<token en claro>",
    "tokenVersion": 1,
    "rotatedAt": "2026-11-05T12:00:00.000Z",
    "format": "svg",
    "qrDataUrl": "data:image/svg+xml;base64,..."
  }
}
```

`format` admite `svg` (por defecto) o `png`. La respuesta usa `Cache-Control: no-store`.
El token no se guarda en disco ni en la base de datos en claro. Si se pierde, debe rotarse
otra vez; el QR anterior dejará de funcionar.

Para generar los QR de todo el catálogo local se usa:

```bash
npm run qr:generate -- --apply
```

Los SVG se guardan en `projects/backend/.qr-codes/`, que está fuera de Git porque
contiene tokens. El manifiesto solo registra slug, título, versión y fecha de rotación.

### 3. Geocerca validada en servidor

- Se calcula la distancia Haversine entre la ubicación enviada por el cliente y el POI.
- `Location.checkInRadiusMeters` define el radio; por defecto 50 m.
- El administrador puede fijarlo entre 10 y 500 m al crear o editar un POI.
- La ubicación del cliente nunca se usa para decidir por sí sola: el servidor recalcula y
  rechaza fuera del radio.
- El error incluye la distancia calculada y el radio permitido, sin revelar información
  adicional.

### 4. Check-in en cualquier orden

- No se exige visitar las paradas en orden.
- Un segundo check-in del mismo usuario en el mismo POI responde
  `409 CHECK_IN_ALREADY_EXISTS`.
- `nextStop` es la primera parada activa no visitada según `order`.
- La aventura se considera completada cuando todas las paradas activas están visitadas.
- `completedAt` es la fecha del check-in más reciente de las paradas activas, solo cuando la
  ruta está completa.

### 5. Integridad POI–aventura

- Una parada solo puede crearse o cambiarse hacia un POI con `status=published`,
  `deletedAt=null`, `isCatalogVisible=true` y no provisional.
- Publicar una aventura exige al menos una parada y que todas apunten a POI publicados y
  visibles en el catálogo.
- Archivar o despublicar un POI que sea parada de una aventura publicada responde
  `409 LOCATION_IN_USE`.
- Para liberar el POI hay que retirar la parada o archivar la aventura.
- Los POI archivados no pueden usarse como parada.

### 6. Foto opcional, dos fases y privacidad del check-in

- El check-in se registra primero con `POST /api/check-ins` en JSON. La foto se sube
  después con `PUT /api/profile/check-ins/:checkInId/photo`.
- Un fallo al subir la foto no revierte la visita ni las insignias; el cliente puede
  reintentar o descartar la imagen.
- `POST /api/check-ins` conserva temporalmente la compatibilidad con
  `multipart/form-data` y el campo `image` para clientes anteriores.
- La foto se valida por MIME y firma binaria (JPEG, PNG o WebP) y se limita a 5 MB.
- Se guarda en `uploads-private/check-ins/`, fuera del prefijo público `/api/uploads`.
- `CheckIn.photo` guarda `{ filename, mimeType, size, updatedAt, visibility, moderationStatus }`;
  no hay URL pública. Los dos últimos campos quedan reservados para moderación.
- La foto se sirve mediante `GET /api/profile/check-ins/:checkInId/photo` y solo al dueño
  del check-in. Otro usuario recibe `404`.
- `PUT` reemplaza la foto y elimina el archivo anterior; `DELETE` elimina la foto sin borrar
  el check-in.
- Si la creación del check-in falla después de escribir el archivo en el modo multipart, la
  foto se elimina.
- El avatar y el resto del perfil privado se documentan en [`PERFIL.md`](./PERFIL.md).

### 7. Insignias persistentes e idempotentes

- `UserAchievement` guarda una instantánea de la insignia y el origen que la otorgó.
- El índice único `(user, type, sourceId)` impide duplicados. El otorgamiento usa
  `$setOnInsert` y trata el error `11000` como «ya otorgada».
- Cada check-in otorga la insignia del POI.
- Completar todas las paradas activas de un recorrido publicado otorga la insignia del
  recorrido. Si la aventura no define `badge`, se usa un nombre genérico derivado del título.
- Una aventura archivada no otorga insignias nuevas; las ya obtenidas se conservan y se
  marcan con `sourceActive: false` al listarlas.
- El progreso de una aventura incluye `achievement` con la insignia persistida del recorrido
  o `null` si todavía no se otorgó.
- Si un check-in duplicado llega después de un fallo previo de otorgamiento, el controlador
  reconcilia las insignias del check-in existente antes de responder `409`.
- `npm run backfill:achievements` reconstruye las insignias desde los check-in y el progreso.
  Es una simulación por defecto; `--apply` escribe, `--user=` limita a una cuenta y
  `--allow-production` es obligatorio en producción.

## Modelos

### Adventure

| Campo | Tipo / regla |
|---|---|
| `title` | Texto obligatorio, máximo 140 caracteres. |
| `slug` | Único, minúsculas, números y guiones. Se autogenera desde el título. |
| `summary` | Texto obligatorio, 10–280 caracteres. |
| `description` | Texto obligatorio, 20–10000 caracteres. |
| `difficulty` | `easy`, `moderate` o `challenging`. Por defecto `easy`. |
| `estimatedMinutes` | Entero 1–1440. Por defecto 60. |
| `coverImage` | URL `http(s)` o ruta local permitida. Opcional. |
| `badge` | Objeto opcional `{ name, description?, image? }`; `name` obligatorio. |
| `status` | `draft`, `published` o `archived`. Por defecto `draft`. |
| `deletedAt`, `createdBy`, `updatedBy`, `deletedBy` | Borrado lógico y auditoría interna. No se serializan las referencias de usuario. |

### AdventureStop

| Campo | Tipo / regla |
|---|---|
| `adventure` | Referencia obligatoria a `Adventure`. |
| `location` | Referencia obligatoria a un POI publicado. |
| `order` | Entero mayor o igual a 1. Único por aventura. |
| `didacticText` | Texto opcional, máximo 2000 caracteres. |
| `instructions` | Texto opcional, máximo 2000 caracteres. |

Índices únicos: `(adventure, order)` y `(adventure, location)`.

### CheckIn

| Campo | Tipo / regla |
|---|---|
| `user` | Referencia al usuario autenticado. |
| `location` | Referencia al POI visitado. |
| `coordinates` | `Point` GeoJSON con la ubicación enviada al hacer check-in. |
| `distanceMeters` | Distancia Haversine calculada por el servidor. |
| `tokenVersion` | Versión del token QR usada en el check-in. |
| `photo` | Objeto opcional `{ filename, mimeType, size, updatedAt, visibility, moderationStatus }`; el archivo vive en `uploads-private/check-ins/`. |

Índice único: `(user, location)`. No se guarda el token en claro ni su hash.

### UserAchievement

| Campo | Tipo / regla |
|---|---|
| `user` | Referencia al usuario que obtuvo la insignia. |
| `type` | `location` o `adventure`. |
| `sourceId` | Referencia al POI o al recorrido de origen. |
| `sourceSlug` | Slug del origen; permite enlazar el progreso sin depender del estado actual. |
| `name` | Nombre visible de la insignia. |
| `description` | Descripción breve. |
| `image` | Imagen opcional de la insignia del recorrido. |
| `category` | Categoría del POI en las insignias de lugar; `null` en las de recorrido. |
| `awardedAt` | Fecha de otorgamiento. |
| `sourceCheckIn` | Check-in que disparó el otorgamiento; puede ser `null` en un backfill. |

Índice único: `(user, type, sourceId)`. La insignia es una instantánea: si el POI o el
recorrido se archivan, el nombre, la descripción y la fecha se conservan.

### Cambios en Location

| Campo | Uso |
|---|---|
| `checkInTokenHash` | SHA-256 del token vigente. `select: false`; nunca se serializa. |
| `checkInTokenVersion` | Contador de rotaciones; empieza en 0. |
| `checkInTokenRotatedAt` | Fecha de la última rotación. |
| `checkInRadiusMeters` | Radio de check-in, por defecto 50, entre 10 y 500. |

Los JSON de POI exponen `checkInTokenConfigured` (booleano) y la versión/fecha de rotación,
pero nunca el hash ni el token.

## Endpoints

### Públicos

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/adventures?page=&limit=` | Lista paginada de aventuras publicadas con `stopsCount`. |
| `GET` | `/api/adventures/:slug` | Detalle de aventura publicada con paradas de POI publicados, ordenadas por `order`. |

### Autenticados

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/adventures/:slug/progress` | Progreso del usuario autenticado, con la insignia persistida del recorrido. |
| `POST` | `/api/check-ins` | Registra un check-in global por POI en JSON; conserva compatibilidad multipart. Devuelve `achievementsAwarded`. |
| `GET` | `/api/profile/check-ins` | Galería paginada de visitas del usuario. |
| `GET` | `/api/profile/check-ins/:checkInId/photo` | Devuelve la foto privada del check-in al dueño. |
| `PUT` | `/api/profile/check-ins/:checkInId/photo` | Añade o reemplaza la foto de un check-in propio. |
| `DELETE` | `/api/profile/check-ins/:checkInId/photo` | Elimina la foto sin borrar la visita ni las insignias. |

Cuerpo JSON de check-in:

```json
{
  "locationId": "64f0c2...",
  "token": "token-del-qr",
  "latitude": 11.4075246,
  "longitude": -69.6778073
}
```

El frontend actual usa este cuerpo JSON y sube la foto después con
`PUT /api/profile/check-ins/:checkInId/photo` (`multipart/form-data`, campo `image`). Si se
necesita compatibilidad con clientes anteriores, `POST /api/check-ins` también acepta
`multipart/form-data` con los mismos campos de texto más `image` opcional. La foto se guarda
en `uploads-private/check-ins/` y solo se sirve al dueño.

Respuesta `201`:

```json
{
  "data": {
    "id": "...",
    "user": "...",
    "location": "...",
    "coordinates": {
      "type": "Point",
      "coordinates": [-69.6778073, 11.4075246]
    },
    "distanceMeters": 0,
    "tokenVersion": 1,
    "photo": null,
    "createdAt": "2026-11-05T12:00:00.000Z"
  },
  "achievementsAwarded": [
    {
      "id": "...",
      "type": "location",
      "sourceId": "...",
      "sourceSlug": "catedral-de-coro",
      "name": "Catedral de Coro",
      "description": "Sello de visita al patrimonio de Santa Ana de Coro.",
      "image": null,
      "category": "religious",
      "awardedAt": "2026-11-08T10:00:00.000Z",
      "sourceCheckIn": "..."
    }
  ]
}
```

`achievementsAwarded` contiene solo las insignias nuevas; puede ser un arreglo vacío cuando
la visita no desbloquea ninguna. Un error al otorgar insignias no revierte el check-in: se
registra y la respuesta sigue siendo válida.

### Progreso

`GET /api/adventures/:slug/progress` devuelve:

```json
{
  "data": {
    "adventure": { "id": "...", "title": "Ruta del Centro", "slug": "ruta-del-centro" },
    "stops": [
      {
        "id": "...",
        "order": 1,
        "didacticText": "...",
        "instructions": "...",
        "visited": true,
        "checkInAt": "2026-11-05T12:00:00.000Z",
        "location": { "id": "...", "title": "Catedral de Coro" }
      }
    ],
    "totalStops": 3,
    "visitedStops": 2,
    "remainingStops": 1,
    "percentage": 67,
    "nextStop": { "order": 3, "visited": false, "location": { "...": "..." } },
    "completed": false,
    "completedAt": null,
    "achievement": null
  }
}
```

Solo cuentan las paradas activas: POI existente, publicado y sin archivar. El porcentaje se
redondea al entero más cercano. Una aventura publicada no puede quedarse sin paradas a través
del API. `achievement` contiene la insignia persistida del recorrido cuando todas las paradas
activas están visitadas; si aún no se otorgó, es `null`.

### Seed de aventura

El script `scripts/seedAdventures.js` crea o actualiza la aventura publicada «Ruta del Casco
Histórico de Coro» con cinco paradas reales:

1. `catedral-de-coro`.
2. `casa-de-las-ventanas-de-hierro`.
3. `casa-del-sol`.
4. `plaza-bolivar-de-coro`.
5. `arco-de-la-federacion`.

```bash
npm run seed:adventures
npm run seed:adventures:verify
```

Es idempotente: resuelve las paradas por `slug`, exige que estén publicadas, visibles y no
provisionales, reordena con valores temporales negativos para evitar colisiones y elimina
paradas que ya no pertenecen al seed. Omite aventuras archivadas o con borrado lógico.
`--verify` comprueba publicación, cantidad, orden y disponibilidad. Si falta un POI, falla y
pide publicar primero el catálogo. El detalle del perfil y las fotos está en
[`PERFIL.md`](./PERFIL.md).

### Administrativos

Todas las rutas requieren access token, rol `admin` y contraseña cambiada si corresponde.

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/admin/adventures?q=&status=&page=&limit=` | Lista administrativa. |
| `GET` | `/api/admin/adventures/:id` | Detalle con paradas y POI, incluidos no publicados. |
| `POST` | `/api/admin/adventures` | Crea una aventura en `draft`. |
| `PATCH` | `/api/admin/adventures/:id` | Edita metadatos e insignia. |
| `DELETE` | `/api/admin/adventures/:id` | Archiva con borrado lógico. |
| `POST` | `/api/admin/adventures/:id/publish` | Publica si tiene paradas válidas. |
| `POST` | `/api/admin/adventures/:id/archive` | Archiva. |
| `POST` | `/api/admin/adventures/:id/restore` | Restaura como borrador. |
| `PUT` | `/api/admin/adventures/:id/stops/reorder` | Reordena con `{ "order": ["stopId1", "stopId2"] }`. |
| `POST` | `/api/admin/adventures/:id/stops` | Añade una parada. |
| `PATCH` | `/api/admin/adventures/:id/stops/:stopId` | Edita textos o cambia el POI de la parada. |
| `DELETE` | `/api/admin/adventures/:id/stops/:stopId` | Elimina una parada. |
| `POST` | `/api/admin/locations/:id/qr/rotate?format=svg\|png` | Rota el token y devuelve el QR una sola vez. |

El reordenamiento exige la lista completa de paradas, sin duplicados. Internamente usa dos
fases con órdenes temporales negativos para evitar colisiones del índice único al intercambiar
posiciones.

## Errores propios

| Código | HTTP | Situación |
|---|---|---|
| `ADVENTURE_NOT_FOUND` | 404 | Aventura inexistente o no publicada en el API público. |
| `ADVENTURE_ARCHIVED` | 409 | Intento de editar una aventura archivada. |
| `ADVENTURE_ALREADY_PUBLISHED` | 409 | Publicación repetida. |
| `ADVENTURE_ALREADY_ARCHIVED` | 409 | Archivo repetido. |
| `ADVENTURE_NOT_ARCHIVED` | 409 | Restauración de una aventura activa. |
| `ADVENTURE_WITHOUT_STOPS` | 409 | Publicación sin paradas. |
| `ADVENTURE_HAS_INVALID_STOPS` | 409 | Alguna parada apunta a un POI no publicado. |
| `ADVENTURE_REQUIRES_STOPS` | 409 | Intento de dejar sin paradas una aventura publicada. |
| `STOP_NOT_FOUND` | 404 | Parada inexistente en la aventura. |
| `STOP_ALREADY_EXISTS` | 409 | POI repetido en la misma aventura. |
| `STOP_ORDER_CONFLICT` | 409 | Orden ya ocupado. |
| `LOCATION_NOT_PUBLISHED` | 409 | Parada sobre POI no publicado o archivado. |
| `LOCATION_IN_USE` | 409 | POI usado por una aventura publicada. |
| `LOCATION_NOT_AVAILABLE` | 409 | Check-in sobre POI no publicado o archivado. |
| `INVALID_CHECK_IN_TOKEN` | 400 | Token ausente, mal formado o invalidado por rotación. |
| `CHECK_IN_OUTSIDE_GEOFENCE` | 400 | Distancia mayor al radio permitido. |
| `CHECK_IN_ALREADY_EXISTS` | 409 | Check-in duplicado del usuario en el POI. |
| `INVALID_QR_FORMAT` | 400 | Formato distinto de `svg` o `png`. |

## Seguridad

- Token QR de 32 bytes con `crypto.randomBytes`; hash SHA-256 persistido.
- Comparación en tiempo constante con `timingSafeEqual`.
- El hash tiene `select: false` y además se elimina en `toJSON`; no aparece en listados,
  detalles públicos, paradas pobladas ni respuestas administrativas.
- La geocerca se valida exclusivamente en el servidor con Haversine.
- La foto de check-in se valida por firma binaria, se limita a 5 MB y se guarda en
  `uploads-private/`, fuera del prefijo público.
- Las fotos de check-in solo se sirven al dueño; otro usuario recibe `404`.
- La foto se carga después del check-in; un fallo de imagen no revierte la visita ni las
  insignias.
- Las insignias se otorgan con un índice único por usuario y origen; el backfill es
  idempotente y no duplica registros.
- El modo `--apply` del backfill exige `--allow-production` cuando `NODE_ENV=production`.
- Rate limit específico de check-in: 30 intentos por IP cada 15 minutos. Se desactiva en
  `NODE_ENV=test` siguiendo el patrón existente.
- No se registran tokens ni hashes en logs ni en metadatos de auditoría.
- La rotación de QR registra `location.qr.rotated` con versión y formato, sin token.
- Los cambios de aventura y paradas se auditan.
- El API público solo expone aventuras `published` sin borrado lógico y paradas con POI
  publicado, visible en catálogo y no provisional.
- Las rutas administrativas reutilizan `authenticate` y `requireRole('admin')`.

## Pruebas

Comando ejecutado:

```bash
cd projects/backend
npm test
```

Resultado real del 2026-11-08:

| Suite | Pruebas | Resultado |
|---|---|---|
| Administración de POI | 13 | Aprobadas |
| CoroAventura | 17 | Aprobadas |
| Autenticación | 12 | Aprobadas |
| API de lugares | 15 | Aprobadas |
| Perfil privado y fotos de check-in | 6 | Aprobadas |
| Insignias, galería y foto posterior | 6 | Aprobadas |
| Seed de aventuras | 2 | Aprobadas |
| Seed de POI | 4 | Aprobadas |
| **Total** | **75** | **75/75 aprobadas** |

La suite `test/adventures.test.js` cubre:

1. QR SVG generado con token opaco de 32 bytes y hash persistido.
2. Hash y token ausentes de respuestas administrativas y públicas.
3. Rotación de QR y rechazo del token anterior.
4. Token inválido rechazado.
5. Check-in válido dentro del radio.
6. Check-in duplicado rechazado con `CHECK_IN_ALREADY_EXISTS`.
7. Check-in fuera de geocerca rechazado.
8. Radio configurable y límites 10–500 m.
9. Progreso con check-ins en cualquier orden.
10. Siguiente parada sugerida correcta.
11. Ruta completada al visitar todas las paradas.
12. Check-in global compartido entre aventuras.
13. POI borrador o archivado rechazado como parada.
14. POI en uso no puede archivarse ni despublicarse.
15. Aventura publicada visible; borrador y archivada ocultas.
16. Reordenamiento completo y rechazo de listas incompletas.
17. Usuario normal bloqueado en rutas administrativas.
18. Auditoría de creación, edición, archivo, restauración y rotación de QR.
19. Check-in rechazado en un POI provisional aunque tenga token vigente.
20. POI provisional oculto del API público y rechazado como parada de aventura.
21. POI excluido del catálogo rechazado como parada y check-in.
22. Check-in con foto en modo multipart, metadatos persistidos y limpieza ante error.
23. Foto servida solo al dueño; otro usuario recibe 404.
24. Insignia de lugar otorgada en el check-in y devuelta en `achievementsAwarded`.
25. Check-in que completa una ruta heredada no genera una insignia de recorrido nueva.
26. Otorgamiento idempotente y reconciliación de un check-in duplicado.
27. Insignia conservada con `sourceActive: false` cuando el origen se archiva.
28. Foto añadida, reemplazada y eliminada después del check-in sin borrar la visita.
29. Galería paginada y filtro `hasPhoto`.
30. Perfil privado, avatar, estadísticas y seed de aventura (suites `profile.test.js` y
    `seedAdventures.test.js`).

## Gate del corte

| Criterio | Estado | Evidencia |
|---|---|---|
| QR generado | Cumplido | `POST /qr/rotate`, SVG/PNG y prueba automatizada. |
| Check-in válido | Cumplido | `POST /api/check-ins` dentro del radio, prueba 5. |
| Duplicado rechazado | Cumplido | `409 CHECK_IN_ALREADY_EXISTS`. |
| Fuera de geocerca rechazado | Cumplido | `400 CHECK_IN_OUTSIDE_GEOFENCE`. |
| Token inválido rechazado | Cumplido | `400 INVALID_CHECK_IN_TOKEN`, incluido token rotado. |
| Progreso correcto | Cumplido | Orden libre, siguiente parada, porcentaje y cierre. |
| Pruebas backend verdes | Cumplido | `npm test`: 75/75. |
| Foto privada de check-in | Cumplido | Carga posterior con `PUT`, reemplazo/eliminación y acceso solo al dueño. |
| Insignias persistentes | Cumplido | `UserAchievement`, índice único, backfill y reconciliación. |
| Documentación | Cumplido | Este documento, `PERFIL.md` y actualización de `FALCONSYNC.md`. |

## Límites y pendientes

- El frontend de aventuras y el escáner QR están implementados en el Corte 4; la verificación
  física de los QR impresos en campo sigue pendiente.
- El seed de aventuras cubre una ruta; las demás aventuras se crean por el API administrativo.
- Las fotos de check-in no se redimensionan, no eliminan EXIF y no pasan por antivirus.
- No existe todavía un flujo de moderación; `visibility` y `moderationStatus` están
  reservados en el modelo.
- Las fotos privadas dependen del almacenamiento local y deben incluirse en respaldos.
- No se almacenan imágenes de QR; el administrador debe descargar o imprimir la respuesta.
- El QR puede fotografiarse y compartirse: la geocerca reduce el abuso, pero no sustituye
  controles anti-fraude más fuertes.
- La ubicación del cliente puede ser simulada; el servidor solo valida coordenadas y radio.
- No existe revocación sin rotación ni fecha de expiración del token; el token se guarda solo
  en memoria en el frontend y nunca se añade a la URL de la aplicación.
- El rate limit de check-in se aplica por IP, no por usuario.
- Las insignias son privadas; no hay notificaciones, tablas públicas ni compartición social.
- No hay moderación de contenido ni revisión por un segundo usuario.
- El slug de una aventura archivada no se reutiliza automáticamente.
- No se implementó retención, exportación ni firma de auditoría.
- Las transcripciones académicas de las Unidades 2 a 7 siguen pendientes; este documento no
  atribuye el trabajo a una unidad.
