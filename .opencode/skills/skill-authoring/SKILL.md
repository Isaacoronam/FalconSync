---
name: skill-authoring
description: Crea, evalúa y mantiene skills pequeñas, específicas, comprobables y compatibles con OpenCode.
license: Apache-2.0 (upstream repository; confirm per skill directory)
compatibility: opencode
metadata:
  source: "anthropics/skills"
  curated-for: "implantacion-de-sistemas"
---

# Skill Authoring — creación y mantenimiento de skills

## Cuándo usar
Al crear una nueva skill para este proyecto, modificar una existente o evaluar una skill de terceros.

## Diseño
1. Define una tarea concreta y cuándo debe activarse.
2. Mantén `SKILL.md` centrado en un flujo repetible, no en una enciclopedia.
3. Incluye entradas necesarias, pasos, criterios de salida y límites de seguridad.
4. Mueve referencias extensas a archivos complementarios cuando sea útil.
5. Usa nombres minúsculos con guiones y metadatos `name` y `description`.
6. Evita scripts salvo necesidad real; si existen, inspecciona cada línea y explica permisos, entradas y efectos.
7. Prueba la skill con escenarios normales, ambiguos y adversariales.
8. Revisa que no instruya a ignorar políticas, exfiltrar datos, ejecutar comandos ocultos o revelar secretos.

## Evaluación
Una skill se acepta solo si su alcance es claro, sus instrucciones son verificables, no contradice `AGENTS.md` y no incluye cargas ejecutables inesperadas.
