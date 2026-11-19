# Guía de contribución

¡Gracias por colaborar con FalconSync! Este repositorio sigue un flujo de trabajo ordenado para mantener el código estable, revisable y consistente con la estrategia del proyecto.

## 1. Flujo de trabajo

Se recomienda seguir GitFlow básico con tres niveles de ramas:

- `main`: versión estable y lista para entrega.
- `develop`: rama de integración donde se unen los cambios.
- `feature/*`, `fix/*`, `docs/*`, `chore/*`: ramas de trabajo temporales.

### Convención de nombres

- `feature/nombre-de-la-funcionalidad`
- `fix/correccion-de-bug`
- `docs/actualizacion-documentacion`
- `chore/configuracion-o-mantenimiento`

Ejemplos:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/panel-admin-poi
```

## 2. Mensajes de commit

Usa Conventional Commits en minúsculas y con el tipo correcto:

- `feat:` para nuevas funcionalidades
- `fix:` para correcciones
- `docs:` para documentación
- `chore:` para mantenimiento o configuración
- `refactor:` para mejoras internas de código

Ejemplos:

```bash
git commit -m "feat: agregar login con JWT"
git commit -m "fix: corregir validacion de geocerca"
git commit -m "docs: actualizar README del proyecto"
```

## 3. Proceso recomendado

1. Actualiza tu rama base:

```bash
git checkout develop
git pull origin develop
```

2. Crea una rama de trabajo:

```bash
git checkout -b feature/tu-tarea
```

3. Desarrolla cambios pequeños y coherentes.
4. Ejecuta validaciones relevantes antes de hacer push.
5. Haz commit siguiendo el estándar establecido.
6. Sube la rama:

```bash
git push origin feature/tu-tarea
```

7. Abre un Pull Request hacia `develop`.
8. Espera revisión y aprobación antes de fusionar.

## 4. Revisión y calidad

Antes de enviar cambios, revisa lo siguiente:

- El código es coherente con la funcionalidad que se está entregando.
- No se incluyen archivos sensibles o locales de entorno (`.env`, uploads temporales, etc.).
- Los cambios están documentados cuando corresponden.
- El comportamiento de backend y frontend queda verificado.

### Validaciones sugeridas

```bash
npm run test:backend
npm run test:frontend
npm run build
npm run e2e
```

Si la tarea es de documentación o configuración, ajusta la validación según el alcance del cambio.

## 5. Pull requests

Los PR deben incluir:

- Descripción clara del cambio
- Objetivo y contexto del problema
- Validaciones ejecutadas
- Capturas si hay cambios visuales relevantes

### Título sugerido

Usa un formato como:

```text
[FEAT] Agregar catálogo público de POI
[FIX] Corregir geocerca en check-in
[DOCS] Actualizar guía de contribución
```

## 6. Reglas básicas

- No hagas push directo a `main` o `develop`.
- No mezcles cambios no relacionados en un mismo commit.
- Mantén el historial limpio y legible.
- Revisa el diff antes de confirmar cambios.
- Si haces cambios de infraestructura, documenta su impacto.

## 7. Checklist antes de abrir un PR

- [ ] La rama está basada en `develop`
- [ ] Los cambios son consistentes con el objetivo
- [ ] Los commits tienen mensajes claros
- [ ] Se ejecutaron validaciones relevantes
- [ ] No se subieron credenciales ni archivos temporales
- [ ] La documentación fue actualizada si aplica

## 8. Agradecimientos

Gracias por mantener FalconSync ordenado, mantenible y fácil de evolucionar. Un flujo claro de contribución ayuda a todos a trabajar con más seguridad y calidad.
