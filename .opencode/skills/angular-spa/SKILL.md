---
name: angular-spa
description: Implementa o revisa páginas, componentes, servicios, formularios y mapas en la SPA Angular 21 de FalconSync.
---

# Frontend Angular de FalconSync

## Cuándo usar

Para cambios en `projects/frontend/`, incluidos navegación, API cliente, formularios,
accesibilidad, pruebas de componentes y mapa Leaflet.

## Procedimiento

1. Confirma la versión y los scripts en `projects/frontend/package.json`; el proyecto usa
   Angular 21. No presupongas Angular 22 ni actualices versiones por una plantilla.
2. Revisa componentes y servicios del feature existente. Conserva la arquitectura standalone,
   `inject()`, Signals donde ya se usan, `ChangeDetectionStrategy.OnPush` y las convenciones
   del componente.
3. Mantén contratos tipados en `src/app/core/models/` y llamadas HTTP en servicios de
   `src/app/core/services/`. No dupliques URLs o lógica de API en componentes.
4. Usa el control flow Angular del repositorio (`@if`, `@for`) y estados visibles de carga,
   error, vacío y éxito; no agregues Bootstrap u otra librería sin autorización.
5. Para Leaflet, conserva límites y configuración cartográfica existentes; mantén atribución
   de tiles y evita introducir un proveedor sin revisar su política.
6. Añade o actualiza pruebas con el runner configurado (Vitest vía Angular CLI); para flujos
   de usuario, reutiliza Playwright en `e2e/`.
7. Ejecuta pruebas específicas y `npm run build` en el frontend cuando el alcance lo permita.

## Límites

- No trates las propuestas de Angular 22+, Bootstrap o despliegue de estáticos al backend
  del starter kit como decisiones vigentes.
- No guardes tokens, cookies ni archivos privados en URLs, logs o almacenamiento público.
