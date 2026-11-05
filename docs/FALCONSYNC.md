# FalconSync — estado del primer corte

Fecha de verificación: 2026-11-05.

## Alcance implementado

Primer corte vertical de **CoroMap en modo lectura**:

- API REST con Express 5.3.0 y Mongoose 9.12.0.
- Modelo `Location` con GeoJSON, índice `2dsphere`, categorías y validaciones.
- Endpoints de salud, listado paginado, filtro por categoría, búsqueda cercana y detalle por slug.
- Seed idempotente con 6 puntos de interés.
- Frontend Angular 21.2.26 standalone, zoneless, con Leaflet 1.9.4.
- Mapa con marcadores, filtros, listado lateral con miniaturas, popups con imagen y diseño responsive.
- Imágenes locales de los 6 POI y favicon propio de FalconSync.
- Pruebas de backend, pruebas de servicio Angular y smoke E2E manual con navegador.

## Stack verificado

| Componente | Versión |
|---|---|
| Node.js | 26.13.0 |
| Angular core | 21.2.26 |
| Angular CLI / build | 21.2.29 |
| Express | 5.3.0 |
| Mongoose | 9.12.0 |
| Driver MongoDB de Mongoose | ~7.8 |
| MongoDB local | 9.0.4 |
| Leaflet | 1.9.4 |
| Vitest (frontend) | 4.x, integrado por Angular CLI |
| Node test runner (backend) | `node --test` |

Correcciones respecto al documento inicial:

- El documento mezclaba versiones de Angular: `@angular/core@21.2.29` no existe; la última 21.x del core es `21.2.26`, mientras `@angular/cli` y `@angular/build` sí tienen `21.2.29`. Se fijó core `21.2.26` y CLI/build `21.2.29`.
- `MongoDB 2.14.1` no es una versión válida del servidor ni de Mongoose; se usó MongoDB 9.0.4 y Mongoose 9.12.0.
- Se añadió la categoría `urban` para representar espacios urbanos, que el documento mencionaba pero el enum original no incluía.

## Estructura

```text
FalconSYN/
├── falcon-sync-backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   └── routes/
│   ├── scripts/seedLocations.js
│   └── test/locations.test.js
├── falcon-sync-frontend/
│   ├── public/
│   │   ├── favicon.ico
│   │   └── images/locations/
│   ├── src/app/core/
│   ├── src/app/features/map/
│   └── src/environments/
├── docs/FALCONSYNC.md
└── .nvmrc
```

## Comandos de arranque

Requisitos: Node 26.13.0 y MongoDB local en `127.0.0.1:27017`.

Backend:

```bash
cd falcon-sync-backend
npm install
npm run seed
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

## Endpoints

- `GET /api/health`
- `GET /api/locations?page=1&limit=50&category=religious`
- `GET /api/locations/near?lat=11.4075&lng=-69.6778&radius=500`
- `GET /api/locations/:slug`

Formato de lista:

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

La **Cruz de los Enconchados** no se incluyó porque no se encontró una fuente cartográfica o documental confiable para su ubicación. No se inventaron coordenadas. Debe verificarse antes de agregarla.

El estado de conservación se dejó como `unknown` en todos los POI: no hay una fuente de conservación verificada en este corte.

## Imágenes de los POI

| POI | Archivo público |
|---|---|
| Catedral de Coro | `/images/locations/catedral-de-coro.jpg` |
| Casa de las Ventanas de Hierro | `/images/locations/casa-de-las-ventanas-de-hierro.jpg` |
| Casa del Sol | `/images/locations/casa-del-sol.jpg` |
| Arco de la Federación | `/images/locations/arco-de-la-federacion.jpg` |
| Médanos de Coro | `/images/locations/medanos-de-coro.jpg` |
| Plaza Bolívar de Coro | `/images/locations/plaza-bolivar-de-coro.jpg` |

El campo `images` del modelo ya existía; el seed lo completa con una ruta relativa por POI y la API lo devuelve sin transformaciones. Los archivos se sirven desde `public/images/locations/` del frontend.

Las imágenes fueron **suministradas por el responsable del proyecto**. La autoría y la licencia no están verificadas todavía y deben confirmarse antes de publicar el sitio. `Iglesia-San-Francisco.jpg` no se incorporó: no existe un POI con ese nombre en el seed ni se dispone de coordenadas y fuente verificables para agregarlo sin inventar datos.

## Verificación ejecutada

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas backend | `npm test` en `falcon-sync-backend` | 11/11 pruebas aprobadas |
| Seed idempotente | `npm run seed` | 6 lugares sincronizados, sin warnings |
| Pruebas frontend | `npm test -- --watch=false` | 4/4 pruebas aprobadas |
| Build producción | `npm run build` | Correcto, sin warnings |
| API real | smoke HTTP | `health=ok`, `all=6`, `poi_sin_imagen=0`; el detalle de Catedral devuelve su ruta de imagen |
| Build estático | inspección de `dist/falcon-sync-frontend/browser` | 6 imágenes y `favicon.ico` presentes; hash del favicon igual al archivo suministrado |
| E2E navegador | Playwright Core + Edge sobre el build de producción servido en local, script temporal | 6 miniaturas de 56×56 con `loading="lazy"`; 6 popups con imagen 16/10 y fuente; 6 solicitudes de imagen en `200`; imagen rota en tarjeta deja visible el punto de categoría; favicon en `200` (15 406 bytes); móvil sin overflow horizontal; 0 errores de consola |

El smoke E2E se ejecutó desde una carpeta temporal y no forma parte todavía del repositorio. No se declara una suite E2E permanente.

## Seguridad y dependencias

- `npm audit --omit=dev` en backend y frontend: **0 vulnerabilidades de producción**.
- `npm audit` del frontend reporta **16 vulnerabilidades moderadas en dependencias de desarrollo de Angular CLI** (`pacote`, `glob`, `minimatch` y transitivas). La corrección disponible exige Angular CLI 22.2.6, un salto mayor; no se aplicó porque el proyecto fijó Angular 21 LTS.
- No hay secretos en el repositorio. `.env.example` solo contiene valores locales.
- El seed y la API no requieren autenticación en este corte porque solo exponen lectura pública.

## Limitaciones y pendientes

- No hay autenticación, usuarios, roles, aventuras, subida de imágenes ni moderación. Ese es el siguiente corte.
- La autoría y licencia de las imágenes están pendientes de verificación. `Iglesia-San-Francisco.jpg` queda fuera del seed hasta disponer de coordenadas y fuente verificables.
- Las imágenes suministradas tienen resoluciones de entre 330 y 738 px de ancho; son suficientes para tarjetas y popups, pero deberían sustituirse por originales de mayor calidad antes de una publicación definitiva.
- No se creó configuración Docker porque Docker no está instalado en el entorno. El arranque verificado es con MongoDB local.
- Los tiles de OpenStreetMap se usan con atribución visible. Para producción debe revisarse su política de uso y evaluarse un proveedor con cuota o autoalojado.
- Las transcripciones de las Unidades 2 a 7 no están generadas; solo existen los PDF/DOCX en `.opencode/knowledge/fuentes/`. Este documento no atribuye el trabajo a una unidad académica.
- Falta revisión experta del contenido patrimonial, imágenes, audios y estados de conservación.
