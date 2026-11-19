# Registro de decisiones arquitectónicas — FALCONSYNC

| Campo | Valor |
|---|---|
| Fecha | 2026-11-17 |
| Estado | D-01 a D-17 aceptadas (D-09 a D-17 aprobadas el 2026-11-13); D-03 revisada el 2026-11-17; D-18 a D-20 y D-22 a D-23 pendientes; D-21 retirada; D-24 propuesta |
| Documentos relacionados | [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md), [`../REQUISITOS.md`](../REQUISITOS.md), [`../RBAC.md`](../RBAC.md) |

## Estados

- **Aceptada:** decisión vigente y aplicable.
- **Propuesta:** requiere aprobación antes de implementar.
- **Pendiente:** depende de un tercero, presupuesto o entorno.
- **Rechazada:** se conserva para trazabilidad.

## Índice de ADR

| ADR | Tema | Estado |
|---|---|---|
| [ADR-001](./ADR-001-separacion-dominio.md) | Separación entre POI, activo, reporte, inspección, hallazgo e intervención | Aceptada por el plan |
| [ADR-002](./ADR-002-roles-capacidades.md) | Roles por capacidades y migración expand-contract | Propuesta; backend y UI de Fase 2 implementados |
| [ADR-003](./ADR-003-evidencia-auditoria.md) | Evidencia privada y auditoría obligatoria | Propuesta |
| [ADR-004](./ADR-004-tiempo-real.md) | Socket.IO, ticket y notificaciones persistidas | Aceptada; diseño propuesto |
| [ADR-005](./ADR-005-rag-fuentes.md) | RAG con fuentes verificadas, citas y abstención | Aceptada (revisada 2026-11-17): RAG v1 sin proveedor externo y con respuesta extractiva |
| [ADR-006](./ADR-006-visita-360.md) | Visita 360° obligatoria con derechos y fallback | Aceptada; contenido pendiente |
| [ADR-007](./ADR-007-operacion-slo.md) | SLO, RPO/RTO, backups y rollback | Propuesta |

## Diseño de Fase 1

Los siguientes documentos desarrollan las decisiones anteriores. Son propuestas de diseño,
no implementación:

| Documento | Contenido |
|---|---|
| [`../MODELO-DATOS.md`](../MODELO-DATOS.md) | ER, diccionario, estados, invariantes, índices y proyección. |
| [`../CASOS-USO.md`](../CASOS-USO.md) | Casos, secuencias, errores y matriz de pruebas. |
| [`../openapi.yaml`](../openapi.yaml) | Contrato HTTP con estado `implemented`/`planned`. |
| [`../EVENTOS-TIEMPO-REAL.md`](../EVENTOS-TIEMPO-REAL.md) | Ticket, salas, eventos, cursor y reconexión. |
| [`../WIREFRAMES.md`](../WIREFRAMES.md) | Rutas, pantallas, estados y accesibilidad. |
| [`../360.md`](../360.md) | Derechos, visor, hotspots, fallback y pruebas 360°. |

## Registro de decisiones

| ID | Decisión | Estado | Consecuencia principal |
|---|---|---|---|
| D-01 | La visita 360° es obligatoria. | Aceptada | Modelo `Panorama`, derechos y visor entran en el alcance. |
| D-02 | Socket.IO es requisito duro. | Aceptada | Refactor de servidor, ticket y salas server-side. |
| D-03 | RAG sin proveedor externo en v1 (recuperación léxica y respuesta con citas); UNESCO 100777 es fuente histórica, no estado actual. | Aceptada (revisada 2026-11-17) | Respuesta extractiva con citas; materiales de UNESCO por curación; etiqueta `Histórico 2008`. |
| D-04 | Para POI no UNESCO se permite búsqueda externa etiquetada. | Aceptada | Guía turística con niveles D/E; asistente técnico no. |
| D-05 | Los reportes son solo para usuarios autenticados. | Aceptada | `report.create` exige sesión. |
| D-06 | El cierre exige intervención verificada. | Aceptada | Máquina de estados y verificación por otra persona. |
| D-07 | La marca pública es FALCONSYNC. | Aceptada | Tokens, textos y metadatos con esa marca. |
| D-08 | SLO, RPO y RTO quedan a criterio del plan. | Aceptada | Se congelan en Fase 0. |
| D-09 | MongoDB con replica set de un nodo en CI, staging y producción. | Aceptada | Permite transacciones; si se rechaza, se usan agregados embebidos e idempotencia. |
| D-10 | Evidencia privada con streaming autenticado; nunca en `/api/uploads`. | Aceptada | Hash, acceso auditado y retención. |
| D-11 | Socket.IO para notificaciones; el chat puede usar HTTP/SSE. | Aceptada | Menor acoplamiento y escalado separado. |
| D-12 | RAG léxico con filtros como línea base; vectores tras evaluación. | Aceptada | No se asume búsqueda vectorial en MongoDB local. |
| D-13 | `/admin` para sistema; `/inspecciones` para conservación. | Aceptada | Separación de capacidades y navegación. |
| D-14 | `user` es el rol de sistema; “Turista” es su etiqueta. | Aceptada | No se crea rol `tourist`. |
| D-15 | El admin no es inspector implícito. | Aceptada | `break-glass` excepcional y auditado. |
| D-16 | `asset.manage` para inspector y admin; admin no inspecciona. | Aceptada | Inventario separado de la inspección. |
| D-17 | La identidad del reportante es visible a inspector/revisor, nunca pública. | Aceptada | Privacidad y triaje. |
| D-18 | Audio y multilingüe son condicionales. | Pendiente | Si se confirman, entran en Fases 0, 1 y 6. |
| D-19 | Hosting, dominio, TLS y región. | Pendiente | Bloquea Fase 9. |
| D-20 | Instancia única o clúster con Redis. | Pendiente | Define Socket.IO y escalado. |
| D-21 | Proveedor RAG, presupuesto y tratamiento de datos. | Retirada (2026-11-17) | No aplica en v1: RAG sin proveedor externo. |
| D-22 | Herramienta de monitoreo y alertas. | Pendiente | Bloquea observabilidad de Fase 9. |
| D-23 | Retención de evidencia y conversaciones. | Pendiente | Afecta privacidad y almacenamiento. |
| D-24 | Clasificación patrimonial explícita de POI (`patrimonialStatus`). | Propuesta | Evita tratar POI turísticos como patrimonio y reemplaza la etiqueta `unesco` sin verificación. |

## Regla de cambio

Una decisión aceptada solo se cambia con un ADR nuevo que indique:

1. la decisión anterior y su motivo;
2. el contexto del cambio;
3. el impacto en requisitos, datos, API, pruebas y operación;
4. la fecha y el responsable de la aprobación.
