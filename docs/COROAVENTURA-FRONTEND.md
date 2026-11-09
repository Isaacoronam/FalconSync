# CoroAventura frontend — Corte 4

Fecha de verificación: 2026-11-08.

Este documento conserva la especificación histórica del frontend de recorridos patrimoniales
de FalconSync. Esa experiencia fue retirada: las rutas públicas `/aventuras*` redirigen a
`/lugares`, las pantallas administrativas de rutas ya no están enlazadas y las recompensas
nuevas se limitan a insignias por POI. QR, check-in, perfil y datos/APIs heredados se
mantienen. La experiencia vigente se describe en [`POI.md`](./POI.md).

No atribuye el diseño a una unidad académica: las transcripciones de las Unidades 2 a 7
todavía no están incorporadas en `.opencode/knowledge/`.

## Alcance implementado

### Públicas

| Ruta | Descripción |
|------|-------------|
| `/aventuras` | Catálogo de recorridos publicados (`GET /api/adventures`) con título, resumen, dificultad, duración, insignia, número de paradas y acceso al escáner QR. |
| `/aventuras/:slug` | Detalle de recorrido publicado con portada, descripción, insignia y paradas ordenadas por `order` con POI publicados (`GET /api/adventures/:slug`). |
| `/aventuras/:slug/progreso` | Progreso del usuario autenticado: porcentaje, siguiente parada, paradas visitadas/pendientes, fecha de cierre e insignia persistida (`GET /api/adventures/:slug/progreso`). |
| `/checkin` | Escáner de QR de una parada. Usa `BarcodeDetector` y cámara cuando el navegador lo admite; siempre ofrece entrada manual del contenido del QR. |
| `/checkin/:locationId` | Check-in de un POI con geolocalización. Requiere un token cargado en memoria por el escáner; si falta, ofrece volver a `/checkin`. Si no hay sesión, redirige a `/login` con un `returnUrl` sin token. |

### Autenticadas

- Pantalla de parada dentro del recorrido: texto didáctico, instrucciones y botón de check-in.
- Check-in con `navigator.geolocation`: posición actual, mensajes claros de permiso denegado, fuera de radio, ubicación no disponible, éxito y duplicado.
- Insignias en la pantalla de éxito: se muestran solo las nuevas (`achievementsAwarded`), con nombre, tipo, descripción e icono.
- Foto opcional en el check-in: validación de tipo y tamaño, vista previa local y subida posterior en una segunda petición. Si la foto falla, el check-in y las insignias se conservan y se puede reintentar o descartar.
- Perfil privado `/perfil`: edición de nombre, usuario y biografía, avatar, estadísticas, insignias, progreso de recorridos y galería paginada de visitas con foto.
- Galería privada: filtros «Todas», «Con foto» y «Sin foto», paginación, reemplazo y eliminación de la foto de una visita y visor ampliado accesible.
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
- `CheckInApiService`: `createCheckIn({ locationId, token, latitude, longitude })` → `POST /api/check-ins` en JSON; devuelve `{ data, achievementsAwarded }`. La foto ya no viaja en esta petición.
- `CheckInSessionService`: guarda el token QR en memoria por `locationId`, con TTL de 15 minutos. `consume` lo elimina después del check-in y `clear` lo descarta al cambiar de parada.
- `ProfileApiService`: `getProfile`, `updateProfile`, `getGallery`, `uploadCheckInPhoto`, `deleteCheckInPhoto`, `uploadAvatar`, `deleteAvatar` y `getPrivateImage` para blobs privados.
- `parseCheckInQr`: acepta JSON `{ type: 'falconsync-check-in', locationId, token }`, URLs `/checkin/:id#t=` o `?token=`, el esquema `falconsync://checkin/:id#t=` y cadenas de consulta. Rechaza esquemas peligrosos y formatos inválidos.
- `checkInTokenGuard`: extrae el token de un enlace heredado, lo guarda en memoria y limpia la URL con `history.replaceState` antes de navegar a `/checkin/:locationId`.
- `QrAdminApiService`: `rotateQr(locationId, format)` → `POST /api/admin/locations/:id/qr/rotate`.
- `AuthService` (reutilizado del Corte 1): token en memoria, refresh en cookie, guard para rutas y `returnUrl` tras el login.

## Comportamiento del check-in

El frontend obtiene la posición con `navigator.geolocation` y la envía al backend; el backend sigue siendo la autoridad de la geocerca (Haversine) y del token QR.

Flujo:

1. `/checkin` escanea el QR con `BarcodeDetector` o recibe el contenido por entrada manual. Los fotogramas no se envían al servidor.
2. El parser obtiene `locationId` y `token`; el token se guarda solo en memoria y la URL queda como `/checkin/:locationId`.
3. Si no hay sesión, `authGuard` redirige a `/login` con `returnUrl` sin token. Tras autenticar se vuelve al check-in y el token sigue en memoria.
4. `POST /api/check-ins` registra la visita y devuelve las insignias nuevas.
5. Si había una foto seleccionada, `PUT /api/profile/check-ins/:id/photo` la sube después. Un fallo de foto no revierte la visita ni las insignias.
6. La pantalla de éxito muestra las insignias y permite reintentar o descartar la foto.

Mensajes del frontend:

| Situación | Mensaje |
|-----------|---------|
| Permiso denegado | "No se pudo obtener tu ubicación. Concede permiso de ubicación." |
| Ubicación no disponible / timeout | "No se pudo determinar tu ubicación." |
| Fuera de radio | "Estás demasiado lejos del punto de interés (X m). Acércate a menos de Y m." (con datos del error 400) |
| Éxito | "Check-in registrado. Tu progreso y tus insignias se actualizaron." |
| Sin insignias nuevas | "Las insignias de esta parada ya estaban en tu perfil o no hay una nueva que otorgar. La visita sí quedó registrada." |
| Duplicado | "Ya registraste un check-in en este punto de interés. Puedes verlo en tu perfil." |
| Token inválido | "El token del QR no es válido o ya fue reemplazado. Escanea el QR actual de la parada." |
| Foto inválida | "La foto debe ser una imagen JPEG, PNG o WebP." / "La foto no puede superar 5 MB." |
| Foto fallida | "No se pudo guardar la foto. Tu check-in y tus insignias ya quedaron registrados." |
| QR ajeno | "Ese código QR no pertenece a una parada de FalconSync." |

## Pruebas

### Unitarias (Vitest)

`npm test -- --watch=false` en `falcon-sync-frontend`.

Suites nuevas o ampliadas:

- `core/services/adventure-api.service.spec.ts`
- `core/services/check-in-api.service.spec.ts`
- `core/services/check-in-session.service.spec.ts`
- `core/services/profile-api.service.spec.ts`
- `core/utils/check-in-qr.spec.ts`
- `core/services/qr-admin-api.service.spec.ts`

### E2E (Playwright)

`npx playwright test e2e/coro-aventura.spec.ts e2e/perfil.spec.ts`.

Escenarios:

1. El escáner manual abre login: `/checkin` con contenido QR → `/login` con `returnUrl` sin token; la URL no contiene el token.
2. Un enlace heredado con token se limpia y conserva el acceso tras el login.
3. Login vuelve al check-in con el token conservado en memoria y el QR verificado.
4. Check-in actualiza progreso: geolocalización simulada dentro del radio → check-in exitoso → insignia de la parada → progreso refleja la parada visitada.
5. Duplicado y fuera de radio: segundo check-in en el mismo POI → error duplicado; posición fuera del radio → error de geocerca.
6. Ruta completada: visitar todas las paradas → pantalla de cierre con insignia del recorrido y fecha de cierre.
7. Perfil privado: editar nombre, usuario y biografía, comprobar el header, subir avatar, registrar un check-in con foto, ver la insignia, abrir el visor, reemplazar la foto, eliminarla y comprobar los filtros de la galería.

Playwright simula geolocalización con `test.use({ permissions: ['geolocation'] })` y
`page.context().setGeolocation(...)`, usando las coordenadas reales de cada POI del seed.
Los escenarios con check-in registran un usuario nuevo por API para aislar los check-ins,
porque el índice único es `(user, location)` y la base E2E persiste durante toda la corrida.

Los escenarios usan el formulario real del componente. Los formularios con `(ngSubmit)`
requieren `FormsModule`; sin él, el navegador ejecuta un submit nativo y recarga la URL sin
emitir las peticiones de la aplicación. Esto aplica tanto al check-in como al escáner QR.

### Resultado E2E verificado

| Comando | Resultado |
|---|---|
| `npx playwright test e2e/coro-aventura.spec.ts e2e/perfil.spec.ts` | 7/7 aprobadas |
| `npm run e2e` | 16/16 aprobadas |
| `$env:CI=1; npx playwright test --project=chromium` | Pendiente de repetir tras los cambios |

La corrida local usa Microsoft Edge mediante el canal configurado en Playwright. La corrida
con `CI=1` usa Chromium y replica el navegador configurado en GitHub Actions. La ejecución
remota del workflow sigue pendiente.

## Requisitos de arranque local

1. Backend en `http://localhost:3000`.
2. Frontend: `cd falcon-sync-frontend && npm start` → `http://localhost:4200`.
3. El seed de aventura se ejecuta con `npm run seed:adventures`; crea la «Ruta del Casco Histórico de Coro» con cinco paradas reales. `npm run seed:adventures:verify` comprueba el estado.
4. Para check-in real, el POI debe tener un token QR rotado (`POST /api/admin/locations/:id/qr/rotate`) y el usuario debe abrir `/checkin` para escanearlo o pegar su contenido.
5. Las fotos de perfil y check-in requieren `UPLOAD_PRIVATE_DIR`; por defecto es `falcon-sync-backend/uploads-private/`.
6. La lectura automática de QR requiere un navegador con `BarcodeDetector` y permiso de cámara. Si no está disponible, la entrada manual sigue funcionando.

## Riesgos y limitaciones

- La geolocalización del navegador puede ser simulada o inexacta; el backend valida la geocerca y el token.
- `navigator.geolocation` requiere HTTPS en producción; en localhost funciona.
- El contenido del QR incluye un token; la aplicación lo mantiene solo en memoria y nunca lo escribe en la URL ni en el historial. Un enlace heredado con token se limpia al entrar.
- `BarcodeDetector` no está disponible en todos los navegadores; el escáner ofrece entrada manual como respaldo y no envía fotogramas al servidor.
- El reordenamiento de paradas requiere la lista completa de identificadores en el payload.
- No hay imágenes de QR almacenadas; el token solo se devuelve al rotar.
- Las fotos de check-in y avatares se validan en cliente y servidor, pero no se redimensionan ni eliminan EXIF.
- La foto se sube después del check-in; si falla, la visita y las insignias se conservan, pero la imagen debe reintentarse manualmente.
- Las insignias y la galería son privadas; no hay perfiles públicos ni moderación de contenido.

## Documentación relacionada

- `docs/AVENTURAS.md`: backend de aventuras, QR y check-in (Corte 3).
- `docs/PERFIL.md`: perfil privado, avatar, foto de check-in y seed de aventura.
- `docs/FALCONSYNC.md`: estado general de los cortes y stack.
- `docs/ADMINISTRACION.md`: panel administrativo y POI (Corte 2).
