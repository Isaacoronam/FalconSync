---
name: documentation-as-code
description: Mantiene README, documentación técnica, diagramas, contratos y changelog alineados con el código.
license: Project-authored
compatibility: opencode
metadata:
  source: "Project-authored skill based on engineering practice"
  curated-for: "implantacion-de-sistemas"
---

# Documentation as Code

## Cuándo usar
Cuando un cambio afecta instalación, configuración, API, arquitectura, modelo de datos, operación, despliegue o comportamiento visible.

## Procedimiento
1. Identifica qué documentación existente describe el área modificada.
2. Compara la documentación con el comportamiento actual del código.
3. Actualiza instrucciones de instalación, variables de entorno (sin valores secretos), ejemplos y diagramas.
4. Mantén ejemplos ejecutables o marca claramente los fragmentos ilustrativos.
5. Registra cambios relevantes en changelog si el proyecto lo utiliza.
6. Comprueba enlaces, nombres de archivos y comandos.
7. Pide revisión cuando la documentación describa contratos o políticas de seguridad.

No inventes funcionalidades ni documentes una propuesta como si ya estuviera implementada.
