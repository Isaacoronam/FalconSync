---
name: error-handling-human-ux
description: Diseña errores de API y mensajes de interfaz claros, accesibles y accionables, conservando el diagnóstico técnico seguro.
---

# Errores útiles para personas

## Cuándo usar

Al implementar errores, formularios, estados de red, carga de imágenes, autenticación o
flujos que deban explicar qué falló y qué puede hacer el usuario.

## Procedimiento

1. Distingue errores esperables (validación, permisos, conflicto, red) de fallos inesperados.
2. Mantén códigos y estados HTTP estables en la API y mensajes seguros en lenguaje claro;
   no envíes stack trace, secretos o información de otras cuentas.
3. En la UI, presenta el error junto a la acción/campo correspondiente, con semántica
   accesible (`role=alert` o `role=status` según corresponda) y opción de recuperación.
4. Preserva el resultado parcial válido: por ejemplo, un fallo al subir una foto después del
   check-in no debe aparentar que se perdió la visita.
5. Registra detalles de diagnóstico solo en logs protegidos y sin datos sensibles.
6. Prueba errores de red, validación, autorización, límite de archivo y estados vacíos.

## Límites

No asumas que el producto usa Toast, Snackbar, Bootstrap o una librería de notificaciones;
usa los patrones ya presentes en Angular y backend.
