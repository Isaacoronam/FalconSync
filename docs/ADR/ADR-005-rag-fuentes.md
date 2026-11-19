# ADR-005 — RAG con fuentes verificadas, respuesta con citas y abstención

| Campo | Valor |
|---|---|
| Estado | Aceptada (revisada el 2026-11-17): RAG v1 sin proveedor externo y con respuesta extractiva |
| Fecha | 2026-11-17 (versión inicial del 2026-11-13) |
| Decisores | Responsable del proyecto |
| Relacionados | [`../FUENTES-RAG.md`](../FUENTES-RAG.md) v1.1, [`../CORPUS-POI.md`](../CORPUS-POI.md), [`../REQUISITOS.md`](../REQUISITOS.md) (RF-57, RF-59, RF-81, RN-17, RN-19, RN-20, RN-22), [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md) §11 |

## Contexto

- Se necesita un asistente técnico y una guía turística con citas verificables.
- El informe de UNESCO de 2008 es histórico. No acredita el estado actual.
- No todos los POI son patrimonio. Muchos son sitios turísticos de la ciudad de Coro.
- Los Términos de Uso de UNESCO (15/09/2026) limitan la copia y el uso de sus materiales para un RAG público.
- Los hechos históricos deben apoyarse en fuentes de alta credibilidad y no en un solo documento.
- El alcance de este proyecto no requiere un proveedor de IA ni un presupuesto asociado.

## Decisión

1. **RAG v1 sin proveedor externo** y sin búsqueda web en vivo. Recuperación léxica con filtros. Respuesta extractiva con citas (FUENTES §8).
2. **Materiales de UNESCO sin licencia abierta:** curación propia con citas breves y enlace. No hay índice persistente de texto completo en v1. No se solicita autorización a UNESCO como vía de la v1.
3. **Niveles de fuente A a E** con reglas de verificación: doble fuente para hechos históricos, tradición etiquetada, contradicciones mostradas y prevalencia de la fuente oficial vigente.
4. **Clasificación patrimonial de los POI** (D-24, propuesta): P-UNESCO-ENTORNO, P-UNESCO-FUERA, P-NACIONAL, NATURAL y TURÍSTICO. La etiqueta `unesco` no prueba pertenencia al bien.
5. **Estado actual** solo desde fuentes A vigentes o inspecciones propias. Nunca desde fuentes históricas.
6. **Asistente técnico en v1:** no usa datos de inspección ni POI turísticos no patrimoniales para diagnosticar.
7. **Sin herramientas de escritura, cierre, asignación ni publicación.**
8. **Validación de citas** contra fragmentos o datos recuperados. Si la validación falla, se devuelve una abstención.
9. **D-03 revisada:** ya no requiere proveedor externo. **D-21 retirada.**

## Consecuencias

- El asistente redacta menos que un modelo generativo, pero cada afirmación es trazable y no hay coste de proveedor.
- La calidad depende de la curación del corpus. Los horarios y accesos caducan y deben revisarse periódicamente.
- Las variantes con proveedor externo, que aparecen en los diagramas de `CASOS-USO.md` y `SEGURIDAD.md`, quedan fuera de v1. Adoptarlas exigirá un ADR nuevo.
- La evaluación con 60 preguntas es obligatoria antes de publicar. El conjunto completo es un entregable pendiente.
- Riesgos RAG-01 a RAG-14 en `FUENTES-RAG.md` §13.

## Alternativas consideradas

- **Modelo generativo con proveedor externo en v1:** descartado por alcance, coste y riesgo de citas inventadas que no era necesario asumir.
- **Índice persistente del texto completo de documentos de UNESCO:** descartado mientras los derechos no estén resueltos.
- **Solicitar autorización a UNESCO:** no se adopta como vía de la v1 (decisión del responsable).
- **Búsqueda web en vivo para la guía turística:** diferido. En v1 se usan fuentes curadas y fechadas.
- **Usar Wikipedia como fuente final:** descartado. Solo se usa como puntero.
- **Incluir datos de inspección en el asistente técnico:** diferido a una decisión posterior, con control de acceso por recurso.

## Referencias

- Plan, §11 y §23.
- `FUENTES-RAG.md` v1.1 y `CORPUS-POI.md`.
- Términos de Uso de UNESCO, última actualización el 15/09/2026.
