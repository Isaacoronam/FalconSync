---
name: authentication-security
description: Diseña, implementa o revisa autenticación, sesiones, roles, permisos y recuperación de cuenta en FalconSync.
---

# Autenticación y autorización

## Cuándo usar

Ante cambios en `projects/backend/src/services/authService.js`, middleware, rutas de auth,
sesiones, roles, cookies, guards o interceptor del frontend.

## Invariantes del proyecto

- La contraseña se procesa con `bcryptjs`; no se almacena en claro.
- El access token vive en memoria en el cliente; el refresh token se usa en cookie
  `HttpOnly`, con los atributos configurados por el backend.
- La renovación de sesión rota el refresh token y permite revocar sesiones.
- El backend es la autoridad para permisos: los guards del frontend solo mejoran UX.
- Las rutas administrativas exigen `authenticate` y `requireRole('admin')`.
- Las acciones sensibles que usan cookie deben conservar la validación de origen confiable.
- No exponer secretos, tokens de refresh ni hashes de credenciales en JSON, URL o logs.

## Procedimiento

1. Traza el flujo completo desde ruta y middleware hasta servicio/modelo y cliente.
2. Comprueba autenticación, autorización, estado de cuenta, revocación y condiciones de
   cambio obligatorio de contraseña en servidor.
3. Evita ampliar permisos por defecto; añade pruebas positivas y negativas para cada rol.
4. Para cambios de sesión, revisa rotación, expiración, logout, origen y comportamiento de
   cookies junto con sus pruebas existentes.
5. Documenta solo el comportamiento verificado y ejecuta las pruebas de autenticación.

## Límites

No implementes login móvil, almacenamiento Android de tokens ni proveedores externos hasta
que ese cliente y sus requisitos estén definidos.
