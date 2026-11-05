---
name: deployment-readiness
description: Evalúa la preparación de una versión para desplegarse, con controles de entorno, rollback, observabilidad y recuperación.
license: Project-authored
compatibility: opencode
metadata:
  source: "Project-authored skill based on engineering practice"
  curated-for: "implantacion-de-sistemas"
---

# Deployment Readiness

## Cuándo usar
Antes de preparar un release, despliegue a staging/producción o cambio de infraestructura.

## Lista de comprobación
- Build reproducible y artefactos identificados.
- Configuración por entorno documentada; secretos fuera del repositorio.
- Migraciones revisadas y plan de reversión.
- Health checks y observabilidad disponibles.
- Logs sin credenciales ni datos sensibles.
- Pruebas críticas ejecutadas.
- Dependencias y vulnerabilidades conocidas evaluadas.
- Estrategia de despliegue y rollback definida.
- Copias de seguridad y recuperación consideradas cuando hay datos persistentes.
- Responsables, ventana y criterios de éxito/abortado definidos.

No ejecutes despliegues ni operaciones destructivas sin autorización explícita. Marca cada punto como verificado, pendiente, no aplicable o bloqueado.
