# Seguridad y modelo de amenazas — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-11-13 |
| Estado | Línea base de Fase 0; controles marcados como planificados no están implementados |
| Documentos relacionados | [`RBAC.md`](./RBAC.md), [`REQUISITOS.md`](./REQUISITOS.md), [`OPERACION.md`](./OPERACION.md) |

> Este documento aplica criterios de seguridad al diseño. No declara que los controles
> planificados ya existan. El estado actual se contrasta con el código y se indica cuándo un
> control es una brecha conocida.

## 1. Activos

| Activo | Por qué importa |
|---|---|
| Credenciales y sesiones | Permiten suplantar cuentas y escalar privilegios. |
| Datos personales | Usuarios, correos, perfiles, reportantes e imágenes. |
| Reportes e inspecciones | Historia técnica y decisiones de conservación. |
| Evidencia fotográfica | Puede contener personas, ubicaciones y metadatos sensibles. |
| Eventos de dominio y auditoría | Cadena de custodia y trazabilidad. |
| Corpus RAG y fuentes | Derechos, citas y credibilidad. |
| Panoramas y audio | Derechos de autor, consentimiento y reputación. |
| Secretos de aplicación | JWT, base de datos, almacenamiento y proveedor externo. |
| Disponibilidad | Acceso público, operación de campo y confianza. |

## 2. Límites de confianza

```text
Navegador / cliente móvil web
        │  HTTPS, cookies, JWT en memoria
        ▼
API Express  ──────────────►  MongoDB
        │                        │
        │                        └── evidencia y eventos
        ├──────────────►  Almacenamiento privado
        ├──────────────►  Socket.IO (ticket)
        └──────────────►  Proveedor LLM / búsqueda externa (no en v1)
```

Fronteras:

- navegador ↔ API;
- API ↔ MongoDB;
- API ↔ almacenamiento público y privado;
- API ↔ clientes Socket.IO;
- consola administrativa ↔ API;
- CI/CD ↔ entornos;
- operador ↔ infraestructura.

## 3. Amenazas y mitigaciones

| ID | Amenaza | Vector | Impacto | Mitigación | Verificación |
|---|---|---|---|---|---|
| S-01 | Fuerza bruta o credential stuffing | Login | Suplantación | Rate limit, contraseña fuerte, bloqueo temporal, auditoría | Pruebas de login y límites |
| S-02 | Robo de sesión | XSS, malware, red | Suplantación | Refresh `httpOnly`, access en memoria, `SameSite=Strict`, CSP/helmet | Revisión de frontend y cabeceras |
| S-03 | Escalada de privilegios | Cambio de rol mal autorizado | Control total | Capacidades server-side, último admin, reautenticación, auditoría | Matriz RBAC y pruebas IDOR |
| S-04 | IDOR | Cambiar IDs de reportes, inspecciones o evidencia | Fuga de datos | Autorización por recurso, IDs no adivinables, 404/403 consistentes | Suites de autorización |
| S-05 | Archivo malicioso | Subida de imagen | RCE, XSS, malware | Validar firma, decodificar, límites, EXIF, antivirus, cuarentena | `evidence.test.js` |
| S-06 | Manipulación de evidencia | Reemplazo o borrado | Pérdida de cadena de custodia | SHA-256, almacenamiento privado, acceso auditado, retención | Verificación de hash y logs |
| S-07 | Fallo de auditoría silencioso | `recordAudit` best-effort | Sin trazabilidad | Evento obligatorio en transiciones críticas; fallar la operación | Pruebas de fallo de evento |
| S-08 | Sala Socket.IO no autorizada | Cliente elige sala | Fuga en tiempo real | Ticket, salas server-side, pertenencia, single-use | `notifications.test.js` |
| S-09 | Repetición o duplicado de eventos | Reenvío | Notificaciones falsas | `eventId` único, cursor, deduplicación, `ack` | Pruebas de reconexión |
| S-10 | Instrucciones embebidas en documento o consulta | Documento o pregunta | Respuesta manipulada | Sin generación libre; documentos tratados como datos, allowlist y sin herramientas de escritura | Conjunto adversario |
| S-11 | Fuga de datos a terceros | Contexto RAG | Privacidad | No hay proveedor RAG en v1; minimización, acceso por recurso y retención | Revisión de payloads |
| S-12 | Cita inventada | Alucinación | Desinformación | Validación contra fragmentos, abstención | Evaluación dorada |
| S-13 | Fuga de secretos | Logs, repo, errores | Compromiso total | Variables de entorno, redacción, `.gitignore`, rotación | Escaneo y revisión |
| S-14 | Cadena de suministro | Dependencias | RCE, robo | Lockfiles, `npm audit`, revisión de cambios | CI y auditoría |
| S-15 | Denegación de servicio | Carga, uploads, consultas | Indisponibilidad | Rate limit, límites de tamaño, timeouts, proxy, cuotas | Prueba de carga |
| S-16 | SSRF | Búsqueda externa o URL | Acceso interno | Allowlist de dominios, egress control, sin URLs arbitrarias | Pruebas de integración |
| S-17 | Inyección de logs | Datos de usuario | Falsificación | Logs estructurados, escape, sin concatenar | Revisión de logs |
| S-18 | Exposición de backups | Almacenamiento | Pérdida total | Cifrado, acceso mínimo, separación de cuentas, restauración | Simulacro |
| S-19 | CSRF | Cookies | Acciones no deseadas | `SameSite=Strict`, CORS allowlist, origen confiable | Pruebas de origen |
| S-20 | Amenaza interna | Operador o admin | Abuso | Menor privilegio, separación de funciones, auditoría, break-glass | Revisión de accesos |
| S-21 | Fuga de evidencia por URL pública | `/api/uploads` | Exposición | Evidencia fuera del prefijo público; endpoint autorizado o URL firmada | Pruebas de acceso |
| S-22 | Borrado o alteración de historial | Update/delete | Pérdida de trazabilidad | Append-only, permisos, eventos, backups | Pruebas de inmutabilidad |
| S-23 | Robo del token de Telegram | `.env`, logs, repositorio | Control total del bot | Token solo en entorno/secret manager, sin logs ni capturas, rotación con BotFather | Revisión de configuración y logs |
| S-24 | Webhook falso o replay | Peticiones al endpoint | Reportes falsos, spam | `X-Telegram-Bot-Api-Secret-Token`, HTTPS, idempotencia por `update_id` | `telegramChannel.test.js` |
| S-25 | Suplantación de cuenta | Vincular Telegram ajeno | Reportes a nombre de otro | Código de un solo uso con hash, TTL, índices únicos y auditoría | Pruebas de conflicto y expiración |
| S-26 | Inyección de prompt en Telegram | Texto libre o foto | Herramientas no autorizadas | Flujos deterministas, herramientas de escritura con confirmación e idempotencia; sin acceso a secretos | Revisión de handlers y pruebas |
| S-27 | Exceso de datos personales | Ubicación, chat, mensajes | Privacidad | Datos mínimos, sin historial, `/privacidad`, expiración de sesión y `/desvincular` | Revisión de modelos y retención |

## 4. Controles por dominio

### 4.1 Autenticación y sesión

- Access token de 15 minutos, solo en memoria; refresh en cookie `httpOnly`,
  `SameSite=Strict`, `Secure` en producción y `Path=/api/auth`.
- Rotación de refresh y revocación por `tokenVersion`.
- Rate limit en login, registro y refresh.
- Reautenticación para cambios de rol, estado y revocación.
- No se aceptan JWT en query string para Socket.IO.

### 4.2 Autorización

- Capacidades en servidor; el frontend solo mejora la experiencia.
- Verificación de pertenencia al recurso, no solo del rol.
- 403/404 sin revelar la existencia de recursos ajenos.
- Pruebas de permitido/denegado por rol y por recurso.
- `break-glass` con motivo, aprobador, vigencia y auditoría.

### 4.3 Evidencia

- Almacenamiento privado separado del público.
- Validación de firma binaria, decodificación real, MIME, dimensiones y tamaño.
- Extracción de fecha y GPS antes de eliminar EXIF; luego eliminación de metadatos.
- SHA-256 al guardar y verificar al leer.
- `pending_scan` y cuarentena; si no hay antimalware, no se habilita la subida en producción.
- Acceso por endpoint autorizado o URL firmada de 60 segundos.
- Registro de accesos con actor, fecha, IP, agente, motivo y recurso.
- Retención, bloqueo legal y borrado lógico auditado.

**Implementado el 2026-11-15:** almacenamiento en `uploads/documents/evidence`, validación con
`sharp`, eliminación de EXIF, SHA-256, idempotencia, autorización por recurso, log append-only
de accesos y retención configurable. Producción responde `503 EVIDENCE_SCAN_UNAVAILABLE`
mientras no exista antimalware. Siguen pendientes el motor de escaneo, la cuarentena
operativa, la purga por retención y el flujo de bloqueo legal.

### 4.4 Auditoría y eventos

- `AuditLog` actual se conserva para operaciones administrativas no críticas.
- Las transiciones de conservación usan `DomainEvent` obligatorio y append-only.
- Si el evento no puede registrarse, la transición falla.
- Cierre, confirmación de severidad y verificación de intervención generan evento en la misma
  operación.
- Los eventos no se actualizan ni se borran por API.

### 4.5 Tiempo real

- Ticket de 60 segundos, un solo uso, con `scope=realtime`, `jti`, `sub` y `tokenVersion`.
- Salas decididas por el servidor: `user:<id>`, `role:inspector`, `inspection:<id>`.
- Verificación de asignación antes de unir a una inspección.
- Notificación persistida antes de emitir; `eventId` único y cursor.
- Límite de conexiones, frecuencia y tamaño de mensaje.
- Redis y sesiones pegajosas si hay clúster; una instancia documentada si no.

### 4.6 RAG

- El asistente no tiene herramientas de escritura, cierre, asignación ni publicación.
- Sin generación libre: composición extractiva con citas literales de máximo 25 palabras o hechos estructurados verificados.
- Citas validadas contra fragmentos recuperados; si falla una regla, abstención total.
- Los documentos son datos: se ignoran las órdenes embebidas y se prueba con un documento sintético.
- Allowlist de fuentes; sin búsqueda externa ni scraping en v1.
- Sin envío de datos a terceros.
- Cuota, caché, límite de latencia y registro de consultas; coste externo 0.
- Retención: turismo anónimo sin persistencia; asistente técnico 90 días con TTL.
- El registro de fuentes nunca expone `storageKey` ni texto completo de fuentes restringidas.

### 4.7 Canal de Telegram y MCP

- El bot de Telegram es un proceso separado (`bin/telegramBot.js`); no se ejecuta
  dentro de OpenCode ni de la SPA.
- El servidor MCP usa stdio como proceso hijo: no abre puertos ni acepta conexiones de
  red. El único secreto del bot es `TELEGRAM_BOT_TOKEN`, fuera del repositorio.
- El bot solo responde en chats privados y no persiste el historial de mensajes.
- La guía y los recorridos son de lectura anónima; crear incidencias exige un vínculo
  con una cuenta activa y la capacidad `report.create`.
- La vinculación usa un código de 8 caracteres, hash SHA-256, TTL de 10 minutos, un
  solo uso e índices únicos por cuenta y por Telegram.
- Los reportes de Telegram llevan `sourceChannel=telegram` y una
  `sourceActionKey` interna para idempotencia; la clave no se expone por la API.
- En modo webhook se exige HTTPS, puerto permitido por Telegram y el secreto
  `X-Telegram-Bot-Api-Secret-Token`. En modo polling se elimina cualquier webhook
  previo para evitar `getUpdates` en conflicto.
- El deep link `?start=CODIGO` transporta un código de un solo uso con TTL de 10
  minutos; no incluye datos de la cuenta y se invalida al canjearse.
- Los avisos de estado se envían solo al `chatId` del vínculo activo y no revierten
  la transición si Telegram falla. El texto no incluye notas internas de triaje.
- Las fotos permanecen desactivadas en producción hasta que el antimalware y la
  cuarentena de evidencia estén operativos.

### 4.8 Infraestructura y operación

- Secretos por entorno, fuera del repositorio y con rotación.
- TLS, proxy inverso, cabeceras de seguridad y límites de cuerpo.
- MongoDB con autenticación y red restringida; replica set si se aprueba D-09.
- Backups cifrados, 3-2-1 y restauración probada.
- Logs estructurados con `correlationId`, sin secretos ni datos personales innecesarios.
- Health/readiness, métricas y alertas de SLO.
- Rollback con imagen anterior y migraciones expand-contract.

## 5. Brechas conocidas del estado actual

| Brecha | Estado | Acción |
|---|---|---|
| `AuditLog` best-effort por defecto | Parcial: las transiciones de rol usan `required: true` | No usar como cadena de custodia; crear `DomainEvent` obligatorio. |
| Sin dominio de evidencia | Resuelto parcialmente: backend privado y auditado con 2/2 pruebas | Falta antimalware, cuarentena operativa, purga por retención y bloqueo legal; producción bloquea cargas. |
| Sin Socket.IO | Confirmada | Implementar ticket y salas server-side. |
| Sin RAG | Confirmada | Implementar corpus, citas y abstención. |
| Visor 360 y contenido | Resuelto el visor: renderer propio, fallback, API pública/admin y aislamiento de inspección | Falta contenido real con derechos, revisión manual de accesibilidad y medición de rendimiento. |
| Rol `moderator` legacy sin rutas | Confirmada | Migrar a `historian`; `inspector` ya es asignable. |
| Gestión de cuentas desde la UI | Resuelto: rol, estado y revocación con reautenticación | Ejecutar la migración de `moderator` y revisar la exportación de datos. |
| CI remoto no verificado | Confirmada | Primera ejecución autorizada en Fase 0. |
| Imágenes de POI con autoría pendiente | Confirmada | Bloquear publicación hasta verificar derechos. |

## 6. Criterios de aceptación de seguridad

- No hay hallazgos críticos o altos abiertos antes del piloto.
- Cada rol y cada recurso tiene prueba de acceso permitido y denegado.
- La evidencia no se sirve por el prefijo público.
- El hash de evidencia se verifica al leer.
- Las transiciones críticas fallan si no pueden auditarse.
- Socket.IO no permite salas ajenas ni reutilizar tickets.
- El asistente no ejecuta acciones ni inventa citas.
- Los secretos no aparecen en el repositorio, logs ni respuestas.
- `npm audit --omit=dev` no reporta vulnerabilidades altas o críticas.
- La restauración de backup se prueba antes del lanzamiento.

## 7. Respuesta a incidentes

| Severidad | Ejemplo | Respuesta |
|---|---|---|
| Crítica | Fuga de evidencia, compromiso de admin, pérdida de datos | Contención inmediata, revocación de sesiones, preservar logs, notificar, postmortem. |
| Alta | IDOR explotable, bypass de autorización, malware en evidencia | Parche urgente, cuarentena, revisión de alcance, auditoría. |
| Media | Rate limit insuficiente, error de configuración | Corrección planificada y verificación. |
| Baja | Mensaje confuso, cabecera faltante | Backlog y revisión. |

Pasos:

1. Detectar y clasificar.
2. Contener sin destruir evidencia.
3. Erradicar la causa.
4. Recuperar con backup o rollback.
5. Verificar y monitorear.
6. Documentar el postmortem y las acciones.

## 8. Correspondencia con Unidad 7

Este modelo aplica los temas de seguridad post-despliegue, IDOR, inyección, secretos,
aislamiento, logs y soporte. La correspondencia es metodológica; las decisiones concretas
son de este proyecto y no se atribuyen literalmente al material académico.
