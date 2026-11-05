---
name: webapp-testing
description: Diseña y ejecuta pruebas de aplicaciones web desde el navegador, cubriendo flujos de usuario y regresiones.
license: Apache-2.0 (upstream repository; confirm per skill directory)
compatibility: opencode
metadata:
  source: "anthropics/skills"
  curated-for: "implantacion-de-sistemas"
---

# Web Application Testing

## Cuándo usar
Para validar interfaces web, navegación, formularios, autenticación en entornos de prueba, accesibilidad funcional y flujos E2E.

## Procedimiento seguro
1. Identifica el framework, runner y configuración E2E existentes (por ejemplo Playwright o Cypress).
2. Usa primero el entorno local o de staging autorizado.
3. Define los flujos críticos y sus precondiciones.
4. Usa datos de prueba ficticios; no uses cuentas reales ni datos personales innecesarios.
5. Verifica estados de carga, éxito, error, validación, navegación y persistencia.
6. Captura evidencia mínima útil y evita incluir tokens, cookies o datos sensibles.
7. Limpia los datos de prueba creados cuando sea seguro.
8. Ejecuta regresiones pertinentes y reporta fallos reproducibles.

## Restricciones
- No ataques sitios de terceros ni realices pruebas intrusivas sin autorización y alcance explícitos.
- No desactives controles de seguridad para conseguir que pase una prueba.
- Si no existe runner, propone una estrategia; no afirmes que ejecutaste pruebas de navegador.
