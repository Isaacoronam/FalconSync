# FalconSync Backend

API REST para los puntos de interés patrimonial de Coro.

## Requisitos

- Node.js 26.13.0
- MongoDB 9.0.4 local en `127.0.0.1:27017`

## Comandos

```bash
npm install
npm run seed
npm run dev
npm test
```

La API queda en `http://localhost:3000`.

## Endpoints implementados

- `GET /api/health`
- `GET /api/locations?page=1&limit=50&category=religious`
- `GET /api/locations/near?lat=11.4075&lng=-69.6778&radius=500`
- `GET /api/locations/:slug`

## Seed y fuentes

El seed es idempotente y actualiza los documentos por `slug`. Las coordenadas se obtuvieron de OpenStreetMap, Wikidata/Wikipedia y un Plus Code verificable. El estado de conservación se deja como `unknown` porque no se dispone de una fuente de conservación verificada.

Cada POI incluye en `images` una ruta pública con el formato `/images/locations/<slug>.jpg`. La API devuelve ese campo tal cual; los archivos los sirve el frontend desde su carpeta `public/images/locations/`. Las imágenes fueron suministradas por el responsable del proyecto y su autoría y licencia están pendientes de verificación.

La **Cruz de los Enconchados** no se incluyó: no se encontró una fuente cartográfica o documental confiable que permita ubicarla sin inventar datos. Debe incorporarse cuando se verifique su ubicación.

## Variables de entorno

Copia `.env.example` a `.env` si necesitas cambiar puerto, URI de MongoDB u orígenes CORS. No se incluyen secretos reales.
