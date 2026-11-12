# Contexto del sistema

## Propósito

FalconSync es una plataforma para promover y gestionar información turística de Santa Ana
de Coro y su entorno patrimonial. La versión actual ofrece un catálogo web de puntos de
interés (POI), mapa Leaflet, contenido editorial, autenticación, check-ins geolocalizados
con QR y administración de POI.

## Estado actual

- Backend: Node.js ESM, Express 5, MongoDB y Mongoose en `projects/backend/`.
- Web: Angular 21 y Leaflet en `projects/frontend/`.
- Las fichas de POI incluyen historia, fuentes editoriales y un estado de conservación
  genérico. El estado permanece `unknown` en el catálogo documentado mientras no haya
  información verificada.
- `projects/mobile/` es solo un esqueleto; no hay una app Android compilable.

## Alcance futuro no implementado

La idea de producto contempla supervisión de campo para conservación preventiva, un visor
360° y asistencia con IA/RAG sobre normativa e historia patrimonial. Estos componentes no
deben presentarse como capacidades existentes hasta que se implementen y verifiquen.

La app móvil puede requerir captura de inspecciones y sincronización; falta definir trabajo
offline, permisos del dispositivo, formatos de evidencia y contratos API antes de diseñarla.
Kotlin está en la idea inicial, pero Android Studio/Gradle, MVVM y Retrofit todavía no son
decisiones aprobadas.

## Referencias

- [README del proyecto](../README.md)
- [Estado y alcance documentados](../docs/FALCONSYNC.md)
- [Catálogo y verificación de POI](../docs/POI.md)
- [Cómo se adaptó el starter kit académico](./unefa-starter-kit-adaptation.md)
