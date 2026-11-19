# ADR-003 — Evidencia privada y auditoría obligatoria

| Campo | Valor |
|---|---|
| Estado | Propuesta |
| Fecha | 2026-11-13 |
| Decisores | Responsable del proyecto |
| Relacionados | [`../SEGURIDAD.md`](../SEGURIDAD.md), [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md) |

## Contexto

El almacenamiento público `/api/uploads` y el privado `uploads/documents/` ya están separados,
pero no existe un dominio de evidencia de inspección. `AuditLog` es best-effort:
`recordAudit()` captura el error y devuelve `null`, por lo que no sirve como cadena de
custodia.

## Decisión

- La evidencia de conservación se guarda en almacenamiento privado, nunca bajo `/api/uploads`.
- Se calcula SHA-256 al guardar y se verifica al leer.
- Se extraen fecha de captura y GPS antes de eliminar EXIF.
- Se valida firma binaria, decodificación real, MIME, dimensiones y tamaño.
- Se usa `pending_scan` y cuarentena; si no hay antimalware, no se habilita la subida en
  producción.
- El acceso se hace por endpoint autorizado o URL firmada de 60 segundos.
- Cada acceso se registra en `EvidenceAccessLog` (append-only).
- Las transiciones críticas usan `DomainEvent` obligatorio; si el evento falla, la operación
  falla.
- `AuditLog` se conserva para operaciones administrativas no críticas.

## Consecuencias

- Se necesita almacenamiento, escaneo, retención y pruebas específicas.
- El cierre de inspección y la verificación de intervención no pueden ser best-effort.
- Si no se aprueba D-09, se usan agregados embebidos e idempotencia, sin prometer atomicidad
  multi-documento.
- La evidencia no se expone ni siquiera para “demostrar” que existe.

## Alternativas consideradas

- Reutilizar `/api/uploads`: se rechaza por exposición pública.
- Guardar solo la URL: se rechaza porque no hay hash ni control de acceso.
- Usar `AuditLog` como cadena de custodia: se rechaza por su modo best-effort.

## Referencias

- Plan, sección 9.
- Seguridad, secciones 3 y 4.3.
