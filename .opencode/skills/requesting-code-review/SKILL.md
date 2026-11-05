---
name: requesting-code-review
description: Solicita una revisión de código con alcance, contexto, criterios y formato de hallazgos claros.
license: MIT (upstream repository; verify current license before upstream updates)
compatibility: opencode
metadata:
  source: "obra/superpowers"
  curated-for: "implantacion-de-sistemas"
---

# Requesting Code Review — solicitar revisión de código

## Cuándo usar
Después de cambios sustanciales, antes de integrar una rama, cuando se modifican contratos/API, seguridad, persistencia o arquitectura.

## Preparación
1. Resume el objetivo del cambio y el comportamiento esperado.
2. Identifica el diff real y los archivos afectados.
3. Proporciona contexto de requisitos, arquitectura y riesgos.
4. Solicita revisar corrección, regresiones, seguridad, rendimiento, mantenibilidad y pruebas.
5. Pide hallazgos priorizados por severidad, con ubicación y evidencia.
6. Solicita distinguir defectos confirmados de sugerencias.

## Reglas
- El revisor debe ser independiente de la implementación cuando sea posible.
- No pidas aprobación genérica; define el alcance.
- No ocultes limitaciones ni pruebas que no se ejecutaron.
- El agente Auditor del proyecto puede aplicar este flujo en modo de solo lectura.
