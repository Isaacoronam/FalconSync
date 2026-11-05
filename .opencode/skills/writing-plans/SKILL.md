---
name: writing-plans
description: Convierte requisitos y decisiones aprobadas en un plan de implementación pequeño, ordenado y verificable.
license: MIT (upstream repository; verify current license before upstream updates)
compatibility: opencode
metadata:
  source: "obra/superpowers"
  curated-for: "implantacion-de-sistemas"
---

# Writing Plans — plan de implementación

## Cuándo usar
Cuando una tarea requiere varios pasos, archivos, dependencias, agentes o pruebas.

## Procedimiento
1. Define el resultado y criterios de aceptación.
2. Enumera archivos/módulos que probablemente se verán afectados; verifica rutas antes de afirmarlas.
3. Divide el trabajo en tareas pequeñas, secuenciales y comprobables.
4. Identifica dependencias y qué tareas pueden ejecutarse en paralelo.
5. Asigna cada tarea al especialista adecuado: análisis/diseño/modelado, desarrollo, pruebas, documentación, despliegue o seguridad.
6. Incluye pruebas específicas y comandos disponibles en el proyecto.
7. Identifica riesgos, migraciones, compatibilidad y puntos que requieren aprobación.
8. Presenta el plan antes de ejecutar si el cambio es sustancial.

## Formato
- Objetivo y alcance
- Supuestos y restricciones
- Tareas numeradas con resultado esperado
- Agente responsable
- Archivos previstos
- Pruebas/verificaciones
- Riesgos y decisiones pendientes

No inventes rutas ni afirmes que un comando existe sin comprobar el proyecto.
