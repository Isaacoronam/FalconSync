# Skills curadas para OpenCode — Implantación de Sistemas

Este paquete instala skills locales en `.opencode/skills/`. Las skills son instrucciones cargadas bajo demanda por OpenCode; no son plugins ejecutables.

## Skills incluidas

| Skill | Uso principal | Agentes recomendados |
|---|---|---|
| brainstorming | Descubrimiento y alternativas | Plan, unidad-02-analisis, unidad-02-diseno |
| writing-plans | Planes verificables | Plan, Build |
| test-driven-development | Desarrollo guiado por pruebas | unidad-03-desarrollo, unidad-04-pruebas |
| systematic-debugging | Causa raíz y corrección | unidad-03-desarrollo, unidad-04-pruebas |
| verification-before-completion | Verificación antes de cerrar | Build, unidad-04-pruebas, auditor |
| requesting-code-review | Revisión independiente | Build, auditor |
| webapp-testing | Pruebas E2E de web | unidad-04-pruebas |
| web-design-guidelines | UX, accesibilidad y responsive | unidad-02-diseno, Build |
| vercel-react-best-practices | Rendimiento React/Next.js | unidad-02-arquitectura, unidad-03-desarrollo |
| skill-authoring | Crear y evaluar skills | Plan, Build, auditor |
| threat-modeling | Análisis de amenazas | unidad-07-soporte-seguridad, unidad-02-arquitectura, auditor |
| documentation-as-code | Documentación alineada con código | unidad-05-documentacion |
| deployment-readiness | Preparación de despliegue | unidad-06-despliegue, unidad-07-soporte-seguridad |

## Criterio de selección y seguridad

- Se priorizaron repositorios conocidos y skills con uso significativo en skills.sh: `obra/superpowers`, `anthropics/skills` y `vercel-labs/agent-skills`.
- La popularidad y las insignias de auditoría publicadas por skills.sh son señales, no garantías de seguridad ni calidad.
- En la revisión del 4 de noviembre de 2026, `test-driven-development` de `obra/superpowers` mostraba Pass en Gen Agent Trust Hub, Socket y Snyk; `systematic-debugging` mostraba Warn en Gen Agent Trust Hub y Pass en Socket/Snyk. `webapp-testing` de Anthropic mostraba Pass en Gen Agent Trust Hub y Warn en Socket/Snyk. `web-design-guidelines` de Vercel mostraba Pass en Gen Agent Trust Hub y Snyk, y Warn en Socket. Estos resultados pueden cambiar y no equivalen a una certificación.
- Este paquete contiene únicamente archivos Markdown `SKILL.md`: no incluye scripts, binarios, dependencias, hooks ni comandos de instalación automática. Por eso no incorpora los scripts auxiliares del `webapp-testing` original; la skill incluida describe un flujo seguro que aprovecha el runner ya instalado en tu proyecto.
- Las skills son adaptaciones de instrucciones inspiradas en workflows públicos de `obra/superpowers`, `anthropics/skills` y `vercel-labs/agent-skills`; no son copias byte a byte ni se presentan como versiones oficiales de esos autores.
- `threat-modeling`, `documentation-as-code` y `deployment-readiness` son skills escritas para este proyecto.
- `vercel-react-best-practices` solo debe usarse si el repositorio utiliza React/Next.js.
- Revisa el contenido y el repositorio upstream antes de actualizar o instalar futuras skills. Nunca confíes solo en el ranking.

## Instalación

1. Descomprime el ZIP en la raíz del proyecto.
2. Copia o combina la carpeta `.opencode/skills/` dentro de la carpeta `.opencode/` de tu proyecto.
3. No reemplaces carpetas o archivos existentes sin revisar sus diferencias.
4. Reinicia OpenCode o inicia una nueva sesión y comprueba que las skills aparecen en la lista de skills disponibles.
5. Pide a un agente que use una skill explícitamente con `@nombre-de-skill` o que invoque la herramienta `skill` cuando proceda.

## Importante

OpenCode busca las skills de proyecto en `.opencode/skills/<nombre>/SKILL.md`. No deben colocarse en `.opencode/agents/`.

## Aplicación FalconSync

Este repositorio también contiene la aplicación:

- `falcon-sync-backend/`: API REST con Express 5.3, Mongoose 9.12, autenticación JWT,
  CRUD de POI, aventuras, paradas, QR, check-in con geocerca, perfil privado, avatar, fotos
  de check-in, imágenes locales y auditoría.
- `falcon-sync-frontend/`: Angular 21 con Leaflet 1.9.4, autenticación, panel administrativo
  completo para POI, perfil privado y suite E2E permanente con Playwright.
- `docs/FALCONSYNC.md`: alcance, comandos, fuentes de datos, verificación y pendientes.
- `docs/AUTENTICACION.md`: modelo de sesión, roles, cookies y límites de seguridad.
- `docs/ADMINISTRACION.md`: CRUD de POI, borrado lógico, imágenes y auditoría.
- `docs/POI.md`: catálogo, reglas de publicación, fuentes y créditos de imágenes.
- `docs/AVENTURAS.md`: modelo de aventuras, QR opaco, geocercas, check-in y progreso.
- `docs/PERFIL.md`: perfil privado, avatar, foto de check-in y seed de aventura.
- `.github/workflows/ci.yml`: workflow de pruebas, build y E2E (creado, aún no ejecutado en
  remoto).

El arranque verificado usa MongoDB 9.0.4 local, backend en `http://localhost:3000` y
frontend en `http://localhost:4200`. La suite E2E usa una base `falconsync_e2e` y los
puertos 3101/4201.
