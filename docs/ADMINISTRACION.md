# Administración y POI — Corte 2

Fecha de verificación: 2026-11-05.

Este documento describe la implementación técnica del panel administrativo y del CRUD de
puntos de interés. No atribuye el diseño a una unidad académica: las transcripciones de las
Unidades 2 a 7 todavía no están incorporadas en `.opencode/knowledge/`.

## Alcance

- Layout administrativo con navegación a panel, POI y auditoría.
- Panel con métricas por estado, usuarios y actividad reciente.
- Listado de POI con búsqueda, filtros, paginación y acciones.
- Creación y edición de POI con validación en cliente y servidor.
- Selector de ubicación sobre un mapa limitado a Falcón.
- Borrado lógico con archivo y restauración.
- Carga de imágenes con adaptador de almacenamiento local.
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
| `status` | `draft`, `published` o `archived`. |
| `deletedAt` | Fecha del borrado lógico; `null` si está activo. |
| `createdBy`, `updatedBy`, `deletedBy` | Referencias internas al usuario; no se serializan en las respuestas JSON. |
| `images` | Rutas públicas de imágenes, hasta 8. |

El API público solo devuelve POI con `status=published` y `deletedAt=null`. Los borradores y
archivados quedan visibles únicamente en el API administrativo.

### Reglas de validación

- Título obligatorio, entre 3 y 120 caracteres.
- Descripción obligatoria, entre 10 y 5000 caracteres.
- Categoría dentro de `architecture`, `monument`, `nature`, `religious`, `urban`.
- Conservación dentro de `good`, `fair`, `poor`, `unknown`.
- Coordenadas numéricas dentro del rectángulo operativo de Falcón:
  latitud `10.3..12.19`, longitud `-71.35..-68.18`.
- URL de fuente y audioguía solo `http` o `https`.
- Imágenes solo con rutas `/api/uploads/locations/...` o `/images/locations/...`.
- Slug autogenerado desde el título si no se envía; solo minúsculas, números y guiones.
- El slug no se reutiliza automáticamente después de archivar un POI; si se necesita otro,
  debe elegirse uno distinto. Es una limitación consciente del índice único actual.

## Endpoints

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/admin/summary` | Métricas, estados y últimas seis acciones. |
| `GET` | `/api/admin/locations` | Lista paginada con `q`, `status`, `category`, `page`, `limit`. |
| `GET` | `/api/admin/locations/:id` | Detalle administrativo. |
| `POST` | `/api/admin/locations` | Crea un POI; por defecto como borrador. |
| `PATCH` | `/api/admin/locations/:id` | Actualiza campos enviados. |
| `DELETE` | `/api/admin/locations/:id` | Archiva con borrado lógico. |
| `POST` | `/api/admin/locations/:id/restore` | Restaura como borrador. |
| `POST` | `/api/admin/locations/:id/images` | Sube una imagen `multipart/form-data` en el campo `image`. |
| `DELETE` | `/api/admin/locations/:id/images` | Quita una imagen mediante `{ "url": "..." }`. |
| `GET` | `/api/admin/audit` | Auditoría paginada, filtrable por `action` y `entityId`. |

Errores propios: `DUPLICATE_SLUG`, `LOCATION_ARCHIVED`, `LOCATION_NOT_ARCHIVED`,
`IMAGE_LIMIT_REACHED`, `IMAGE_NOT_FOUND`, `INVALID_IMAGE`, `INVALID_IMAGE_TYPE`,
`IMAGE_TOO_LARGE`.

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
imágenes en la misma pantalla de edición. La tabla se convierte en tarjetas en pantallas
menores a 700 px para evitar desplazamiento horizontal.

## Verificación

| Comprobación | Resultado |
|---|---|
| Pruebas backend | 33/33 |
| Pruebas frontend | 18/18 |
| Build de producción | Correcto |
| E2E | 6/6 con Edge local |
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
- El workflow de CI sigue sin ejecutarse en remoto.
