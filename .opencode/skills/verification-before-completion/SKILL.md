---
name: verification-before-completion
description: Exige evidencia reciente antes de declarar una tarea, prueba o cambio como completado.
license: MIT (upstream repository; verify current license before upstream updates)
compatibility: opencode
metadata:
  source: "obra/superpowers"
  curated-for: "implantacion-de-sistemas"
---

# Verification Before Completion — verificar antes de concluir

## Cuándo usar
Antes de afirmar que una implementación, corrección, build, prueba, documentación o despliegue está terminado.

## Lista de verificación
1. Relaciona cada criterio de aceptación con una comprobación.
2. Ejecuta los comandos pertinentes en el estado actual del árbol de trabajo.
3. Lee la salida completa y el código de salida.
4. Comprueba que no se omitieron pruebas, warnings críticos ni fallos.
5. Inspecciona el diff para detectar cambios no solicitados, secretos o archivos accidentales.
6. Verifica que la documentación afectada esté actualizada.
7. Separa verificaciones ejecutadas de verificaciones pendientes.

## Lenguaje de estado
- “Verificado”: evidencia observada y reproducible.
- “Parcialmente verificado”: algunas comprobaciones pasaron y otras no se pudieron ejecutar.
- “Pendiente”: no se ejecutó la comprobación.
- Nunca uses “todo funciona” basándote únicamente en inspección visual o en que el agente terminó.

Incluye comandos, resultados y limitaciones en el resumen.
