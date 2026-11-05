---
name: test-driven-development
description: Aplica un ciclo de pruebas primero, implementación mínima y refactorización para cambios de software.
license: MIT (upstream repository; verify current license before upstream updates)
compatibility: opencode
metadata:
  source: "obra/superpowers"
  curated-for: "implantacion-de-sistemas"
---

# Test-Driven Development (TDD)

## Cuándo usar
Para lógica de negocio, validaciones, servicios, funciones, endpoints y correcciones reproducibles donde las pruebas automatizadas sean viables.

## Ciclo RED-GREEN-REFACTOR
1. RED: escribe una prueba pequeña que exprese el comportamiento esperado.
2. Ejecuta la prueba y confirma que falla por la razón correcta.
3. GREEN: implementa el cambio mínimo para que pase.
4. Ejecuta la prueba y confirma que pasa.
5. REFACTOR: mejora el diseño sin cambiar el comportamiento.
6. Ejecuta de nuevo las pruebas relevantes.

## Reglas
- No escribas una prueba que pase antes del cambio y la presentes como evidencia del nuevo comportamiento.
- No debilites o elimines pruebas para hacer que el conjunto pase.
- Usa nombres que describan comportamiento observable.
- Incluye casos límite y escenarios negativos.
- Si el proyecto no tiene infraestructura de pruebas, informa la limitación y propone cómo establecerla antes de fingir TDD.
- Registra comandos y resultados reales.
