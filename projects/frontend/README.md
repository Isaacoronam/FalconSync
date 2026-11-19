# FalconSync Frontend

Aplicación Angular 21 (core 21.2.26, CLI 21.2.29) para el mapa patrimonial de Santa Ana de Coro.

## Requisitos

- Node.js 26.13.0
- Backend FalconSync en `http://localhost:3000`
- MongoDB local con el seed ejecutado. El E2E usa por defecto el replica set
  `mongodb://127.0.0.1:27018` (`replicaSet=falconsyncTest`) porque conservación y
  evidencia requieren transacciones; se puede sobrescribir con `E2E_MONGODB_URI`.

## Comandos

```bash
npm install
npm start
npm test -- --watch=false
npm run build
npm run e2e
```

`npm start` usa `proxy.conf.json` para enviar `/api` al backend. La aplicación queda en `http://localhost:4200`.

## Estructura

```text
projects/frontend/
├── src/
│   ├── app/
│   │   ├── pages/            # Vistas enrutadas (carga diferida desde app.routes.ts)
│   │   ├── components/       # Componentes reutilizables: layout admin, selector de mapa, panel de evidencia
│   │   ├── services/         # Clientes HTTP y estado; subcarpetas guards/, interceptors/, validators/, utils/ y config/
│   │   ├── models/           # Contratos TypeScript de la API
│   │   └── app.ts, app.routes.ts, app.config.ts
│   ├── assets/               # Recursos públicos copiados a la raíz del sitio: imágenes de POI, marca y favicons
│   ├── environments/         # Configuración de entorno (apiUrl)
│   ├── styles/               # Parciales SCSS compartidos
│   └── index.html, main.ts, styles.scss
├── e2e/                      # Pruebas Playwright
├── scripts/                  # Generación de iconos de marca
└── angular.json, tsconfig*.json, proxy*.conf.json, playwright.config.ts, package.json
```

## Estructura relevante

- `src/app/pages/map/coro-map.component.ts`: mapa Leaflet, filtros y popups.
- `src/app/pages/aventuras/`: catálogo, detalle, progreso y check-in de aventuras. `aventura-list`, `aventura-detail` y `aventura-progreso` no tienen ruta activa: las rutas `/aventuras/*` redirigen a `/lugares`. Decidir en el cierre si se retiran.
- `src/app/pages/perfil/`: perfil privado, avatar, estadísticas, Chivito y fotos de check-in.
- `src/app/pages/admin/`: panel, listado de POI, formulario, auditoría y usuarios. El layout administrativo y el selector de mapa están en `src/app/components/admin/`.
- `src/app/pages/admin/aventuras/`: listado, creación/edición, paradas y QR de aventuras.
- `src/app/pages/conservation/`: reportes, triaje, inspecciones, hallazgos, evidencia, intervenciones, revisión y cierre. El panel de evidencia reutilizable está en `src/app/components/conservation/`.
- `src/app/services/conservation-api.service.ts`: cliente HTTP de reportes, inspecciones e intervenciones.
- `src/app/services/evidence-api.service.ts`: carga, listado y descarga privada de evidencia.
- `src/app/services/location-api.service.ts`: cliente HTTP de lugares.
- `src/app/services/admin-api.service.ts`: cliente HTTP del CRUD administrativo.
- `src/app/services/adventure-api.service.ts`: cliente HTTP de aventuras y paradas.
- `src/app/services/check-in-api.service.ts`: cliente HTTP de check-in; usa JSON o `multipart/form-data` según haya foto.
- `src/app/services/profile-api.service.ts`: perfil, avatar y blobs privados.
- `src/app/services/qr-admin-api.service.ts`: cliente HTTP de rotación de QR.
- `src/app/models/location.model.ts`: contrato TypeScript de `Location`.
- `src/app/models/admin.model.ts`: resumen, POI administrativo y auditoría.
- `src/app/models/adventure.model.ts`: contratos TypeScript de aventuras, paradas, progreso, check-in y QR.
- `src/app/models/profile.model.ts`: perfil, estadísticas, aventuras resumidas y check-in recientes.
- `src/environments/environment.ts`: URL base de la API.
- `proxy.conf.json`: proxy de desarrollo hacia el backend.
- `src/assets/images/locations/`: imágenes de los POI, referenciadas por el campo `images` de la API.
- `src/assets/favicon.ico`: favicon de FalconSync usado por `src/index.html`.
- `e2e/`: suite Playwright de mapa, autenticación, administración de POI, aventuras, perfil y flujo de conservación con denegaciones/IDOR.

## Administración

- `/admin`: panel con métricas por estado y actividad reciente.
- `/admin/poi`: búsqueda, filtros, paginación, edición, archivo y restauración.
- `/admin/poi/nuevo` y `/admin/poi/:id/editar`: ficha completa con selector Leaflet limitado
  a Falcón y gestión de imágenes.
- `/admin/auditoria`: historial de acciones administrativas.
- `/admin/aventuras`: listado administrativo de aventuras, publicación, archivo y
  restauración.
- `/admin/aventuras/nuevo` y `/admin/aventuras/:id/editar`: creación y edición de
  aventuras.
- `/admin/aventuras/:id/paradas`: gestión y reordenamiento de paradas.
- `/admin/locations/:id/qr`: generación, impresión y descarga de QR de check-in.

Públicas:

- `/aventuras`: catálogo de recorridos publicados.
- `/aventuras/:slug`: detalle de recorrido con paradas ordenadas.
- `/aventuras/:slug/progreso`: progreso del usuario autenticado.
- `/checkin`: escáner QR con cámara (`BarcodeDetector`) y entrada manual; el token se guarda
  solo en memoria y no se añade a la URL.
- `/checkin/:locationId`: check-in con geolocalización y foto posterior opcional.
- `/perfil`: perfil privado del usuario autenticado, con avatar, estadísticas, insignias,
  Chivito y galería paginada de visitas.

La tabla de POI se convierte en tarjetas por debajo de 700 px. Las imágenes públicas de POI se
suben al backend y se sirven desde `/api/uploads/...`. Los avatares y las fotos de check-in se
guardan en el almacenamiento privado y se solicitan como `Blob` autenticado; el frontend no
guarda archivos localmente.

El detalle funcional y de seguridad está en
[`../../docs/ADMINISTRACION.md`](../../docs/ADMINISTRACION.md) y
[`../../docs/PERFIL.md`](../../docs/PERFIL.md).

## Cartografía

El mapa usa tiles de OpenStreetMap con su atribución visible. Para producción debe revisarse la política de uso de tiles y evaluarse un proveedor con cuota o un servicio autoalojado.

El icono de los marcadores se genera con `L.divIcon`, por lo que no depende de las imágenes empaquetadas de Leaflet.

## Imágenes y favicon

Las tarjetas y los popups usan la primera ruta de `images` que devuelve la API. Si un POI no tiene imagen, la tarjeta conserva el punto de color por categoría y el popup se muestra sin imagen. Si una ruta falla al cargar, la tarjeta vuelve al punto de categoría y el popup oculta la imagen, sin romper el resto de la ficha.

Las imágenes fueron suministradas por el responsable del proyecto; la autoría y la licencia están pendientes de verificación antes de publicar.
