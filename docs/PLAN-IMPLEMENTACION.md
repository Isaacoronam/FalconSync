# Plan de implementación — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.4 |
| Fecha | 2026-11-19 |
| Estado | Ejecutable; T0 verificado y T1 preparado con reproducción local; ejecución remota pendiente de autorización |
| Base verificada | Árbol local sobre `36631af` (`fix/ci-seed-adventures-test`), con la estructura obligatoria del 2026-11-18 sin commit |
| Alcance | Web FALCONSYNC; la app móvil nativa queda fuera |
| Autoridad | Revisión de ingeniería + decisiones cerradas por el responsable del proyecto |

> Este documento no atribuye sus decisiones a las Unidades 2–7. La correspondencia
> metodológica con esas unidades se declara en la sección 20. Las metas numéricas son
> propuestas verificables, no hechos ya medidos.

## 0. Estado de ejecución

| Fecha | Hito | Evidencia |
|---|---|---|
| 2026-11-13 | Baseline re-verificado en esta sesión | `npm run verify`: 79/79 backend, 52/52 frontend, build correcto, 16/16 E2E |
| 2026-11-13 | Fase 0 documental creada | `docs/REQUISITOS.md`, `docs/RBAC.md`, `docs/FUENTES-RAG.md`, `docs/SEGURIDAD.md`, `docs/OPERACION.md`, `docs/ADR/` |
| 2026-11-13 | Deriva documental corregida | Cifras de `docs/` alineadas con el baseline real |
| 2026-11-13 | Fase 2 backend de roles | `historian` e `inspector` en el enum; endpoints de rol, estado y revocación; scripts `migrate:roles`/`verify:roles`; suite `roles.test.js` |
| 2026-11-13 | Fase 2 UI de cuentas | Diálogo de rol, estado y revocación con reautenticación; E2E `admin-users.spec.ts`; verificación completa 89/89 backend, 53/53 frontend y 17/17 E2E Chromium |
| 2026-11-13 | Fase 1 documental creada | `docs/MODELO-DATOS.md`, `docs/CASOS-USO.md`, `docs/EVENTOS-TIEMPO-REAL.md`, `docs/openapi.yaml`, `docs/WIREFRAMES.md` y `docs/360.md`; YAML válido con `js-yaml`; OpenAPI válido con Redocly (2 advertencias no bloqueantes) |
| Pendiente | Revisión y aprobación integral del diseño de Fase 1 | D-09 a D-17 están aprobadas; el contrato restante y las decisiones FD-* siguen pendientes. El backend existente es parcial y debe reconciliarse con el contrato |
| Pendiente | Migración de datos de `moderator` a `historian` | Requiere backup, dry-run revisado y autorización; no se ejecutó |
| Pendiente | Aprobación de D-18 a D-20 y D-22; D-23 parcial; decisiones FD-* y alcance de audio/idiomas (D-21 retirada en v1; D-24 a D-29 aceptadas el 2026-11-20) | Bloquea las partes dependientes de derechos, retención de evidencia y operación |
| Pendiente | CI remoto verde | Requiere autorización para publicar rama/PR |
| 2026-11-13 | Autorización backend | `requireAnyCapability`, permisos por recurso, auditoría de solo metadatos y revisor asignado implementados; 4/4 pruebas unitarias aprobadas; integración bloqueada por MongoDB replica set no disponible en `127.0.0.1:27018` |
| 2026-11-15 | Replica set local operativo | `mongod` en `127.0.0.1:27018` con `replicaSet=falconsyncTest` verificado como `PRIMARY`; desbloquea conservación y evidencia |
| 2026-11-15 | Bug de bandeja de inspecciones corregido | `listInspectionsController` pasaba argumentos incompatibles y producía 403; `conservation.test.js` 2/2 |
| 2026-11-15 | Evidencia privada implementada | Modelos, servicio, rutas, almacenamiento privado, validación con `sharp`, eliminación de EXIF, SHA-256, idempotencia, acceso auditado y retención; `evidence.test.js` 2/2 y backend completo 98/98 |
| 2026-11-15 | Baseline re-verificado | Backend 100/100, frontend 53/53, build correcto; E2E 19/19 en Edge local |
| 2026-11-15 | UI de conservación implementada | Rutas `/reportes`, `/reportes/:id`, `/inspecciones` e `/inspecciones/:id`; triaje, conversión, hallazgos, evidencia, intervenciones, revisión y cierre; `conservation.spec.ts` 2/2 con flujo vertical y denegaciones/IDOR |
| 2026-11-17 | RAG v1 sin proveedor y corpus de POI | `docs/FUENTES-RAG.md` v1.1, `docs/CORPUS-POI.md`, ADR-005 revisado, D-03 revisada, D-21 retirada; fuentes oficiales y de historia verificadas; contradicciones de Wikipedia documentadas |
| 2026-11-18 | T0 estructura verificada | `npm run verify`: 110/110 backend (14 suites), 53/53 frontend, build correcto y 19/19 E2E; `structure.test.js` y `uploads.test.js`; 0 registros con `storageKey` en `uploads-private/` |
| 2026-11-19 | T1 CI preparado y reproducido en copia limpia | `.github/workflows/ci.yml` dispara en `develop`, `main` y `master`; inicia `mongo:9.0` con `--replSet falconsyncTest` y `rs.initiate()`, publica el mismo `mongod` en `27017` y `27018` y ejecuta auditorías, pruebas, build y E2E. Copia limpia sin `.env` ni `node_modules`: 110/110 backend, 53/53 frontend, build, 19/19 E2E con `CI=1` y 0 vulnerabilidades de producción. El paso Docker no se ejecutó localmente (no hay Docker); `rs.initiate()` se validó en un replica set desechable. GitHub Actions no se ejecutó |
| 2026-11-20 | Fase 0 RAG cerrada | ADR-005 con addendum; D-24 a D-29 aceptadas; `FUENTES-RAG.md` v1.2; S-08, UC-14 y UC-15 sin proveedor; RF-60 diferido; modelo y contrato alineados. Sin cambios de código ni pruebas de ejecución |
| 2026-11-20 | Primer núcleo backend del chatbot RAG | Modelos de fuente/fragmento y conversación/mensaje; búsqueda léxica, citas extractivas, abstención, RBAC técnico, TTL de 90 días y cierre por defecto hasta evaluación. `assistant.test.js`: 7/7. Ingesta CLI, corpus, UI y evaluación dorada pendientes |
| 2026-11-23 | Guía turística V2 cerrada | Recuperación semántica local (embeddings multilingües) con `questions` curadas en S-002/S-003; resolución de POI sin selector con regla de dominancia; abstenciones por lugar no publicado, texto libre y año sin evidencia; citas una por fuente. Evaluación v2: 59/59 y `unmetTargets` vacío (`docs/evaluacion-rag/rag-v2-2026-11-23.json`). `npm run verify`: 149/149 backend, 89/89 frontend, build correcto y 21/21 E2E (incluye el nuevo `e2e/guia.spec.ts`). Base de desarrollo 27018 reconstruida (24 POI, 3 fuentes, 26 fragmentos) |
| 2026-11-24 | Guía turística V3 cerrada | S-021/S-022 aprobadas y activas; corpus expandido a 14 fuentes y 131 fragmentos (S-024 blog adobe/tapia y S-025 ficha técnica nivel C; S-026–S-029 y S-032 resúmenes propios de Wikipedia/Wikivoyage nivel D; S-030 horario del MUCOR nivel A y S-031 horario de misas nivel C); preguntas compuestas con sub-consultas, evidencia por parte y hasta 3 citas; patrones de «estado Falcón», precio-vs-horario y adobe cultural. Evaluación v3: 125/125 y `unmetTargets` vacío (`docs/evaluacion-rag/rag-v3-2026-11-24.json`); regresión v2 con `--sources`: 59/59. `npm run verify`: 156/156 backend, 89/89 frontend, build correcto y 21/21 E2E |
| Pendiente | Antimalware y retención definitiva | Producción bloquea cargas de evidencia con `503 EVIDENCE_SCAN_UNAVAILABLE` hasta desplegar escaneo |

**Revisión de estado:** el árbol local contiene la estructura obligatoria del 2026-11-18 y
los avances de conservación, evidencia y autorización sin commit. T0 se verificó el
2026-11-18 con `npm run verify` sobre el replica set local: 110/110 backend, 53/53 frontend,
build correcto y 19/19 E2E. T1 se preparó el 2026-11-19: el workflow ya usa un replica set,
dispara en `develop` y se reprodujo en una copia limpia con 110/110 backend, 53/53 frontend,
build y 19/19 E2E con `CI=1`. El paso Docker de Mongo y GitHub Actions no se ejecutaron
localmente; la publicación de la rama/PR sigue pendiente de autorización (A2). El
2026-11-23 se reprodujo `npm run verify` completo sobre el replica set local: 149/149
backend, 89/89 frontend, build correcto y 21/21 E2E; la guía turística V2 quedó cerrada
con la evaluación dorada en `unmetTargets` vacío. No se desplegó nada.

## 1. Objetivo

Convertir FALCONSYNC en una plataforma de conservación patrimonial trazable, con:

- separación estricta entre POI turístico, activo patrimonial, reporte, inspección, hallazgo
  e intervención;
- roles y capacidades aplicados en el servidor;
- evidencia privada con hash, acceso auditado y retención;
- flujo vertical reportar → triar → inspeccionar → hallar → intervenir → cerrar;
- notificaciones en tiempo real con Socket.IO;
- asistente RAG con fuentes autorizadas, citas y abstención;
- visita 360° obligatoria;
- identidad visual accesible y operación con backups, monitoreo y rollback probados.

## 2. Alcance y exclusiones

### Incluido

- Dominio de conservación y su API.
- Roles `historian` e `inspector`, migración desde `moderator` y administración de cuentas.
- Evidencia privada y auditoría obligatoria para transiciones críticas.
- Socket.IO para notificaciones y actualizaciones de inspección.
- RAG sin proveedor externo en v1 (recuperación léxica y respuesta con citas), corpus controlado y dos asistentes: técnico y turístico.
- Visita 360° con derechos, hotspots, fallback y accesibilidad.
- UI pública, consola de inspección separada de `/admin`, y tokens visuales.
- Pruebas, piloto, despliegue y operación.

### Excluido

- App Android nativa de campo (`projects/mobile/`).
- Funcionamiento offline prometido desde navegador móvil.
- Reservas, pagos, ventas o inventario turístico.
- Scraping de redes sociales.
- Diagnósticos automáticos por IA o acciones de escritura ejecutadas por el asistente.

### Condicional

- Audioguías y contenido multilingüe: obligatoriedad no cerrada. Si se confirman, entran en
  las fases 0, 1 y 6 con derechos, transcripciones y fallback.
- Almacenamiento vectorial: se decide en la puerta de fase 5; el MongoDB local actual no
  acredita búsqueda vectorial.

## 3. Baseline verificado

Verificación vigente de T0, ejecutada el 2026-11-18 sobre la estructura obligatoria y el árbol
de trabajo actual, y reproducción de T1 en una copia limpia el 2026-11-19. La copia de T1
excluyó `.env`, `node_modules` y datos de ejecución. El baseline anterior (2026-11-15) era
100/100 backend, 53/53 frontend y 19/19 E2E; la tabla histórica de deriva conserva las cifras
de su momento.

| Verificación | Comando | Resultado real |
|---|---|---|
| Backend | `npm --prefix projects/backend test` | **110/110 aprobadas**, 14 suites, 0 fallos, 82.56 s |
| Frontend | `npm --prefix projects/frontend run test -- --watch=false` | **53/53 aprobadas**, 12 archivos, 9.85 s |
| Build | `npm --prefix projects/frontend run build` | Correcto, 16.47 s |
| E2E | `npm --prefix projects/frontend run e2e` | **19/19 aprobadas**, 2.8 min, Edge local (suite completa dentro de `npm run verify`) |
| Estructura | `test/structure.test.js` | 5/5: sin `src/` en backend; sin `core/`, `features/` ni `public/` en frontend; `api/` solo con módulos aprobados |
| Almacenamiento | `test/uploads.test.js` | 5/5: privado 404 en `/api/uploads`; guard impide arrancar con carpetas solapadas o `documents/` dentro del público |
| Node | `node -v` | v26.13.0 |
| MongoDB local | `mongod --version` | v9.0.4; replica set de un nodo en `127.0.0.1:27018` (`replicaSet=falconsyncTest`), usado por defecto por conservación, evidencia y E2E; el standalone en `127.0.0.1:27017` no sirve para esas suites |
| Auditoría de dependencias | `npm audit --omit=dev` en backend y frontend | 0 vulnerabilidades en la copia limpia (2026-11-19); `npm ci` del frontend informa 16 moderadas solo en dependencias de desarrollo |
| CI local reproducible | Copia limpia + `CI=1` | `npm ci` en backend y frontend; 110/110 backend, 53/53 frontend, build correcto y 19/19 E2E en Chromium; el contenedor Docker de Mongo no se ejecutó porque la máquina local no tiene Docker |
| CI remoto | No verificado | Sin evidencia de ejecución remota; requiere publicar rama/PR (A2) |

### Deriva documental detectada y corregida

Estado previo a la corrección P0-03, ejecutada el 2026-11-13. Se conserva como evidencia de
la diferencia; las cifras de la columna “Afirma” ya no están vigentes en esos documentos.

| Documento | Afirmaba | Real verificado |
|---|---|---|
| `docs/FALCONSYNC.md` | 75/75 backend; 51/51 frontend; 15/15 E2E en un pasaje | 79/79; 52/52; 16/16 |
| `docs/AUTENTICACION.md` | 67 backend; 15 E2E | 79/79; 16/16 |
| `docs/AVENTURAS.md` | 75/75 | 79/79 |
| `docs/PERFIL.md` | 75/75 | 79/79 |
| `docs/POI.md` | 75/75 | 79/79 |
| `docs/ADMINISTRACION.md` | 79/79; 16/16 Edge local; CI pendiente | Coincide con la realidad |

**Estado:** P0-03 completada el 2026-11-13. Las cifras de `docs/` se alinearon con el
baseline real; esta tabla se conserva como evidencia histórica de la deriva.

### Hechos estructurales confirmados

- Hay 23 POI, pero no son 23 edificaciones: el catálogo mezcla edificios, monumentos,
  espacios urbanos, museos, comercio y naturaleza.
- El enum de roles es `user`, `moderator` (legacy temporal), `historian`, `inspector` y
  `admin`; solo `user`, `historian`, `inspector` y `admin` son asignables desde la API.
- `moderator` no tiene rutas propias. La API administrativa y la interfaz de usuarios ya
  cambian rol, estado y revocan sesiones con reautenticación.
- El árbol local ya incluye el dominio backend de conservación: modelos `HeritageAsset`,
  `Report`, `Inspection`, `Intervention`, `Evidence`, `EvidenceAccessLog` y `DomainEvent`;
  hallazgos embebidos en inspecciones; rutas montadas en `/api`; triaje, conversión,
  inspección, revisión, intervención, evidencia y cierre con eventos y control de versión.
  La bandeja de inspecciones fue corregida el 2026-11-15. El flujo vertical está cubierto por
  pruebas de backend y E2E, y la UI vive en `projects/frontend/src/app/pages/conservation/`.
- La evidencia privada ya tiene modelos, rutas `/api/evidence`, almacenamiento fuera del
  prefijo público, validación de contenido, eliminación de EXIF, hash SHA-256, idempotencia,
  autorización por recurso, registro append-only de accesos y retención configurable. La
  consulta de accesos está en `/api/admin/evidence/:id/access-log`.
- No se encontraron en el backend notificaciones, Socket.IO ni RAG. La UI de reportes e
  inspecciones existe en `projects/frontend/src/app/pages/conservation/` y está cubierta por
  `e2e/conservation.spec.ts`.
- La visita 360° ya tiene modelo `Panorama`, original privado, derivados con `sharp`, API
  pública y administrativa, visor WebGL propio con fallback, flujo editorial separado y
  pruebas. No hay panorámicas reales con derechos verificados; la galería pública queda vacía
  y no se publicará contenido sintético.
- `Intervention` exige evidencia para completar o verificar; con la carga y consulta ya
  implementadas, el camino puede terminar y cerrar hallazgos que requieren intervención.
- Las rutas de conservación usan `requireAnyCapability`; los servicios comprueban propietario,
  asignación de inspector/revisor y ejecutor. Admin solo accede a proyecciones de auditoría,
  sin descripción del reporte, alcance, hallazgos ni intervenciones. `break_glass` no concede
  acceso hasta que exista su flujo auditado.
- La conversión de reportes exige un `HeritageAsset`; un reporte vinculado solo a un POI no
  puede convertirse hasta que se asocie a un activo patrimonial válido.
- Los servicios de conservación y evidencia requieren transacciones MongoDB. El baseline
  local usa el replica set de un nodo en `127.0.0.1:27018`; el E2E también lo usa por
  defecto (`mongodb://127.0.0.1:27018/falconsync_e2e?replicaSet=falconsyncTest`). El
  workflow de CI ya usa un replica set y publica el mismo `mongod` en `27017`/`27018`; la
  ejecución remota sigue pendiente de autorización.
- `Location.conservationStatus` existe con `good/fair/poor/unknown`; los 23 POI están en
  `unknown`. El campo solo se actualiza mediante inspección revisada y el payload
  administrativo lo rechaza.
- `AuditLog` sigue siendo best-effort por defecto; las transiciones críticas de roles usan
  `recordAudit({ required: true })` y compensan el cambio si la auditoría falla
  (`projects/backend/microservices/auditService.js`). Las transiciones de conservación usan
  `DomainEvent` dentro de la misma transacción.
- `index.js` exporta la app construida con `createApp()` y `bin/server.js` la pone a
  escuchar; las pruebas importan `index.js`.
- El CI usa `mongo:9.0` como replica set; no acredita búsqueda vectorial.
- El almacenamiento público `/api/uploads` y el privado `uploads/documents/` ya están
  separados; la evidencia de inspección no debe reutilizar el prefijo público.

## 4. Decisiones cerradas

| ID | Decisión |
|---|---|
| D-01 | La visita 360° es obligatoria. |
| D-02 | Socket.IO es requisito duro. |
| D-03 | RAG sin proveedor externo en v1 (recuperación léxica y respuesta con citas). El documento UNESCO 100777 es fuente histórica, no estado actual. |
| D-04 | Para POI no UNESCO se permite búsqueda externa con etiqueta de confianza. |
| D-05 | Los reportes son solo para usuarios autenticados. |
| D-06 | El cierre exige intervención verificada. |
| D-07 | La marca pública es FALCONSYNC. |
| D-08 | SLO, RPO y RTO quedan a criterio de este plan; se congelan en la puerta de fase 0. |

### Decisiones propuestas para aprobación en fase 0

| ID | Propuesta | Motivo |
|---|---|---|
| D-09 | MongoDB con replica set de un nodo en CI, staging y producción; standalone solo en desarrollo local sin garantías transaccionales. | Permite transacciones para cierre, eventos y evidencia; el CI anterior standalone no las ofrecía y ya se migró a replica set. Si no se aprueba, el diseño usa agregados embebidos e idempotencia y no promete atomicidad multi-documento. |
| D-10 | Evidencia en almacenamiento privado con streaming autenticado; nunca bajo `/api/uploads`. | Evita exposición pública y permite registro de accesos. |
| D-11 | Socket.IO para notificaciones; el chat puede usar HTTP/SSE y no comparte obligatoriamente transporte. | Reduce acoplamiento y permite escalar por separado. |
| D-12 | RAG léxico con filtros de metadatos como línea base; vectores solo tras evaluación y elección de almacén (Atlas, Qdrant u otro). | No se asume búsqueda vectorial en MongoDB local. |
| D-13 | `/admin` queda para cuentas, roles, configuración y auditoría; la consola de inspección vive en `/inspecciones`. | Separa capacidades y evita ampliar el panel administrativo. |
| D-14 | `user` es el rol de sistema; “Turista” es su etiqueta visible. No se crea un rol `tourist`. | Evita duplicar identidad y permisos. |
| D-15 | El administrador no es inspector implícito. Cualquier excepción será `break-glass` con motivo, aprobación y auditoría. | Principio de menor privilegio. |

**Aprobación registrada:** D-09 a D-17 fueron aprobadas por el propietario el 2026-11-13.
D-18 a D-20 y D-22 a D-23 siguen pendientes; D-21 se retiró en v1 (2026-11-17). Esta aprobación no autoriza migrar datos, contratar servicios,
incurrir en gastos, publicar cambios ni desplegar.

## 5. Arquitectura del dominio

### 5.1 Separación de conceptos

| Concepto | Función | Regla clave |
|---|---|---|
| `Location` | POI público y ficha turística | No es la fuente de verdad técnica. |
| `HeritageAsset` | Edificación o unidad patrimonial inspeccionable | Enlaza opcionalmente con `Location`; no todo POI es una edificación. |
| `Report` | Aviso recibido, aún no verificado | No es diagnóstico; se conserva aunque se convierta en inspección. |
| `Inspection` | Actuación de un inspector | Tiene estados, responsable, fechas y alcance propios. |
| `Finding` | Daño observado en una inspección | Distingue severidad propuesta de severidad confirmada. |
| `Intervention` | Obra o acción de conservación | Solo una intervención verificada permite cerrar un hallazgo que la requiera. |
| `Evidence` | Foto o documento | Privada, con hash, autor, fecha, precisión y acceso auditado. |
| `DomainEvent` | Hecho inmutable del dominio | Actor, fecha, estado anterior, estado nuevo y motivo. |
| `Notification` | Aviso persistido para un usuario | `eventId` único, cursor, estado leído y deduplicación. |

### 5.2 Máquinas de estado

**Report**

```text
received -> triaged -> accepted -> converted
                    -> rejected
                    -> closed (duplicado o sin acción)
```

- `converted` exige `inspectionId`.
- Un reporte cerrado o rechazado conserva su historial y evidencias.
- Un reporte abierto se muestra en la consola interna, nunca modifica el estado público de
  conservación.

**Inspection**

```text
planned -> in_progress -> submitted -> reviewed -> closed
                       ^          |
                       |          v
                       +------ returned
planned -> cancelled
```

- `submitted` exige al menos un hallazgo o una declaración explícita de “sin hallazgos”.
- `reviewed` exige revisor distinto del inspector que envió, salvo excepción auditada.
- `closed` exige que todo hallazgo con `requiresIntervention=true` tenga una intervención
  `verified`; los hallazgos sin intervención requieren justificación y revisión.
- El cierre es idempotente y versionado con `version` (concurrencia optimista).

**Finding**

```text
proposed -> confirmed -> resolved
         -> discarded
confirmed -> reopened -> confirmed
```

- `severityProposed` la fija el inspector; `severityConfirmed` solo la fija el revisor.
- `resolved` solo se alcanza con intervención verificada o cierre justificado.

**Intervention**

```text
proposed -> approved -> in_progress -> completed -> verified
                    -> rejected
```

- `verified` exige verificador distinto del ejecutor y evidencia.
- Una intervención rechazada no cuenta para el cierre.

**Evidence**

```text
uploaded -> pending_scan -> available
                        -> quarantined
available -> superseded | deleted (lógico, con retención)
```

### 5.3 Estado de conservación público

`Location.conservationStatus` deja de editarse desde el formulario de POI. Se calcula como
proyección de la **última inspección cerrada y revisada** del `HeritageAsset` enlazado:

| Resultado de inspección | Proyección pública |
|---|---|
| Buen estado | `good` |
| Estado regular | `fair` |
| Estado deficiente | `poor` |
| Sin inspección revisada | `unknown` + “Sin inspección verificada” |

- Un reporte abierto no cambia la proyección.
- La ficha pública muestra la fecha de la última inspección revisada y el enlace a su resumen.
- La administración no puede forzar el estado sin una inspección revisada; una corrección
  excepcional requiere evento, motivo y auditoría.

## 6. Roles y capacidades

### 6.1 Matriz rol × capacidad

| Capacidad | user / Turista | historian | inspector | admin |
|---|---:|---:|---:|---:|
| Crear y leer sus propios reportes | Sí | Sí | Sí | Sí |
| Ver reportes de terceros | No | No | Sí | Solo auditoría |
| Triar y convertir reportes | No | No | Sí | No |
| Crear y ejecutar inspecciones | No | No | Sí | No |
| Confirmar hallazgos y severidad | No | No | Sí, con revisión | No |
| Ver evidencia de inspección | No | No | Solo asignadas | Solo auditoría |
| Crear y verificar intervenciones | No | No | Verificar, no ejecutar | No |
| Editar historia, fuentes y contenido editorial | No | Sí | No | No |
| Revisar contenido editorial | No | Sí | No | No |
| Gestionar cuentas, roles y estado | No | No | No | Sí |
| Configuración no secreta y auditoría | No | No | No | Sí |
| Asistente turístico | Sí | Sí | Sí | Sí |
| Asistente técnico | No | Consulta | Sí | No |
| `break-glass` de inspección | No | No | No | Excepcional, con motivo y aprobación |

Reglas:

- `moderator` se mantiene temporalmente durante la migración, sin capacidades nuevas.
- La autorización se aplica en el servidor; el guard de Angular solo mejora la experiencia.
- Todo cambio de rol o estado revoca sesiones (`tokenVersion++`) y se audita.
- El último administrador activo no puede degradarse ni desactivarse.
- Un administrador no puede autodegradarse.
- Los cambios sensibles exigen reautenticación con contraseña actual.

### 6.2 Migración expand-contract

1. **Expand**: añadir `historian` e `inspector` al enum; mantener `moderator`.
2. Desplegar código que entienda ambos esquemas, sin otorgar capacidades nuevas a
   `moderator`.
3. Simular, respaldar y contar cuentas afectadas.
4. Convertir `moderator` a `historian` con revisión explícita; revocar sesiones.
5. Verificar cero `moderator` restantes.
6. **Contract**: retirar `moderator` del enum en una liberación posterior.

No se migra `RefreshSession`: el rol vive en `User`. Sí se actualizan `User`, autenticación,
administración, `authService.isModerator`, contadores, filtros, etiquetas, pruebas y
documentación.

## 7. Modelo de datos planificado

Convenciones existentes que se conservan: Mongoose 9, ESM, `timestamps`, `versionKey: false`,
`toJSON` sin campos privados, borrado lógico donde ya existe e índices explícitos.

| Colección | Campos clave | Índices / reglas |
|---|---|---|
| `HeritageAsset` | `code`, `name`, `type`, `locationId?`, `unescoStatus`, `protectionLevel`, `address`, `geometry`, `status`, `createdBy` | `code` único; `locationId`; `type + status`; `unescoStatus` |
| `Report` | `reporterId`, `heritageAssetId?`, `locationId?`, `category`, `description`, `capturedAt`, `gps`, `state`, `triage`, `inspectionId?`, `rejectionReason`, `version` | `state + createdAt`; `reporterId + createdAt`; `inspectionId` |
| `Inspection` | `assetId`, `reportId?`, `inspectorId`, `reviewerId?`, `type`, `state`, `scope`, `findings[]`, `history[]`, fechas, `version` | `assetId + state`; `inspectorId + state`; `state + scheduledAt`; `version` |
| `Finding` | Subdocumento de `Inspection`: `findingId`, `category`, `description`, `severityProposed`, `severityConfirmed`, `requiresIntervention`, `state`, `evidenceIds[]` | `findingId` único dentro de la inspección; severidad validada |
| `Intervention` | `inspectionId`, `findingIds[]`, `type`, `description`, `executor`, `state`, `completedAt`, `verifiedBy`, `verifiedAt`, `evidenceIds[]` | `inspectionId + state`; `findingIds`; verificador ≠ ejecutor |
| `Evidence` | `ownerType`, `ownerId`, `storageKey`, `sha256`, `mimeType`, `bytes`, `capturedAt`, `gps?`, `accuracyMeters?`, `uploadedBy`, `scanStatus`, `exifStripped`, `retentionUntil`, `version` | `sha256`; `ownerType + ownerId`; `scanStatus`; retención |
| `EvidenceAccessLog` | `evidenceId`, `actorId`, `action`, `ip`, `userAgent`, `purpose`, `createdAt` | `evidenceId + createdAt`; solo append |
| `DomainEvent` | `eventId`, `aggregateType`, `aggregateId`, `eventType`, `actorId`, `occurredAt`, `fromState`, `toState`, `reason`, `payload`, `correlationId` | `eventId` único; `aggregateType + aggregateId + occurredAt`; sin update/delete |
| `Notification` | `userId`, `eventId`, `type`, `payload`, `cursor`, `readAt`, `createdAt` | `eventId` único; `userId + cursor`; `userId + readAt` |
| `SourceDocument` | `title`, `institution`, `version`, `publicationDate`, `retrievedAt`, `pages`, `license`, `rights`, `accessLevel`, `checksum`, `storageKey`, `status`, `supersedes` | `checksum` único; `status`; `accessLevel` |
| `SourceChunk` | `documentId`, `ordinal`, `page`, `section`, `text`, `tokens`, `checksum`, `embedding?` | `documentId + ordinal`; `page`; texto completo o vector según almacén |
| `Conversation` | `userId?`, `assistant`, `startedAt`, `lastMessageAt`, `retentionUntil` | `userId + startedAt`; TTL de retención |
| `Message` | `conversationId`, `role`, `content`, `citations[]`, `createdAt`, `model`, `latencyMs` | `conversationId + createdAt` |
| `Panorama` | `assetId?`, `locationId?`, `title`, `description`, `imageKey`, `derivativeKey`, `thumbnailKey`, `projection`, `width`, `height`, `checksum`, `derivativeChecksum`, `thumbnailChecksum`, `bytes`, `license`, `licenseUrl`, `author`, `credit`, `capturedAt`, `status`, `visibility`, `hotspots[]`, `fallback`, `rights*`, `consent*`, `version` | `assetId`; `locationId`; `status + visibility`; `version` |
| `AudioGuide` (condicional) | `assetId`, `language`, `audioKey`, `transcript`, `durationSeconds`, `license`, `status` | `assetId + language` |

Reglas transversales:

- `DomainEvent` y `EvidenceAccessLog` son append-only; no hay endpoints de modificación.
- Las transiciones críticas incrementan `version` y usan `If-Match` o `expectedVersion`.
- Los identificadores públicos son `id`; no se exponen hashes, tokens ni claves internas.
- Las evidencias se referencian por ID; nunca por URL pública.

## 8. API prevista

Se conservan las rutas actuales. Las nuevas rutas se montan en `createApp()` y comparten
`authenticate`, capacidades, rate limit y manejo de errores existente.

| Método y ruta | Capacidad | Uso |
|---|---|---|
| `POST /api/reports` | autenticado | Crear reporte con evidencia opcional. |
| `GET /api/reports/mine` | autenticado | Ver reportes propios. |
| `GET /api/reports/:id` | dueño o inspector | Detalle con historial. |
| `PATCH /api/reports/:id/triage` | inspector | Aceptar, rechazar o cerrar. |
| `POST /api/reports/:id/convert` | inspector | Crear inspección y enlazar. |
| `GET /api/inspections` | inspector/admin auditor | Bandeja por estado y asignación. |
| `POST /api/inspections` | inspector | Crear inspección planificada. |
| `GET /api/inspections/:id` | inspector asignado/admin auditor | Detalle, hallazgos e historial. |
| `POST /api/inspections/:id/start` | inspector asignado | Iniciar. |
| `POST /api/inspections/:id/submit` | inspector asignado | Enviar a revisión. |
| `POST /api/inspections/:id/review` | revisor | Revisar y confirmar severidad. |
| `POST /api/inspections/:id/close` | revisor | Cerrar con intervención verificada. |
| `POST /api/inspections/:id/findings` | inspector asignado | Añadir hallazgo propuesto. |
| `PATCH /api/inspections/:id/findings/:findingId` | inspector/revisor | Confirmar, descartar o reabrir. |
| `POST /api/interventions` | inspector | Proponer intervención. |
| `POST /api/interventions/:id/verify` | inspector distinto | Verificar intervención. |
| `POST /api/evidence` | autenticado con alcance | Subir evidencia privada. |
| `GET /api/evidence/:id` | autorizado por recurso | Descargar con registro de acceso. |
| `GET /api/notifications` | autenticado | Listar y recuperar por cursor. |
| `POST /api/notifications/:id/read` | dueño | Marcar leída. |
| `POST /api/realtime/ticket` | autenticado | Ticket de corta duración para Socket.IO. |
| `POST /api/assistant/tourist/query` | público con rate limit | Guía turística con citas. |
| `POST /api/assistant/inspection/query` | inspector | Asistente técnico con citas. |
| `GET /api/panoramas` | público | Panoramas publicados. |
| `GET /api/panoramas/:id` | público | Escena, hotspots y créditos. |
| `GET /api/panoramas/:id/image`, `/:id/thumbnail` | público | Derivados verificados por checksum. |
| `GET/POST /api/admin/panoramas` | `panorama.manage` / `panorama.publish` | Inventario; alta multipart con `panorama.manage`. |
| `GET/PATCH /api/admin/panoramas/:id` | `panorama.manage` / `panorama.publish` | Detalle y edición con `If-Match`. |
| `GET /api/admin/panoramas/:id/image`, `/:id/thumbnail` | `panorama.manage` / `panorama.publish` | Derivados autenticados. |
| `POST /api/admin/panoramas/:id/{approve,publish,archive}` | `panorama.publish` (público) / `panorama.manage` (inspección) | Transiciones con `If-Match`. |
| `PATCH /api/admin/users/:id/role` | admin | Cambiar rol con reautenticación. |
| `PATCH /api/admin/users/:id/status` | admin | Activar/desactivar con protecciones. |
| `POST /api/admin/users/:id/revoke-sessions` | admin | Revocar sesiones. |
| `GET /api/admin/sources` | admin | Registro de fuentes RAG. |

Anexos obligatorios de fase 1: `docs/openapi.yaml` y ejemplos de error con códigos estables
(`VALIDATION_ERROR`, `FORBIDDEN`, `INVALID_TRANSITION`, `EVIDENCE_QUARANTINED`,
`LAST_ADMIN_PROTECTED`, etc.).

## 9. Evidencia, auditoría y atomicidad

### 9.1 Evidencia

- Almacenamiento privado separado del prefijo público; acceso solo por endpoint autorizado o
  URL firmada de 60 segundos.
- Validación en servidor: firma binaria, decodificación real, dimensiones máximas, límite de
  bytes, MIME permitido.
- Extracción de fecha de captura y GPS antes de eliminar EXIF; luego eliminación de metadatos.
- `sha256` calculado al guardar y verificado al leer.
- Estado `pending_scan` hasta el análisis; `quarantined` si hay malware. Si no se despliega
  antivirus, la subida de evidencia se desactiva en producción; no se declara “segura” sin
  análisis.
- Registro de accesos con actor, fecha, IP, agente, motivo y recurso.
- Retención configurable, bloqueo legal y borrado lógico auditado.

**Estado implementado (2026-11-15):**

| Requisito | Implementación actual |
|---|---|
| Almacenamiento privado | `localStorageAdapter.saveEvidence` escribe en `uploads/documents/evidence`; `storageKey` e `idempotencyKey` no se exponen en JSON |
| Validación | `evidenceContent.js` verifica firma JPEG/PNG/WebP/PDF, MIME declarado, decodificación con `sharp`, 40 MP máximo y rechazo de animaciones |
| EXIF | `exif.js` extrae fecha y GPS antes de re-codificar; las imágenes se guardan sin metadatos |
| Hash | SHA-256 al guardar y verificación al leer; una diferencia marca `quarantined` y emite evento |
| Idempotencia | `Idempotency-Key` con hash por usuario; misma clave y mismo contenido devuelve la evidencia existente; contenido distinto devuelve `409 IDEMPOTENCY_CONFLICT` |
| Autorización | Reporte solo para propietario; inspección/intervención solo para inspector, revisor, ejecutor o verificador asignados; admin solo metadatos y accesos |
| Auditoría | `EvidenceAccessLog` append-only con actor, IP, agente, motivo y recurso; descarga falla con `503 AUDIT_REQUIRED` si no puede registrarse |
| Retención | `EVIDENCE_RETENTION_DAYS` (365 por defecto), `retentionUntil` y `legalHold`; el proceso de borrado legal aún no está implementado |
| Escaneo | `EVIDENCE_SCAN_UNAVAILABLE` en producción sin antimalware; desarrollo/test permiten explícitamente el flujo no escaneado |

Pendiente antes de producción: motor antimalware, cuarentena operativa, purga por retención
y flujo auditado de bloqueo legal. La subida permanece desactivada en producción mientras
esos controles no existan.

### 9.2 Auditoría

- `AuditLog` actual se conserva para operaciones administrativas no críticas.
- Las transiciones de dominio usan `DomainEvent` obligatorio y append-only.
- Si el evento no puede registrarse, la transición crítica falla. No hay modo best-effort.
- El cierre de inspección, la confirmación de severidad y la verificación de intervención
  generan evento en la misma operación.

### 9.3 Atomicidad

Con D-09 aprobada:

- MongoDB con replica set de un nodo en CI, staging y producción.
- Transacciones para: cierre de inspección + evento + proyección; conversión de reporte +
  inspección; verificación de intervención + evento.
- El CI inicia `rs.initiate()` antes de las pruebas y usa `replicaSet=rs0`.
- Sin D-09: diseño de agregado embebido + idempotencia, sin prometer atomicidad
  multi-documento. La puerta de fase 3 exige decidir y probar una de las dos.

## 10. Tiempo real con Socket.IO

- `bin/server.js` se refactoriza para exportar `createHttpServer(app)` y
  `createRealtimeServer(httpServer)`; los tests siguen usando `createApp()`.
- `POST /api/realtime/ticket` emite un JWT de 60 segundos con `scope=realtime`, `jti`, `sub`
  y `tokenVersion`; se consume una sola vez. No se acepta JWT en query string.
- El servidor decide las salas: `user:<id>`, `role:inspector`, `inspection:<id>` tras
  verificar asignación. El cliente no elige salas arbitrarias.
- Eventos mínimos: `notification.created`, `inspection.updated`, `report.created`.
- Toda notificación se persiste antes de emitirse, con `eventId` único y `cursor`.
- El cliente reconecta con `lastCursor`; el servidor reenvía los eventos perdidos.
- Confirmaciones (`ack`), deduplicación por `eventId`, límite de conexiones y frecuencia.
- Una instancia: memoria para tickets y salas. Clúster: sesiones pegajosas + adaptador Redis;
  se documenta explícitamente cuál se despliega.
- Nginx: `Upgrade` y `Connection` para WebSocket; timeout mayor que el heartbeat.
- El chat puede usar HTTP/SSE; no se fuerza el mismo transporte si no lo necesita.

## 11. RAG, fuentes y asistentes

### 11.1 Registro de fuentes

Cada fuente se registra antes de ingerirse con: título, institución, versión, fecha de
publicación, fecha de obtención, páginas, licencia, derechos de uso, nivel de acceso,
checksum, ubicación y estado (`active`, `superseded`, `retracted`).

### 11.2 Política de fuentes

La política canónica es `docs/FUENTES-RAG.md` §2.1–§2.4. Este plan no duplica los niveles A–E.

Resumen operativo:

- Turístico: A–D como fuente final según `usagePolicy`; E solo contexto etiquetado.
- Técnico: A/B/C técnico; sin D/E.
- Hechos históricos: A/B, o doble B/C independiente; D solo puntero.
- Estado actual: solo A vigente; 100777 es histórico 2008.
- Cada fuente declara `usagePolicy` e `indexingPolicy`; una fuente `short_quotes_only` no se indexa en texto completo.
- No todo POI del Casco Histórico es UNESCO. `patrimonialStatus` (D-24) se registra por POI; `sin_clasificar` no autoriza afirmar pertenencia.
- Sin scraping: APIs permitidas, búsqueda licenciada o curación manual.

### 11.3 Ingesta y recuperación

1. Registro y verificación de derechos.
2. Obtención manual o descarga autorizada; checksum con alcance explícito.
3. Extracción conservando página y sección.
4. Solo se indexa texto en español; una fuente solo en inglés queda `draft`.
5. Fragmentación de 3 a 6 frases con `chunkKey` legible; trazabilidad al fragmento.
6. Un único índice de texto sobre `SourceChunk.text`, con `default_language: 'spanish'` y `language_override: 'language'`; filtros en índices separados.
7. Evaluación de recuperación antes de construir el chat.
8. Decisión de almacén vectorial (D-12) solo si la evaluación léxica no alcanza. En v1 no hay embeddings.
9. Respuesta con citas verificadas; abstención si no hay evidencia suficiente.
10. Ingesta por CLI y manifiestos (`--dry-run`, `--apply`, `--verify`, `--rebuild-index`), sin subida de PDF ni parseo automático.

### 11.4 Controles del asistente

- El asistente no tiene herramientas que modifiquen la base, cierren incidencias, asignen severidad definitiva ni publiquen contenido.
- No hay generación libre: la respuesta se compone con citas literales de máximo 25 palabras o hechos estructurados verificados.
- Cada cita se valida contra un fragmento recuperado; si falla una regla, se descarta la respuesta completa y se abstiene.
- Los documentos son datos, no instrucciones: se ignoran las órdenes embebidas y se prueba con un documento sintético.
- Cuota por usuario o IP, caché, latencia y registro de consultas. El coste externo por consulta es 0 en v1.
- Retención: turismo anónimo sin persistencia; asistente técnico 90 días con TTL en `Conversation` y `Message`.
- El asistente técnico responde “no consta” cuando la fuente no cubre el activo o la fecha.

### 11.5 Evaluación

Conjunto dorado mínimo: 60 preguntas (20 respondibles, 20 multi-fuente, 20 sin respuesta o adversarias). Métricas: recall@5, precisión de citas, tasa de abstención correcta y latencia p50/p95 de recuperación y de respuesta completa. No se mide primer token ni coste por consulta porque no hay proveedor externo.

Evaluación v1 ejecutada el 2026-11-22: 60 casos, recall@5 1.00, precisión de citas 1.00,
abstención correcta 0.9642857142857143, 0 citas inválidas, p50 14 ms y p95 30 ms.
Informe reproducible en [`evaluacion-rag/rag-v1-2026-11-22.json`](./evaluacion-rag/rag-v1-2026-11-22.json).

## 12. Visita 360°, audio e idiomas

Implementado:

- `Panorama` equirectangular con `assetId` o `locationId`, créditos, licencia, checksums,
  fecha, estado, visibilidad, versión y auditoría.
- Original privado y derivados generados con `sharp`; el EXIF se elimina y el checksum se
  verifica al servir.
- API pública (`/api/panoramas`) limitada a `published + public` y API administrativa
  (`/api/admin/panoramas`) con capacidades separadas.
- Visor WebGL 1 propio, sin dependencia externa: activación explícita, fallback estático
  primero, teclado, hotspots como enlaces accesibles y sin autogiro ni autoplay.
- Flujo editorial: administración configura y sube (`panorama.manage`); historiador aprueba,
  publica y archiva panoramas turísticos (`panorama.publish`); administración gestiona por
  completo los de inspección.
- Derechos documentados antes de publicar; consentimiento para imágenes de personas;
  difuminado cuando corresponda.
- Panoramas de inspección separados de los públicos; nunca expuestos por la API turística ni
  a la curaduría.
- Pruebas backend (`test/panorama.test.js`), unitarias de SPA y E2E (`panoramas.spec.ts`).

Pendiente:

- Contenido real con derechos verificados; no se publica material sintético.
- Medición de rendimiento, revisión manual de accesibilidad y prueba en móvil.
- Audio y multilingüe solo si se confirman (D-18): `AudioGuide` con transcripción, idioma,
  duración, licencia y estado; sin autoplay; subtítulos.

## 13. UI, identidad visual y accesibilidad

- `/admin` exclusivo de administradores: cuentas, roles, configuración no secreta y auditoría.
- `/reportes` para usuario autenticado: crear y consultar los propios; el detalle muestra el
  triaje, la evidencia y la inspección asociada. La cola de triaje vive en `/inspecciones`
  para inspector/revisor.
- `/inspecciones` para inspector/revisor, con guard por capacidad: cola de triaje, alta de
  inspección, conversión de reportes aceptados, bandeja asignada y acceso al detalle.
- `/inspecciones/:id` concentra inicio o reanudación, hallazgos con evidencia, envío a
  revisión, revisión con severidades, intervenciones con evidencia, verificación y cierre.
- La UI cubre carga, error, vacío, denegación y conflicto de versión; las acciones
  incompatibles con el rol o el estado no se ofrecen, pero la autorización real permanece en
  el backend. Tras adjuntar evidencia se bloquean las acciones hasta que la recarga silenciosa
  actualiza la versión, evitando conflictos por datos obsoletos.
- La ficha pública muestra conservación solo si hay inspección revisada; si no, “Sin
  inspección verificada”. Los reportes abiertos no se muestran al público.
- Tokens semánticos en `src/styles/_tokens.scss`; tipografía en `_typography.scss`.
- Contraste verificado: `#92400E` para texto de alerta sobre ámbar; texto oscuro sobre
  `#D97706` (5.23:1); `#B45309` sobre cal (4.84:1); `#047857` (5.29:1); `#78350F` (8.75:1).
  No usar `#D97706` sobre `#FFFBEB` para texto normal (3.07:1) ni blanco sobre `#D97706`.
- Estados con texto, icono o patrón; nunca solo color.
- Playfair Display e Inter autoalojadas, con licencia conservada; sin dependencia de Google
  Fonts en producción.
- Escala web responsive; las medidas editoriales 20/13/10.5 pt no se trasladan literalmente.
- WCAG 2.2 AA: foco visible, teclado, orden de tabulación, etiquetas, contraste, movimiento
  reducido y zoom. Los paneles de evidencia repetidos generan ids únicos por instancia para
  no romper la asociación entre etiqueta y campo.

## 14. SLO, RPO, RTO y métricas

Propuesta para congelar en fase 0:

| Métrica | Objetivo | Método |
|---|---|---|
| Disponibilidad pública | 99.5 % mensual, excluyendo mantenimiento planificado | Comprobación sintética cada minuto desde dos regiones |
| Disponibilidad interna de inspección | 99.0 % en horario de campo | Igual, con ventana declarada |
| RPO | 1 h para base y evidencia; si el proveedor solo permite backup diario, se declara 24 h y se compensa con versionado de objetos | Última copia verificada |
| RTO | 4 h para servicio completo | Simulacro de restauración |
| MTTR crítico | 4 h | Incidentes reales |
| Backups | 3-2-1; restauración probada antes del lanzamiento y tras cada cambio de esquema | Acta de simulacro |
| RAG recuperación | p95 ≤ 2 s | Medición separada de recuperación |
| RAG respuesta completa | p95 ≤ 8 s para respuestas de hasta 5 frases | Medición extremo a extremo |
| Flujo de reporte | p95 ≤ 45 s con foto en 4G | Inicio: toque “Reportar” con sesión iniciada; fin: confirmación 201 |
| GPS | 90 % de lecturas con precisión reportada ≤ 10 m | Muestra de dispositivos; lecturas peores se marcan, no se aceptan en silencio |
| Accesibilidad | WCAG 2.2 AA | Automatizado + revisión manual |
| Seguridad | Sin hallazgos críticos o altos abiertos | Auditoría y pruebas de autorización |

El “2 segundos” se interpreta como latencia de recuperación; la respuesta completa tiene su
propio SLO. Se mide con hardware, red, top-k y caché concretos; no se promete antes.

## 15. Fases, entregables y puertas

| Fase | Trabajo principal | Agente responsable | Puerta de salida |
|---|---|---|---|
| 0. Alcance y baseline | Decisiones, SRS, matriz RN→HU→RF, RBAC, fuentes, threat model, ADR, SLO, corrección documental y baseline | `unidad-02-analisis`, `unidad-02-diseno`, `unidad-05-documentacion`, `unidad-07-soporte-seguridad` | Alcance firmado; baseline reproducible; derechos identificados; proveedor no requerido en v1; CI reproducible |
| 1. Análisis y diseño | Modelo de dominio, ER, diccionario, estados, casos de uso, secuencias, OpenAPI, wireframes, eventos, política RAG y 360 | `unidad-02-modelado`, `unidad-02-arquitectura`, `unidad-02-diseno` | Diseño revisado y trazable; contrato aprobado antes de programar |
| 2. Roles y cuentas | Roles, capacidades, migración, administración, guards, pruebas IDOR | `unidad-03-desarrollo`, `unidad-04-pruebas`, `unidad-07-soporte-seguridad` | Matriz probada; cero `moderator`; último admin protegido; sesiones revocadas |
| 3. Núcleo de conservación | Modelos, servicios, API y UI mínima del flujo vertical; evidencia privada; historial | `unidad-03-desarrollo`, `unidad-04-pruebas`, `unidad-07-soporte-seguridad` | E2E completo; historial conservado; evidencia inaccesible sin permiso; transiciones inválidas rechazadas |
| 4. Socket.IO | Ticket, salas, notificaciones persistidas, reconexión, deduplicación, carga | `unidad-03-desarrollo`, `unidad-04-pruebas`, `unidad-06-despliegue` | Handshake autorizado; alertas pertinentes; recuperación tras reconexión; carga medida |
| 5. RAG | Registro de fuentes, ingesta, recuperación, evaluación, asistentes con citas y abstención | `unidad-03-desarrollo`, `unidad-04-pruebas`, `unidad-07-soporte-seguridad` | Citas correctas; abstención sin evidencia; p95 medido; fuentes autorizadas |
| 6. Visita 360° | **Infraestructura implementada:** modelo, derechos, visor, hotspots, fallback, accesibilidad y aislamiento. Falta contenido real con derechos y evidencia de rendimiento/accesibilidad manual. | `unidad-03-desarrollo`, `unidad-04-pruebas`, `unidad-05-documentacion` | Derechos documentados; contenido aprobado; sin datos privados; accesible |
| 7. Identidad visual y SPA | Tokens, fuentes, componentes, vistas pública e interna, accesibilidad | `unidad-03-desarrollo`, `unidad-04-pruebas` | WCAG 2.2 AA; contraste, teclado y responsive verificados |
| 8. Pruebas integrales y piloto | Pirámide, API/E2E, carga, seguridad, usabilidad, accesibilidad y campo | `unidad-04-pruebas`, `unidad-07-soporte-seguridad` | Métricas con muestra, entorno y método; sin defectos críticos/altos; acta |
| 9. Despliegue y operación | Docker, staging/producción, TLS, secretos, CI/CD, observabilidad, backups, rollback, runbook | `unidad-06-despliegue`, `unidad-07-soporte-seguridad` | Restauración probada; rollback probado; smoke tests; SLO monitoreado |
| 10. Cierre y transferencia | Documentación como código, Mermaid, README, API, manuales, changelog, trazabilidad y soporte | `unidad-05-documentacion` | Definición de terminado; aceptación; licencias; documentación coincide con lo desplegado |

Dependencias:

- La fase 5 puede empezar en paralelo con la 3 si el equipo de contenidos trabaja el corpus.
- La fase 6 ya tiene la infraestructura implementada; la publicación sigue esperando
  panorámicas reales con derechos verificados y la revisión de accesibilidad/rendimiento.
- Las pruebas y la preparación de despliegue son puertas continuas, no fases finales.

## 16. Impacto por archivo

Las tablas de esta sección describen el impacto objetivo y no son por sí solas un inventario
de trabajo pendiente. Algunos elementos del backend de conservación ya existen parcialmente
en el árbol local; el estado confirmado y los faltantes están en las secciones 0 y 3.

### 16.1 Backend existente

| Archivo | Cambio |
|---|---|
| `projects/backend/databases/models/User.js` | Añadir `historian` e `inspector`; retirar `moderator` en contract. |
| `projects/backend/databases/models/Location.js` | `conservationStatus` deja de ser editable; proyección derivada; posible campo de inspección vigente. |
| `projects/backend/databases/models/AuditLog.js` | Conservar; ampliar tipos de entidad si se usa para auditoría administrativa. |
| `projects/backend/middlewares/auth.js` | Sustituir/complementar `requireRole` con capacidades. |
| `projects/backend/microservices/authService.js` | Actualizar `isModerator` y emisión de rol; revocación. |
| `projects/backend/api/admin/adminUserController.js` | Añadir rol, estado, revocación y protecciones. |
| `projects/backend/api/admin/adminRoutes.js` | Montar endpoints de cuentas y fuentes. |
| `projects/backend/api/admin/adminRoutes.js` y `index.js` | Montar rutas nuevas. |
| `projects/backend/bin/server.js` | Separar creación HTTP y Socket.IO; apagado ordenado. |
| `projects/backend/microservices/storage/localStorageAdapter.js` | Carpetas de evidencia, metadatos, hash, borrado seguro. |
| `projects/backend/microservices/storage/index.js` | Adaptador de almacenamiento privado. |
| `projects/backend/middlewares/uploadImage.js` | Decodificación, dimensiones, EXIF y límites. |
| `projects/backend/microservices/auditService.js` | Modo obligatorio para transiciones; no silenciar fallos críticos. |
| `projects/backend/helpers/env.js` | Variables de evidencia, realtime, RAG, almacén vectorial y SLO. |
| `projects/backend/test/*.test.js` | Actualizar expectativas de roles y añadir suites nuevas. |
| `projects/backend/scripts/e2eServer.js` | Mantener compatibilidad con el nuevo servidor. |
| `projects/backend/package.json` | Dependencias: `socket.io` y cliente de almacenamiento/escaneo. En v1 RAG no añade dependencias: MongoDB `$text` y `node:crypto` bastan; no hay extracción PDF ni cliente de proveedor. |

### 16.2 Backend nuevo

| Archivo | Propósito |
|---|---|
| `databases/models/HeritageAsset.js` | Activo patrimonial inspeccionable. |
| `databases/models/Report.js` | Aviso ciudadano y triaje. |
| `databases/models/Inspection.js` | Agregado de inspección con hallazgos e historial embebidos. |
| `databases/models/Intervention.js` | Intervención y verificación. |
| `databases/models/Evidence.js` | Metadatos de evidencia privada. |
| `databases/models/EvidenceAccessLog.js` | Registro append-only de accesos. |
| `databases/models/DomainEvent.js` | Evento de dominio inmutable. |
| `databases/models/Notification.js` | Notificación persistida y cursor. |
| `databases/models/SourceDocument.js`, `databases/models/SourceChunk.js` | Corpus RAG y trazabilidad. |
| `databases/models/Conversation.js`, `databases/models/Message.js` | Conversaciones y citas. |
| `databases/models/Panorama.js`, `databases/models/AudioGuide.js` | Visita 360° y audio condicional. |
| `microservices/capabilityService.js` | Matriz de capacidades y `break-glass`. |
| `microservices/reportService.js` | Creación, triaje y conversión idempotente. |
| `microservices/inspectionService.js` | Máquina de estados, revisión y cierre. |
| `microservices/conservationProjectionService.js` | Proyección pública del estado. |
| `microservices/evidenceService.js` | Hash, metadatos, escaneo, retención y acceso. |
| `microservices/domainEventService.js` | Registro obligatorio y consulta. |
| `microservices/notificationService.js` | Persistencia, cursor y emisión. |
| `microservices/realtimeTicketService.js` | Ticket de corta duración y single-use. |
| `microservices/rag/*` | Ingesta, recuperación léxica, composición extractiva, abstención y validación de citas. Sin adaptador de proveedor ni generación libre en v1. |
| `middlewares/capability.js` | Autorización por capacidad. |
| `middlewares/idempotency.js` | Clave de idempotencia en operaciones críticas. |
| `middlewares/uploadEvidence.js` | Carga privada de evidencia. |
| `api/conservation/heritageAssetController.js`, `api/conservation/reportController.js`, `api/conservation/inspectionController.js`, `api/conservation/interventionController.js`, `api/evidence/evidenceController.js` | Casos de uso HTTP. |
| `api/notifications/notificationController.js`, `api/realtime/realtimeController.js`, `api/assistant/assistantController.js`, `api/panoramas/panoramaController.js`, `api/admin/adminSourceController.js` | Rutas nuevas. |
| `api/conservation/heritageAssets.js`, `api/conservation/reports.js`, `api/conservation/inspections.js`, `api/conservation/interventions.js`, `api/evidence/evidence.js`, `api/notifications/notifications.js`, `api/realtime/realtime.js`, `api/assistant/assistant.js`, `api/panoramas/panoramas.js`, `api/admin/adminSources.js` | Routers. |
| `scripts/migrateRoles.js` | Migración expand-contract con `--dry-run` y `--apply`. |
| `scripts/verifyRoles.js` | Verificación de cero `moderator` y último admin. |
| `seeders/seedHeritageAssets.js` | Enlazar POI con activos sin inventar patrimonio. |
| `scripts/ingestSources.js`, `scripts/verifySources.js` | Ingesta y verificación de corpus. |
| `scripts/loadRealtime.js` | Carga de Socket.IO con cliente. |
| `test/roles.test.js`, `test/adminUsers.test.js`, `test/inspections.test.js`, `test/evidence.test.js`, `test/notifications.test.js`, `test/rag.test.js`, `test/panoramas.test.js` | Suites nuevas. |

### 16.3 Frontend existente

| Archivo | Cambio |
|---|---|
| `projects/frontend/src/app/models/auth.model.ts` | Roles y capacidades. |
| `projects/frontend/src/app/models/admin.model.ts` | Usuario con rol/estado y acciones. |
| `projects/frontend/src/app/models/location.model.ts` | Proyección de conservación y fecha de inspección. |
| `projects/frontend/src/app/services/auth.service.ts` | `isHistorian`, `isInspector`, capacidades. |
| `projects/frontend/src/app/services/admin-api.service.ts` | Endpoints de rol, estado y revocación. |
| `projects/frontend/src/app/services/location-api.service.ts` | Conservación verificada. |
| `projects/frontend/src/app/services/guards/auth.guard.ts` | Guards por capacidad. |
| `projects/frontend/src/app/app.routes.ts` | `/inspecciones`, `/reportes`, `/asistente`, `/panoramas`. |
| `projects/frontend/src/app/pages/admin/usuarios/admin-usuarios.component.*` | Acciones de cuenta y confirmación. |
| `projects/frontend/src/app/components/admin/layout/admin-layout.component.*` | Menú solo administrativo. |
| `projects/frontend/src/app/pages/lugares/lugar-detail/*` | Insignia de conservación verificada o “sin inspección”. |
| `projects/frontend/src/styles.scss`, `src/styles/_admin.scss` | Importar tokens y tipografía. |
| `projects/frontend/src/app/app.config.ts` | Providers de realtime y interceptores. |
| `projects/frontend/e2e/*.spec.ts` | Mantener y ampliar. |

### 16.4 Frontend nuevo

| Archivo | Propósito |
|---|---|
| `src/styles/_tokens.scss`, `src/styles/_typography.scss` | Tokens semánticos y fuentes autoalojadas. |
| `src/app/models/report.model.ts`, `inspection.model.ts`, `evidence.model.ts`, `notification.model.ts`, `panorama.model.ts` | Contratos tipados. |
| `src/app/services/report-api.service.ts`, `inspection-api.service.ts`, `evidence-api.service.ts`, `notification-api.service.ts`, `realtime.service.ts`, `assistant-api.service.ts`, `panorama-api.service.ts` | Clientes HTTP y Socket.IO. |
| `src/app/services/guards/capability.guard.ts` | Guard por capacidad. |
| `src/app/pages/reportes/*` | Crear reporte y ver los propios. |
| `src/app/pages/inspecciones/*` | Bandeja, detalle, hallazgos, evidencia y cierre. |
| `src/app/pages/asistente/*` | Chat con citas y abstención. |
| `src/app/pages/panoramas/*` | Visor 360°, hotspots y fallback. |
| `src/app/pages/notificaciones/*` | Centro de notificaciones y reconexión. |
| `projects/frontend/e2e/roles.spec.ts`, `inspections.spec.ts`, `notifications.spec.ts`, `assistant.spec.ts`, `panorama.spec.ts`, `a11y.spec.ts` | Cobertura nueva. |

### 16.5 Documentación, configuración y CI

| Archivo | Cambio |
|---|---|
| `docs/PLAN-IMPLEMENTACION.md` | Este documento. |
| `docs/FALCONSYNC.md`, `AUTENTICACION.md`, `ADMINISTRACION.md`, `POI.md`, `PERFIL.md`, `AVENTURAS.md` | Corregir baseline y estado; enlazar este plan. |
| `context/business_rules.md`, `context/api_contracts.md`, `context/system_context.md` | Reglas, contratos y contexto nuevos. |
| `README.md`, `docs/INSTALACION.md`, `.env.example` | Variables, arranque y operación. |
| `.github/workflows/ci.yml` | Replica set, suites nuevas, artefactos y jobs. |
| `docs/REQUISITOS.md`, `docs/RBAC.md`, `docs/FUENTES-RAG.md`, `docs/SEGURIDAD.md`, `docs/OPERACION.md`, `docs/ADR/` | Entregables de Fase 0 creados. |
| `docs/MODELO-DATOS.md`, `docs/CASOS-USO.md`, `docs/EVENTOS-TIEMPO-REAL.md`, `docs/openapi.yaml`, `docs/WIREFRAMES.md`, `docs/360.md` | Entregables de Fase 1 creados y actualizados; el contrato 360 está implementado y las rutas restantes se marcan como planificadas. |
| `docs/PILOTO.md` | Entregable de Fase 8; pendiente. |
| `docs/ADR/ADR-*.md` | Decisiones D-01 a D-08; D-09 a D-23 se registran en el plan y los documentos de Fase 1. |

## 17. Matriz de pruebas

| Nivel | Qué cubre | Herramienta / comando | Puerta |
|---|---|---|---|
| Unidad backend | Máquinas de estado, capacidades, proyección, hash, citas | `npm --prefix projects/backend test` | Cada transición válida e inválida |
| Unidad frontend | Guards, servicios, componentes, tokens | `npm --prefix projects/frontend run test -- --watch=false` | 100 % de casos nuevos |
| Integración API | Auth, roles, CRUD, idempotencia, errores | Node test + `supertest` + Mongo de prueba | Contratos y códigos estables |
| E2E | Reporte → inspección → cierre; cuentas; notificaciones; 360; asistente | `npm --prefix projects/frontend run e2e` | Flujo completo y regresiones |
| Autorización | IDOR horizontal y vertical | Suites `roles`, `inspections`, `evidence` | Sin acceso cruzado |
| Evidencia | MIME falso, dimensiones, EXIF, hash, cuarentena, acceso | `test/evidence.test.js` | Archivo privado e inaccesible sin permiso |
| Tiempo real | Handshake, salas, reconexión, duplicados, carga | `test/notifications.test.js`, `scripts/loadRealtime.js` | Sin fuga entre usuarios |
| RAG | Recuperación, citas, abstención, inyección, coste | `test/rag.test.js`, evaluación dorada | Citas válidas y abstención |
| Accesibilidad | Contraste, teclado, foco, axe | Playwright + `@axe-core/playwright` + revisión manual | WCAG 2.2 AA |
| Carga y estrés | API, Socket.IO, RAG | Script de carga + entorno staging | p95 dentro de SLO |
| Seguridad | IDOR, inyección, secretos, uploads, rate limit | Revisión + pruebas + `npm audit --omit=dev` | Sin críticos/altos abiertos |
| Campo | GPS, flujo 45 s, 360, usabilidad | Protocolo de piloto | Métricas con muestra y método |
| Operación | Backup, restauración, rollback, salud | Simulacro staging | RTO/RPO medidos |

Casos IDOR mínimos:

- `user` no lee reportes, inspecciones ni evidencia de otro usuario.
- `historian` no lee evidencia de inspección ni confirma severidad.
- `inspector` no edita contenido editorial ni gestiona cuentas.
- `admin` no inspecciona por defecto; solo auditoría.
- El inspector A no accede a la inspección asignada al inspector B.
- Un cliente Socket.IO no entra en salas de otro usuario ni de una inspección no asignada.
- Un ticket de realtime no se reutiliza y expira.

## 18. CI/CD y entornos

- CI actual: un job en `.github/workflows/ci.yml`, disparado en push y PR a `develop`, `main`
  y `master`, y manualmente con `workflow_dispatch`.
- MongoDB: `mongo:9.0` se inicia con `--replSet falconsyncTest`, `--bind_ip_all` y
  `rs.initiate()`; el mismo `mongod` se publica en `27017` y `27018` para respetar los puertos
  por defecto de las suites. No se define `MONGODB_URI_TEST` global para no hacer que todas
  las suites compartan una sola base de datos.
- Pasos: `npm ci` y `npm audit --omit=dev` en backend y frontend, pruebas, build, Chromium y
  E2E; el reporte de Playwright se publica como artefacto si falla. El contenedor de Mongo se
  elimina siempre al final.
- Añadir en fases posteriores: pruebas de notificaciones y contratos, cobertura y jobs
  nocturnos para RAG/carga.
- Entornos: local, test, staging y producción. Secretos fuera del repositorio; `.env.example`
  solo con marcadores.
- Staging con datos sintéticos; producción con backups 3-2-1 y restauración probada.
- Observabilidad: logs estructurados con `correlationId`, health/readiness, métricas de
  latencia/errores, alertas de SLO y trazas del asistente RAG.
- Rollback: imagen anterior + migraciones expand-contract + feature flags. No se hace
  `down` destructivo de datos.
- La ejecución remota del CI requiere autorización para publicar la rama/PR (A2). Hasta
  entonces, se declara “reproducible localmente”, no “CI remoto verde”.

## 19. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-01 | PDF UNESCO 100777 detrás de Cloudflare | Descarga manual o acceso autorizado; no bloquear el resto del corpus; registrar checksum. |
| R-02 | Fuente 2008 usada como estado actual | Etiqueta “Histórico 2008”; estado actual solo con SOC recientes e inspecciones. |
| R-03 | MongoDB sin replica set en algún entorno | D-09 aprobada; CI y local ya usan replica set; verificar staging y producción antes del despliegue. |
| R-04 | Evidencia expuesta o sin antivirus | Almacenamiento privado, acceso auditado, escaneo; desactivar subida si no hay escaneo. |
| R-05 | Escalada de privilegios en migración | `moderator` sin capacidades nuevas; dry-run, respaldo, revisión y revocación. |
| R-06 | Bloqueo del último admin | Protección en servidor, pruebas y alerta. |
| R-07 | Socket.IO en clúster sin adaptador | Una instancia documentada o Redis + sesiones pegajosas. |
| R-08 | RAG alucina o cita mal | Validación de citas, abstención, conjunto dorado y revisión humana. |
| R-09 | Inyección de prompt en documentos | Delimitación, instrucciones de sistema, allowlist y pruebas adversarias. |
| R-10 | Latencia y tamaño del índice RAG | Top-k, caché y p95 separados por fase; sin proveedor de pago en v1. |
| R-11 | Derechos de 360/audio/imágenes | Registro de licencias, consentimiento, difuminado y bloqueo de publicación. |
| R-12 | GPS impreciso | Registrar precisión, marcar lecturas y no aceptar en silencio. |
| R-13 | Deriva documental | Baseline único, corrección P0-03 y verificación en cada release. |
| R-14 | CI nunca ejecutado | Primera puerta de fase 0 con rama/PR autorizada. |
| R-15 | Alcance de audio/idiomas sin cerrar | Decisión en fase 0; si no, se excluye y se documenta. |

## 20. Trazabilidad académica

Correspondencia metodológica, no atribución de las decisiones concretas:

| Unidad | Aporte | Fases |
|---|---|---|
| Unidad 2 | Análisis, reglas de negocio, historias, requerimientos, ER, UML, wireframes y prototipos | 0, 1, 6, 7 |
| Unidad 3 | Contrato técnico, DTOs, paridad de entornos, validación, logging, SOLID, GitFlow y DoD | 2–5 |
| Unidad 4 | Pirámide de pruebas, caja negra/blanca, carga, estrés, seguridad, usabilidad, bugs y CI | 3, 8 |
| Unidad 5 | Doc-as-code, JSDoc, Mermaid, README, manuales y changelog | 7, 10 |
| Unidad 6 | Entornos, Docker, CI/CD, observabilidad, RTO/RPO, backups y rollback | 4, 9 |
| Unidad 7 | IDOR, inyección, secretos, aislamiento de red, L1/L2/L3, logs estructurados, correlation ID y RUNBOOK | 2, 4, 5, 9 |

## 21. Dependencias externas y aprobaciones

| Dependencia | Necesita | Bloquea |
|---|---|---|
| Documento UNESCO 100777 (PDF 1) | Descarga manual, comparación de SHA-256 y curación con citas breves; sin índice de texto completo en v1 | Ingesta de texto completo |
| SOC 2026, 48COM/47COM | Enlace, licencia y fecha | Estado actual del corpus |
| Proveedor LLM/embeddings | No requerido en v1 (respuesta extractiva); solo si un ADR futuro lo aprueba | — |
| Almacén vectorial | Solo si la evaluación léxica no alcanza; decisión posterior | Recuperación semántica (opcional) |
| Hosting y dominio | Staging, TLS, DNS y correo | Fase 9 |
| Derechos 360 | Autoría, licencia, consentimiento y captura | Fase 6 |
| Audio/idiomas | Confirmación de alcance, transcripciones y licencias | Fase 6 |
| Push/PR | Autorización para publicar y ejecutar CI remoto | Puerta de fase 0 |
| Autoridad patrimonial | Autorización del piloto y validación de contenido | Fase 8 |

## 22. Definición de terminado

No se declara terminado por número de pantallas, sino cuando:

- La matriz de capacidades está aplicada en servidor y probada; no queda `moderator` legacy.
- Un reporte puede registrarse, triarse, convertirse en inspección, evaluarse, asignarse,
  intervenir y cerrarse conservando historial y evidencia.
- El estado de conservación público solo aparece con una inspección revisada; si no, se
  declara “sin inspección verificada”.
- La evidencia es privada, con hash, metadatos, acceso auditado y retención; no se expone por
  `/api/uploads`.
- El asistente cita fuentes autorizadas, se abstiene sin evidencia y no ejecuta acciones.
- La infraestructura de la visita 360° tiene derechos, hotspots, fallback, visor y
  accesibilidad; la publicación queda bloqueada hasta disponer de contenido real con derechos
  verificados. Audio e idiomas solo si se confirmaron.
- Las métricas de campo y RAG se reportan con muestra, entorno, método y resultado.
- Staging y producción tienen backups, restauración probada, monitoreo, rollback y
  documentación coincidente.
- No hay hallazgos críticos o altos de seguridad abiertos.
- El CI remoto está verde o existe una ejecución reproducible registrada antes del piloto.
- La documentación refleja el baseline real y el estado desplegado.

## 23. Ruta priorizada para completar FALCONSYNC

La prioridad es cerrar primero el flujo de conservación completo y seguro. RAG, Socket.IO y
360° son importantes, pero no deben retrasar un flujo de campo funcional. La app móvil nativa
sigue fuera del alcance.

| Orden | Paquete | Trabajo y dependencias | Criterio de salida |
|---|---|---|---|
| 0 | Cerrar alcance y contratos | Revisar el estado de D-09 a D-29 y FD-* contra las aprobaciones registradas; D-24 a D-29 quedaron cerradas el 2026-11-20; siguen abiertas D-18 a D-20, D-22, la parte de evidencia de D-23 y las FD-*. Confirmar derechos, retención y audio/idiomas; proveedor y presupuesto de IA no se requieren en v1. Aprobar el contrato OpenAPI y reconciliarlo con las rutas actuales. Obtener una ejecución de CI remoto con autorización. | Decisiones pendientes asignadas y aprobadas/rechazadas; contrato único; CI remoto verde o limitación formalmente aceptada antes del piloto. |
| 1 | Proteger la migración de roles | Ejecutar solo el `--dry-run`, revisar cuentas afectadas y último administrador; generar y restaurar un backup; obtener autorización explícita antes de `--apply`. Verificar cero `moderator`, sesiones revocadas y luego retirar el rol en una liberación separada. | Migración reversible mediante backup probado; reporte de verificación; pruebas positivas/negativas de IDOR y privilegio mínimo; no quedan cuentas `moderator`. |
| 2 | Terminar el dominio backend | Alinear estados, errores, transiciones, permisos y `docs/openapi.yaml` con la API existente. Resolver la asociación POI → activo patrimonial antes de convertir reportes. Probar concurrencia, idempotencia, transacciones y proyección pública; mantener MongoDB como replica set donde se ejecuten estos flujos. | Contratos y API coinciden; transiciones inválidas/duplicadas se rechazan; los reportes aceptados se convierten y conservan historial. |
| 3 | Habilitar evidencia privada | Implementar carga, validación de tipo/contenido/tamaño, almacenamiento no público, hash, metadatos/EXIF, escaneo o cuarentena, autorización por recurso, registro de accesos y retención. Vincular evidencias a reportes, hallazgos e intervenciones; definir comportamiento seguro si el escaneo no está disponible. | Evidencia no accesible por URL pública; acceso no autorizado denegado y auditado; intervención puede completarse/verificarse con evidencia y no puede cerrarse sin los requisitos del dominio. |
| 4 | Entregar UI de conservación | Construir primero `/reportes` (crear y consultar propios) y `/inspecciones` (bandeja asignada, ejecutar, hallazgos, revisar, intervención, evidencia y cierre). Aplicar guards por capacidad como UX, manteniendo autorización en backend. Incluir estados vacíos, errores, carga y accesibilidad básica. | E2E desde reporte hasta cierre verificado, además de denegaciones para usuario ajeno, inspector no asignado y rol incorrecto. |
| 5 | Integrar flujo y consolidar calidad | Probar el recorrido completo en un replica set desde frontend hasta MongoDB; agregar pruebas de API/E2E, regresión, autorización, carga de evidencia y recuperación. Validar que el estado público procede solo de inspección revisada/cerrada. | E2E reproducible; historial consistente; sin hallazgos críticos/altos abiertos; baseline local repetible y CI remoto documentado. |
| 6 | Construir capacidades complementarias | **Socket.IO:** después de persistir notificaciones, implementar ticket de un solo uso, salas autorizadas, cursores y reconexión. **RAG:** puede avanzar en paralelo al backend tras aprobar corpus, derechos y evaluación, sin proveedor externo y con ingesta CLI; implementar citas y abstención antes de abrir acceso. **360°:** la infraestructura ya está implementada; quedan derechos/adquisición de contenido real y las verificaciones de accesibilidad, móvil y rendimiento antes de publicar. | Cada capacidad tiene sus pruebas de autorización, calidad y operación; RAG cita fuentes verificables; 360° publica contenido con derechos registrados; realtime recupera eventos tras reconexión. |
| 7 | Preparar piloto y operación | Aplicar identidad visual progresivamente; revisar WCAG 2.2 AA y responsive; provisionar staging/producción, secretos, TLS, observabilidad, backups y runbooks. Ejecutar restauración y rollback; hacer piloto autorizado con protocolo de GPS, tiempos, accesibilidad y flujos reales. | SLO medidos; backup/restauración y rollback demostrados; piloto con muestra y resultados documentados; aceptación y transferencia operativa. |

### Próximo incremento recomendado

La autorización por capacidades, el backend de conservación, la evidencia privada, la UI de
conservación (`/reportes`, `/inspecciones`) y la infraestructura de la visita 360° ya están
implementados y cubiertos por las suites de backend, frontend y E2E. El siguiente incremento
es cerrar las decisiones D-18 a D-23, el dry-run/backup de roles, el antimalware y la
migración del CI a replica set; no ejecutar la migración ni habilitar cargas en producción sin
autorización. Después, Socket.IO y RAG pueden avanzar en carriles separados; la visita 360°
solo necesita contenido real con derechos y las verificaciones pendientes.

Las pruebas, revisión de seguridad, accesibilidad y documentación son puertas continuas de
cada paquete, no una fase final. La identidad visual puede avanzar incrementalmente, pero no
debe desplazar la entrega del flujo funcional.