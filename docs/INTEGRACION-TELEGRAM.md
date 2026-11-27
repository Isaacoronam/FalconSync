# Integración de Telegram vía MCP — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.1 |
| Fecha | 2026-11-25 |
| Estado | Implementado (MVP); polling, sin fotos, con recorrido curado y avisos de estado |
| Decisión | [`ADR/ADR-009-telegram-mcp.md`](./ADR/ADR-009-telegram-mcp.md) |
| Documentos relacionados | [`SEGURIDAD.md`](./SEGURIDAD.md), [`OPERACION.md`](./OPERACION.md), [`openapi.yaml`](./openapi.yaml), [`FUENTES-RAG.md`](./FUENTES-RAG.md) |

## 1. Alcance

El canal de Telegram permite:

- consultar la guía patrimonial con las mismas citas y abstenciones del sitio web;
- buscar lugares publicados, ver los cercanos y consultar la «Ruta del Casco Histórico de Coro»;
- vincular una cuenta de FalconSync con un código de un solo uso o con un enlace directo;
- crear reportes de conservación con texto y ubicación;
- consultar, paginar y abrir el detalle de las incidencias propias;
- recibir un aviso cuando cambia el estado de una incidencia creada por Telegram.

No permite en v1: fotos, reportes anónimos, rutas giro a giro, pagos, reservas ni
notificaciones de cada evento de inspección.

## 2. Arquitectura

```text
Usuario de Telegram
        │ Bot API (polling o webhook)
        ▼
bin/telegramBot.js  ── grammY + máquina de estados
        │ MCP Client (stdio)
        ▼
bin/mcpServer.js  ── @modelcontextprotocol/sdk
        │
        ▼
microservices/mcp/tools.js
        │
        ├── assistantService (guía RAG)
        ├── Location / Adventure (POI y rutas)
        ├── channelLinkService (vínculo)
        └── conservationService (reportes)
```

El servidor MCP no abre puertos. El bot no accede a MongoDB directamente.

## 3. Piezas implementadas

| Pieza | Archivo |
|---|---|
| Servidor MCP | `projects/backend/bin/mcpServer.js`, `microservices/mcp/` |
| Herramientas MCP | `microservices/mcp/tools.js`, `server.js`, `data.js` |
| Bot y flujos | `bin/telegramBot.js`, `microservices/telegram/` |
| Vínculo | `microservices/channelLinkService.js`, `api/channels/` |
| Modelos | `ChannelLink`, `ChannelLinkCode`, `TelegramUpdate` |
| Reportes | `Report.sourceChannel` y `Report.sourceActionKey` |
| Perfil web | `pages/perfil` + `services/channel-link-api.service.ts` |
| Acceso desde el chat web | `pages/assistant` + `environment.telegramBotUrl` |
| Avisos de estado | `microservices/telegram/notifications.js` |
| Proceso PM2 | `ecosystem.config.cjs` (`falconsync-telegram`) |
| Pruebas | `test/telegramChannel.test.js`, `test/telegramBot.test.js` |

## 4. Configuración

En `projects/backend/.env`:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=token_de_BotFather
# URL pública de la SPA para enlaces en los mensajes. En producción debe ser HTTPS.
TELEGRAM_WEB_URL=https://falconsync.example
TELEGRAM_MODE=polling
TELEGRAM_WEBHOOK_URL=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_PORT=3201
TELEGRAM_WEBHOOK_PATH=/telegram/webhook
TELEGRAM_LINK_CODE_TTL_MINUTES=10
TELEGRAM_MAX_QUERIES_PER_HOUR=20
TELEGRAM_MAX_REPORTS_PER_DAY=3
```

Para polling no hace falta URL ni secreto de webhook. Para webhook:

```env
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://bot.tudominio.com/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=un_secreto_de_16_a_256_caracteres
```

El secreto se genera localmente, por ejemplo:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No se debe pegar el token en el chat ni en el repositorio.

## 5. Ejecución

```powershell
# Desde projects/backend
npm run telegram:start

# Registrar comandos visibles en Telegram
npm run telegram:commands:set

# Solo si se usa webhook
npm run telegram:webhook:set
npm run telegram:webhook:delete
```

En polling debe existir una sola instancia del bot. Si hay un webhook activo,
`getUpdates` falla; el arranque en polling intenta eliminarlo.

En producción, `ecosystem.config.cjs` incluye la aplicación `falconsync-telegram` con
`autorestart`, límite de memoria y logs propios:

```powershell
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs falconsync-telegram
```

## 6. Acceso desde la web

- El chat de `/guia` muestra una franja al pie, solo en modo turista, con el enlace
  `https://t.me/Falconsync_bot`. El botón incluye el icono de Telegram (Simple Icons, CC0) en un
  círculo blanco, nombre accesible «Abrir @Falconsync_bot en Telegram» y ancho completo en móvil.
- El perfil, tras generar el código, ofrece «Abrir en Telegram» con el deep link
  `https://t.me/Falconsync_bot?start=CODIGO`. El bot interpreta el payload de `/start`
  y canjea el código sin que la persona tenga que copiarlo.
- Si el código vence o ya se usó, el bot responde con el error y permite generar otro.
- La URL del bot se configura en `projects/frontend/src/environments/environment.ts`
  (`telegramBotUrl`). Si se cambia de bot, deben actualizarse token y URL.

## 7. Flujo de vinculación

1. La persona inicia sesión en FalconSync y abre `/perfil`.
2. En «Canales» pulsa «Vincular Telegram».
3. La API devuelve un código de 8 caracteres, válido 10 minutos y de un solo uso.
4. La persona pulsa «Abrir en Telegram» o envía `/vincular CODIGO` al bot.
5. El bot llama a `vincular_telegram`; el servidor MCP valida el hash, la expiración,
   el uso único y los índices de unicidad.
6. `/desvincular` elimina el vínculo. La auditoría conserva el evento.

Un Telegram no puede quedar vinculado a dos cuentas y una cuenta no puede tener dos
Telegram activos.

## 8. Flujo de incidencia

1. `/reportar` exige vínculo y abre una sesión de 15 minutos.
2. Se busca el lugar por nombre o por ubicación compartida (máximo 2 km).
3. Se elige una categoría de daño.
4. Se escribe una descripción de 10 a 2000 caracteres.
5. Se comparte la ubicación o se omite.
6. Se confirma con botones.
7. `crear_incidencia` exige `confirm: true` y una clave de idempotencia.
8. El reporte entra en `received` y sigue el flujo normal de conservación.

Categorías: `structural`, `moisture`, `cracks`, `material_loss`, `vandalism`,
`vegetation`, `fire`, `collapse_risk`, `other`.

En v1 no se adjuntan fotos. Producción bloquea `/api/evidence` hasta tener
antimalware; el bot lo explica.

## 9. Consulta de incidencias, lugares cercanos y avisos

- `/misreportes` lista cinco incidencias por página. Cada una tiene un botón
  «Detalle N» y, si hay más, «Ver más»; también se puede consultar una incidencia
  concreta con `consultar_incidencia` desde el MCP.
- El detalle incluye lugar, categoría, estado, fecha, descripción, GPS, motivo de
  rechazo o cierre y un enlace a `/reportes/:id`.
- `/cerca` pide la ubicación y devuelve hasta cinco POI publicados a menos de 2 km,
  con distancia y enlace a `/lugares/:slug`. Compartir una ubicación fuera de un
  reporte también activa esta búsqueda.
- Cuando el triaje acepta, rechaza o cierra una incidencia creada por Telegram, y
  cuando se convierte en inspección, el autor vinculado recibe un mensaje con el
  nuevo estado y el enlace al detalle. El aviso es best-effort: si Telegram falla,
  la transición de conservación no se revierte.
- El canal de origen se muestra en «Mis reportes», en el detalle y en la cola de
  triaje (`Web` o `Telegram`).

## 10. Rutas

El bot lista la «Ruta del Casco Histórico de Coro» con cinco paradas, coordenadas,
enlaces a OpenStreetMap y el aviso:

> Recorrido recomendado con paradas registradas. No es una ruta verificada paso a paso
> ni incluye navegación giro a giro.

No se promete distancia, accesibilidad, cierre ni estado actual.

## 11. Seguridad y privacidad

- Token del bot solo en `.env` o gestor de secretos.
- MCP por stdio; sin puerto público.
- Webhook opcional con `X-Telegram-Bot-Api-Secret-Token`.
- Idempotencia por `update_id` y por `sourceActionKey`.
- Límite por usuario: 20 consultas/hora, 3 reportes/24 h y 10 intentos de vinculación/hora;
  además del rate limit del servidor MCP y del backend.
- Datos guardados: ID de Telegram, chat, vínculo y reportes. No se guardan contraseñas
  ni historial de mensajes.
- Los logs no incluyen token, secreto ni descripción del reporte.
- El bot solo responde en chats privados.
- `/privacidad` explica el tratamiento y `/desvincular` revoca el vínculo.
- El deep link `?start=CODIGO` transporta un código de un solo uso, con TTL de 10
  minutos; no contiene datos de la cuenta. No se debe reenviar ni publicar.
- Los avisos de estado se envían solo al `chatId` del vínculo activo y no incluyen
  datos internos de triaje más allá del motivo visible para el autor.

## 12. Pruebas

```powershell
npm --prefix projects/backend test -- test/telegramChannel.test.js
npm --prefix projects/backend test -- test/telegramBot.test.js
npm --prefix projects/frontend test -- --watch=false
```

Las pruebas cubren: código de un solo uso, expiración, conflicto entre cuentas,
herramientas MCP, detalle de una incidencia propia, idempotencia de reportes,
rechazo sin vínculo, búsqueda cercana, aviso de cambio de estado, formato de
mensajes, paginación y límites. El E2E de `/guia` verifica el enlace a Telegram y el
de `/perfil` verifica el deep link con el código.

## 13. Limitaciones y pendientes

- Sin fotos hasta desplegar antimalware.
- Sin rutas peatonales reales con geometría y accesibilidad.
- Los avisos cubren triaje y conversión, no cada evento posterior de la inspección.
- Una sola instancia de polling. Los límites de consultas/reportes viven en memoria
  del proceso; con varias instancias haría falta un almacén compartido (Redis).
- El estado de la sesión del reporte vive en memoria; si el bot se reinicia, la
  persona debe empezar de nuevo.
- La ejecución remota del workflow de CI sigue pendiente de autorización.
- El webhook sigue siendo opcional y no está desplegado; requiere HTTPS y un proxy
  público hacia el puerto local.
