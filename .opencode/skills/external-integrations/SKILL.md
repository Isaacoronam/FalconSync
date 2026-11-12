---
name: external-integrations
description: Evalúa y prepara integraciones aprobadas con servicios externos o MCP, con alcance mínimo, manejo seguro de credenciales y fallos explícitos.
---

# Integraciones externas

## Cuándo usar

Solo si una necesidad aprobada requiere conectar FalconSync con un proveedor externo,
webhook, correo, mensajería o servidor MCP.

## Procedimiento

1. Define el caso de uso y confirma el sistema externo, propietario, datos intercambiados y
   entorno permitido.
2. Comprueba si ya existe un cliente o contrato; no inventes un servidor MCP ni un conector
   de email, Telegram o WebSocket.
3. Minimiza permisos, campos compartidos, retención y datos personales; almacena secretos
   solo mediante la configuración de entorno/secret manager aprobado.
4. Define timeouts, límites, reintentos acotados, idempotencia, manejo de fallos y registros
   sin credenciales.
5. Aísla el adaptador y prueba éxito, timeout, respuestas inválidas, rate limit y caída del
   proveedor con dobles locales.
6. Documenta permisos, configuración, límites, costos y procedimiento de desactivación.

## Límites

No envíes datos del repositorio a terceros, no habilites conectores por defecto y no uses
credenciales reales en pruebas.
