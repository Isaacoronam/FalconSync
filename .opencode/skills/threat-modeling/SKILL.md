---
name: threat-modeling
description: Identifica activos, límites de confianza, amenazas, mitigaciones y riesgos de seguridad durante el diseño.
license: Project-authored adaptation; no upstream code copied
compatibility: opencode
metadata:
  source: "anthropics/skills (security-oriented skill pattern; adapted for project)"
  curated-for: "implantacion-de-sistemas"
---

# Threat Modeling — modelado de amenazas

## Cuándo usar
Al diseñar autenticación/autorización, APIs, manejo de archivos, pagos, datos sensibles, integraciones, infraestructura o cambios de límites de confianza.

## Procedimiento
1. Define alcance, arquitectura, actores y activos.
2. Dibuja flujos de datos y límites de confianza.
3. Identifica puntos de entrada, privilegios, dependencias y superficies expuestas.
4. Considera amenazas como suplantación, manipulación, repudio, divulgación, denegación de servicio y elevación de privilegios.
5. Evalúa probabilidad, impacto y evidencia.
6. Propón mitigaciones concretas y controles de detección.
7. Asigna riesgos residuales y preguntas pendientes.
8. Vincula cada mitigación con requerimientos y pruebas.

## Reglas
- No afirmes que un sistema es seguro por haber completado una lista.
- No ejecutes explotación activa sin autorización explícita.
- No reveles secretos ni datos personales en el modelo.
- Usa la Unidad 7 como fuente académica cuando esté disponible; separa ese contenido de marcos externos.
