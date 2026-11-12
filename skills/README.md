# Skills locales

Las skills ejecutables se conservan en
[`.opencode/skills/`](../.opencode/skills/) porque esa es la ubicación que descubre
OpenCode. Este directorio es el punto de entrada de la estructura del repositorio; no
duplicar aquí los archivos `SKILL.md`.

## Mapa de skills por especialista

Las asignaciones en `.opencode/agents/*.md` permiten solo las skills listadas para cada
agente (las demás quedan denegadas).

| Agente | Skills permitidas |
|---|---|
| `auditor` | `requesting-code-review`, `verification-before-completion`, `threat-modeling`, `documentation-as-code`, `deployment-readiness` |
| `unidad-02-analisis` | `brainstorming`, `writing-plans` |
| `unidad-02-arquitectura` | `brainstorming`, `writing-plans`, `threat-modeling`, `backend-architecture-crud` |
| `unidad-02-diseno` | `brainstorming`, `writing-plans`, `web-design-guidelines` |
| `unidad-02-modelado` | `brainstorming`, `writing-plans`, `documentation-as-code`, `backend-architecture-crud` |
| `unidad-03-desarrollo` | `writing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `documentation-as-code`, `backend-architecture-crud`, `angular-spa`, `authentication-security`, `api-validation-security`, `error-handling-human-ux`, `mobile-kotlin-android`, `external-integrations` |
| `unidad-04-pruebas` | `webapp-testing`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `api-validation-security` |
| `unidad-05-documentacion` | `documentation-as-code`, `verification-before-completion` |
| `unidad-06-despliegue` | `deployment-readiness`, `verification-before-completion`, `systematic-debugging` |
| `unidad-07-soporte-seguridad` | `threat-modeling`, `authentication-security`, `api-validation-security`, `systematic-debugging`, `deployment-readiness` |

## Skills de producto derivadas del kit del profesor

- `backend-architecture-crud`: capas Express/Mongoose existentes, validación y pruebas.
- `angular-spa`: patrones comprobados de Angular 21, Leaflet, Vitest y Playwright.
- `authentication-security`: JWT, refresh, roles y origen confiable ya implementados.
- `api-validation-security`: validación, autorización, subida y separación de archivos.
- `error-handling-human-ux`: errores API/UX conforme a los patrones del proyecto.
- `mobile-kotlin-android`: orientación para una app futura, no una capacidad implementada.
- `external-integrations`: solo para conectores aprobados; no hay uno activo por defecto.

El kit se adaptó según evidencia real en
[`context/unefa-starter-kit-adaptation.md`](../context/unefa-starter-kit-adaptation.md).
`web-design-guidelines`, `webapp-testing` y `deployment-readiness` cubren las áreas de UX,
pruebas y despliegue que el starter kit planteaba sin material operativo suficiente.
