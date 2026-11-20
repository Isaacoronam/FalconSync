# ADR-006 — Visita 360° obligatoria con derechos y fallback

| Campo | Valor |
|---|---|
| Estado | Aceptada e implementada; contenido real pendiente |
| Fecha | 2026-11-13 |
| Actualizada | 2026-11-19 |
| Decisores | Responsable del proyecto |
| Relacionados | [`../REQUISITOS.md`](../REQUISITOS.md), [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md), [`../360.md`](../360.md) |

## Contexto

La visita 360° es obligatoria. Las imágenes pueden tener derechos, personas identificables y
metadatos sensibles. La infraestructura ya está implementada; todavía no hay panorámicas
reales con derechos verificados y no se publicará contenido sintético.

## Decisión

- Modelar `Panorama` con activo o POI, título, imagen, proyección, checksums, autor,
  licencia, fecha, estado, versión y auditoría.
- Conservar el original en almacenamiento privado y publicar solo derivados con checksum,
  sin EXIF sensible.
- Publicar solo panoramas aprobados y con derechos documentados; la aprobación y publicación
  turística corresponden al historiador (`panorama.publish`).
- Mantener la configuración técnica y los panoramas de inspección en administración
  (`panorama.manage`), sin acceso del historiador a estos últimos.
- Visor WebGL 1 propio, sin dependencia externa, con activación explícita, hotspots, teclado
  y fallback estático obligatorio.
- Separar panoramas públicos de panoramas de inspección en modelo, API, UI y almacenamiento.
- Documentar consentimiento y difuminar personas cuando corresponda.
- Añadir `AudioGuide` y multilingüe solo si se confirman; con transcripción, idioma, duración,
  licencia y fallback.

## Consecuencias

- La publicación queda bloqueada hasta verificar derechos y derivados.
- El renderer propio exige mantener shaders, proyección y accesibilidad; no hay dependencia
  externa que actualizar, pero tampoco soporte de terceros.
- Los panoramas de inspección nunca se exponen por la API turística ni a la curaduría.
- El contenido 360° se enlaza a activos verificados, no a cualquier POI.
- La galería pública permanece vacía mientras no exista contenido con derechos.

## Alternativas consideradas

- Publicar imágenes sin licencia: se rechaza por riesgo legal.
- Usar un visor propietario o una biblioteca sin evaluar licencia: se descarta; se implementó
  un renderer propio.
- Exponer panoramas de inspección como turísticos: se rechaza por fuga de datos.
- Permitir que administración publique contenido turístico: se rechaza para mantener la
  separación editorial.

## Referencias

- Plan, sección 12.
- Requisitos, RF-67 a RF-72.
