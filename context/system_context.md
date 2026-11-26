# Contexto del sistema

## Propósito

FalconSync es una plataforma para promover y gestionar información turística de Santa Ana
de Coro y su entorno patrimonial. La versión actual ofrece un catálogo web de puntos de
interés (POI), mapa Leaflet, contenido editorial, autenticación, check-ins geolocalizados
con QR y administración de POI.

## Estado actual

- Backend: Node.js ESM, Express 5, MongoDB y Mongoose. Rutas y controladores en
  `projects/backend/api/<módulo>/`, servicios en `microservices/` y modelos en `databases/`.
- Web: Angular 21 y Leaflet; vistas en `projects/frontend/src/app/pages/`.
- Catálogo: 23 POI con fichas, fuentes editoriales y estado de conservación `unknown`
  mientras no exista una inspección cerrada y revisada con evidencia.
- Conservación: reportes ciudadanos, triaje, inspecciones de campo, hallazgos,
  intervenciones, revisión, cierre y publicación del estado verificado. UI en `/reportes` e
  `/inspecciones`.
- Evidencia privada: `uploads/documents/`, validación y recodificación con `sharp` sin EXIF,
  hash SHA-256, autorización por recurso y registro de accesos. En producción, sin motor
  antimalware desplegado, la carga responde `503 EVIDENCE_SCAN_UNAVAILABLE`.
- Roles: `user`, `moderator` (legacy en migración), `historian`, `inspector` y `admin`.
- RAG: Chivito, guía turística activa con corpus curado, citas, abstención y evaluación; el
  asistente técnico está implementado pero cerrado hasta aprobar su corpus. Las rutas son
  recomendaciones y datos de acceso registrados, sin navegación giro a giro ni cálculo de
  rutas por calles. Los horarios solo se responden con fuente publicada y fechada.
- Visitas 360°: panoramas publicados, visor WebGL propio, hotspots y fallback estático.
- Conservación y evidencia usan transacciones: requieren replica set. En local se usa
  `127.0.0.1:27018` (`replicaSet=falconsyncTest`).
- `test/structure.test.js` comprueba que el árbol mantiene la estructura aprobada y
  `test/uploads.test.js` cubre la separación público/privada y los guards de arranque.
- CI: `.github/workflows/ci.yml` dispara en `develop`, `main` y `master`, inicia un replica set
  de MongoDB y ejecuta auditorías, pruebas, build y E2E. Se reprodujo en una copia limpia local
  el 2026-11-19; la ejecución en GitHub sigue pendiente de autorización (A2).
- `projects/mobile/` es solo un esqueleto; no hay una app Android compilable.

## Alcance futuro no implementado

La idea de producto contempla notificaciones en tiempo real con Socket.IO. Hay documentación de
diseño, pero el servidor Socket.IO no está implementado. Este componente no debe presentarse
como capacidad existente hasta que se implemente y verifique.

La app móvil puede requerir captura de inspecciones y sincronización; falta definir trabajo
offline, permisos del dispositivo, formatos de evidencia y contratos API antes de diseñarla.
Kotlin está en la idea inicial, pero Android Studio/Gradle, MVVM y Retrofit todavía no son
decisiones aprobadas.

## Referencias

- [README del proyecto](../README.md)
- [Estado y alcance documentados](../docs/FALCONSYNC.md)
- [Catálogo y verificación de POI](../docs/POI.md)
- [Cómo se adaptó el starter kit académico](../memory/unefa-starter-kit-adaptation.md)
