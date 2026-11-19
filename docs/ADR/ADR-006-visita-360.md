# ADR-006 — Visita 360° obligatoria con derechos y fallback

| Campo | Valor |
|---|---|
| Estado | Aceptada; contenido pendiente |
| Fecha | 2026-11-13 |
| Decisores | Responsable del proyecto |
| Relacionados | [`../REQUISITOS.md`](../REQUISITOS.md), [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md) |

## Contexto

La visita 360° es obligatoria. No existe modelo, visor ni inventario de panoramas. Las
imágenes pueden tener derechos, personas identificables y metadatos sensibles.

## Decisión

- Modelar `Panorama` con activo o POI, título, imagen, proyección, checksum, autor, licencia,
  fecha y estado.
- Publicar solo panoramas aprobados y con derechos documentados.
- Visor con hotspots, navegación por teclado y fallback estático.
- Separar panoramas públicos de panoramas de inspección.
- Documentar consentimiento y difuminar personas cuando corresponda.
- Añadir `AudioGuide` y multilingüe solo si se confirman; con transcripción, idioma, duración,
  licencia y fallback.

## Consecuencias

- La publicación queda bloqueada hasta verificar derechos.
- Se necesita una biblioteca de visualización con licencia y accesibilidad comprobadas.
- Los panoramas de inspección nunca se exponen por la API turística.
- El contenido 360° se enlaza a activos verificados, no a cualquier POI.

## Alternativas consideradas

- Publicar imágenes sin licencia: se rechaza por riesgo legal.
- Usar un visor propietario sin evaluar licencia: se rechaza hasta verificarlo.
- Exponer panoramas de inspección como turísticos: se rechaza por fuga de datos.

## Referencias

- Plan, sección 12.
- Requisitos, RF-67 a RF-72.
