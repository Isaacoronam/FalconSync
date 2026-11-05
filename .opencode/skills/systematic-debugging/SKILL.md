---
name: systematic-debugging
description: Investiga defectos de forma sistemática, buscando causa raíz antes de aplicar correcciones.
license: MIT (upstream repository; verify current license before upstream updates)
compatibility: opencode
metadata:
  source: "obra/superpowers"
  curated-for: "implantacion-de-sistemas"
---

# Systematic Debugging — depuración sistemática

## Cuándo usar
Ante errores, regresiones, fallos de pruebas, comportamiento inesperado, problemas de integración o rendimiento.

## Procedimiento
1. Reproduce el problema y registra el entorno, pasos, entradas y resultado observado.
2. Lee el error completo, logs y trazas relevantes; no ocultes la primera causa.
3. Formula hipótesis comprobables y ordénalas por evidencia.
4. Aísla variables: compara el último estado correcto, entradas, configuración y dependencias.
5. Diseña el experimento más pequeño que discrimine entre hipótesis.
6. Identifica la causa raíz antes de editar.
7. Implementa la corrección mínima.
8. Añade una prueba de regresión cuando sea posible.
9. Ejecuta pruebas relevantes y revisa efectos colaterales.

## Reglas
- No hagas cambios aleatorios ni múltiples cambios no relacionados.
- No borres datos ni modifiques producción para experimentar.
- Protege secretos en logs y capturas.
- Si no puedes reproducir, informa exactamente qué evidencia falta.
