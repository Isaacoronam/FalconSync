# Adaptación del UNEFA AI Starter Kit

El material del profesor se revisó como guía inicial de organización y prácticas. Se
integran únicamente ideas compatibles con el código y los requisitos comprobados de
FalconSync. Este registro evita confundir ejemplos del kit con componentes ya implementados.

## Ideas adoptadas

- Separar contexto, reglas de negocio, contratos, memoria y procedimientos especializados.
- Mantener módulos backend, frontend y espacio móvil diferenciados.
- Revisar arquitectura, contratos, validación, autorización, experiencia de errores, pruebas
  y preparación de despliegue en skills invocables según la tarea.
- Tratar Android/Kotlin como línea futura, definiendo alcance y seguridad antes de comenzar.

## Adaptaciones al proyecto real

| Tema | Evidencia actual | Criterio adoptado |
|---|---|---|
| Backend | Node 26 ESM, Express 5, Mongoose 9, Multer y almacenamiento mediante adapter | Conservar el backend actual; no reemplazarlo por la plantilla `WebServer` |
| Frontend | Angular 21, Signals en features, Leaflet y estilos propios | Documentar Angular 21; Angular 22+ es una aspiración, no versión instalada |
| Autenticación | `bcryptjs`, JWT, cookies de refresh, roles y middleware de origen | Usar estos contratos; no suponer login móvil |
| Archivos | Middleware Multer y almacenamiento público/privado | No instalar `express-fileupload` ni servir archivos privados como estáticos |
| Tiempo real | No se encontró Socket.IO ni contratos WebSocket en el backend | No añadir sockets sin requerimiento confirmado |
| UI | El frontend utiliza estilos SCSS propios; Bootstrap no figura como dependencia | Seguir el sistema visual existente y no incorporar Bootstrap por la plantilla |
| Mobile | Solo existe un esqueleto `projects/mobile/` | Kotlin, MVVM, Retrofit y corrutinas son decisiones por validar antes de implementar |
| Despliegue | Existe CI de GitHub Actions; no hay PM2/SSH ni proceso de producción documentado | No ejecutar procedimientos remotos ni asumir política de backups/rollback no acordada |
| Validación de dominio | Los identificadores y reglas existentes son propios de Coro/Falcón | No incorporar RUT chileno ni validaciones de otro país sin requisito |
| Servicios externos | No hay un contrato aprobado para email, Telegram u otros conectores | No instalar ni activar conectores MCP/externos por defecto |

## Material descartado como implementación

Los archivos de skills del kit eran stubs sin instrucciones concretas. Su inventario se usó
como mapa temático; las skills del proyecto se escribieron con base en los patrones
verificados. `backup.doc`, el ejemplo de servidor Socket.IO y el manifiesto genérico de APK
no se incorporan como código de producción.

## Fuente y skills resultantes

- Fuente: guía de arquitectura y skills del UNEFA AI Starter Kit proporcionado por el
  profesor; su copia temporal se retiró después de revisar y adaptar su contenido, a
  solicitud del usuario.
- Skills del proyecto: `.opencode/skills/`.
- Estado funcional verificado: [contexto del sistema](./system_context.md),
  [reglas de negocio](./business_rules.md) y [contratos API](./api_contracts.md).
