# ADR-009 — Canal de Telegram vía MCP con identidad vinculada

| Campo | Valor |
|---|---|
| Fecha | 2026-11-25 |
| Estado | Aceptada e implementada (MVP) |
| Decisores | Responsable del proyecto, agente de construcción |
| Relacionados | [`../INTEGRACION-TELEGRAM.md`](../INTEGRACION-TELEGRAM.md), [`../SEGURIDAD.md`](../SEGURIDAD.md), [`../OPERACION.md`](../OPERACION.md), [`../openapi.yaml`](../openapi.yaml), [`../../AGENTS.md`](../../AGENTS.md) |

## Contexto

FalconSync ya tiene una guía RAG HTTP, catálogo público de POI y un flujo formal de
reportes de conservación. No existía ningún canal de mensajería ni servidor MCP. El
documento `memory/unefa-starter-kit-adaptation.md` registraba que no había contrato
aprobado para Telegram ni conectores externos.

La necesidad es permitir que una persona consulte la guía y los recorridos desde
Telegram y, si vincula su cuenta, reporte incidencias patrimoniales con el mismo flujo
de conservación del sitio web.

## Decisión

1. **Adaptador de Telegram con `grammY`**, como proceso separado
   (`bin/telegramBot.js`), no dentro de la SPA ni de OpenCode.
2. **Servidor MCP propio por stdio** (`bin/mcpServer.js`), lanzado como proceso hijo
   del bot. No se expone un puerto MCP ni se usa un MCP de Telegram de terceros.
3. **Lectura anónima:** guía, búsqueda de lugares y recorridos no exigen cuenta.
4. **Escritura vinculada:** solo una cuenta de FalconSync con `report.create` puede
   crear incidencias. El vínculo se autoriza con un código de un solo uso generado
   desde el perfil web, que ofrece un deep link `?start=CODIGO` además del envío
   manual.
5. **Polling por defecto.** El webhook queda como opción para producción con HTTPS,
   `TELEGRAM_WEBHOOK_URL` y `TELEGRAM_WEBHOOK_SECRET`.
6. **Sin fotos en v1.** Producción bloquea la evidencia hasta desplegar antimalware.
7. **Rutas curadas.** Se reutiliza la «Ruta del Casco Histórico de Coro» como
   recorrido recomendado, con aviso de que no es navegación paso a paso.
8. **Idempotencia en dos niveles:** `TelegramUpdate` descarta reintentos de Telegram
   y `Report.sourceActionKey` impide duplicar un reporte.
9. **Datos mínimos:** se guarda el ID de Telegram, el chat y el vínculo; no se guardan
   contraseñas ni el historial de mensajes.
10. **Avisos best-effort:** el autor vinculado recibe un mensaje cuando su incidencia
    cambia de estado; un fallo de Telegram no revierte la transición de conservación.

## Consecuencias

- El bot puede operar sin exponer la API a Internet: el MCP habla por stdin/stdout.
- La guía y las rutas funcionan aunque el usuario no tenga cuenta.
- Los reportes conservan trazabilidad, autoría y auditoría del flujo existente.
- El costo externo es cero: Telegram Bot API y RAG local.
- El chat web enlaza al bot y el perfil puede vincular con un deep link.
- Limitaciones: un solo proceso de polling por bot; sin fotos; sin rutas giro a giro;
  los avisos cubren triaje y conversión, no cada evento de inspección.

## Alternativas consideradas

| Alternativa | Motivo de rechazo |
|---|---|
| MCP de Telegram de terceros | No es un runtime de producto; añade un intermediario innecesario y no resuelve identidad ni autorización. |
| Ejecutar el bot dentro de OpenCode | OpenCode es un agente de desarrollo, no un servicio multiusuario con SLA. |
| MCP por HTTP público | Más superficie de red y autenticación de servicio para un solo cliente. Stdio es suficiente en v1. |
| Bot que llame directo a la API REST | Duplica autenticación y no deja una capa de herramientas reutilizable. |
| Reportes anónimos | El modelo exige `reporterId` y responsabilidad; se rechaza. |
| Fotos en v1 | Producción responde `503 EVIDENCE_SCAN_UNAVAILABLE` hasta tener antimalware. |

## Seguimiento

- Evaluar MCP por Streamable HTTP cuando existan más clientes (WhatsApp, widget web).
- Añadir fotos cuando el antimalware y la cuarentena estén operativos.
- Evaluar rutas peatonales reales con geometría, accesibilidad y cierres.
- Notificar al inspector por un canal aprobado cuando el flujo de triaje lo requiera.
