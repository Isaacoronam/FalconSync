# FalconSync Frontend

Aplicación Angular 21 (core 21.2.26, CLI 21.2.29) para el mapa patrimonial de Santa Ana de Coro.

## Requisitos

- Node.js 26.13.0
- Backend FalconSync en `http://localhost:3000`
- MongoDB local con el seed ejecutado

## Comandos

```bash
npm install
npm start
npm test -- --watch=false
npm run build
```

`npm start` usa `proxy.conf.json` para enviar `/api` al backend. La aplicación queda en `http://localhost:4200`.

## Estructura relevante

- `src/app/features/map/coro-map.component.ts`: mapa Leaflet, filtros y popups.
- `src/app/core/services/location-api.service.ts`: cliente HTTP de lugares.
- `src/app/core/models/location.model.ts`: contrato TypeScript de `Location`.
- `src/environments/environment.ts`: URL base de la API.
- `proxy.conf.json`: proxy de desarrollo hacia el backend.
- `public/images/locations/`: imágenes de los POI, referenciadas por el campo `images` de la API.
- `public/favicon.ico`: favicon de FalconSync usado por `src/index.html`.

## Cartografía

El mapa usa tiles de OpenStreetMap con su atribución visible. Para producción debe revisarse la política de uso de tiles y evaluarse un proveedor con cuota o un servicio autoalojado.

El icono de los marcadores se genera con `L.divIcon`, por lo que no depende de las imágenes empaquetadas de Leaflet.

## Imágenes y favicon

Las tarjetas y los popups usan la primera ruta de `images` que devuelve la API. Si un POI no tiene imagen, la tarjeta conserva el punto de color por categoría y el popup se muestra sin imagen. Si una ruta falla al cargar, la tarjeta vuelve al punto de categoría y el popup oculta la imagen, sin romper el resto de la ficha.

Las imágenes fueron suministradas por el responsable del proyecto; la autoría y la licencia están pendientes de verificación antes de publicar.
