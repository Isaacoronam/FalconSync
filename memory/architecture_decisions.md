# Decisiones arquitectónicas registradas

## Estructura obligatoria del repositorio

Decisión del 18 de noviembre de 2026. Se adopta la estructura obligatoria definida por el responsable del proyecto y documentada en `AGENTS.md` y en este archivo. No existe un `ESTRUCTURA_PROYECTO.md` versionado; su contenido se consolidó aquí. Sustituye a la decisión anterior «Estructura por proyectos», que conservaba las estructuras internas para evitar reescrituras.

Estructura resultante:

- Raíz: `AGENTS.md`, `context/` (`system_context.md`, `business_rules.md`, `api_contracts.md`), `skills/`, `memory/` (`architecture_decisions.md`, `error_solutions.md`) y `projects/`.
- Backend: `api/` (`auth`, `users`, `uploads`, `adventures`, `check-ins`, `locations`, `conservation`, `evidence`, `admin`), `assets/`, `bin/server.js`, `databases/`, `helpers/`, `logs/`, `microservices/`, `middlewares/`, `public/`, `scripts/`, `seeders/`, `uploads/` (`images/`, `documents/`, `apks/`), `.env.example`, `ecosystem.config.cjs`, `index.js` y `package.json`.
- Frontend: `src/app/{components,pages,services,models}` y `src/assets/`.
- Mobile: `src/{screens,components,services,models}` y `package.json`.

Criterios:

- Las rutas HTTP, los montajes `/api/...` y las URLs públicas no cambian. Los datos de MongoDB que guardan URLs (`/api/uploads/...`, `/images/locations/...`) siguen siendo válidos.
- `api/<módulo>/` agrupa rutas y controladores. `microservices/` es la capa de servicios de negocio e infraestructura; el proyecto sigue siendo un monolito modular, sin procesos separados. El nombre se conserva por la especificación.
- `databases/` contiene la conexión (`db.js`) y los modelos Mongoose (`models/`). `helpers/` agrupa configuración (`env.js`, `falcon.js`) y utilidades puras.
- `index.js` construye la aplicación Express y `bin/server.js` la pone a escuchar. Las pruebas importan `index.js`.
- Almacenamiento: `uploads/images/` es público (`UPLOAD_DIR`) y solo se sirve estáticamente en `/api/uploads`. `uploads/documents/` es privado (`UPLOAD_PRIVATE_DIR`): avatares, fotos de check-in y evidencia, entregados solo por endpoints autenticados.
- Las rutas por defecto de `uploads/` se calculan desde la raíz del backend, no desde el directorio de arranque.
- El arranque falla si `UPLOAD_PRIVATE_DIR` está dentro de `UPLOAD_DIR` o es igual a ella. El guard vive en `helpers/env.js` y lo cubre `test/uploads.test.js`; evita publicar evidencia y datos personales por el estático de `/api/uploads`.
- Las imágenes de POI del frontend viven en `src/assets/images/locations/` y se publican en la misma URL `/images/locations/`.

Excepciones (fuera de la especificación; necesarias para herramientas o convenciones):

- Raíz: `docs/` (documentación ampliada, según `AGENTS.md`), `.github/` (CI), `.opencode/` (agentes, skills y conocimiento de OpenCode), `.git`, `.gitignore`, `.editorconfig`, `.nvmrc`, `package.json` (scripts `npm run verify` y similares), `README.md` y `CONTRIBUTING.md`.
- Backend: `test/` (pruebas de `node --test`), `package-lock.json` y `README.md` del proyecto.
- Frontend: `e2e/`, `scripts/` (iconos de marca), `src/environments/`, `src/styles/`, los archivos de arranque `src/main.ts` e `src/index.html`, los archivos raíz `src/app/app.{ts,html,scss,spec.ts,config.ts,routes.ts}`, el `README.md` del proyecto y la configuración de Angular, TypeScript, Prettier y Playwright.
- Mobile: `README.md` del esqueleto y `.gitkeep` de las carpetas reservadas.

Registro de decisiones (ADR): el detalle vive en `docs/ADR/`, con su índice en `docs/ADR/README.md`. Este archivo resume las decisiones que afectan a la estructura y enlaza al ADR correspondiente cuando exista.

Consecuencias:

- `ecosystem.config.cjs` permite ejecutar la API con PM2 en producción. PM2 no es una dependencia del proyecto.
- `projects/mobile/package.json` existe solo para cumplir la estructura. No declara dependencias, scripts ni configuración de compilación.
- Un `.env` local que conserve `UPLOAD_DIR=./uploads` o `UPLOAD_PRIVATE_DIR=./uploads-private` de una versión anterior debe cambiarse a `./uploads/images` y `./uploads/documents`, o eliminar esas claves para usar los valores por defecto.

## Skills de agentes

Las skills ejecutables permanecen en `.opencode/skills/`, que es la ruta de descubrimiento configurada en `AGENTS.md`. `skills/README.md` funciona como índice, no como copia de las skills.

## Aplicación móvil

La app móvil se plantea como Android/Kotlin en la idea del producto. El repositorio contiene solo el esqueleto de carpetas y un `package.json` mínimo (ver la decisión de estructura). No se declara una app compilable hasta definir su configuración Android, sus dependencias y su integración con la API.

## Adaptación del UNEFA AI Starter Kit

Se adoptó la separación entre contexto, reglas, contratos, skills y memoria. Las tecnologías y procedimientos de ejemplo no se tratan como arquitectura actual: no se incorporaron Socket.IO, `express-fileupload`, Bootstrap, endpoints de APK ni Angular 22. PM2 aparece solo como configuración opcional de despliegue (`ecosystem.config.cjs`), exigida por la estructura obligatoria. La matriz de evidencia y decisiones está en [`memory/unefa-starter-kit-adaptation.md`](./unefa-starter-kit-adaptation.md). Se movió desde `context/` para que ese directorio contenga solo el contexto del sistema, las reglas de negocio y los contratos HTTP.

## Integración continua

Decisión del 19 de noviembre de 2026 (T1). El workflow `.github/workflows/ci.yml` se ejecuta en push y pull request a `develop`, `main` y `master`, además de `workflow_dispatch`. Un solo job ejecuta, en orden: `npm ci` y `npm audit --omit=dev` del backend, pruebas del backend, `npm ci` y `npm audit --omit=dev` del frontend, pruebas del frontend, build de producción, Chromium y E2E.

Criterios:

- MongoDB se inicia como replica set de un nodo con `mongo:9.0 --replSet falconsyncTest --bind_ip_all` y `rs.initiate()`, porque conservación, evidencia y E2E usan transacciones. El workflow espera `isWritablePrimary` antes de continuar.
- Se publica el mismo `mongod` en `27017` y `27018`: las suites que no usan transacciones apuntan al primer puerto y conservación, evidencia y E2E al segundo. No se define `MONGODB_URI_TEST` global para no colapsar todas las suites en una sola base.
- `CI` se define como cadena (`'true'`) para evitar la coerción booleana de YAML; Playwright lo usa para elegir Chromium, reintentos y reporte GitHub.
- El reporte de Playwright y `test-results` se publican como artefacto solo si el job falla, con retención de 7 días. El contenedor de Mongo se elimina con `if: always()`.
- La ejecución remota no se declara verde hasta que exista una corrida autorizada en GitHub. La copia limpia local y `rs.initiate()` en un replica set desechable son evidencia de reproducibilidad, no de CI remoto.
