---
name: mobile-kotlin-android
description: Planifica o implementa la futura aplicación Android de campo de FalconSync; úsala solo para tareas móviles Kotlin explícitas.
---

# Aplicación móvil de campo (planificada)

## Estado

`projects/mobile/` es actualmente un esqueleto sin proyecto Gradle, manifiesto Android ni
fuentes Kotlin. El requisito de producto plantea una app Android para supervisión de campo,
pero sus flujos y contratos móviles todavía deben definirse.

## Cuándo usar

Solo cuando se solicite diseñar o construir la app Android/Kotlin, su captura de inspecciones
o su integración con la API.

## Procedimiento

1. Confirma alcance, dispositivos, flujo de inspección, trabajo sin conexión, ubicación,
   cámara, sincronización y permisos antes de crear el proyecto.
2. Trata MVVM, Retrofit/OkHttp y corrutinas como propuestas del starter kit, no como
   decisiones ya aprobadas; documenta alternativas y trade-offs.
3. Revisa los contratos backend existentes y propone cambios coordinados antes de asumir
   endpoints de inspección que aún no existen.
4. Minimiza permisos y datos recolectados; define consentimiento, protección local de
   imágenes, tokens, cola offline y reintentos antes de operar con datos reales.
5. Implementa pruebas apropiadas y documenta build, firma y distribución solo cuando se
   acuerden.

## Límites

- No declares una app, login móvil, modo offline ni publicación APK existente.
- No publiques APKs, configures firma ni añadas credenciales de firma al repositorio.
- No uses plantillas de versionado, `version.json` ni rutas `/uploads/apks/` sin decisión
  de producto y diseño de seguridad explícitos.
