# FalconSync — estado de los cortes 0 a 5

Fecha de verificación: 2026-11-08. Actualizado con la identidad Chivito el 2026-11-25.

## Alcance implementado

### Corte 0 — Identidad y geografía

- Tipografía sans-serif de sistema para cuerpo y títulos (`Segoe UI Variable`, `Segoe UI`,
  `system-ui`), sin peticiones externas ni dependencias de licencia.
- Pesos y espaciado ajustados para títulos, fichas y tarjetas.
- Mapa limitado al rectángulo operativo de Falcón con `maxBounds`,
  `maxBoundsViscosity=1` y `minZoom=8`.
- Vista inicial en Coro a zoom 13 y control “Ver todo Falcón”.
- Identidad Chivito: logo circular en `projects/frontend/src/assets/brand/falconsync-logo.png`
  (512×512, transparencia exterior), versión de 128 px para header, administración y
  autenticación, favicon generado desde el logo completo y hoja de personaje recortada en
  avatar y poses.
- Fondo de Médanos en `src/assets/images/fondo-medanos.webp`, aplicado en una capa fija con
  overlay de contraste y tratamiento responsive.
- Favicon y `apple-touch-icon` regenerados desde los maestros
  (`favicon.ico` con 16/32/48 px, `favicon-32.png`, `apple-touch-icon.png` de 180×180)
  mediante `npm --prefix projects/frontend run brand:assets`.

### Corte 1 — Autenticación y permisos

- Modelos `User` y `RefreshSession`.
- Registro, login, refresh rotativo, logout, `me` y cambio de contraseña.
- Access token de 15 minutos en memoria; refresh de 7 días en cookie `httpOnly`,
  `SameSite=Strict` y `Path=/api/auth`.
- Hash `bcryptjs` con coste 12, rate limit en endpoints sensibles y comprobación de origen.
- Roles `user`, `moderator` (legacy temporal), `historian`, `inspector` y `admin`.
- Bootstrap de administrador idempotente con `scripts/createAdmin.js`.
- Cambio obligatorio de contraseña en el primer acceso del admin creado por bootstrap.
- Frontend: login, registro, cambio de contraseña, guards, interceptor, header con sesión,
  expulsión a `/acceso-denegado` y panel `/admin` mínimo con métricas.

### Corte 1.5 — E2E permanente y CI

- Playwright dentro del repositorio, con configuración `playwright.config.ts`.
- Servidor E2E aislado en `scripts/e2eServer.js`: base de datos `falconsync_e2e`,
  23 POI publicados, un admin operativo y un admin pendiente de cambio de contraseña.
- Servidores de prueba en puertos 3101 (API) y 4201 (frontend) para no chocar con el
  entorno de desarrollo.
- Workflow de GitHub Actions en `.github/workflows/ci.yml`, disparado en push y PR a
  `develop`, `main` y `master`, y manualmente. Inicia `mongo:9.0` con `--replSet
  falconsyncTest` y `rs.initiate()`, publica el mismo `mongod` en `27017` y `27018` y ejecuta
  auditorías, pruebas, build, Chromium y E2E.
- El workflow **no fue ejecutado** en GitHub: requiere publicar la rama/PR (A2). Se reprodujo
  en una copia limpia local el 2026-11-19: 110/110 backend, 53/53 frontend, build correcto,
  19/19 E2E con `CI=1` y auditorías `--omit=dev` sin vulnerabilidades. El paso Docker de Mongo
  no se ejecutó localmente por no haber Docker; la secuencia `rs.initiate()` se validó en un
  replica set desechable. No se declara CI remoto verde.

### Corte 2 — Administración y POI

- Layout administrativo con panel, listado de POI y auditoría.
- Panel con usuarios, POI por estado y actividad reciente.
- CRUD de POI con validación en cliente y servidor.
- Estados `draft`, `published` y `archived`; el API público solo expone publicados y
  descarta los marcados como provisionales. `includeProvisional=true` sigue disponible
  para el mapa, pero ya no hay borradores en el catálogo.
- Ficha ampliada con dirección, circuitos, etiquetas, fuente y fecha de verificación de
  coordenadas, nivel de verificación y créditos de imágenes.
- Regla de publicación: un POI provisional o sin `coordinateVerifiedAt` no puede publicarse.
- Filtros administrativos por categoría, circuito y etiqueta; el mapa público filtra solo
  por categoría.
- Catálogo de 23 POI en el seed: 23 publicados y 0 borradores.
- Mapa público con 23 POI visibles, cada uno con imagen. Los 17 POI restantes se publicaron
  el 2026-11-07 con revisión documental; el Parque Nacional Médanos de Coro queda
  `unverified` y Casa Museo Locos de la Vela mantiene su discrepancia documentada.
- Clustering propio en píxeles y popups con etiquetas, verificación y créditos, sin avisos
  de provisionalidad.
- Borrado lógico y restauración como borrador.
- Selector de ubicación con Leaflet limitado al rectángulo de Falcón.
- Imágenes locales mediante `StorageAdapter`, con validación de firma binaria, límite de
  5 MB y máximo de 8 por POI.
- Auditoría de creación, edición, archivo, restauración y gestión de imágenes.
- Tabla responsive convertida en tarjetas por debajo de 700 px.

El detalle de endpoints, permisos, validaciones y límites está en
[`docs/ADMINISTRACION.md`](./ADMINISTRACION.md). El catálogo, las reglas de publicación,
las fuentes y el manifiesto de imágenes están en [`docs/POI.md`](./POI.md).

### Corte 3 — backend legado de recorridos y servicios de visita

- Modelos `Adventure` y `AdventureStop` se conservan temporalmente para compatibilidad;
  `CheckIn` y `UserAchievement` soportan visitas e insignias por POI.
- Check-in global por POI, con índice único `(user, location)`.
- QR opaco por POI: token de 32 bytes, hash SHA-256 persistido y rotación que invalida los
  QR anteriores.
- Geocerca Haversine validada en servidor, con radio configurable entre 10 y 500 m.
- APIs de recorrido y progreso se conservan temporalmente, fuera del flujo turístico.
- Las visitas nuevas y el backfill otorgan insignias por POI, no por recorrido.

La referencia histórica está en [`docs/AVENTURAS.md`](./AVENTURAS.md).

### Experiencia turística vigente — exploración por POI

- Catálogo de lugares en `/lugares` y ficha editorial en `/lugares/:slug`.
- El formulario de POI gestiona historia, datos de interés, información para visitantes y
  fuentes editoriales aparte de la fuente cartográfica.
- Las URL públicas antiguas `/aventuras*` redirigen al catálogo de lugares.
- El perfil presenta insignias de lugares visitados; los logros heredados de recorridos no
  se eliminan de la base ni se muestran en el flujo actual.
- El escáner QR en `/checkin` usa `BarcodeDetector` cuando está disponible y ofrece entrada
  manual; el token vive solo en memoria y nunca se añade a la URL.
- Check-in por POI con geolocalización del navegador (`/checkin/:locationId`), Chivito y
  una insignia persistente por lugar. La celebración con Chivito se abre solo tras `201` e
  insignia nueva; nunca en errores, duplicados o QR inválido.
- Generación, impresión y descarga de QR de check-in (`/admin/locations/:id/qr`).
- Suite E2E con Playwright y geolocalización simulada para catálogo, QR, check-in, insignias
  y redirección de URL heredadas.

El detalle histórico de la interfaz anterior está en
[`docs/COROAVENTURA-FRONTEND.md`](./COROAVENTURA-FRONTEND.md); la ficha vigente está en
[`docs/POI.md`](./POI.md).

### Corte 5 — Perfil privado, insignias y fotos

- `User` con `username`, `bio` y metadatos privados de avatar; generación automática de
  nombre de usuario y backfill para cuentas existentes.
- Perfil visible solo para su dueño en `/perfil`; sin rutas públicas por `username`.
- Edición de nombre, usuario y biografía, con actualización del header.
- Avatar privado con carga, reemplazo y eliminación.
- Insignias persistentes visibles en el perfil, con origen archivado marcado.
- Galería privada paginada de visitas con filtros, visor ampliado y reemplazo/eliminación de
  fotos sin borrar el check-in.
- Check-in y foto en dos fases: primero la visita, después la imagen.
- Avatares y fotos en `uploads/documents/`, servidos solo por endpoints autenticados.
- Estadísticas de check-ins, lugares descubiertos e insignias de lugares.
- Bloque de Chivito con avatar celebra las visitas con mensajes basados en las estadísticas
  disponibles; las insignias sin imagen persistida usan el medallón de su categoría.
- Seed idempotente de la «Ruta del Casco Histórico de Coro» con cinco paradas reales.
- E2E de perfil, avatar, check-in con foto, insignias, galería y visor (`e2e/perfil.spec.ts`).

El detalle está en [`docs/PERFIL.md`](./PERFIL.md).

### Corte 6 — Conservación y evidencia privada

- Dominio con `HeritageAsset`, `Report`, `Inspection`, `Intervention` y `Evidence`; el
  historial se reconstruye desde `DomainEvent`.
- Flujo vertical: reporte → triaje → conversión en inspección → hallazgos y evidencia →
  revisión → intervención → verificación → cierre.
- Autorización por capacidades con permisos por recurso y revisor asignado; el ejecutor no
  puede verificar su propia intervención.
- Evidencia en almacenamiento privado, sin URL pública, con validación de contenido
  (`sharp`), SHA-256, eliminación de EXIF, acceso auditado y fecha de retención
  configurable; la política final de retención (D-23) sigue pendiente.
- Sin antimalware en producción la carga responde `503 EVIDENCE_SCAN_UNAVAILABLE`; el flujo
  no escaneado solo se permite en desarrollo y pruebas.
- UI `/reportes`, `/reportes/:id`, `/inspecciones` e `/inspecciones/:id` con triaje,
  conversión, hallazgos, evidencia, intervenciones, revisión y cierre. Las acciones se
  bloquean durante la recarga silenciosa para evitar conflictos de versión.
- Conservación y evidencia usan transacciones sobre el replica set de `127.0.0.1:27018`;
  el standalone de `127.0.0.1:27017` no es suficiente.
- E2E `e2e/conservation.spec.ts`: recorrido completo, denegaciones e IDOR. La suite total
  quedó en 19/19 en Edge local (2026-11-18) y en 19/19 con `CI=1`/Chromium en copia limpia
  (2026-11-19).

El contrato y el modelo están en [`docs/openapi.yaml`](./openapi.yaml) y
[`docs/MODELO-DATOS.md`](./MODELO-DATOS.md).

## Stack verificado

| Componente | Versión |
|---|---|
| Node.js | 26.13.0 |
| Angular core | 21.2.26 |
| Angular CLI / build | 21.2.29 |
| Express | 5.3.0 |
| Mongoose | 9.12.0 |
| MongoDB local | 9.0.4 |
| Leaflet | 1.9.4 |
| bcryptjs | 3.0.3 |
| jsonwebtoken | 9.0.3 |
| express-rate-limit | 8.7.3 |
| multer | 2.x |
| cookie-parser | 1.4.7 |
| Playwright Test | 1.65.0 |
| qrcode | 1.5.4 |
| Vitest (frontend) | 4.x, integrado por Angular CLI |
| Node test runner (backend) | `node --test` |

Correcciones respecto al documento inicial:

- El documento mezclaba versiones de Angular: `@angular/core@21.2.29` no existe; la última
  21.x del core es `21.2.26`, mientras `@angular/cli` y `@angular/build` sí tienen
  `21.2.29`. Se fijó core `21.2.26` y CLI/build `21.2.29`.
- `MongoDB 2.14.1` no es una versión válida del servidor ni de Mongoose; se usó MongoDB
  9.0.4 y Mongoose 9.12.0.
- Se añadió la categoría `urban` para representar espacios urbanos.

## Estructura

La estructura obligatoria del repositorio está descrita en `AGENTS.md` y registrada en `memory/architecture_decisions.md`.

```text
FalconSync/
├── .github/workflows/ci.yml
├── AGENTS.md
├── context/                       # Contexto, reglas (incluye RBAC) y contratos API
├── skills/                        # Índice; las skills ejecutables siguen en .opencode/skills
├── memory/                        # Decisiones arquitectónicas y soluciones verificadas
├── projects/
│   ├── backend/                   # Express: api/, microservices/, databases/, uploads/, scripts/, seeders/, test/
│   ├── frontend/                  # Angular: src/app/{pages,components,services,models}, src/assets/, e2e/
│   └── mobile/                    # Esqueleto pendiente de la app de campo
├── docs/
│   ├── ADMINISTRACION.md
│   ├── AUTENTICACION.md
│   ├── AVENTURAS.md
│   ├── COROAVENTURA-FRONTEND.md
│   ├── FALCONSYNC.md
│   ├── PERFIL.md
│   └── POI.md
└── .nvmrc
```

En el backend, las rutas y controladores se agrupan por módulo en `api/`, la lógica de negocio en `microservices/` y los modelos en `databases/models/`. En el frontend, las vistas están en `src/app/pages/`, los componentes reutilizables en `components/`, los clientes HTTP en `services/` y los contratos en `models/`. Solo cambió la ubicación de los archivos: las URLs de la API y de los recursos públicos se mantienen.

## Identidad visual y geografía

- `--font-body` y `--font-display` usan una pila de sistema; no se descargó ninguna fuente
  en tiempo de ejecución.
- Los títulos principales usan peso 700 y un `letter-spacing` negativo suave; las fichas y
  tarjetas usan 600 para no perder jerarquía al abandonar la serif.
- El mapa usa este límite operativo:

```ts
const FALCON_BOUNDS = [
  [10.3, -71.35],
  [12.19, -68.18],
];
```

- La vista inicial es Coro (`11.4078, -69.6785`) a zoom 13. El botón “Ver todo Falcón”
  hace `fitBounds` al rectángulo.
- El rectángulo **no es el polígono oficial de Falcón**. Para el contorno exacto hace falta
  un GeoJSON verificado de OSM/INE con atribución.
- El logo maestro y la hoja de Chivito se conservan en `projects/frontend/design/source/`.
  `npm --prefix projects/frontend run brand:assets` genera el logo circular, la marca de
  cabeza, favicons, avatar, poses y el fondo optimizado. La identidad se documenta en
  [`IDENTIDAD.md`](./IDENTIDAD.md) y [`ADR-008`](./ADR/ADR-008-identidad-chivito.md).

## Autenticación

El detalle de decisiones, endpoints, cookies y límites está en
[`docs/AUTENTICACION.md`](./AUTENTICACION.md).

Resumen operativo:

- El `.env` local está ignorado por Git y contiene secretos aleatorios generados para este
  entorno.
- `npm run create-admin` creó `admin@falconsync.local`; la contraseña está en `.env` y debe
  cambiarse en el primer acceso.
- El script es idempotente: una segunda ejecución no modifica la contraseña existente.
- El panel `/admin` permite gestionar POI editoriales, imágenes, QR y auditoría. Los datos y
  las APIs de recorridos se mantienen temporalmente por compatibilidad, pero su gestión ya no
  forma parte de la interfaz. El perfil privado, el avatar y las fotos de check-in se
  completaron en el Corte 5; la moderación sigue pendiente.

## Comandos de arranque

Requisitos: Node 26.13.0 y MongoDB local. La verificación completa usa un replica set de un
nodo en `127.0.0.1:27018` (`replicaSet=falconsyncTest`); el standalone en `127.0.0.1:27017`
solo cubre módulos sin transacciones.

Backend:

```bash
cd projects/backend
npm install
cp .env.example .env   # completar secretos de al menos 32 caracteres
npm run seed           # inserta los POI ausentes y elimina Mirador del Pueblo
npm run seed:sync      # sincroniza fichas y elimina Mirador del Pueblo
npm run seed:verify    # comprueba existencia, publicación, coordenadas y retiro del Mirador
npm run seed:adventures        # crea o actualiza la Ruta del Casco Histórico
npm run seed:adventures:verify # verifica publicación, orden y paradas disponibles
npm run backfill:usernames     # asigna username a cuentas anteriores al Corte 5
npm run backfill:achievements  # simula la reconstrucción de insignias; --apply escribe
npm run create-admin   # requiere ADMIN_* en .env
npm run dev
```

Frontend, en otra terminal:

```bash
cd projects/frontend
npm install
npm start
```

- API: `http://localhost:3000`
- Aplicación: `http://localhost:4200`
- El frontend usa `proxy.conf.json` para enviar `/api` al backend.
- Las imágenes públicas de POI se guardan en `uploads/` y se sirven en `/api/uploads/...`.
- Los avatares y las fotos de check-in se guardan en `uploads/documents/` y solo se sirven por
  endpoints autenticados del perfil. Ambas carpetas están ignoradas por Git.
- El backend se detiene si el puerto ya está ocupado; detén la instancia anterior antes de
  iniciar otra. `npm run seed` es idempotente, inserta POI ausentes y elimina únicamente
  Mirador del Pueblo. `npm run seed:sync` actualiza fichas existentes, sincroniza las
  coordenadas solo de Parque Nacional Médanos de Coro sin modificar los demás puntos,
  preserva estado y `isProvisional`, y elimina ese mismo POI retirado.
  `npm run seed:verify` falla si falta un POI, si Mirador del Pueblo sigue presente o si un
  publicado está provisional o sin fecha de verificación. `npm run seed:adventures` es
  idempotente y exige que las cinco paradas estén publicadas y disponibles.

En Windows, si no se dispone de `cp`, crear `.env` manualmente a partir de
`.env.example`. No se deben usar los valores de ejemplo en producción.

## Endpoints

Públicos:

- `GET /api/health`
- `GET /api/locations?page=1&limit=50&category=religious&circuit=casco-historico&tag=unesco`
- `GET /api/locations/near?lat=11.4075&lng=-69.6778&radius=500`
- `GET /api/locations/:slug`
- `GET /api/adventures?page=1&limit=20`
- `GET /api/adventures/:slug`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Autenticados:

- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `GET /api/adventures/:slug/progress` (incluye `achievement`)
- `POST /api/check-ins` (JSON; conserva compatibilidad `multipart/form-data` con `image`)
- `GET /api/profile/me` (incluye insignias)
- `PATCH /api/profile/me`
- `GET /api/profile/avatar`
- `POST /api/profile/avatar` (`multipart/form-data`, campo `image`)
- `DELETE /api/profile/avatar`
- `GET /api/profile/check-ins?page=&limit=&hasPhoto=`
- `GET /api/profile/check-ins/:checkInId/photo`
- `PUT /api/profile/check-ins/:checkInId/photo` (`multipart/form-data`, campo `image`)
- `DELETE /api/profile/check-ins/:checkInId/photo`

Administración (rol `admin`, cambio de contraseña completado):

- `GET /api/admin/summary`
- `GET /api/admin/locations?q=&status=&category=&circuit=&tag=&page=&limit=`
- `GET /api/admin/locations/:id`
- `POST /api/admin/locations`
- `PATCH /api/admin/locations/:id`
- `DELETE /api/admin/locations/:id` (borrado lógico)
- `POST /api/admin/locations/:id/restore`
- `POST /api/admin/locations/:id/images`
- `DELETE /api/admin/locations/:id/images`
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
- `PUT /api/admin/adventures/:id/stops/reorder`
- `GET /api/admin/users?q=&role=&active=&page=&limit=`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/status`
- `POST /api/admin/users/:id/revoke-sessions`
- `GET /api/admin/audit?page=&limit=&action=&entityId=`

Las imágenes públicas de POI se sirven en `/api/uploads/...`. Los avatares y las fotos de
check-in no tienen URL estática: se sirven solo por `/api/profile/avatar` y
`/api/profile/check-ins/:checkInId/photo` con sesión del dueño. La galería usa
`GET /api/profile/check-ins` con paginación y filtro `hasPhoto`.

Formato de lista de lugares:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 50, "total": 0, "totalPages": 0 }
}
```

## Fuentes de los POI

El catálogo completo, con los 23 POI publicados, está en
[`docs/POI.md`](./POI.md). Esta tabla resume los 6 que se publicaron primero:

| POI | Coordenadas `[lng, lat]` | Fuente |
|---|---|---|
| Catedral de Coro | `[-69.6778073, 11.4075246]` | OpenStreetMap way 370610638 |
| Casa de las Ventanas de Hierro | `[-69.6799844, 11.4089625]` | Plus Code `773GC85C+H2J`, C. Zamora |
| Casa del Sol | `[-69.6790501, 11.4089358]` | OpenStreetMap node 1122775758, Zamora/Federación |
| Arco de la Federación | `[-69.6713859, 11.410797]` | Wikipedia, coordenadas de la página |
| Médanos de Coro | `[-69.6577925, 11.4384496]` | OpenStreetMap relation 3461483 |
| Plaza Bolívar de Coro | `[-69.6782276, 11.4072929]` | OpenStreetMap way 370610469 |

Los 17 POI restantes se publicaron el 2026-11-07 con `coordinateVerifiedAt` como fecha de
revisión documental, no de visita en campo. Quince son `single-source`; el Parque Nacional
Médanos de Coro es `unverified` por coordenada aproximada y Casa Museo Locos de la Vela
mantiene una discrepancia de unos 100 m entre fuentes.

La **Cruz de los Enconchados** no se incluyó porque no se encontró una fuente cartográfica
o documental confiable para su ubicación. No se inventaron coordenadas. Debe verificarse
antes de agregarla.

El estado de conservación se dejó como `unknown` en los 23 POI: no hay una fuente de
conservación verificada en este corte.

## Imágenes de los POI

Hay 23 imágenes en `src/assets/images/locations/`, con una imagen local asociada a cada POI que
aparece en el mapa. El manifiesto legible por máquina está en
`src/assets/images/locations/manifest.json` y se sirve en `/images/locations/manifest.json`.

| POI | Archivo público | Crédito |
|---|---|---|
| Catedral de Coro | `/images/locations/catedral-de-coro.jpg` | Pendiente de verificar |
| Casa de las Ventanas de Hierro | `/images/locations/casa-de-las-ventanas-de-hierro.jpg` | Pendiente de verificar |
| Casa del Sol | `/images/locations/casa-del-sol.jpg` | Pendiente de verificar |
| Arco de la Federación | `/images/locations/arco-de-la-federacion.jpg` | Pendiente de verificar |
| Médanos de Coro | `/images/locations/medanos-de-coro.jpg` | Pendiente de verificar |
| Plaza Bolívar de Coro | `/images/locations/plaza-bolivar-de-coro.jpg` | Pendiente de verificar |
| Iglesia de San Francisco | `/images/locations/iglesia-de-san-francisco.jpg` | Janethrodri, CC BY-SA 4.0 |
| Iglesia de San Clemente | `/images/locations/iglesia-de-san-clemente.jpg` | Janethrodri, CC BY-SA 4.0 |
| Cruz de San Clemente | `/images/locations/cruz-de-san-clemente.jpg` | Zerojosefer, CC BY-SA 4.0 |
| Casa Balcón de los Arcaya | `/images/locations/casa-balcon-de-los-arcaya.jpg` | Zerojosefer, CC BY-SA 4.0 |
| Museo de Arte de Coro | `/images/locations/museo-de-arte-de-coro.jpg` | Janethrodri, CC BY-SA 4.0 |
| Gelatería El Sol | `/images/locations/Gelateria-el-sol.jpeg` | Pendiente de verificar |
| Parque Nacional Médanos de Coro | `/images/locations/parque-nacional-medanos-de-coro.jpg` | Pendiente de verificar |

Las 18 imágenes suministradas por el responsable del proyecto tienen autoría y licencia
**pendientes de verificar**. Las 5 imágenes restantes se tomaron de Wikimedia Commons,
tienen autor, licencia y origen registrados en `imageCredits`, y el popup del mapa los muestra. El
detalle está en [`docs/POI.md`](./POI.md).

## Verificación ejecutada

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas backend | `npm run test:backend` | 178/178 aprobadas, 19 suites (2026-11-25) |
| Seed idempotente | `test/seedLocations.test.js` | 23 insertados la primera vez y 0 la segunda |
| Seed de aventura | `npm run seed:adventures` + `--verify` | Aventura publicada con 5 paradas, orden y disponibilidad correctos |
| Sincronización local | `npm run seed:sync` | 23 registros actualizados; coordenada de Parque Nacional Médanos de Coro sincronizada y verificada |
| Verificación del seed | `npm run seed:verify` | 23 POI sin desviaciones; Gelatería El Sol dentro del catálogo |
| Backfill de usuarios | `npm run backfill:usernames` | 2 usuarios actualizados con `username` |
| Backfill de insignias | `npm run backfill:achievements` | Simulación por defecto; `--apply` escribe. No ejecutado sobre datos locales en esta verificación |
| Bootstrap admin | `npm run create-admin` | Admin creado; segunda ejecución sin cambios |
| Pruebas frontend | `npm run test:frontend` | 101/101 aprobadas, 18 archivos (2026-11-26) |
| Build producción | `npm run build` | Correcto, sin advertencias (2026-11-26) |
| Evaluación RAG v5 | `npm run rag:evaluate -- --dataset corpus/evaluation/rag-golden-v5.json --report corpus/evaluation/rag-golden-v5-report.json` | 146/146, 0 fallos, `unmetTargets` vacío; sourceHit 0.92; p95 110 ms (2026-11-26) |
| E2E de catálogo POI, QR y perfil | `npx playwright test e2e/coro-aventura.spec.ts e2e/perfil.spec.ts` | 7/7 aprobadas |
| E2E de identidad y Chivito | `npm run e2e -- e2e/identidad.spec.ts e2e/brand.spec.ts e2e/guia.spec.ts` | 9/9 aprobadas (2026-11-25) |
| E2E conversacional con corpus | `npx playwright test e2e/chatbot-guia.spec.ts` con `RAG_TOURIST_ENABLED=true` | 6/6 aprobadas y 1 omitida por diseño (2026-11-26) |
| E2E permanente | `npm run e2e` | 29/29 aprobadas y 5 omitidas por corpus RAG deshabilitado (2026-11-25); 19/19 histórico en Edge local (2026-11-18) y en copia limpia con `CI=1`/Chromium (2026-11-19) |
| Auditoría producción backend | `npm audit --omit=dev` | 0 vulnerabilidades |
| Auditoría producción frontend | `npm audit --omit=dev` | 0 vulnerabilidades |
| Auditoría completa frontend | `npm audit` | 16 moderadas en dependencias de desarrollo de Angular CLI |
| Workflow CI | `.github/workflows/ci.yml` | Actualizado a replica set y disparo en `develop`; reproducido en copia limpia, **no ejecutado** en GitHub |
| CI local reproducible | Copia limpia sin `.env` ni `node_modules` | `npm ci` + 110/110 backend + 53/53 frontend + build + 19/19 E2E con `CI=1`; `npm audit --omit=dev` 0 vulnerabilidades. El paso Docker de Mongo no se ejecutó localmente |

El presupuesto `anyComponentStyle` se ajustó de 6/10 kB a 10/12 kB porque el perfil privado
compila 9.41 kB de estilos. Se mantuvieron los estilos cohesionados en el componente en lugar
de fragmentarlos solo para cumplir un umbral pensado para componentes pequeños; el nuevo
límite sigue acotando el crecimiento y el build queda sin advertencias.

La suite `test/adventures.test.js` cubre QR, rotación, hash no expuesto, check-in válido,
duplicado, fuera de geocerca, token inválido, check-in rechazado en POI provisional,
progreso en cualquier orden, siguiente parada, cierre, check-in global compartido, POI no
publicado o provisional como parada, POI en uso, publicación, reordenamiento, permisos y
auditoría. `test/achievements.test.js` cubre la insignia de lugar, el rechazo de nuevas
insignias de recorrido heredadas, la idempotencia, la reconciliación de duplicados, la
conservación de logros antiguos con `sourceActive: false`, la foto posterior al check-in y la
galería paginada con filtro `hasPhoto`.
`test/profile.test.js` cubre perfil privado, generación y edición de `username`, avatar
privado, foto de check-in, acceso denegado a otros usuarios y estadísticas de aventura.
`test/seedAdventures.test.js` comprueba que el seed usa paradas reales publicadas y rutas de
imagen permitidas. `test/locations.test.js` cubre además los filtros públicos por circuito y
etiqueta, el rechazo de valores desconocidos y la ocultación de un POI provisional aunque
esté marcado como publicado. `test/adminLocations.test.js` cubre la regla de publicación con
fecha de verificación y los filtros administrativos por circuito y etiqueta.

La suite E2E comprueba:

- límites reales de Leaflet (`maxBounds`, viscosidad, zoom mínimo, centro inicial);
- mapa público con 23 tarjetas con imagen, sin marcadores provisionales, clúster y filtro
  únicamente por categoría;
- la lista lateral de POI se desplaza dentro de su panel sin mover la página;
- que un `panTo` fuera del estado queda clavado dentro del rectángulo;
- control “Ver todo Falcón” y ausencia de overflow horizontal a 390 px;
- registro, persistencia de sesión tras recarga, logout y rechazo de credenciales;
- ruta protegida que redirige a login con `returnUrl`;
- usuario normal bloqueado en `/admin`;
- admin operativo con panel y métricas;
- cambio obligatorio del admin inicial y desbloqueo posterior;
- creación de un POI, carga de imagen, publicación y aparición en el mapa;
- archivo lógico, desaparición del API público y restauración como borrador;
- escáner QR: entrada manual, login con `returnUrl` sin token y token conservado en memoria;
- enlace heredado con token: limpieza de la URL y acceso conservado tras el login;
- check-in con geolocalización simulada, celebración modal de Chivito e insignia del lugar;
- rechazo de check-in duplicado y de posición fuera de la geocerca;
- catálogo y detalle editorial por POI, con redirección de URL públicas heredadas;
- perfil privado: edición de nombre, usuario y biografía, actualización del header, avatar,
  check-in con foto, insignia, visor ampliado, reemplazo y eliminación de foto y filtros de
  galería;
- gestión de cuentas: cambio de rol, desactivación, reactivación y revocación de sesiones
  con reautenticación;
- Chivito `/guia`: creación de perfil por UI, avatar y rol, estado de disponibilidad y bloqueo
  de la consulta sin corpus (`e2e/guia.spec.ts`) y —con el corpus RAG habilitado— la batería
  de preguntas del E2E de conversación (`e2e/chatbot-guia.spec.ts`): saludos («hola» y «hi»),
  lugares publicados, estado UNESCO, adobe y tapia por separado y compuestos, identidad de
  Coro y FALCONSYNC sin enlaces internos, turismo, ruta sin fuente verificada y preguntas
  compuestas de dos partes conocidas y de mezcla conocida+desconocida. La batería con corpus
  comprobó 6 casos aprobados y 1 omitido (el caso D del modo sin RAG) el 2026-11-26; incluye
  la cita separada de adobe/tapia y el mensaje específico de precios sin fuente.

La E2E local usa Microsoft Edge mediante el canal de Playwright. La suite completa quedó en
19/19 en Edge el 2026-11-18 y en 19/19 con `CI=1`/Chromium en una copia limpia el 2026-11-19;
el 2026-11-25, dentro de `npm run verify`, la suite completa quedó en **30 aprobadas y 5
omitidas por diseño** (con la guía apagada se omiten B, B7, E, C y C3b). Incluye el caso de
vinculación de Telegram en `/perfil` (`e2e/perfil.spec.ts`). La ejecución remota
del workflow sigue pendiente de autorización. Las imágenes de la E2E se guardan en
`test-results/e2e-uploads` y `test-results/e2e-uploads-private`, y no contaminan las carpetas
de desarrollo.

Por defecto la suite E2E corre con la guía apagada: `playwright.config.ts` fija
`RAG_TOURIST_ENABLED`, `RAG_CORPUS_VERSION` y `RAG_TECHNICAL_ENABLED` (los toma del entorno
que lanza la suite y, si no están, los apaga), de modo que el `.env` de desarrollo no cambia
el resultado de `npm run verify` ni de CI. `scripts/e2eServer.js` solo ingiere las 14
fuentes de la evaluación dorada (S-005 y S-023 quedan fuera) cuando la guía turística viene
habilitada con corpus declarado; sin esa petición no se ingiere nada y el estado sigue en
«Guía en preparación». Para conversar con la guía en E2E:
`$env:RAG_TOURIST_ENABLED='true'; $env:RAG_CORPUS_VERSION='2026-11-22.1'; npm --prefix projects/frontend run e2e -- e2e/chatbot-guia.spec.ts`
— la ingesta con embeddings tardó 18,3 s y el timeout de arranque del backend sube a 600 s
solo en ese modo. En esa modalidad, los casos B7 (horario sin fuente del lugar preguntado)
y C3b (mezcla «…y quién…») documentaban los defectos FG-01 y FG-02; ambos quedaron en
verde tras la corrección de `assistantService.js` (evidencia de estado acotada al lugar
preguntado y conector «y quién» reconocido), verificada con la batería completa.

## Canal de Telegram y MCP

El canal de Telegram se implementó el 2026-11-25 con `grammY` y un servidor MCP propio por
stdio. El bot (`bin/telegramBot.js`) reutiliza la guía RAG, el catálogo de POI y el flujo de
conservación; no accede a MongoDB directamente. La guía y los recorridos son públicos; los
reportes exigen vincular la cuenta con un código de un solo uso generado en `/perfil`.

- Herramientas MCP: guía, búsqueda de lugares, lugares cercanos, rutas, estado de vínculo,
  vincular/desvincular, crear incidencia, consultar incidencias propias y ver su detalle.
- `/misreportes` pagina de cinco en cinco y permite abrir el detalle; `/cerca` usa la
  ubicación compartida para listar POI a menos de 2 km.
- El chat de `/guia` enlaza al bot en una franja al pie; el perfil ofrece el deep link
  `?start=CODIGO` para vincular sin copiar el código.
- El recorrido publicado es «Ruta del Casco Histórico de Coro» (5 paradas) y se presenta como
  recomendación, no como navegación giro a giro.
- Los reportes llevan `sourceChannel=telegram`; la clave de idempotencia no se expone.
- El autor recibe un aviso best-effort cuando su incidencia cambia de estado.
- No se adjuntan fotos en v1: producción bloquea la evidencia hasta tener antimalware.
- Runbook y configuración: [`INTEGRACION-TELEGRAM.md`](./INTEGRACION-TELEGRAM.md);
  decisión: [`ADR/ADR-009-telegram-mcp.md`](./ADR/ADR-009-telegram-mcp.md).

## Seguridad y dependencias

- `npm audit --omit=dev`: 0 vulnerabilidades de producción en backend y frontend.
- `npm audit` del frontend reporta 16 vulnerabilidades moderadas en dependencias de
  desarrollo de Angular CLI (`glob`, `minimatch` y transitivas). La corrección disponible
  exige Angular CLI 22.2.6, un salto mayor; no se aplicó porque el proyecto fijó Angular 21.
- No hay secretos en el repositorio. `.env` está ignorado y `.env.example` solo contiene
  marcadores.
- Las rutas `/api/admin/*` exigen rol `admin` y contraseña cambiada; el API público solo
  expone POI publicados y no serializa referencias internas de usuario.
- Las imágenes públicas se validan por firma binaria, se limitan a JPEG/PNG/WebP, 5 MB y 8
  por POI. La carpeta `uploads/` está ignorada por Git.
- Los avatares y las fotos de check-in se validan por MIME y firma binaria, se limitan a 5 MB
  y se guardan en `uploads/documents/`, también ignorada por Git.
- El avatar y las fotos de check-in solo se sirven con sesión del dueño. No hay URL estática
  ni acceso desde `/api/uploads/...`; otro usuario recibe `404`.
- El perfil es privado: no existe directorio público ni búsqueda por `username`. El nombre de
  usuario solo se muestra dentro de `/perfil`.
- Las respuestas de imágenes privadas usan `Cache-Control: private, max-age=300,
  must-revalidate`.
- La sustitución de avatar elimina el archivo anterior; si falla la persistencia, elimina el
  archivo nuevo. Si falla un check-in en modo multipart después de guardar la foto, también la
  elimina.
- La foto del check-in se sube después de la visita; un fallo de imagen no revierte la visita
  ni las insignias. Reemplazarla o eliminarla tampoco borra el check-in.
- Las insignias se otorgan con índice único `(user, type, sourceId)` y `$setOnInsert`; una
  insignia ya obtenida no se duplica y se conserva si su origen se archiva.
- El backfill de insignias es una simulación por defecto; `--apply` exige
  `--allow-production` cuando `NODE_ENV=production`.
- El QR de check-in usa un token opaco de 32 bytes; solo se persiste su hash SHA-256, la
  comparación es en tiempo constante y el hash nunca se serializa.
- La geocerca se valida en servidor con Haversine, con radio configurable entre 10 y 500 m.
- El check-in tiene rate limit específico (30 intentos por IP cada 15 minutos) y no registra
  tokens en logs ni en auditoría.
- El API público solo expone aventuras publicadas y paradas con POI publicado; el hash del
  token y las referencias de usuario no salen en las respuestas.
- Un POI que es parada de una aventura publicada no puede archivarse ni despublicarse hasta
  retirar la parada o archivar la aventura (`409 LOCATION_IN_USE`).
- El seed y los endpoints de lectura son públicos por diseño en este corte. Los scripts de
  seed y backfill se ejecutan manualmente con acceso a la base de datos.
- El rate limit se desactiva en `NODE_ENV=test` para no interferir con las pruebas; sus
  umbrales no tienen una prueba automatizada propia.

## Limitaciones y pendientes

- El logo maestro y los iconos de marca se integraron y regeneraron en este corte
  (`src/assets/brand/falconsync-logo.png`, `falconsync-logo-128.png`,
  `npm run brand:assets`).
- El límite del mapa es rectangular y operativo, no el polígono oficial de Falcón.
- No hay verificación de correo, recuperación de contraseña, MFA ni autogestión de sesiones
  por el usuario; un administrador puede revocar sesiones ajenas desde el panel.
- La migración de `moderator` a `historian` aún no se ejecutó y no existe exportación de
  datos de usuario. La UI no permite asignar `moderator`, solo reemplazarlo por un rol
  vigente.
- El slug de un POI archivado no se reutiliza automáticamente; debe elegirse otro.
- Las imágenes de POI no generan miniaturas ni eliminan metadatos EXIF, no pasan por
  antivirus y no están replicadas. La evidencia de conservación sí elimina EXIF, pero tampoco
  pasa por un antivirus real: sin escáner, producción bloquea la carga. Todo el
  almacenamiento local debe incluirse en el respaldo.
- El perfil privado no tiene directorio público por decisión de alcance. Si se agrega, exige
  revisar privacidad, moderación y consentimiento.
- La galería privada está paginada (9 por página) y solo muestra las visitas del usuario. No
  hay perfiles públicos ni compartición social.
- No existe todavía un flujo de moderación; `visibility` y `moderationStatus` están
  reservados en `CheckIn.photo`.
- Los avatares y las fotos privadas son locales, no están cifrados de extremo a extremo y
  dependen del respaldo y control de acceso del servidor.
- No hay lista de nombres de usuario reservados ni historial de cambios de `username`.
- El backend/API de aventuras y paradas se conserva para compatibilidad; no hay una interfaz
  turística ni administrativa para crear recorridos. Faltan la moderación, los artículos,
  los eventos y la agenda. Las fichas POI ya admiten historia, datos, información práctica y
  fuentes; todavía hay que completar y revisar editorialmente esos contenidos.
- La Ruta del Casco Histórico se responde desde S-022 como recomendación con paradas; no hay
  cálculo de rutas por calles ni navegación giro a giro. La S-022 V3 está en el manifiesto y
  en la evaluación, pero la reingesta del corpus de desarrollo requiere un historiador activo
  que verifique derechos.
- Los QR no guardan imágenes en el servidor; el token solo se devuelve al rotar.
- El QR puede fotografiarse y compartirse y la ubicación del cliente puede simularse; la
  geocerca reduce el abuso, pero no elimina el fraude. La aplicación mantiene el token solo en
  memoria y lo elimina de la URL si llega en un enlace heredado.
- La lectura automática de QR depende de `BarcodeDetector`; si el navegador no lo admite, el
  escáner usa entrada manual y no envía fotogramas al servidor.
- El slug de una aventura archivada no se reutiliza automáticamente.
- La autoría y licencia de 18 imágenes sigue pendiente de verificación; las otras 5 están
  acreditadas con CC BY-SA 4.0.
- La verificación en campo de los 23 POI sigue pendiente; `coordinateVerifiedAt` registra
  revisión documental. El Parque Nacional Médanos de Coro es `unverified` por coordenada
  aproximada y Casa Museo Locos de la Vela mantiene una discrepancia de unos 100 m.
- No se creó configuración Docker porque Docker no está instalado en el entorno.
- Los tiles de OpenStreetMap se usan con atribución visible. Para producción debe revisarse
  su política de uso y evaluarse un proveedor con cuota o autoalojado.
- Las transcripciones de las Unidades 2 a 7 no están generadas; solo existen los PDF/DOCX en
  `.opencode/knowledge/fuentes/`. Este documento no atribuye el trabajo a una unidad
  académica.

## Trazabilidad académica

El trabajo de este corte es de ingeniería y se justifica por el estado real del repositorio.
No se atribuye a una unidad académica porque las transcripciones de las Unidades 2 a 7
todavía no existen en `.opencode/knowledge/`. La matriz
Regla de Negocio → Historia de Usuario → Requerimiento → Diseño → Código → Prueba queda
pendiente de la tarea documental.
