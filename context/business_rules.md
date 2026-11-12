# Reglas de negocio vigentes

Estas reglas se resumen de la implementación y documentación del proyecto; no se atribuyen
a una unidad académica.

## Usuarios y permisos

- Los roles definidos son `user`, `moderator` y `admin`.
- Las rutas bajo `/api/admin` requieren autenticación y rol `admin`.
- Las rutas privadas de perfil y check-in requieren autenticación.
- El perfil y sus imágenes privadas pertenecen al usuario autenticado; no son recursos
  públicos.

## Puntos de interés

- El catálogo público debe excluir POI archivados, eliminados, provisionales y excluidos
  del catálogo.
- Para publicar un POI, no debe ser provisional y debe tener fecha de verificación de
  coordenadas.
- La fecha de revisión documental no equivale a una inspección o verificación en campo.
- La historia editorial y sus fuentes deben gestionarse separadas de la fuente cartográfica.
- No asignar un estado de conservación como hecho verificado sin evidencia; los POI del
  catálogo documentado están en estado `unknown`.

## Check-in

- Un check-in se asocia a un POI y a un usuario, con QR y geocerca validados por el servidor.
- Un usuario no puede registrar dos veces el mismo POI.
- La foto del check-in es opcional y se almacena como contenido privado.

## Referencias de detalle

- [Reglas editoriales y publicación de POI](../docs/POI.md)
- [Autenticación y sesiones](../docs/AUTENTICACION.md)
- [Check-in y QR](../docs/AVENTURAS.md)
- Implementación de permisos: `projects/backend/src/routes/adminRoutes.js` y
  `projects/backend/src/middlewares/auth.js`.
