# Paquete definitivo — Agentes + Skills para OpenCode

## Instalación

1. Haz una copia de seguridad de tu proyecto o confirma que está bajo Git.
2. Descomprime este ZIP directamente en la **raíz del proyecto OpenCode** (la carpeta donde está `opencode.json`, si ya existe).
3. Si Windows pregunta si deseas combinar carpetas, acepta. Si pregunta por reemplazar `AGENTS.md` o archivos de agentes que provengan del paquete anterior que te entregué, puedes reemplazarlos por estas versiones consolidadas.
4. **Este paquete no contiene `opencode.json` intencionalmente**: así no sobrescribe la configuración que ya tengas para modelos, proveedores, MCP, permisos u otras opciones.
5. Reinicia OpenCode desde la raíz del proyecto.

## Qué instala

- `AGENTS.md`: instrucciones compartidas para Build, Plan y los especialistas.
- `.opencode/agents/`: 10 subagentes especialistas, incluyendo Auditor.
- `.opencode/skills/`: 13 skills locales cargables bajo demanda.
- `.opencode/knowledge/`: estructura de conocimiento para las Unidades 2 a 7, con plantillas y marcadores pendientes.

## Estructura

```text
tu-proyecto/
├── AGENTS.md
├── opencode.json                 # se conserva, no viene en este ZIP
└── .opencode/
    ├── agents/
    │   ├── unidad-02-analisis.md
    │   ├── unidad-02-diseno.md
    │   ├── unidad-02-arquitectura.md
    │   ├── unidad-02-modelado.md
    │   ├── unidad-03-desarrollo.md
    │   ├── unidad-04-pruebas.md
    │   ├── unidad-05-documentacion.md
    │   ├── unidad-06-despliegue.md
    │   ├── unidad-07-soporte-seguridad.md
    │   └── auditor.md
    ├── skills/
    │   └── [13 skills, cada una con SKILL.md]
    └── knowledge/
        ├── unidad-02.md ... unidad-07.md
        ├── fuentes/
        └── plantillas/

```

## Agentes disponibles

Build y Plan son agentes primarios integrados de OpenCode. Los 10 agentes personalizados son subagentes y se pueden invocar por `@nombre` o delegar desde los primarios.

- `unidad-02-analisis`
- `unidad-02-diseno`
- `unidad-02-arquitectura`
- `unidad-02-modelado`
- `unidad-03-desarrollo`
- `unidad-04-pruebas`
- `unidad-05-documentacion`
- `unidad-06-despliegue`
- `unidad-07-soporte-seguridad`
- `auditor`

Los especialistas están configurados para no iniciar otros subagentes. Auditor es de solo lectura: no puede editar ni ejecutar comandos de shell.

## Skills disponibles

`brainstorming`, `writing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `webapp-testing`, `web-design-guidelines`, `vercel-react-best-practices`, `skill-authoring`, `threat-modeling`, `documentation-as-code`, `deployment-readiness`.

## Verificación

Desde la raíz del proyecto:

```bash
opencode agent list
```

Comprueba que aparecen los 10 agentes personalizados. Las skills se descubren en `.opencode/skills/<nombre>/SKILL.md` y se cargan bajo demanda.

Si tus permisos existentes en `opencode.json` bloquean la herramienta `task` o `skill`, OpenCode puede impedir la delegación o la carga de skills. Este paquete no cambia esos permisos para no sobrescribir tu configuración.

## Importante sobre el material académico

Los archivos `unidad-02.md` a `unidad-07.md` siguen siendo marcadores de preparación, no transcripciones completas. Coloca los documentos originales de las Unidades 2 a 7 en `.opencode/knowledge/fuentes/` y completa los archivos a partir de ellos. La Unidad 1 no fue proporcionada y no se inventa.
