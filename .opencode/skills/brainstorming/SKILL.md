---
name: brainstorming
description: Estructura el descubrimiento del problema y explora alternativas antes de diseñar una solución.
license: MIT (upstream repository; verify current license before upstream updates)
compatibility: opencode
metadata:
  source: "obra/superpowers"
  curated-for: "implantacion-de-sistemas"
---

# Brainstorming — descubrir y definir la solución

## Cuándo usar
Antes de diseñar una funcionalidad nueva, cambiar el comportamiento del sistema, crear un módulo, modificar arquitectura o resolver una necesidad ambigua.

## Procedimiento
1. Resume el objetivo en una frase y confirma qué problema real se quiere resolver.
2. Inspecciona el contexto existente: código, documentación, usuarios, restricciones y convenciones.
3. Separa hechos confirmados, supuestos, restricciones y preguntas abiertas.
4. Identifica actores, escenarios principales, escenarios alternativos y casos límite.
5. Propón como mínimo dos alternativas cuando existan decisiones arquitectónicas o funcionales relevantes.
6. Compara alternativas por valor, complejidad, riesgos, mantenibilidad, seguridad y compatibilidad.
7. Recomienda una alternativa y explica por qué.
8. Obtén confirmación antes de implementar cambios que alteren alcance o comportamiento.

## Entregable
Problema, objetivos, fuera de alcance, actores, escenarios, alternativas, recomendación, riesgos, preguntas y criterios de aceptación.

## Reglas
- No conviertas supuestos en requisitos.
- No diseñes antes de comprender el problema.
- Consulta la base académica en `.opencode/knowledge/` cuando aplique; distingue su contenido de buenas prácticas generales.
- No modifiques archivos durante una fase de descubrimiento salvo que el usuario lo solicite expresamente.
