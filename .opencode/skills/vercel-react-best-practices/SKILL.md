---
name: vercel-react-best-practices
description: Aplica patrones de rendimiento y composición para proyectos que realmente usan React o Next.js.
license: MIT (upstream repository; verify current license before upstream updates)
compatibility: opencode
metadata:
  source: "vercel-labs/agent-skills"
  curated-for: "implantacion-de-sistemas"
---

# React Best Practices

## Cuándo usar
Solo si el repositorio usa React o Next.js. Primero confirma dependencias y versión.

## Revisión orientativa
- Evita waterfalls de datos; paraleliza operaciones independientes.
- Mantén límites cliente/servidor claros en Next.js.
- Reduce renders y trabajo innecesario; mide antes de optimizar.
- Evita pasar grandes estructuras si basta con datos acotados.
- Usa carga diferida cuando reduzca trabajo inicial real.
- Mantén componentes enfocados y composición clara.
- Revisa estabilidad de keys, estado derivado y efectos.
- Considera accesibilidad y manejo de errores además del rendimiento.

## Reglas
No apliques recomendaciones específicas de React a proyectos que no usan React. No cambies arquitectura ni añadas librerías sin evidencia y aprobación. Prioriza mediciones y perfilado del proyecto.
