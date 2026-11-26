Plan sénior para culminar FALCONSYNC
El objetivo es terminar FALCONSYNC, no “CoroPatrimonio 360”. Tomo como base el estado más reciente registrado en el Plan de implementación: la web turística ya tiene funciones reales, los roles están avanzando y hay una primera API de conservación, pero esta todavía no completa un flujo usable de principio a fin.

Primero hay que acordar qué significa “al 100%”: 100% del alcance aprobado, construido, probado, operable y aceptado; no todas las ideas posibles. El plan vigente deja fuera la app Android nativa y el modo offline, mientras que audio e idiomas siguen condicionales. Si cualquiera de esas funciones debe ser requisito de lanzamiento, hay que incorporarla formalmente al alcance antes de comprometer fechas. La descripción de la app móvil confirma que hoy solo existe un esqueleto.

Fases y puertas de salida
Fase	Objetivo	Se considera terminada cuando…
0. Cerrar alcance y gobierno	Acordar qué entra en el lanzamiento, quién aprueba contenido y quién acepta el producto. Resolver decisiones abiertas: proveedor y costos de IA, región y retención, fuentes, derechos 360°, audio e idiomas. Registrar explícitamente el alcance móvil.	Existe un alcance de lanzamiento aprobado, responsables identificados y ninguna decisión sin resolver que bloquee una función incluida.
1. Congelar diseño y contratos	Revisar requisitos e historias; cerrar el modelo POI ↔ activo patrimonial; aprobar estados y transiciones; conciliar OpenAPI con la API real; definir permisos, errores, evidencia y pantallas.	Los requisitos trazan a diseño, código y prueba; el contrato aprobado coincide con lo que se implementará.
2. Terminar RBAC y migración de roles	Verificar permisos en servidor, mantener protecciones de administración y migrar moderator de forma reversible, con respaldo, simulación y revisión.	La migración fue autorizada y verificada; no quedan cuentas con roles heredados; las pruebas cubren permisos permitidos y denegados.
3. Completar conservación, evidencia e interfaz	Entregar el flujo vertical completo descrito abajo. Es la prioridad funcional principal.	Un usuario puede reportar y consultar su caso; un inspector asignado puede inspeccionar, registrar hallazgos y evidencia; un revisor autorizado puede decidir; el cierre conserva historial. Todo está probado de extremo a extremo.
4. Notificaciones en tiempo real	Añadir notificaciones persistentes, autorización de conexiones y salas, reconexión y recuperación de eventos.	Las notificaciones no se pierden al desconectarse, no se filtran entre usuarios y la deduplicación y recuperación están probadas.
5. Asistentes RAG	Registrar fuentes con derechos y versión, construir la ingesta y recuperación, y ofrecer asistentes turístico y técnico con citas.	Cada respuesta puede rastrearse a fuentes autorizadas; el asistente se abstiene si no hay evidencia y no se presenta como inspector ni autoridad.
6. Visita 360°	Incorporar escenas, hotspots y contenido aprobado con derechos y separación estricta del material privado de inspección.	El contenido publicado tiene derechos documentados; el visor tiene alternativa sin WebGL y cumple los criterios de accesibilidad y privacidad acordados.
7. Identidad y accesibilidad	Consolidar marca, estilos, responsive y accesibilidad en la experiencia pública y administrativa.	La marca del producto es FALCONSYNC en interfaz, documentación y metadatos; teclado, contraste, foco, móvil y estados de interfaz fueron revisados.
8. Pruebas integrales y piloto	Validar el producto completo en condiciones representativas, incluyendo contenido, permisos, experiencia de campo y riesgos.	El piloto tiene resultados y aceptación documentados; no quedan defectos críticos o altos abiertos.
9. Despliegue y operación	Preparar entornos, secretos, TLS, CI, monitoreo, backups, restauración y rollback.	El despliegue es repetible; restauración y rollback se demostraron; las métricas y alertas acordadas están activas.
10. Cierre y transferencia	Actualizar documentación, guías, operación y soporte; entregar el producto a sus responsables.	La documentación coincide con la versión desplegada, hay responsables operativos y se acepta formalmente la entrega.
Las fases respetan la estructura del plan del repositorio. La diferencia es que en la Fase 3 propongo cuatro entregas internas para que no se dé por terminada una API sin una experiencia verificable:

Fase 3A: API y dominio de conservación
Hay modelos y rutas iniciales para activos, reportes, inspecciones, intervenciones y eventos; no equivalen todavía a un módulo completo. Hay que finalizar transiciones válidas, concurrencia, idempotencia, autorización por recurso y manejo consistente de errores. También debe quedar definido cuándo un reporte se convierte en inspección y de dónde sale el estado público de conservación: solo de información revisada y con evidencia, no de una fuente histórica o una inferencia.

Fase 3B: evidencia privada
Antes de permitir el cierre real de intervenciones, implementar carga privada y autorización por recurso, validación de contenido, hash, eliminación de metadatos sensibles, registro de accesos y retención. Si se requiere análisis antivirus, el comportamiento de producción debe quedar definido; no se debe habilitar una ruta insegura como alternativa silenciosa. El detalle de los controles previstos está en SEGURIDAD.md.

Fase 3C: interfaz de usuario e inspector
Crear las pantallas de reportes propios y la consola de inspecciones asignadas: ejecutar inspección, documentar hallazgos, adjuntar evidencia, revisar, proponer intervención y cerrar. Los guards del frontend ayudan a la experiencia, pero los permisos deben aplicarse en el backend. Cada pantalla debe contemplar carga, errores, estados vacíos y denegaciones.

Fase 3D: recorrido de extremo a extremo
Probar el recorrido completo desde el navegador hasta MongoDB, incluidos fallos, permisos incorrectos, duplicados y recursos ajenos. El plan ya señala que la integración de conservación requiere un MongoDB replica set; el entorno standalone que se menciona como activo no basta para considerar validado ese flujo.

Trabajo que debe avanzar en paralelo
Hay tres líneas que conviene iniciar sin esperar a que termine todo el desarrollo:

Contenido y datos: verificar en campo los POI, revisar sus coordenadas, fuentes, imágenes, autoría y licencias. La fecha de revisión documental no demuestra una visita o inspección en campo.
Decisiones y contratos: cerrar la revisión de diseño y el contrato API, mientras se prepara la migración de roles sin ejecutarla hasta tener respaldo, simulación revisada y autorización.
Calidad y operación: mantener pruebas, seguridad y accesibilidad como puertas de cada entrega, no como una tarea final.
Para RAG, el corpus requiere responsables, derechos y evaluación antes de conectar un proveedor. Para 360°, la captura y los derechos también pueden prepararse en paralelo, pero la publicación debe esperar aprobación del contenido. Los requisitos de fuentes están descritos en FUENTES-RAG.md.

Próximo incremento recomendado
Yo empezaría así:

Reconciliar el estado y revalidar el baseline en el árbol actual. El plan registra pruebas anteriores —89 backend, 53 frontend y 17 E2E—, pero también indica que los últimos cambios no tuvieron una verificación integral y que la integración de conservación quedó bloqueada por el replica set.
Cerrar el contrato de conservación y las decisiones bloqueantes de Fases 0 y 1.
Preparar el entorno de integración con replica set y completar evidencia privada antes de terminar la interfaz.
Entregar un solo recorrido vertical funcional de reporte a cierre, con UI y pruebas de autorización.
Solo después ampliar a Socket.IO, RAG y 360°, respetando las dependencias y decisiones aprobadas.
No fijaría todavía una fecha de terminación: depende de capacidad del equipo, aprobaciones externas, trabajo de campo, derechos y proveedor. Después de cerrar la Fase 0 sí se puede estimar cada entrega con responsables y duración.

Definición de “100%”
FALCONSYNC estará listo dentro del alcance acordado cuando:

Todos los requisitos incluidos estén trazados y aceptados.
Los flujos críticos funcionen desde la interfaz hasta la base de datos.
Las pruebas unitarias, API, E2E, seguridad y accesibilidad estén ejecutadas y documentadas.
El CI remoto esté verificado; no basta con que el workflow exista.
No haya hallazgos críticos o altos abiertos.
Contenido, imágenes y escenas publicadas tengan fuentes y derechos revisados.
Backups, restauración, monitoreo, runbooks y rollback hayan sido probados.
Los responsables de contenido y operación acepten la entrega.
La documentación describa la versión real y cualquier exclusión esté declarada.
La app móvil, el modo offline, audio e idiomas no deben quedar ambiguos: o se agregan al alcance con requisitos, diseño, pruebas y aceptación propios, o se declaran expresamente fuera de esta entrega.

Este plan usa como fuente principal el Plan de implementación y la especificación de requisitos. También toma en cuenta las transcripciones locales de las Unidades 2–7 para análisis, desarrollo, pruebas, documentación, despliegue y soporte; no atribuye funcionalidades del producto al material académico. No modifiqué archivos ni ejecuté pruebas al preparar este plan.

https://github.com/kaankiziltug/logo-design-skill