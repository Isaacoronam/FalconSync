# CoroAventura frontend — Corte 4

Fecha de verificación: 2026-11-07.

Este documento describe el frontend de aventuras patrimoniales de FalconSync,
implementado en `falcon-sync-frontend` (Angular 21 + Leaflet). Consume la API del
backend construida en el Corte 3 (`docs/AVENTURAS.md`).

No atribuye el diseño a una unidad académica: las transcripciones de las Unidades 2 a 7
todavía no están incorporadas en `.opencode/knowledge/`.

## Alcance implementado

### Públicas

| Ruta | Descripción |
|------|-------------|
| `/aventuras` | Catálogo de aventuras publicadas (`GET /api/adventures`) con título, resumen, dificultad, duración, insignia y número de paradas. |
| `/aventuras/:slug` | Detalle de aventura publicada con portada, descripción, insignia y paradas ordenadas por `order` con POI publicados (`GET /api/adventures/:slug`). |
| `/aventuras/:slug/progreso` | Progreso del usuario autenticado: porcentaje, siguiente parada, paradas visitadas/pendientes y fecha de cierre (`GET /api/adventures/:slug/progreso`). |
| `/checkin/:locationId?token=...` | Check-in de un POI con geolocalización del navegador. Token precargado desde la URL; si no hay sesión, redirige a `/login` con `returnUrl` completo y vuelve al check-in tras autenticar. |

### Autenticadas

- Pantalla de parada dentro de la aventura: texto didáctico, instrucciones y botón de check-in.
- Check-in con `navigator.geolocation`: posición actual, mensajes claros de permiso denegado, fuera de radio, ubicación no disponible, éxito y duplicado.
- Foto opcional en el check-in: validación de tipo y tamaño, vista previa local y envío multipart. La foto solo se muestra en el perfil privado del dueño.
- Perfil privado `/perfil`: edición de nombre, usuario y biografía, avatar, estadísticas, progreso de aventuras y últimos check-in con foto.
- Pantalla de ruta completada: insignia, fecha de cierre y celebración.

### Administrativas (rol `admin`)

| Ruta | Descripción |
|------|-------------|
| `/admin/aventuras` | Listado administrativo de aventuras (todos los estados). |
| `/admin/aventuras/nuevo` | Creación de aventura (borrador). |
| `/admin/aventuras/:id/editar` | Edición de metadatos e insignia. |
| `/admin/aventuras/:id/paradas` | Gestión de paradas: añadir, editar, eliminar y reordenar. |
| `/admin/locations/:id/qr` | Rotación de QR (`POST /api/admin/locations/:id/qr/rotate`), vista previa, impresión y descarga una sola vez. |

## Servicios de API del frontend

- `AdventureApiService`: `list`, `getBySlug`, `getProgress` y endpoints administrativos de aventuras y paradas (`listAdmin`, `getAdmin`, `createAdmin`, `updateAdmin`, `publishAdmin`, `archiveAdmin`, `restoreAdmin`, `addStop`, `updateStop`, `deleteStop`, `reorderStops`).
- `CheckInApiService`: `createCheckIn({ locationId, token, latitude, longitude, photo? })` → `POST /api/check-ins` (JSON si no hay foto; `multipart/form-data` si hay `photo`).
- `ProfileApiService`: `getProfile`, `updateProfile`, `uploadAvatar`, `deleteAvatar` y `getPrivateImage` para blobs privados.
- `QrAdminApiService`: `rotateQr(locationId, format)` → `POST /api/admin/locations/:id/qr/rotate`.
- `AuthService` (reutilizado del Corte 1): token en memoria, refresh en cookie, guard para rutas y `returnUrl` tras el login.

## Comportamiento del check-in

El frontend obtiene la posición con `navigator.geolocation` y la envía al backend; el backend sigue siendo la autoridad de la geocerca (Haversine) y del token QR.

Mensajes del frontend:

| Situación | Mensaje |
|-----------|---------|
| Permiso denegado | "No se pudo obtener tu ubicación. Concede permiso de ubicación." |
| Ubicación no disponible / timeout | "No se pudo determinar tu ubicación." |
| Fuera de radio | "Estás demasiado lejos del punto de interés (X m). Acércate a menos de Y m." (con datos del error 400) |
| Éxito | "Check-in registrado. Se actualizó tu progreso en la aventura." o "Check-in registrado con tu foto…" si se adjuntó imagen. |
| Duplicado | "Ya registraste un check-in en este punto de interés." |
| Token inválido | "El token del QR no es válido o ha expirado. Pide uno nuevo." |
| Foto inválida | "La foto debe ser una imagen JPEG, PNG o WebP." / "La foto no puede superar 5 MB." |

## Pruebas

### Unitarias (Vitest)

`npm test -- --watch=false` en `falcon-sync-frontend`.

Suites nuevas:

- `core/services/adventure-api.service.spec.ts`
- `core/services/check-in-api.service.spec.ts`
- `core/services/qr-admin-api.service.spec.ts`

### E2E (Playwright)

`npx playwright test e2e/coro-aventura.spec.ts e2e/perfil.spec.ts`.

Escenarios:

1. Escaneo abre login: `/checkin/:locationId?token=...` sin sesión → `/login` con `returnUrl` completo.
2. Login vuelve al check-in: tras autenticar, la app regresa a `/checkin/...` con el token conservado.
3. Check-in actualiza progreso: geolocalización simulada dentro del radio → check-in exitoso → progreso refleja parada visitada (33 %, siguiente parada).
4. Duplicado y fuera de radio: segundo check-in en mismo POI → error duplicado; posición fuera del radio → error de geocerca.
5. Ruta completada: visitar todas las paradas → pantalla de cierre con insignia y fecha de cierre.
6. Perfil privado: editar nombre, usuario y biografía, comprobar el header, subir avatar, registrar un check-in con foto y verlo en `/perfil`.

Playwright simula geolocalización con `test.use({ permissions: ['geolocation'] })` y
`page.context().setGeolocation(...)`, usando las coordenadas reales de cada POI del seed.
Los escenarios con check-in registran un usuario nuevo por API para aislar los check-ins,
porque el índice único es `(user, location)` y la base E2E persiste durante toda la corrida.

Los escenarios usan el formulario real del componente. El formulario requiere
`FormsModule` para que `(ngSubmit)` se registre; sin él, el navegador ejecuta un submit
nativo, recarga la URL sin `?token=` y nunca se emite `POST /api/check-ins`.

### Resultado E2E verificado

| Comando | Resultado |
|---|---|
| `npx playwright test e2e/coro-aventura.spec.ts e2e/perfil.spec.ts --project=chromium` | 6/6 aprobadas |
| `npm run e2e` | 15/15 aprobadas |
| `$env:CI=1; npx playwright test --project=chromium` | 15/15 aprobadas |

La corrida local usa Microsoft Edge mediante el canal configurado en Playwright. La corrida
con `CI=1` usa Chromium y replica el navegador configurado en GitHub Actions: 15/15 aprobadas
tras el Corte 5. La ejecución remota del workflow sigue pendiente.

## Requisitos de arranque local

1. Backend en `http://localhost:3000`.
2. Frontend: `cd falcon-sync-frontend && npm start` → `http://localhost:4200`.
3. El seed de aventura se ejecuta con `npm run seed:adventures`; crea la «Ruta del Casco Histórico de Coro» con cinco paradas reales. `npm run seed:adventures:verify` comprueba el estado.
4. Para check-in real, el POI debe tener un token QR rotado (`POST /api/admin/locations/:id/qr/rotate`).
5. Las fotos de perfil y check-in requieren `UPLOAD_PRIVATE_DIR`; por defecto es `falcon-sync-backend/uploads-private/`.

## Riesgos y limitaciones

- La geolocalización del navegador puede ser simulada o inexacta; el backend valida la geocerca y el token.
- `navigator.geolocation` requiere HTTPS en producción; en localhost funciona.
- El enlace QR contiene un token en la URL: usarse solo en entornos seguros; el token se invalida con cada rotación.
- El reordenamiento de paradas requiere la lista completa de identificadores en el payload.
- No hay imágenes de QR almacenadas; el token solo se devuelve al rotar.
- Las fotos de check-in y avatares se validan en cliente y servidor, pero no se redimensionan ni eliminan EXIF.
- No existe todavía un endpoint para eliminar o reemplazar la foto de un check-in.

## Documentación relacionada

- `docs/AVENTURAS.md`: backend de aventuras, QR y check-in (Corte 3).
- `docs/PERFIL.md`: perfil privado, avatar, foto de check-in y seed de aventura.
- `docs/FALCONSYNC.md`: estado general de los cortes y stack.
- `docs/ADMINISTRACION.md`: panel administrativo y POI (Corte 2).
