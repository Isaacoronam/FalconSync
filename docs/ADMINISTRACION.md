# Administración y POI — Corte 2

Fecha de verificación: 2026-11-06.

Este documento describe la implementación técnica del panel administrativo y del CRUD de
puntos de interés. No atribuye el diseño a una unidad académica: las transcripciones de las
Unidades 2 a 7 todavía no están incorporadas en `.opencode/knowledge/`.

## Alcance

- Layout administrativo con navegación a panel, POI y auditoría.
- Panel con métricas por estado, usuarios y actividad reciente.
- Listado de POI con búsqueda, filtros por estado, categoría, circuito y etiqueta,
  paginación y acciones.
- Creación y edición de POI con validación en cliente y servidor.
- Ficha editorial con descripción, historia, datos de interés, información para visitantes,
  fuentes editoriales, dirección, circuitos, etiquetas, verificación cartográfica y créditos
  de imágenes.
- Regla de publicación: no se publica un POI provisional ni uno sin fecha de verificación.
- Selector de ubicación sobre un mapa limitado a Falcón.
- Borrado lógico con archivo y restauración.
- Carga de imágenes con adaptador de almacenamiento local.
- Acceso a impresión/descarga del QR desde el listado de POI publicados.
- Registro de auditoría para cada acción administrativa.
- Pruebas de backend, frontend y E2E.

## Permisos

Todas las rutas `/api/admin/*` exigen:

1. access token válido;
2. cuenta activa;
3. `tokenVersion` vigente;
4. contraseña cambiada si el usuario fue creado por bootstrap;
5. rol `admin`.

El rol `moderator` sigue reservado para el corte de moderación. No se implementó todavía
gestión de usuarios ni asignación de roles desde el panel.

## Modelo de POI

El modelo `Location` incorpora:

| Campo | Uso |
|---|---|
| `address` | Dirección o referencia legible, hasta 240 caracteres. |
| `circuits` | Lista de circuitos del enum cerrado; sin duplicados. |
| `tags` | Lista de etiquetas del enum cerrado; sin duplicados. |
| `coordinateSource` | Fuente cartográfica o documental de las coordenadas, hasta 500 caracteres. |
| `coordinateVerifiedAt` | Fecha de verificación de coordenadas; obligatoria para publicar. |
| `verificationLevel` | `unverified`, `single-source` o `verified`. |
| `isProvisional` | Indica ubicación o datos pendientes de verificación; impide publicar. |
| `isCatalogVisible` | Controla si el POI se incluye en el catálogo y mapa públicos. |
| `status` | `draft`, `published` o `archived`; por defecto `draft`. |
| `deletedAt` | Fecha del borrado lógico; `null` si está activo. |
| `createdBy`, `updatedBy`, `deletedBy` | Referencias internas al usuario; no se serializan en las respuestas JSON. |
| `images` | Rutas públicas de imágenes, hasta 8. |
| `imageCredits` | Autor, licencia, enlace de licencia y origen de cada imagen. |
| `checkInRadiusMeters` | Radio de check-in del POI, entre 10 y 500 m; por defecto 50. |
| `checkInTokenVersion`, `checkInTokenRotatedAt` | Estado de rotación del QR; el hash no se serializa. |

La lista y el detalle normal públicos solo devuelven POI con `status=published`,
`deletedAt=null`, `isProvisional!=true` e `isCatalogVisible!=false`. La lista permite
`includeProvisional=true` para que el mapa muestre borradores provisionales visibles con
advertencias. Ese modo no se extiende al detalle, búsqueda cercana, aventuras o check-in.
Los borradores internos, excluidos del catálogo y archivados permanecen solo en el API
administrativo.

### Reglas de validación

- Título obligatorio, entre 3 y 120 caracteres.
- Descripción obligatoria, entre 10 y 5000 caracteres.
- Categoría dentro de `architecture`, `monument`, `nature`, `religious`, `urban`, `museum`,
  `viewpoint`, `commerce`, `service`.
- Circuitos dentro de `casco-historico`, `museos`, `naturaleza-miradores`,
  `espacios-urbanos`, `la-vela`, `comercio-servicios`; sin duplicados.
- Etiquetas dentro de `colonial`, `unesco`, `gastronomy`, `theater`, `sports`, `promenade`,
  `market`, `crafts`, `family`, `photogenic`, `free-entry`, `guided-tour`; sin duplicados.
- Conservación dentro de `good`, `fair`, `poor`, `unknown`.
- Coordenadas numéricas dentro del rectángulo operativo de Falcón:
  latitud `10.3..12.19`, longitud `-71.35..-68.18`.
- `coordinateVerifiedAt` debe ser una fecha válida o `null`.
- Para publicar, `isProvisional` debe ser `false` y `coordinateVerifiedAt` debe existir.
  La regla se valida en el controlador y en el hook `pre('validate')` del modelo.
- URL de fuente y audioguía solo `http` o `https`.
- Imágenes solo con rutas `/api/uploads/locations/...` o `/images/locations/...`.
- Slug autogenerado desde el título si no se envía; solo minúsculas, números y guiones.
- El slug no se reutiliza automáticamente después de archivar un POI; si se necesita otro,
  debe elegirse uno distinto. Es una limitación consciente del índice único actual.

## Endpoints

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/admin/summary` | Métricas, estados y últimas seis acciones. |
| `GET` | `/api/admin/locations` | Lista paginada con `q`, `status`, `category`, `circuit`, `tag`, `page`, `limit`. |
| `GET` | `/api/admin/locations/:id` | Detalle administrativo. |
| `POST` | `/api/admin/locations` | Crea un POI; por defecto como borrador. |
| `PATCH` | `/api/admin/locations/:id` | Actualiza campos enviados. |
| `DELETE` | `/api/admin/locations/:id` | Archiva con borrado lógico. |
| `POST` | `/api/admin/locations/:id/restore` | Restaura como borrador. |
| `POST` | `/api/admin/locations/:id/images` | Sube una imagen `multipart/form-data` en el campo `image`. |
| `DELETE` | `/api/admin/locations/:id/images` | Quita una imagen mediante `{ "url": "..." }`. |
| `POST` | `/api/admin/locations/:id/qr/rotate?format=svg\|png` | Rota el token QR y devuelve el token y la imagen una sola vez. |
| `GET` | `/api/admin/audit` | Auditoría paginada, filtrable por `action` y `entityId`. |

Errores propios: `DUPLICATE_SLUG`, `LOCATION_ARCHIVED`, `LOCATION_NOT_ARCHIVED`,
`LOCATION_IN_USE`, `IMAGE_LIMIT_REACHED`, `IMAGE_NOT_FOUND`, `INVALID_IMAGE`,
`INVALID_IMAGE_TYPE`, `IMAGE_TOO_LARGE`, `INVALID_QR_FORMAT`.

`LOCATION_IN_USE` impide archivar o despublicar un POI que sea parada de una aventura
publicada. El detalle de aventuras, QR y check-in está en [`AVENTURAS.md`](./AVENTURAS.md).

## Borrado lógico

`DELETE` no elimina el documento:

1. cambia `status` a `archived`;
2. guarda `deletedAt` y `deletedBy`;
3. deja de aparecer en el API público;
4. puede restaurarse, volviendo siempre a `draft` para revisión antes de publicar.

Las imágenes no se borran al archivar el POI; se conservan para permitir la restauración.
Solo se elimina el archivo físico cuando se quita explícitamente una imagen.

## Imágenes y almacenamiento

- Límite: 5 MB por archivo y 8 imágenes por POI.
- Formatos: JPEG, PNG y WebP.
- El tipo declarado por el navegador se contrasta con la firma binaria del archivo.
- SVG y otros formatos se rechazan para evitar contenido activo.
- Los archivos se guardan con nombre aleatorio en `UPLOAD_DIR/locations`.
- El adaptador está en `src/services/storage/localStorageAdapter.js` y se expone mediante
  `src/services/storage/index.js`. El contrato permite sustituirlo por S3, R2 u otro
  almacenamiento de objetos.
- Las imágenes se sirven en `/api/uploads/...` con caché de 30 días y
  `Cross-Origin-Resource-Policy: cross-origin`.
- `uploads/` está ignorado por Git. En producción debe incluirse en la política de respaldo
  y, si se usa más de una instancia, migrarse a almacenamiento compartido.

## Auditoría

Cada operación registra:

- acción (`location.created`, `location.updated`, `location.deleted`,
  `location.restored`, `location.image.uploaded`, `location.image.removed`);
- usuario y correo;
- entidad e identificador;
- resumen legible;
- metadatos acotados (campos modificados, URL o tamaño de imagen);
- IP y `user-agent`;
- fecha de creación.

La auditoría no bloquea la operación principal si falla su escritura, pero el error queda en
el log del servidor. No se implementó retención, exportación ni firma de logs.

## Frontend

Rutas:

- `/admin`: panel de control.
- `/admin/poi`: listado y acciones.
- `/admin/poi/nuevo`: creación.
- `/admin/poi/:id/editar`: edición, imágenes y publicación.
- `/admin/auditoria`: historial.

El formulario usa validación reactiva, un selector Leaflet limitado a Falcón y gestión de
imágenes en la misma pantalla de edición. Incluye descripción, historia, hechos de interés,
información para visitantes, fuentes editoriales y los metadatos de publicación y ubicación.
El bloqueo de publicación provisional o sin fecha se aplica en cliente además de servidor.
El listado permite filtrar por categoría, circuito y etiqueta, e imprimir o descargar el QR
de los POI publicados. La tabla se convierte en tarjetas en pantallas menores a 700 px para
evitar desplazamiento horizontal.

## Verificación

| Comprobación | Resultado |
|---|---|
| Pruebas backend | 75/75 aprobadas |
| Pruebas frontend | 51/51 aprobadas |
| Build de producción | Correcto, sin advertencias |
| E2E | 16/16 en Edge local; corrida Chromium/CI pendiente de repetir |
| Seed y verificación | 23 POI publicados; Gelatería El Sol y la entrada del Parque Nacional Médanos de Coro visibles en el mapa |
| `npm audit --omit=dev` | 0 vulnerabilidades en backend y frontend |

La prueba E2E `admin-poi.spec.ts` crea un POI, sube una imagen, lo publica, comprueba que
aparece en el mapa, lo archiva, verifica que desaparece del API público y lo restaura.

## Límites y pendientes

- No hay gestión de usuarios ni cambio de roles desde el panel.
- No hay flujo editorial con revisión por un segundo usuario.
- No se generan miniaturas ni se eliminan metadatos EXIF.
- No hay análisis antivirus de archivos subidos.
- El almacenamiento es local y no está replicado.
- El slug archivado no puede reutilizarse sin elegir otro.
- No se implementó historial visual de versiones ni comparación de cambios.
- Los 17 POI borradores requieren verificación de coordenadas en campo; uno tiene
  discrepancias documentadas y no deben publicarse todavía.
- La autoría y licencia de 18 imágenes sigue pendiente de confirmación.
- No hay flujo para aprobar la verificación de coordenadas por un segundo usuario.
- El workflow de CI sigue sin ejecutarse en remoto.
