---
name: backend-architecture-crud
description: Diseña o modifica módulos, rutas, controladores, modelos Mongoose y CRUD en el backend FalconSync con los patrones existentes de Express 5 y ESM.
---

# Backend Express y Mongoose de FalconSync

## Cuándo usar

Al añadir o cambiar endpoints, módulos del dominio, persistencia, validaciones, scripts o
subidas de archivos en `projects/backend/`.

## Procedimiento

1. Lee primero `projects/backend/package.json`, rutas relacionadas, controlador, modelo,
   servicio y pruebas existentes. No impongas un esqueleto genérico si el patrón actual ya
   resuelve el caso.
2. Conserva ESM y los routers Express. Respeta la estructura obligatoria: rutas y controladores
   en `api/<módulo>/`, servicios en `microservices/`, modelos en `databases/models/`, y
   `middlewares/` y `helpers/` para middlewares y utilidades.
3. Valida entradas explícitamente y construye consultas con campos permitidos. Mantén
   invariantes críticas también en el modelo cuando corresponda.
4. Usa `HttpError` y el middleware de errores existente; no filtres detalles internos ni
   conviertas fallos en respuestas exitosas.
5. Para archivos, utiliza el middleware de Multer y el `StorageAdapter` existentes. No
   introduzcas `express-fileupload` ni expongas almacenamiento privado como estático.
6. Agrega pruebas con `node:test` y `supertest`, incluyendo permisos, errores y casos
   límite; documenta el contrato afectado.
7. Ejecuta las pruebas dirigidas y la verificación disponible antes de informar resultado.

## Límites

- No añadas Socket.IO, microservicios independientes, bootstrap u otra dependencia sin requisito
  y aprobación explícitos. `microservices/` es la capa de servicios del monolito, y
  `ecosystem.config.cjs` es configuración opcional de PM2 que no añade dependencias.
- No copies datos, endpoints o estructuras de la plantilla del starter kit como si fueran
  parte del sistema.
- No modifiques bases de datos externas ni desplegues como parte de una tarea local.
