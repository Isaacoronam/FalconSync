# ADR-007 — SLO, RPO/RTO, backups y rollback

| Campo | Valor |
|---|---|
| Estado | Propuesta |
| Fecha | 2026-11-13 |
| Decisores | Responsable del proyecto |
| Relacionados | [`../OPERACION.md`](../OPERACION.md), [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md) |

## Contexto

El plan debe definir disponibilidad, pérdida máxima de datos y tiempo de recuperación. Hoy
no hay staging, monitoreo ni restauración probada. El CI existe, pero no tiene ejecución
remota verde.

## Decisión

- Disponibilidad pública 99.5 % mensual; interna de inspección 99.0 % en horario de campo.
- RPO 1 h para base y evidencia; 24 h si el proveedor solo ofrece backup diario, compensado
  con versionado.
- RTO 4 h para servicio completo; 2 h para solo lectura.
- MTTR crítico 4 h.
- Backups 3-2-1, cifrados, con restauración probada antes del lanzamiento y tras cambios de
  esquema.
- RAG: p95 ≤ 2 s primera respuesta interna, ≤ 4 s con búsqueda externa, ≤ 8 s respuesta
  completa de hasta 500 tokens.
- Reporte: p95 ≤ 45 s con foto en 4G.
- GPS: 90 % de lecturas ≤ 10 m, con marcado de las peores.
- WCAG 2.2 AA y sin hallazgos críticos/altos abiertos.
- Rollback con imagen anterior, migraciones expand-contract y feature flags.

## Consecuencias

- Se necesita staging, monitoreo, alertas y simulacros.
- Las métricas se reportan con muestra, entorno, método y fecha.
- Si no se aprueba D-09, el RPO/RTO se revisa según la topología real.
- El CI remoto debe estar verde o existir una ejecución reproducible registrada.

## Alternativas consideradas

- Prometer “alta disponibilidad” sin número: se rechaza por no ser verificable.
- Backup diario sin probar restauración: se rechaza por riesgo de pérdida.
- Medir solo promedios: se rechaza porque oculta la cola.

## Referencias

- Plan, sección 14.
- Operación, secciones 2 a 3.
