---
name: api-validation-security
description: Valida contratos, entrada HTTP, autorización, errores y carga de archivos en la API Express FalconSync.
---

# Validación y seguridad de API

## Cuándo usar

Al diseñar o revisar endpoints, DTO/modelos, cargas de archivos, filtros de consulta,
mensajes de error o exposición de datos.

## Procedimiento

1. Identifica contrato, consumidores, autenticación requerida y datos sensibles.
2. Valida tipo, longitud, rangos, enumeraciones y formatos antes de usarlos; acepta solo
   campos explícitos y no uses valores enviados por el cliente para decidir autorización.
3. Comprueba invariantes de negocio tanto en el controlador como en el modelo cuando sean
   críticas para persistencia.
4. Usa `HttpError` y el middleware global; devuelve errores estables y comprensibles sin
   stack traces ni detalles de infraestructura.
5. Para archivos, conserva límites de tamaño, validación MIME/firma y rutas de
   `StorageAdapter`. Separa uploads públicos de avatares/fotos privadas.
6. Revisa rate limiting, CORS/origen, Helmet, logs y consultas MongoDB relevantes.
7. Agrega casos de entrada inválida, falta de permisos, archivo límite y acceso cruzado a
   recursos. No realices pruebas intrusivas fuera de entornos autorizados.

## Límites

No agregues validaciones específicas de RUT chileno, email/SMS de terceros u otros dominios
que no formen parte de los requisitos confirmados.
