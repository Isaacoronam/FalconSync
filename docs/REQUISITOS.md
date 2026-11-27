# Especificación de requisitos — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.1 |
| Fecha | 2026-11-25 |
| Estado | Línea base de Fase 0; identidad Chivito y celebración incorporadas; D-09 a D-23 y alcance condicional siguen pendientes |
| Autoridad | [`docs/PLAN-IMPLEMENTACION.md`](./PLAN-IMPLEMENTACION.md) y decisiones del responsable del proyecto |
| Documentos relacionados | [`RBAC.md`](./RBAC.md), [`FUENTES-RAG.md`](./FUENTES-RAG.md), [`SEGURIDAD.md`](./SEGURIDAD.md), [`OPERACION.md`](./OPERACION.md), [`MODELO-DATOS.md`](./MODELO-DATOS.md), [`CASOS-USO.md`](./CASOS-USO.md), [`openapi.yaml`](./openapi.yaml), [`WIREFRAMES.md`](./WIREFRAMES.md), [`360.md`](./360.md), [`ADR/README.md`](./ADR/README.md) |

> Este documento traduce el plan a requisitos verificables. No atribuye sus decisiones a las
> Unidades 2–7; la correspondencia metodológica se declara en el plan, sección 20. Las metas
> numéricas son objetivos propuestos, no resultados medidos.

## 1. Objetivo y alcance

FALCONSYNC debe permitir que un visitante consulte el patrimonio y la oferta turística de
Coro, que un usuario autenticado reporte daños, que un inspector gestione el ciclo de
conservación y que un administrador gobierne cuentas y configuración sin confundirse con un
inspector. La visita 360° es obligatoria y las notificaciones en tiempo real usan Socket.IO.

### Incluido

- Catálogo público de POI, mapa y ficha editorial existentes.
- Fichas enriquecidas de los 23 POI con «Qué es», historia, detalles, visita, fuentes, fecha
  de revisión y galería de imágenes con créditos y licencia.
- Corpus RAG `S-033` de investigación patrimonial, integrado sin borrar el conocimiento
  anterior y con pruebas E2E específicas para los 23 lugares.
- Autenticación, sesiones y roles actuales, migrados a `historian` e `inspector`.
- Dominio de conservación: activo patrimonial, reporte, inspección, hallazgo, intervención,
  evidencia y eventos de dominio.
- Evidencia privada, con hash, acceso auditado y retención.
- Notificaciones persistentes y Socket.IO.
- Asistentes RAG técnico y turístico, con citas y abstención.
- Visita 360° con derechos, hotspots, fallback y accesibilidad.
- Identidad visual FALCONSYNC y accesibilidad WCAG 2.2 AA.
- Pruebas, piloto, despliegue y operación.

### Excluido

- App Android nativa de campo (`projects/mobile/`).
- Funcionamiento offline prometido desde el navegador móvil.
- Reservas, pagos, ventas o inventario turístico.
- Scraping de redes sociales.
- Diagnósticos automáticos o acciones de escritura ejecutadas por la IA.
- Actualización de Angular 22 dentro de este alcance.

### Condicional

- Audioguías y contenido multilingüe: obligatoriedad no cerrada. Si se confirman, se
  incorporan con transcripciones, licencias, idioma y fallback.
- Almacenamiento vectorial: se decide en la puerta de Fase 5. El MongoDB local actual no
  acredita búsqueda vectorial.

## 2. Actores

| Actor | Descripción | Autenticación |
|---|---|---|
| Visitante | Consulta catálogo, mapa, fichas y visita 360°. | No |
| `user` / Turista | Se registra, consulta, hace check-in y reporta daños. | Sí |
| `historian` / Historiador | Mantiene historia, fuentes y contenido editorial; revisa contenido. | Sí |
| `inspector` / Inspector | Triaja reportes, inspecciona, propone hallazgos e intervenciones. | Sí |
| Inspector revisor | Inspector con capacidad de revisión asignada a una inspección concreta. | Sí |
| `admin` / Administrador | Gestiona cuentas, roles, configuración no secreta y auditoría. | Sí |
| Operador / Soporte | Opera despliegue, backups, monitoreo y soporte; no es un rol de producto. | Fuera de la API de producto |
| Autoridad patrimonial | Autoriza el piloto y valida contenido; no opera el sistema. | Fuera del sistema |
| Proveedor externo | LLM, embeddings o búsqueda externa; recibe solo el contexto permitido. | Credencial de servicio |

## 3. Glosario

| Término | Definición |
|---|---|
| POI | Punto de interés turístico. No es sinónimo de edificación patrimonial. |
| `HeritageAsset` | Edificación o unidad patrimonial inspeccionable; puede enlazar un POI. |
| Reporte | Aviso de un usuario autenticado; no es diagnóstico ni hallazgo confirmado. |
| Inspección | Actuación de un inspector con estados, responsable, alcance y fechas. |
| Hallazgo | Daño observado en una inspección; distingue severidad propuesta y confirmada. |
| Intervención | Obra o acción de conservación; solo su verificación permite cerrar hallazgos que la requieran. |
| Evidencia | Foto o documento privado con hash, autor, fecha, precisión y acceso auditado. |
| Evento de dominio | Hecho inmutable con actor, fecha, transición y motivo. |
| RAG | Recuperación de fuentes autorizadas antes de generar una respuesta. |
| Abstención | Respuesta “no hay evidencia suficiente” cuando la recuperación no cubre la pregunta. |
| IDOR | Acceso indebido a un recurso por cambiar su identificador. |
| Break-glass | Excepción temporal, motivada, aprobada y auditada a una separación de funciones. |
| SLO / RPO / RTO | Objetivo de nivel de servicio / pérdida máxima de datos / tiempo máximo de recuperación. |

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Los roles de producto son `user`, `historian`, `inspector` y `admin`. `moderator` solo existe durante la migración expand-contract y no recibe capacidades nuevas. |
| RN-02 | “Turista” es la etiqueta visible de `user`; no se crea un rol `tourist` separado. |
| RN-03 | El historiador no aprueba diagnósticos técnicos ni cierra inspecciones. El inspector no gestiona cuentas ni publica contenido editorial. El administrador no inspecciona por defecto. |
| RN-04 | El último administrador activo no puede degradarse ni desactivarse. Ningún administrador puede autodegradarse. |
| RN-05 | Todo cambio de rol o estado revoca las sesiones del afectado, incrementa `tokenVersion` y se audita. |
| RN-06 | Los reportes son solo para usuarios autenticados. Un reporte no es un diagnóstico. |
| RN-07 | El reporte conserva su historial aunque se rechace, cierre o convierta. |
| RN-08 | Una inspección enviada se revisa por una persona distinta de quien la envió, salvo excepción `break-glass` auditada. |
| RN-09 | La severidad propuesta la fija el inspector; la severidad confirmada solo la fija el revisor. |
| RN-10 | El cierre de una inspección exige intervención verificada para todo hallazgo que la requiera; los hallazgos sin intervención exigen justificación y revisión. |
| RN-11 | El estado público de conservación se deriva de la última inspección revisada y cerrada. Sin inspección verificada se muestra `unknown` y “Sin inspección verificada”. |
| RN-12 | Un reporte abierto no cambia el estado público de conservación. |
| RN-13 | La evidencia es privada, con hash SHA-256, acceso auditado y retención. Nunca se sirve desde el prefijo público `/api/uploads`. |
| RN-14 | Las transiciones críticas son append-only y fallan si no pueden registrar su evento de dominio. La auditoría no es best-effort para conservación. |
| RN-15 | Las notificaciones se persisten antes de emitirse, con `eventId` único y cursor. Socket.IO transporta eventos; no es la única copia. |
| RN-16 | Las salas de Socket.IO las decide el servidor según rol y pertenencia. El cliente no elige salas arbitrarias. |
| RN-17 | El asistente técnico usa fuentes autorizadas y se abstiene sin evidencia. No usa redes sociales ni reseñas para diagnosticar. |
| RN-18 | La guía turística puede usar fuentes externas, incluidas redes sociales, con etiqueta de confianza, fecha y enlace. |
| RN-19 | El documento UNESCO 100777 es un informe histórico de 2008; no acredita el estado actual. El estado actual sale de informes recientes y de las inspecciones propias. |
| RN-20 | No todo POI del Casco Histórico es UNESCO. `unescoStatus` se registra explícitamente y no se etiqueta automáticamente. |
| RN-21 | Un panorama 360° solo se publica con autoría, licencia, créditos, checksum y estado aprobado. Los panoramas de inspección no se exponen en la API turística. |
| RN-22 | Un POI turístico no patrimonial se presenta como tal: no usa lenguaje de patrimonio ni de conservación, y su clasificación se registra por POI y por fuente. La etiqueta `unesco` no prueba pertenencia al bien (D-24). |
| RN-26 | El check-in turístico y el reporte de conservación son flujos separados. |
| RN-23 | Las reglas de publicación de POI se mantienen: no se publica un POI provisional ni sin fecha de verificación de coordenadas. |
| RN-24 | Los estados se comunican con texto, icono o patrón; nunca solo con color. |
| RN-25 | La marca pública es FALCONSYNC. |
| RN-27 | Chivito es la única voz del guía turístico; no se presenta como inspector, autoridad ni asistente técnico. |
| RN-28 | Los recursos oficiales de marca y Chivito se usan sin sustituirlos, deformarlos ni reinterpretarlos. |
| RN-29 | La celebración de check-in solo aparece tras un `201` con insignia nueva; nunca en error, duplicado, QR inválido o fuera de geocerca. |
| RN-30 | Nombre, descripción, categoría e imagen de la insignia provienen del backend o de su categoría real; la UI no inventa datos. |
| RN-31 | La identidad y el fondo no reducen el contraste ni bloquean la interacción; respetan `prefers-reduced-motion`. |
| RN-32 | La personalidad de Chivito no altera hechos, citas ni abstención del RAG. |

## 5. Historias de usuario

| ID | Como | Quiero | Para | Prioridad | Criterio de aceptación |
|---|---|---|---|---|---|
| HU-01 | Visitante | consultar catálogo, mapa y ficha de un POI | conocer la oferta turística | Alta | El catálogo excluye POI no publicados; la ficha muestra fuentes y estado de conservación verificable. |
| HU-02 | Visitante | explorar una visita 360° | recorrer el patrimonio a distancia | Alta | La escena carga con créditos, hotspots, fallback y navegación por teclado. |
| HU-03 | `user` | registrarme e iniciar sesión | acceder a funciones autenticadas | Alta | Registro, login, refresh y logout funcionan; el token de acceso no se guarda en `localStorage`. |
| HU-04 | `user` | reportar un daño con foto y ubicación | avisar a conservación | Alta | El reporte queda `received`, conserva evidencia y solo lo ven el dueño y el inspector autorizado. |
| HU-05 | `user` | ver mis reportes y su estado | saber qué ocurrió con mi aviso | Alta | Solo veo mis reportes; el estado refleja triaje, conversión o cierre. |
| HU-06 | `historian` | editar historia, fuentes y contenido editorial | mantener la ficha patrimonial | Alta | Puedo editar contenido; no puedo confirmar severidad ni cerrar inspecciones. |
| HU-07 | `historian` | revisar contenido editorial | evitar publicar fuentes débiles | Media | El contenido revisado queda identificado; el no revisado no se publica como verificado. |
| HU-08 | `inspector` | triar reportes recibidos | decidir si requieren inspección | Alta | Puedo aceptar, rechazar o cerrar con motivo; cada acción queda auditada. |
| HU-09 | `inspector` | convertir un reporte en inspección | iniciar el trabajo de campo | Alta | La conversión es idempotente y enlaza reporte e inspección. |
| HU-10 | `inspector` | planificar y ejecutar una inspección | evaluar el activo | Alta | La inspección recorre `planned → in_progress → submitted`; las transiciones inválidas se rechazan. |
| HU-11 | `inspector` | registrar hallazgos con severidad propuesta y evidencia | documentar el daño | Alta | Cada hallazgo conserva categoría, descripción, severidad propuesta y evidencia privada. |
| HU-12 | Inspector revisor | revisar una inspección y confirmar severidad | validar el diagnóstico técnico | Alta | No puedo revisar mi propia inspección; la severidad confirmada queda separada de la propuesta. |
| HU-13 | Inspector revisor | cerrar una inspección con intervención verificada | dar cierre trazable | Alta | No cierro si un hallazgo que requiere intervención no tiene una intervención `verified`. |
| HU-14 | `inspector` | proponer y verificar intervenciones | registrar la solución aplicada | Alta | El verificador es distinto del ejecutor y existe evidencia. |
| HU-15 | Visitante | ver el estado de conservación solo si está verificado | no confundir reportes con diagnósticos | Alta | Sin inspección revisada se muestra “Sin inspección verificada”; un reporte abierto no cambia el estado. |
| HU-16 | `inspector` | ver una bandeja filtrable por lugar, tipo, severidad, estado, fecha y responsable | priorizar el trabajo | Alta | Los filtros se aplican en servidor y respetan la asignación. |
| HU-17 | `inspector` | recibir alertas en tiempo real | reaccionar sin recargar | Alta | Recibo eventos pertinentes; al reconectar recupero los perdidos por cursor. |
| HU-18 | `user` | recibir notificaciones de mis reportes | seguir el avance | Media | Solo recibo notificaciones de mis recursos; puedo marcarlas leídas. |
| HU-19 | `admin` | gestionar cuentas, roles y estado | administrar el sistema | Alta | No puedo degradar al último admin ni autodegradarme; el cambio revoca sesiones y se audita. |
| HU-20 | `admin` | consultar auditoría y registro de fuentes | gobernar el sistema | Media | La auditoría es de solo lectura; no inspecciono por defecto. |
| HU-21 | `inspector` | consultar normativa, arquitectura colonial y técnicas de tapia/adobe | obtener orientación técnica preliminar y contextualizada | Alta | Distingue norma, evidencia e hipótesis; cita fuentes verificadas o se abstiene. No emite diagnóstico definitivo ni prescribe una intervención para un inmueble concreto. |
| HU-22 | Visitante | consultar historia, POI y rutas turísticas sugeridas | planificar una visita informada | Media | Distingue fuente oficial, externa y no verificada; usa el corpus curado y se abstiene si no hay evidencia. Las rutas no garantizan acceso, horario, seguridad ni accesibilidad. La búsqueda externa en vivo queda diferida. |
| HU-23 | Historiador | validar la identidad, el nivel, los derechos y la vigencia de las fuentes RAG, y proponer altas, versiones y retiros | mantener un corpus trazable y autorizado | Alta | Cada propuesta identifica documento, página, sección y checksum; la mutación la ejecuta administración con `source.manage`; una versión nueva no borra la anterior. |
| HU-24 | Operador | desplegar, monitorear, respaldar y revertir | operar el servicio | Alta | Existe restauración probada, monitoreo, alertas y rollback documentado. |
| HU-25 | Soporte | diagnosticar un incidente | reducir el tiempo de reparación | Media | Los logs tienen `correlationId` y no exponen secretos ni datos personales innecesarios. |
| HU-26 | Visitante | reconocer FalconSync por su nueva identidad visual | sentir una plataforma turística propia de Falcón | Alta | Logo en header/auth/admin, favicon válido, fondo legible en 390/768/1440, sin scroll horizontal y contraste AA. |
| HU-27 | Visitante | conversar con Chivito, mi guía turístico | descubrir Coro y los POI con respuestas citadas | Alta | Chivito tiene nombre, rol y avatar; los mensajes se distinguen; hay saludo, indicador de espera, error/reintento y citas; el modo técnico no usa Chivito; no se afirma IA generativa. |
| HU-28 | Turista | que Chivito celebre mi check-in y me muestre la insignia ganada | sentir la recompensa y continuar explorando | Alta | El modal solo aparece con `201` e insignia nueva; muestra badge y POI reales; cierra con botón, Escape o fondo; enlaza al perfil; no aparece en error/duplicado/sin insignia; el doble envío se bloquea. |
| HU-29 | Usuario con diversidad funcional | usar la identidad, el chat y la celebración con teclado, lector y movimiento reducido | participar sin barreras | Alta | Foco visible y atrapado en el modal; etiquetas; contraste; estados no cromáticos; responsive; `prefers-reduced-motion`. |

## 6. Requisitos funcionales

### 6.1 Identidad, roles y administración

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-01 | Mantener registro, login, refresh rotativo, logout, `me` y cambio de contraseña. | Alta | HU-03 |
| RF-02 | Añadir `historian` e `inspector` al modelo de usuario y migrar `moderator` con expand-contract. | Alta | HU-06, HU-08, HU-19 |
| RF-03 | Aplicar capacidades en el servidor; el guard de Angular solo mejora la experiencia. | Alta | Todas |
| RF-04 | Permitir al admin cambiar rol y estado, revocar sesiones y consultar auditoría. | Alta | HU-19 |
| RF-05 | Exigir reautenticación con contraseña actual para cambios sensibles de cuenta. | Alta | HU-19 |
| RF-06 | Proteger al último administrador activo y prohibir la autodegradación. | Alta | HU-19 |
| RF-07 | Revocar sesiones e incrementar `tokenVersion` al cambiar rol o estado. | Alta | HU-19 |
| RF-08 | Registrar evento obligatorio de cambio de rol, estado y revocación. | Alta | HU-19 |
| RF-09 | Ofrecer `break-glass` de inspección solo a admin, con motivo, aprobación, vigencia y auditoría. | Media | HU-19 |
| RF-10 | Exponer etiquetas visibles: Turista, Historiador, Inspector, Administrador. | Media | Todas |

### 6.2 Inventario patrimonial

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-11 | Crear y mantener `HeritageAsset` con código único, tipo, estado, geometría y nivel de protección. | Alta | HU-10 |
| RF-12 | Enlazar opcionalmente un activo con un POI; no todo POI es activo ni toda edificación es POI. | Alta | HU-10 |
| RF-13 | Registrar `unescoStatus` explícito y no etiquetar automáticamente todo el Casco Histórico como UNESCO. | Alta | HU-15 |
| RF-14 | Mantener índices por tipo, estado, `unescoStatus` y ubicación. | Media | HU-16 |
| RF-15 | Permitir que el historiador enlace fuentes y contenido editorial al activo sin modificar datos técnicos. | Media | HU-06 |

### 6.3 Reportes e inspecciones

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-16 | Crear reportes autenticados con categoría, descripción, fecha de captura, GPS y evidencia opcional. | Alta | HU-04 |
| RF-17 | Listar los reportes propios y, para inspector, los reportes autorizados. | Alta | HU-05, HU-08 |
| RF-18 | Triar reportes con aceptar, rechazar o cerrar, motivo y evento. | Alta | HU-08 |
| RF-19 | Convertir un reporte aceptado en inspección de forma idempotente. | Alta | HU-09 |
| RF-20 | Crear, asignar y planificar inspecciones. | Alta | HU-10 |
| RF-21 | Implementar la máquina de estados de inspección y rechazar transiciones inválidas. | Alta | HU-10, HU-12, HU-13 |
| RF-22 | Registrar hallazgos con categoría, descripción, severidad propuesta y evidencia. | Alta | HU-11 |
| RF-23 | Separar severidad propuesta de confirmada; solo el revisor confirma. | Alta | HU-12 |
| RF-24 | Impedir que el inspector revise su propia inspección, salvo `break-glass` auditado. | Alta | HU-12 |
| RF-25 | Proponer, aprobar, ejecutar, completar y verificar intervenciones con evidencia. | Alta | HU-14 |
| RF-26 | Exigir verificador distinto del ejecutor. | Alta | HU-14 |
| RF-27 | Cerrar inspección solo con intervenciones verificadas o justificación revisada. | Alta | HU-13 |
| RF-28 | Calcular el estado público desde la última inspección revisada y cerrada. | Alta | HU-15 |
| RF-29 | Mostrar fecha de última inspección y “Sin inspección verificada” cuando corresponda. | Alta | HU-15 |
| RF-30 | Mantener historial append-only de reporte, inspección, hallazgo e intervención. | Alta | HU-05, HU-13 |
| RF-31 | Usar versionado optimista (`version`/`If-Match`) en transiciones críticas. | Alta | HU-10, HU-13 |
| RF-32 | Filtrar la bandeja por lugar, tipo, severidad, estado, fecha y responsable. | Alta | HU-16 |
| RF-33 | Crear índices geoespaciales y de consulta para priorización. | Media | HU-16 |
| RF-34 | Mantener separado el check-in turístico del reporte de conservación. | Alta | HU-04 |

### 6.4 Evidencia

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-35 | Subir evidencia privada asociada a reporte, inspección o intervención. | Alta | HU-04, HU-11, HU-14 |
| RF-36 | Validar firma binaria, decodificación real, MIME, dimensiones y tamaño. | Alta | HU-04 |
| RF-37 | Extraer fecha de captura y GPS antes de eliminar EXIF; luego eliminar metadatos. | Alta | HU-04 |
| RF-38 | Calcular SHA-256 al guardar y verificar al leer. | Alta | HU-04 |
| RF-39 | Poner la evidencia en `pending_scan` y cuarentena si el análisis falla. | Alta | HU-04 |
| RF-40 | Desactivar la subida de evidencia en producción si no hay análisis antimalware. | Alta | HU-04 |
| RF-41 | Servir evidencia solo por endpoint autorizado o URL firmada de corta duración. | Alta | HU-04 |
| RF-42 | Registrar cada acceso a evidencia con actor, fecha, IP, agente y motivo. | Alta | HU-20 |
| RF-43 | Aplicar retención, bloqueo legal y borrado lógico auditado. | Media | HU-20 |

### 6.5 Tiempo real

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-44 | Refactorizar `server.js` para separar creación HTTP y Socket.IO; los tests siguen usando `createApp()`. | Alta | HU-17 |
| RF-45 | Emitir ticket de corta duración, un solo uso, para el handshake. | Alta | HU-17 |
| RF-46 | Decidir salas en servidor por usuario, rol y asignación. | Alta | HU-17, HU-18 |
| RF-47 | Persistir notificación antes de emitir, con `eventId` único y cursor. | Alta | HU-17, HU-18 |
| RF-48 | Emitir al menos `notification.created`, `inspection.updated` y `report.created`. | Alta | HU-17 |
| RF-49 | Recuperar eventos perdidos al reconectar con `lastCursor`. | Alta | HU-17 |
| RF-50 | Soportar `ack`, deduplicación, límite de conexiones y frecuencia. | Media | HU-17 |
| RF-51 | Documentar una instancia o clúster con sesiones pegajosas y adaptador Redis. | Media | HU-24 |
| RF-52 | Configurar Nginx para `Upgrade` y `Connection` con timeout mayor que el heartbeat. | Media | HU-24 |

### 6.6 RAG y asistentes

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-53 | Registrar cada fuente con título, institución, versión, fecha, páginas, licencia, derechos, checksum, nivel, `usagePolicy`, `indexingPolicy` y estado. | Alta | HU-23 |
| RF-54 | Ingerir documentos autorizados conservando página y sección. | Alta | HU-23 |
| RF-55 | Fragmentar en 3–6 frases con `chunkKey` legible, manteniendo trazabilidad al fragmento. | Alta | HU-23 |
| RF-56 | Usar recuperación léxica con filtros de metadatos como línea base; vectores solo tras evaluación. | Alta | HU-21, HU-22 |
| RF-57 | Responder con citas verificadas contra fragmentos recuperados. | Alta | HU-21, HU-22 |
| RF-58 | Abstenerse cuando la recuperación sea débil o no cubra la pregunta, con un motivo explícito. | Alta | HU-21, HU-22 |
| RF-59 | Separar asistente técnico (A/B/C técnico) de guía turística (A–E con etiqueta). | Alta | HU-21, HU-22 |
| RF-60 | (Diferido a v1.1) Búsqueda externa para POI sin fuente curada. En v1 el asistente responde solo con el corpus registrado y se abstiene si no hay evidencia. | Baja | HU-22 |
| RF-61 | Etiquetar UNESCO 100777 como histórico 2008 y no usarlo como estado actual. | Alta | HU-21, HU-22 |
| RF-62 | Impedir que el asistente ejecute escrituras, cierres, asignaciones o publicaciones. | Alta | HU-21 |
| RF-63 | Defenderse de instrucciones embebidas en documentos y consultas (inyección de prompt). | Alta | HU-21 |
| RF-64 | Aplicar cuota por usuario o IP, caché, límite de latencia y registro de consultas. El coste externo por consulta es 0 en v1. | Media | HU-24 |
| RF-65 | No persistir conversaciones turísticas anónimas; retener las técnicas 90 días con control de acceso al historial. | Media | HU-20 |
| RF-66 | Evaluar recuperación y respuestas con un conjunto dorado de 60 preguntas. | Alta | HU-21, HU-22 |

### 6.7 Visita 360°, audio e idiomas

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-67 | Modelar `Panorama` con activo/POI, título, imagen, proyección, checksum, autor, licencia, fecha y estado. | Alta | HU-02 |
| RF-68 | Publicar solo panoramas aprobados y con derechos documentados. | Alta | HU-02 |
| RF-69 | Ofrecer visor 360° con hotspots, navegación por teclado y fallback estático. | Alta | HU-02 |
| RF-70 | Separar panoramas públicos de panoramas de inspección. | Alta | HU-02 |
| RF-71 | Añadir `AudioGuide` solo si se confirma: idioma, audio, transcripción, duración, licencia y estado. | Condicional | HU-02 |
| RF-72 | Añadir contenido multilingüe solo si se confirma: idioma, fallback y revisión editorial. | Condicional | HU-02 |

### 6.8 Interfaz y accesibilidad

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-73 | Mantener `/admin` exclusivo de administradores. | Alta | HU-19 |
| RF-74 | Crear `/inspecciones` para inspector/revisor y `/reportes` para usuario autenticado. | Alta | HU-04, HU-08 |
| RF-75 | Aplicar tokens visuales FALCONSYNC y fuentes autoalojadas Playfair Display e Inter. | Alta | Todas |
| RF-76 | Verificar contraste WCAG 2.2 AA y no usar color como único indicador. | Alta | Todas |
| RF-77 | Ofrecer foco visible, teclado, etiquetas, zoom y movimiento reducido. | Alta | Todas |
| RF-78 | Mostrar estados de carga, error, vacío y recuperación accionable. | Media | Todas |
| RF-79 | Mostrar en el mapa solo conservación respaldada por inspección revisada. | Alta | HU-15 |
| RF-80 | Incluir centro de notificaciones y reconexión visible. | Media | HU-17, HU-18 |
| RF-81 | Mostrar citas, fuentes y abstención en el asistente. | Alta | HU-21, HU-22 |
| RF-88 | Presentar orientación técnica sobre arquitectura colonial y tapia/adobe como preliminar, diferenciando normas, hechos e hipótesis; no prescribir intervenciones específicas ni sustituir una inspección profesional. | Alta | HU-21 |
| RF-89 | Sugerir recorridos solo entre POI registrados y no afirmar condiciones actuales de acceso, horario, seguridad o accesibilidad sin una fuente vigente. | Media | HU-22 |
| RF-90 | Integrar logo oficial, variantes y favicon en header, autenticación, administración y metadatos. | Alta | HU-26 |
| RF-91 | Aplicar tokens de color, tipografía y espaciado, y el fondo de Médanos con capas de legibilidad responsive. | Alta | HU-26, HU-29 |
| RF-92 | Generar los recursos derivados de forma reproducible desde los maestros con `npm run brand:assets`. | Alta | HU-26 |
| RF-93 | Presentar el chat como Chivito, con avatar, rol, saludo, estados y citas, reutilizando `/api/assistant/tourist/query`. | Alta | HU-27 |
| RF-94 | Mantener el modo técnico separado; Chivito no aparece como asistente técnico. | Alta | HU-27 |
| RF-95 | Mostrar un diálogo de celebración accesible con la insignia y el POI reales tras un check-in válido. | Alta | HU-28 |
| RF-96 | No abrir la celebración en errores, duplicados, QR inválido, fuera de geocerca o cuando no hay insignia nueva. | Alta | HU-28 |
| RF-97 | Actualizar pruebas unitarias, E2E, documentación y contratos afectados. | Alta | Todas |
| RF-98 | Proporcionar medallones de categoría para insignias con `image: null`, derivados de la categoría real. | Media | HU-28 |

### 6.9 Operación y administración

| ID | Requisito | Prioridad | HU |
|---|---|---|---|
| RF-82 | Ampliar el panel admin con roles, estado, revocación y registro de fuentes. | Alta | HU-19, HU-20 |
| RF-83 | Exponer health/readiness y métricas de latencia, errores y saturación. | Alta | HU-24 |
| RF-84 | Emitir logs estructurados con `correlationId` y sin secretos. | Alta | HU-25 |
| RF-85 | Documentar y probar backup, restauración y rollback. | Alta | HU-24 |
| RF-86 | Ejecutar CI con replica set, suites nuevas y artefactos. | Alta | HU-24 |
| RF-87 | Mantener OpenAPI, ADR, README y documentación alineados con el código. | Media | Todas |

## 7. Requisitos no funcionales

| ID | Requisito | Objetivo | Verificación |
|---|---|---|---|
| RNF-01 | Disponibilidad pública | 99.5 % mensual, excluyendo mantenimiento planificado | Comprobación sintética cada minuto desde dos regiones |
| RNF-02 | Disponibilidad interna de inspección | 99.0 % en horario de campo | Igual, con ventana declarada |
| RNF-03 | RPO | 1 h para base y evidencia; 24 h si el proveedor solo ofrece backup diario, compensado con versionado | Última copia verificada |
| RNF-04 | RTO | 4 h para servicio completo | Simulacro de restauración |
| RNF-05 | MTTR crítico | 4 h | Incidentes reales |
| RNF-06 | Flujo de reporte | p95 ≤ 45 s con foto en 4G, desde “Reportar” hasta confirmación 201 | Medición con muestra y entorno |
| RNF-07 | GPS | 90 % de lecturas con precisión reportada ≤ 10 m | Muestra de dispositivos; lecturas peores se marcan |
| RNF-08 | RAG, primera respuesta visible | p95 ≤ 2 s corpus interno; ≤ 4 s con búsqueda externa | Medición separada de recuperación y primer token |
| RNF-09 | RAG, respuesta completa | p95 ≤ 8 s para hasta 500 tokens | Medición extremo a extremo |
| RNF-10 | Accesibilidad | WCAG 2.2 AA | Automatizado + revisión manual |
| RNF-11 | Seguridad | Sin hallazgos críticos o altos abiertos | Auditoría, pruebas de autorización y `npm audit` |
| RNF-12 | Privacidad | Minimización, retención y acceso por necesidad | Revisión de datos y logs |
| RNF-13 | Observabilidad | Health, métricas, logs con `correlationId` y alertas de SLO | Revisión en staging |
| RNF-14 | Backups | 3-2-1; restauración probada antes del lanzamiento y tras cambios de esquema | Acta de simulacro |
| RNF-15 | Escalabilidad | Una instancia documentada; clúster con Redis y sesiones pegajosas | Prueba de carga |
| RNF-16 | Compatibilidad | Angular 21.2.26, Node 26.13, MongoDB 9, Express 5, ESM | Build y pruebas |
| RNF-17 | Mantenibilidad | OpenAPI, ADR, documentación como código y changelog | Revisión de release |
| RNF-18 | Pruebas | Cada transición y cada permiso nuevo tiene caso permitido y denegado | Matriz de pruebas |
| RNF-19 | Internacionalización | Español primero; multilingüe solo si se confirma | Revisión de alcance |
| RNF-20 | Licencias | Fuentes, imágenes, panoramas y audio con derechos documentados | Registro de fuentes |
| RNF-21 | Offline | No se promete funcionamiento offline desde navegador móvil | Revisión de alcance |
| RNF-22 | Integridad | Eventos append-only y concurrencia optimista en transiciones críticas | Pruebas de concurrencia |
| RNF-23 | Coste RAG | Cuota, caché y coste por consulta medidos | Panel de coste |
| RNF-24 | Marca | FALCONSYNC en interfaz, documentación y metadatos | Revisión visual |
| RNF-25 | Accesibilidad visual | WCAG 2.2 AA: contraste 4.5:1, foco, teclado y estados no cromáticos | Revisión manual + pruebas E2E |
| RNF-26 | Rendimiento de recursos | Fondo WebP ≤ 350 KB; logo ≤ 350 KB; avatares ≤ 120 KB; sin dependencias nuevas | Revisión de tamaños en build |
| RNF-27 | Movimiento | Respetar `prefers-reduced-motion`; sin animaciones permanentes | Revisión CSS + captura |
| RNF-28 | Reproducibilidad | `npm run brand:assets` regenera logo, favicons, avatar, poses y fondo | Ejecución del script |

## 8. Trazabilidad RN → HU → RF/RNF

| RN | HU | RF / RNF |
|---|---|---|
| RN-01, RN-02 | HU-03, HU-06, HU-08, HU-19 | RF-02, RF-10, RNF-18 |
| RN-03 | HU-06, HU-08, HU-12, HU-19, HU-20 | RF-03, RF-23, RF-24, RF-73, RF-74 |
| RN-04, RN-05 | HU-19 | RF-05, RF-06, RF-07, RF-08 |
| RN-06, RN-07 | HU-04, HU-05, HU-08 | RF-16, RF-17, RF-18, RF-30 |
| RN-08, RN-09, RN-10 | HU-12, HU-13, HU-14 | RF-21, RF-23, RF-24, RF-26, RF-27 |
| RN-11, RN-12 | HU-15 | RF-28, RF-29, RF-79 |
| RN-13, RN-14 | HU-04, HU-11, HU-13, HU-20 | RF-35 a RF-43, RF-30, RNF-22 |
| RN-15, RN-16 | HU-17, HU-18 | RF-44 a RF-52 |
| RN-17, RN-18, RN-19 | HU-21, HU-22, HU-23 | RF-53 a RF-66 |
| RN-20 | HU-15, HU-22 | RF-13, RF-60 |
| RN-21 | HU-02 | RF-67 a RF-70 |
| RN-26 | HU-04 | RF-34 |
| RN-23 | HU-01 | RF-01, reglas de POI vigentes |
| RN-24 | Todas | RF-76, RF-77 |
| RN-25 | Todas | RNF-24 |
| RN-27 | HU-27 | RF-93, RF-94 |
| RN-28 | HU-26 | RF-90, RF-92, RNF-28 |
| RN-29 | HU-28 | RF-95, RF-96 |
| RN-30 | HU-28 | RF-95, RF-98 |
| RN-31 | HU-26, HU-29 | RF-91, RNF-25, RNF-27 |
| RN-32 | HU-27 | RF-93, RF-94; RF-57, RF-58, RF-81 |

## 9. Criterios de aceptación por fase

| Fase | Criterio de aceptación |
|---|---|
| 0 | Requisitos, RBAC, fuentes, threat model, SLO y ADR aprobados; baseline reproducible; CI remoto verde o ejecución reproducible registrada. |
| 1 | Modelo de dominio, estados, ER, OpenAPI, wireframes y eventos revisados; no se programa antes de aprobar el contrato. |
| 2 | Matriz rol × capacidad probada; cero `moderator`; último admin protegido; sesiones revocadas; IDOR cubierto. |
| 3 | Flujo reporte → inspección → hallazgo → intervención → cierre E2E; historial conservado; evidencia privada; transiciones inválidas rechazadas. |
| 4 | Handshake autorizado; salas server-side; notificaciones persistidas; reconexión y duplicados probados; carga medida. |
| 5 | Citas válidas; abstención sin evidencia; conjunto dorado evaluado; fuentes autorizadas; coste y latencia medidos. |
| 6 | Derechos documentados; contenido aprobado; 360 accesible; sin datos privados; fallback probado. |
| 7 | WCAG 2.2 AA; contraste, teclado, foco, responsive y estados no cromáticos verificados. |
| 8 | Métricas con muestra, entorno, método y resultado; sin defectos críticos/altos; acta de piloto. |
| 9 | Restauración probada; rollback probado; smoke tests; SLO monitoreado; runbook. |
| 10 | Documentación coincide con lo desplegado; licencias completas; aceptación firmada. |

## 10. Supuestos y dependencias

- El PDF del documento UNESCO 100777 se recibió localmente (SHA-256 en `docs/FUENTES-RAG.md`). Su identidad frente al original y sus derechos siguen pendientes.
- El estado actual del patrimonio requiere informes SOC recientes y decisiones 48COM/47COM,
  además de las inspecciones propias.
- En v1 no hay proveedor externo de LLM ni de embeddings (decisión del 2026-11-17). Si se aprueba uno en el futuro, se documentarán su retención y su tratamiento de datos.
- El almacén vectorial solo se decide si la evaluación léxica no alcanza. El MongoDB local no acredita búsqueda vectorial.
- Los derechos de las imágenes 360° y de las 18 imágenes de POI con autoría pendiente deben
  verificarse antes de publicar.
- El hosting, dominio, TLS y la decisión instancia/clúster no están cerrados.
- La autoridad patrimonial debe autorizar el piloto y validar contenido.
- La app móvil queda fuera; la captura de campo se hará por web en esta etapa.

## 11. Control de cambios

Toda modificación de alcance, regla de negocio o criterio de aceptación debe:

1. registrarse en este documento y en el plan;
2. indicar el requisito, la historia y la prueba afectada;
3. actualizar la matriz RBAC o el registro de fuentes si corresponde;
4. aprobarse antes de implementar el cambio;
5. conservar la versión anterior para trazabilidad.
