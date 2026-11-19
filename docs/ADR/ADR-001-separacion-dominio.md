# ADR-001 — Separación del dominio de conservación

| Campo | Valor |
|---|---|
| Estado | Aceptada por el plan |
| Fecha | 2026-11-13 |
| Decisores | Responsable del proyecto y revisión de ingeniería |
| Relacionados | [`../PLAN-IMPLEMENTACION.md`](../PLAN-IMPLEMENTACION.md), [`../REQUISITOS.md`](../REQUISITOS.md) |

## Contexto

El catálogo actual tiene 23 POI que mezclan edificios, monumentos, espacios urbanos, museos,
comercio y naturaleza. `Location.conservationStatus` existe, pero los 23 están en `unknown`.
No hay forma de distinguir un aviso ciudadano de un diagnóstico técnico ni de conservar la
cadena de custodia de una inspección.

## Decisión

Separar estas entidades:

| Entidad | Función |
|---|---|
| `Location` | POI público y ficha turística. |
| `HeritageAsset` | Edificación o unidad patrimonial inspeccionable; enlace opcional con POI. |
| `Report` | Aviso autenticado, no diagnóstico. |
| `Inspection` | Actuación de un inspector con estados y responsable. |
| `Finding` | Daño observado, con severidad propuesta y confirmada. |
| `Intervention` | Obra o acción de conservación verificable. |
| `Evidence` | Foto o documento privado con hash y acceso auditado. |
| `DomainEvent` | Hecho inmutable de transición. |

El estado público de conservación se deriva de la última inspección revisada y cerrada. Un
reporte abierto no cambia ese estado.

## Consecuencias

- No todo POI se convierte en activo patrimonial ni se etiqueta como UNESCO.
- El formulario de POI deja de editar `conservationStatus` directamente.
- Se necesitan índices, migración y pruebas de proyección.
- La ficha pública muestra “Sin inspección verificada” cuando no hay evidencia.

## Alternativas consideradas

- Usar solo `Location` con campos de inspección: se rechaza porque mezcla turismo y técnica.
- Usar solo `Report` como entidad central: se rechaza porque un reporte no es una inspección.
- Guardar hallazgos en un array sin entidad: se rechaza porque dificulta historial y consultas.

## Referencias

- Plan, secciones 5 y 7.
- Requisitos, RN-06 a RN-12 y RF-11 a RF-34.
