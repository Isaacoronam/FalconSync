# ADR-005 — RAG con fuentes verificadas, respuesta con citas y abstención

| Campo | Valor |
|---|---|
| Estado | Aceptada (revisada el 2026-11-17; addendas del 2026-11-20, 2026-11-23, 2026-11-24, 2026-11-25 y 2026-11-26): RAG sin proveedor externo, respuesta extractiva y guía turística V5 con separación de conceptos, compuestas y acceso |
| Fecha | 2026-11-20 (versión inicial del 2026-11-13; revisión del 2026-11-17) |
| Decisores | Responsable del proyecto |
| Relacionados | [`../FUENTES-RAG.md`](../FUENTES-RAG.md) v1.10, [`../CORPUS-POI.md`](../CORPUS-POI.md), [`../REQUISITOS.md`](../REQUISITOS.md) (RF-57, RF-59, RF-81, RN-17, RN-19, RN-20, RN-22), [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md) §11 |

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
4. **Clasificación patrimonial de los POI** (D-24, aceptada el 2026-11-20): `unesco_fuera_verificado`, `unesco_entorno_pendiente`, `nacional_verificado`, `natural_protegido`, `turistico_no_patrimonial` y `sin_clasificar` (valor por defecto). La etiqueta `unesco` no prueba pertenencia al bien.
5. **Estado actual** solo desde fuentes A vigentes o inspecciones propias. Nunca desde fuentes históricas.
6. **Asistente técnico en v1:** no usa datos de inspección ni POI turísticos no patrimoniales para diagnosticar.
7. **Sin herramientas de escritura, cierre, asignación ni publicación.**
8. **Validación de citas** contra fragmentos o datos recuperados. Si la validación falla, se devuelve una abstención.
9. **D-03 revisada:** ya no requiere proveedor externo. **D-21 retirada.**

## Consecuencias

- El asistente redacta menos que un modelo generativo, pero cada afirmación es trazable y no hay coste de proveedor.
- La calidad depende de la curación del corpus. Los horarios y accesos caducan y deben revisarse periódicamente.
- Las variantes con proveedor externo quedan fuera de v1; los diagramas y controles se alinearon con la respuesta extractiva el 2026-11-20. Adoptar un proveedor exigirá un ADR nuevo.
- La evaluación con 60 preguntas es obligatoria antes de publicar; quedó entregada con el conjunto v3 (125 casos) el 2026-11-24.
- Riesgos RAG-01 a RAG-14 en `FUENTES-RAG.md` §13.

## Addendum 2026-11-20 — alcance operativo de v1

Aprobado por el responsable del proyecto. No cambia la decisión de fondo; fija cómo se aplica.

| Tema | Decisión |
|---|---|
| Forma de respuesta | Extractiva: citas literales de máximo 25 palabras o hechos estructurados verificados. Sin generación libre. |
| Ingesta | CLI y manifiestos con `--dry-run`, `--apply`, `--verify` y `--rebuild-index`. Sin subida de PDF ni parseo automático en v1. |
| Corpus | Solo fuentes en español. Una fuente solo en inglés queda `draft` hasta que exista una traducción revisada. |
| Índice | Un único índice de texto sobre `SourceChunk.text`; filtros en índices separados. Sin embeddings. |
| Derechos | Fuentes restringidas: `indexingPolicy=short_quotes_only`; nunca texto completo. |
| Persistencia | Turístico anónimo: sin `Conversation` ni `Message`. Técnico autenticado: 90 días con TTL en ambas colecciones. |
| RBAC | Se mantiene `source.manage` solo para admin. El historiador valida y propone con `source.read`; la CLI exige un actor con `source.manage`. |
| Búsqueda externa | RF-60 y la búsqueda externa en vivo quedan diferidos a v1.1. |
| Apertura | Solo si el conjunto dorado tiene cobertura oficial verificada. Si no, modo restringido o no se abre. |
| D-24 | Aceptada. `sin_clasificar` es el valor por defecto; el asistente se abstiene ante pertenencia no verificada. |

Consecuencias:

- `docs/FUENTES-RAG.md` v1.2 es la fuente canónica de niveles, políticas de uso e indexación.
- `docs/PLAN-IMPLEMENTACION.md` §11 deja de duplicar la tabla A–E.
- `docs/CASOS-USO.md` S-08, UC-14 y UC-15 describen recuperación léxica y composición extractiva.
- `docs/REQUISITOS.md` RF-60 pasa a diferido y RF-64 elimina el coste por consulta.
- El asistente turístico no se presenta como producto de UNESCO ni como conocimiento completo del bien.

## Addendum 2026-11-23 — guía turística V2

Aprobado por el responsable del proyecto al cerrar la V2 de la guía turística. No cambia la
decisión de fondo (respuesta extractiva con citas, sin proveedor externo); actualiza la
recuperación y las abstenciones. La fuente canónica del comportamiento sigue siendo
`FUENTES-RAG.md` §8.

| Tema | Decisión |
|---|---|
| Índice | Embeddings multilingües locales (`paraphrase-multilingual-MiniLM-L12-v2`, 384 dimensiones) sobre `SourceChunk.text` y las `questions` curadas de cada fragmento; umbral `RAG_MIN_SIMILARITY=0.6`. Sustituye a «Sin embeddings» del addendum anterior. |
| Resolución del lugar | Sin selector y desde el texto de la pregunta: título exacto publicado → cobertura léxica ≥ 0.5 → pista de seguimiento → similitud semántica. Un lugar que existe en el catálogo pero no está publicado (`draft`/`archived`) mencionado por nombre provoca abstención. |
| Atribución semántica | La vía semántica no se usa cuando la evidencia general alcanza el umbral y la ficha de ningún lugar la supera con claridad (`POI_GENERAL_MARGIN=0.15`). |
| Citas | Una cita por fuente primero (ficha del lugar + registro general) con tope `MAX_ANSWER_CITATIONS=2`; la ficha del lugar resuelto se acepta desde `POI_FICHA_MIN_SIMILARITY=0.4` y encabeza el orden. |
| Abstenciones nuevas | Peticiones de texto libre generado (poema, redacción, invención), preguntas con un año concreto que ningún fragmento seleccionado contiene y lugares no publicados. |
| Evaluación | `rag-golden-v2.json` (59 casos) ejecutado el 2026-11-23 con el modelo real sobre `falconsync_rag_eval`: todas las metas cumplidas. Informe en `projects/backend/corpus/evaluation/rag-golden-v2-report.json`. El mínimo de 60 casos sigue pendiente como entregable editorial. |
| Asistente técnico | Sigue cerrado hasta tener corpus y evaluación técnica aprobados. |

Consecuencias:

- Las preguntas curadas (`questions`) pasan a ser parte de la curación: una fuente sin ellas
  responde solo por similitud de texto y pierde cobertura en preguntas parafraseadas.
- El umbral global no se baja para forzar respuestas: la cobertura se gana con curación, no
  relajando la abstención.
- `docs/CASOS-USO.md` UC-14 y UC-15 siguen describiendo composición extractiva; la
  recuperación ahora es semántica con apoyo léxico.

## Addendum 2026-11-24 — guía turística V3

Aprobado por el responsable del proyecto al cerrar la V3 (instrucción de seguir las recomendaciones
sénior para terminar el chatbot). No cambia la decisión de fondo (respuesta extractiva con citas,
sin proveedor externo); amplía el corpus y las preguntas que la guía puede responder. La fuente
canónica del comportamiento sigue siendo `FUENTES-RAG.md` v1.8.

| Tema | Decisión |
|---|---|
| Corpus | Expansión a 14 fuentes y 131 fragmentos: S-024 (blog «Arquitectura con barro») y S-025 (ficha técnica adobe/tapial) nivel C con citas ≤25 palabras por instrucción del responsable; S-026 a S-029 y S-032, resúmenes propios ≤25 palabras de Wikipedia/Wikivoyage nivel D con enlace (nunca fuente final de un hecho normativo o de estado actual); S-030 (cuenta oficial del MUCOR) nivel A y S-031 (horario de misas referido) nivel C para horarios publicados. S-021 y S-022 aprobadas por el responsable el 2026-11-23. |
| Preguntas compuestas | Una pregunta con varias partes se divide en sub-consultas (máximo 3, por marcas «? ¿» o conector interrogativo), cada parte exige evidencia propia por encima del umbral y la respuesta sale en un mismo texto con hasta 3 citas; sin evidencia en alguna parte → abstención `NO_EVIDENCE` con mensaje único y 3 sugerencias. |
| Horarios | Se responden solo con fuente publicada y fechada (S-030, S-031) con la obligación de confirmar antes de la visita; sin fuente publicada, «Sin horarios confirmados». Los precios siguen sin fuente y se abstienen. |
| Patrones de consulta | «estado Falcón» no activa la lógica de estado actual; el aspecto de precio no se responde con un horario; las consultas culturales sobre adobe/tapia no se tratan como diagnóstico fuera de ámbito. |
| Evaluación | `rag-golden-v3.json` (125 casos: 59 de v2 + 50 del dataset turístico + 10 paráfrasis + 6 compuestas) ejecutado el 2026-11-24 con el corpus completo: todas las metas cumplidas (p95 45 ms). Regresión v2 con `--sources` sobre las cinco fuentes originales: 59/59. El mínimo editorial de 60 casos queda cubierto. |

Consecuencias:

- Las fuentes D (Wikipedia/Wikivoyage) se usan como contexto con resumen propio y enlace; solo
  localizan o contextualizan, nunca sustentan por sí solas un hecho normativo o de estado actual.
- Los horarios de S-030 y S-031 caducan: re-verificarlos antes de cada temporada o a los 12 meses
  (frescura de `FUENTES-RAG.md` §2.2).
- `rag-golden-v2.json` no se modifica: su regresión se ejecuta con `--sources S-002,S-003,S-020,S-021,S-022`
  para aislar el cambio de código; el comportamiento nuevo se mide con el conjunto v3.

## Addendum 2026-11-25 - guía turística V4

La V4 corrige los defectos observados en conversaciones reales sin cambiar el principio de
respuesta extractiva con citas. La fuente canónica del comportamiento pasa a
`FUENTES-RAG.md` v1.9.

| Tema | Decisión |
|---|---|
| Saludos | Un mensaje completo de saludo responde `answerType: greeting` con bienvenida y 3 sugerencias, sin consultar el corpus. La validación admite 2 caracteres solo para saludos. |
| Coincidencia | Las preguntas curadas se comparan sin acentos, mayúsculas ni puntuación. El umbral léxico de POI sube a 0.6 y «Coro» no cuenta como token distintivo del título. |
| Citas | La cita secundaria exige cobertura compuesta, pertenencia al POI resuelto o un margen ≤0.15 respecto de la principal. Las fuentes internas no exponen URL pública. |
| Identidad de Coro | `S-026#introduccion` aporta una definición general de 24 palabras; las preguntas de ciudad, producto, turismo y tapia quedan curadas en los manifiestos. |
| Composición | Deduplicación de frases, capitalización, aviso de historia condicional y aviso de ruta no verificada. |
| Evaluación | `rag-golden-v4.json` (134 casos) el 2026-11-25: 134/134 y todas las metas cumplidas (p95 54 ms). Regresión v2 con `--sources`: 59/59. V3 queda congelado con 123/125 por p-20 y p-30, dos expectativas obsoletas de falsos positivos léxicos. |

Consecuencias:

- El corpus de desarrollo contiene 14 fuentes y 132 fragmentos verificados.
- `rag-golden-v3.json` no se edita; las correcciones y los casos nuevos viven en v4.

## Addendum 2026-11-26 - guía turística V5

La V5 corrige respuestas tangenciales observadas en conversaciones reales sin cambiar la
respuesta extractiva con citas. La fuente canónica pasa a `FUENTES-RAG.md` v1.10.

| Tema | Decisión |
|---|---|
| Separación de conceptos | «ciudad» y «Coro» no son señales suficientes para atribuir un POI. «¿Qué es la ciudad?» responde sobre la ciudad; «¿Qué es la Ciudad Deportiva?» resuelve su ficha. |
| Preguntas compuestas | Se dividen hasta en tres subconsultas por «?», comas o conectores interrogativos. Cada parte resuelve su POI, recupera su evidencia y compone su texto en orden; una parte sin evidencia abstiene el conjunto. Las partes elípticas usan la selección de la pregunta completa. |
| Acceso | Ruta, estacionamiento, transporte, distancia y visitas nocturnas exigen evidencia del aspecto preguntado. Sin ella se abstienen con un mensaje específico. Una ficha de POI solo lleva el aviso de ruta no verificada; un dato de bus/avenida se etiqueta como acceso registrado. |
| Entidades no soportadas | «¿Qué es la Casa X?» sin POI resuelto y sin la palabra distintiva en la evidencia se abstiene; no se sustituye por otra ficha parecida. |
| Horarios y precios | El aviso genérico de datos no verificados se retira cuando la respuesta aporta horario/estado. Una pregunta de precio sin fuente usa un mensaje de precios, no de horarios. |
| Corpus | S-022 pasa a V3: corrige el mapa (filtro por categoría; geolocalización en check-in) y añade la Ruta del Casco Histórico como recomendación, no como navegación. |
| Evaluación | `rag-golden-v5.json` (146 casos) el 2026-11-26: 146/146, 0 fallos, `unmetTargets` vacío; sourceHit 0.92, citationValidity 1, p95 110 ms. V4 se conserva congelado; sus p-45/p-48 premiaban respuestas no sustentadas. |

Consecuencias:

- El corpus de evaluación contiene 14 fuentes y 133 fragmentos; la reingesta del corpus de
  desarrollo requiere un historiador activo que verifique los derechos de la S-022 V3.
- El asistente técnico sigue cerrado; la ruta es una recomendación con paradas, sin cálculo
  de calles ni navegación giro a giro.
- `rag-golden-v4.json` no se edita; las expectativas corregidas y los casos nuevos viven en v5.

## Alternativas consideradas

- **Modelo generativo con proveedor externo en v1:** descartado por alcance, coste y riesgo de citas inventadas que no era necesario asumir.
- **Índice persistente del texto completo de documentos de UNESCO:** descartado mientras los derechos no estén resueltos.
- **Solicitar autorización a UNESCO:** no se adopta como vía de la v1 (decisión del responsable).
- **Búsqueda web en vivo para la guía turística:** diferido. En v1 se usan fuentes curadas y fechadas.
- **Usar Wikipedia como fuente final:** descartado. Solo se usa como puntero.
- **Incluir datos de inspección en el asistente técnico:** diferido a una decisión posterior, con control de acceso por recurso.

## Referencias

- Plan, §11 y §23.
- `FUENTES-RAG.md` v1.2 y `CORPUS-POI.md`.
- Términos de Uso de UNESCO, última actualización el 15/09/2026.
