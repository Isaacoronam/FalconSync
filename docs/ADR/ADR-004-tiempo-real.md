# ADR-004 — Socket.IO, ticket y notificaciones persistidas

| Campo | Valor |
|---|---|
| Estado | Aceptada; diseño propuesto |
| Fecha | 2026-11-13 |
| Decisores | Responsable del proyecto |
| Relacionados | [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md), [`../SEGURIDAD.md`](../SEGURIDAD.md) |

## Contexto

Socket.IO es un requisito duro. El backend crea el servidor HTTP directamente en
`bin/server.js`; los tests usan `createApp()`. No existe autenticación de handshake, salas ni
notificaciones persistidas.

## Decisión

- Refactorizar `server.js` para separar `createHttpServer(app)` y
  `createRealtimeServer(httpServer)`.
- Emitir un ticket de 60 segundos, un solo uso, con `scope=realtime`, `jti`, `sub` y
  `tokenVersion`; no aceptar JWT en query string.
- Decidir las salas en el servidor: `user:<id>`, `role:inspector`, `inspection:<id>` tras
  verificar asignación.
- Persistir la notificación antes de emitirla, con `eventId` único y cursor.
- Eventos mínimos: `notification.created`, `inspection.updated`, `report.created`.
- Recuperar eventos perdidos al reconectar con `lastCursor`; deduplicar por `eventId`.
- Usar `ack`, límites de conexión y frecuencia.
- Una instancia documentada; si hay clúster, sesiones pegajosas y adaptador Redis.
- El chat puede usar HTTP/SSE; no se fuerza el mismo transporte.

## Consecuencias

- Se necesita una suite de autorización, reconexión y carga.
- Nginx debe configurar `Upgrade` y `Connection` con timeout mayor que el heartbeat.
- La notificación no es la fuente de verdad: la API siempre puede reconstruir el estado.
- Si no se aprueba Redis, el despliegue queda limitado a una instancia.

## Alternativas consideradas

- Polling o SSE solamente: se rechaza porque Socket.IO es requisito duro.
- JWT en query string: se rechaza por fuga en logs y proxies.
- Salas elegidas por el cliente: se rechaza por fuga entre usuarios.

## Referencias

- Plan, sección 10.
- Requisitos, RF-44 a RF-52.
