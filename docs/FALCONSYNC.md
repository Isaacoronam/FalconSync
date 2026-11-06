# FalconSync — estado de los cortes 0, 1, 1.5 y 2

Fecha de verificación: 2026-11-05.

## Alcance implementado

### Corte 0 — Identidad y geografía

- Tipografía sans-serif de sistema para cuerpo y títulos (`Segoe UI Variable`, `Segoe UI`,
  `system-ui`), sin peticiones externas ni dependencias de licencia.
- Pesos y espaciado ajustados para títulos, fichas y tarjetas.
- Mapa limitado al rectángulo operativo de Falcón con `maxBounds`,
  `maxBoundsViscosity=1` y `minZoom=8`.
- Vista inicial en Coro a zoom 13 y control “Ver todo Falcón”.
- **Pendiente:** el logo maestro PNG no estaba disponible en el repositorio ni en el
  adjunto de la conversación. El header conserva la marca “F”, y el favicon y
  `apple-touch-icon` siguen sin regenerarse. No se inventó ni se sustituyó por una
  identidad distinta.

### Corte 1 — Autenticación y permisos

- Modelos `User` y `RefreshSession`.
- Registro, login, refresh rotativo, logout, `me` y cambio de contraseña.
- Access token de 15 minutos en memoria; refresh de 7 días en cookie `httpOnly`,
  `SameSite=Strict` y `Path=/api/auth`.
- Hash `bcryptjs` con coste 12, rate limit en endpoints sensibles y comprobación de origen.
- Roles `user`, `moderator` y `admin`.
- Bootstrap de administrador idempotente con `scripts/createAdmin.js`.
- Cambio obligatorio de contraseña en el primer acceso del admin creado por bootstrap.
- Frontend: login, registro, cambio de contraseña, guards, interceptor, header con sesión,
  expulsión a `/acceso-denegado` y panel `/admin` mínimo con métricas.

### Corte 1.5 — E2E permanente y CI

- Playwright dentro del repositorio, con configuración `playwright.config.ts`.
- Servidor E2E aislado en `scripts/e2eServer.js`: base de datos `falconsync_e2e`, seis POI,
  un admin operativo y un admin pendiente de cambio de contraseña.
- Servidores de prueba en puertos 3101 (API) y 4201 (frontend) para no chocar con el
  entorno de desarrollo.
- Workflow de GitHub Actions creado en `.github/workflows/ci.yml` con MongoDB de servicio,
  pruebas, build, Chromium y E2E.
- El workflow **no fue ejecutado** todavía: no se hizo push ni se dispone de una ejecución
  remota verificada. El YAML no se declara verde.

### Corte 2 — Administración y POI

- Layout administrativo con panel, listado de POI y auditoría.
- Panel con usuarios, POI por estado y actividad reciente.
- CRUD de POI con validación en cliente y servidor.
- Estados `draft`, `published` y `archived`; el API público solo expone publicados.
- Borrado lógico y restauración como borrador.
- Selector de ubicación con Leaflet limitado al rectángulo de Falcón.
- Imágenes locales mediante `StorageAdapter`, con validación de firma binaria, límite de
  5 MB y máximo de 8 por POI.
- Auditoría de creación, edición, archivo, restauración y gestión de imágenes.
- Tabla responsive convertida en tarjetas por debajo de 700 px.

El detalle de endpoints, permisos, validaciones y límites está en
[`docs/ADMINISTRACION.md`](./ADMINISTRACION.md).

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

```text
FalconSYN/
├── .github/workflows/ci.yml
├── falcon-sync-backend/
│   ├── scripts/
│   │   ├── createAdmin.js
│   │   ├── e2eServer.js
│   │   └── seedLocations.js
│   ├── src/
│   │   ├── config/            # entorno, Mongo y límites de Falcón
│   │   ├── controllers/       # auth, admin, POI y locations públicas
│   │   ├── middlewares/       # auth, origin, rate limit, upload, errores
│   │   ├── models/            # User, RefreshSession, Location, AuditLog
│   │   ├── routes/
│   │   ├── services/          # auth, auditoría y storage
│   │   └── utils/             # HttpError, validaciones
│   ├── uploads/               # imágenes locales, ignoradas por Git
│   └── test/                  # locations, auth y adminLocations
├── falcon-sync-frontend/
│   ├── e2e/                   # map, auth y admin-poi
│   ├── public/images/locations/
│   ├── src/app/
│   │   ├── core/              # guards, interceptor, modelos, servicios
│   │   ├── features/
│   │   │   ├── admin/         # layout, dashboard, POI y auditoría
│   │   │   ├── auth/          # login, registro, cambio, 403
│   │   │   └── map/
│   │   ├── environments/
│   │   └── styles/_admin.scss
│   ├── playwright.config.ts
│   ├── proxy.conf.json
│   └── proxy.e2e.conf.json
├── docs/
│   ├── ADMINISTRACION.md
│   ├── AUTENTICACION.md
│   └── FALCONSYNC.md
└── .nvmrc
```

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
- El logo sigue pendiente porque no se recibió el PNG maestro. No se debe considerar
  cerrada la identidad visual hasta incorporarlo y regenerar favicon y
  `apple-touch-icon` desde el mismo archivo.

## Autenticación

El detalle de decisiones, endpoints, cookies y límites está en
[`docs/AUTENTICACION.md`](./AUTENTICACION.md).

Resumen operativo:

- El `.env` local está ignorado por Git y contiene secretos aleatorios generados para este
  entorno.
- `npm run create-admin` creó `admin@falconsync.local`; la contraseña está en `.env` y debe
  cambiarse en el primer acceso.
- El script es idempotente: una segunda ejecución no modifica la contraseña existente.
- El panel `/admin` ya permite gestionar POI, imágenes y auditoría. La gestión de usuarios,
  las rutas, los QR y la moderación corresponden a los cortes siguientes.

## Comandos de arranque

Requisitos: Node 26.13.0 y MongoDB local en `127.0.0.1:27017`.

Backend:

```bash
cd falcon-sync-backend
npm install
cp .env.example .env   # completar secretos de al menos 32 caracteres
npm run seed
npm run create-admin   # requiere ADMIN_* en .env
npm run dev
```

Frontend, en otra terminal:

```bash
cd falcon-sync-frontend
npm install
npm start
```

- API: `http://localhost:3000`
- Aplicación: `http://localhost:4200`
- El frontend usa `proxy.conf.json` para enviar `/api` al backend.

En Windows, si no se dispone de `cp`, crear `.env` manualmente a partir de
`.env.example`. No se deben usar los valores de ejemplo en producción.

## Endpoints

Públicos:

- `GET /api/health`
- `GET /api/locations?page=1&limit=50&category=religious`
- `GET /api/locations/near?lat=11.4075&lng=-69.6778&radius=500`
- `GET /api/locations/:slug`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Autenticados:

- `GET /api/auth/me`
- `POST /api/auth/change-password`

Administración (rol `admin`, cambio de contraseña completado):

- `GET /api/admin/summary`
- `GET /api/admin/locations?q=&status=&category=&page=&limit=`
- `GET /api/admin/locations/:id`
- `POST /api/admin/locations`
- `PATCH /api/admin/locations/:id`
- `DELETE /api/admin/locations/:id` (borrado lógico)
- `POST /api/admin/locations/:id/restore`
- `POST /api/admin/locations/:id/images`
- `DELETE /api/admin/locations/:id/images`
- `GET /api/admin/audit?page=&limit=&action=&entityId=`

Las imágenes se sirven en `/api/uploads/...`.

Formato de lista de lugares:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 50, "total": 0, "totalPages": 0 }
}
```

## Fuentes de los POI

| POI | Coordenadas `[lng, lat]` | Fuente |
|---|---|---|
| Catedral de Coro | `[-69.6778073, 11.4075246]` | OpenStreetMap way 370610638 |
| Casa de las Ventanas de Hierro | `[-69.6799844, 11.4089625]` | Plus Code `773GC85C+H2J`, C. Zamora |
| Casa del Sol | `[-69.6790501, 11.4089358]` | OpenStreetMap node 1122775758, Zamora/Federación |
| Arco de la Federación | `[-69.6713859, 11.410797]` | Wikipedia, coordenadas de la página |
| Médanos de Coro | `[-69.6577925, 11.4384496]` | OpenStreetMap relation 3461483 |
| Plaza Bolívar de Coro | `[-69.6782276, 11.4072929]` | OpenStreetMap way 370610469 |

La **Cruz de los Enconchados** no se incluyó porque no se encontró una fuente cartográfica
o documental confiable para su ubicación. No se inventaron coordenadas. Debe verificarse
antes de agregarla.

El estado de conservación se dejó como `unknown` en todos los POI: no hay una fuente de
conservación verificada en este corte.

## Imágenes de los POI

| POI | Archivo público |
|---|---|
| Catedral de Coro | `/images/locations/catedral-de-coro.jpg` |
| Casa de las Ventanas de Hierro | `/images/locations/casa-de-las-ventanas-de-hierro.jpg` |
| Casa del Sol | `/images/locations/casa-del-sol.jpg` |
| Arco de la Federación | `/images/locations/arco-de-la-federacion.jpg` |
| Médanos de Coro | `/images/locations/medanos-de-coro.jpg` |
| Plaza Bolívar de Coro | `/images/locations/plaza-bolivar-de-coro.jpg` |

Las imágenes fueron suministradas por el responsable del proyecto. La autoría y la licencia
no están verificadas todavía y deben confirmarse antes de publicar el sitio.
`Iglesia-San-Francisco.jpg` no se incorporó: no existe un POI con ese nombre en el seed ni
se dispone de coordenadas y fuente verificables para agregarlo sin inventar datos.

## Verificación ejecutada

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas backend | `npm test` en `falcon-sync-backend` | 33/33 aprobadas (10 admin POI + 12 auth + 11 locations) |
| Seed idempotente | `npm run seed` | 6 lugares sincronizados |
| Bootstrap admin | `npm run create-admin` | Admin creado; segunda ejecución sin cambios |
| Pruebas frontend | `npm test -- --watch=false` | 18/18 aprobadas |
| Build producción | `npm run build` | Correcto, sin warnings |
| E2E permanente | `npm run e2e` en `falcon-sync-frontend` | 6/6 aprobadas con Edge |
| Auditoría producción backend | `npm audit --omit=dev` | 0 vulnerabilidades |
| Auditoría producción frontend | `npm audit --omit=dev` | 0 vulnerabilidades |
| Auditoría completa frontend | `npm audit` | 16 moderadas en dependencias de desarrollo de Angular CLI |
| Workflow CI | `.github/workflows/ci.yml` | Creado, **no ejecutado** en remoto |

La suite E2E comprueba:

- límites reales de Leaflet (`maxBounds`, viscosidad, zoom mínimo, centro inicial);
- que un `panTo` fuera del estado queda clavado dentro del rectángulo;
- control “Ver todo Falcón” y ausencia de overflow horizontal a 390 px;
- registro, persistencia de sesión tras recarga, logout y rechazo de credenciales;
- ruta protegida que redirige a login con `returnUrl`;
- usuario normal bloqueado en `/admin`;
- admin operativo con panel y métricas;
- cambio obligatorio del admin inicial y desbloqueo posterior;
- creación de un POI, carga de imagen, publicación y aparición en el mapa;
- archivo lógico, desaparición del API público y restauración como borrador.

La E2E local usa Microsoft Edge mediante el canal de Playwright. En CI se configuró
Chromium, pero esa ejecución no está verificada todavía. Las imágenes de la E2E se guardan
en `test-results/e2e-uploads` y no contaminan la carpeta `uploads/` de desarrollo.

## Seguridad y dependencias

- `npm audit --omit=dev`: 0 vulnerabilidades de producción en backend y frontend.
- `npm audit` del frontend reporta 16 vulnerabilidades moderadas en dependencias de
  desarrollo de Angular CLI (`glob`, `minimatch` y transitivas). La corrección disponible
  exige Angular CLI 22.2.6, un salto mayor; no se aplicó porque el proyecto fijó Angular 21.
- No hay secretos en el repositorio. `.env` está ignorado y `.env.example` solo contiene
  marcadores.
- Las rutas `/api/admin/*` exigen rol `admin` y contraseña cambiada; el API público solo
  expone POI publicados y no serializa referencias internas de usuario.
- Las imágenes se validan por firma binaria, se limitan a JPEG/PNG/WebP, 5 MB y 8 por POI.
  La carpeta `uploads/` está ignorada por Git.
- El seed y los endpoints de lectura son públicos por diseño en este corte.
- El rate limit se desactiva en `NODE_ENV=test` para no interferir con las pruebas; sus
  umbrales no tienen una prueba automatizada propia.

## Limitaciones y pendientes

- **Logo maestro pendiente:** sin el PNG no se puede cerrar la identidad visual ni
  regenerar favicon/`apple-touch-icon`.
- El límite del mapa es rectangular y operativo, no el polígono oficial de Falcón.
- No hay verificación de correo, recuperación de contraseña, MFA ni gestión de sesiones.
- El panel admin no gestiona usuarios ni roles; el rol `moderator` sigue reservado para el
  corte de moderación.
- El slug de un POI archivado no se reutiliza automáticamente; debe elegirse otro.
- Las imágenes locales no generan miniaturas ni eliminan metadatos EXIF, no pasan por
  antivirus y no están replicadas. En producción deben incluirse en el respaldo.
- No existen todavía aventuras, paradas, check-in, QR, geocercas, moderación, artículos,
  eventos ni agenda.
- La autoría y licencia de las imágenes siguen pendientes de verificación.
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
