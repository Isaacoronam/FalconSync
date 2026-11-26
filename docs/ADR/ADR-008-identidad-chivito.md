# ADR-008 — Identidad Chivito y celebración de check-in

| Campo | Valor |
|---|---|
| Estado | Aceptada e implementada |
| Fecha | 2026-11-25 |
| Decisores | Responsable del proyecto |
| Relacionados | [`../IDENTIDAD.md`](../IDENTIDAD.md), [`../REQUISITOS.md`](../REQUISITOS.md), [`../AVENTURAS.md`](../AVENTURAS.md), [`../FUENTES-RAG.md`](../FUENTES-RAG.md) |

## Contexto

FalconSync ya tenía catálogo, mapa, check-in por QR, insignias por POI y una guía RAG con
citas. La identidad visual seguía apoyada en un logo pequeño y un fondo crema plano. El
responsable del proyecto aportó un logo nuevo, una hoja de personaje de Chivito y un paisaje
de los Médanos de Coro. La renovación debía integrarse sin añadir un proveedor de IA ni un
segundo chat.

## Decisión

- Chivito es la voz y la imagen del **guía turístico**. No representa al asistente técnico ni
  a una autoridad de conservación.
- El chat de Chivito reutiliza el endpoint RAG existente (`/api/assistant/tourist/query`) y
  conserva citas, abstención y límites. En esta iteración **no se añade un LLM generativo
  externo ni WebSocket**; D-03, D-11 y D-21 siguen vigentes.
- Los recursos de marca y del personaje se generan de forma reproducible desde maestros
  locales con `sharp`; no se editan a mano ni se sustituyen por imágenes genéricas.
- El logo con damero incrustado se recorta a su borde real y se enmascara en círculo. El
  badge oficial se usa en header, administración, autenticación y favicon; la variante de
  cabeza queda como recurso compacto alternativo.
- La celebración del check-in solo se abre cuando el backend responde `201` y devuelve al
  menos una insignia nueva. No se abre en errores, duplicados, QR inválido, fuera de geocerca
  ni cuando la insignia ya existía.
- El nombre, la descripción, la categoría y la imagen de la insignia provienen del backend.
  Si un registro histórico tiene `image: null`, la UI usa el medallón de su categoría; no
  inventa nombres ni datos por POI.
- El fondo se aplica en una capa fija, decorativa y sin interacción, con overlay de contraste.
  En móvil se muestra como banda inferior para no cortar el cartel de Médanos.

## Consecuencias

- Los tests de marca, chat, check-in y perfil deben cubrir la nueva identidad y el modal.
- Las insignias anteriores a esta iteración no cambian en base de datos: usan el medallón de
  categoría como respaldo visual.
- No hay streaming de tokens ni historial turístico persistente; el indicador «Chivito está
  pensando…» es local y el RAG sigue siendo extractivo.
- Los derechos de las imágenes aportadas deben registrarse antes de una publicación abierta.

## Alternativas consideradas

- Añadir un proveedor LLM y WebSocket: se difiere; exige credenciales, coste, retención y una
  evaluación de seguridad que no forman parte de este corte.
- Usar la hoja de Chivito completa como avatar: se descarta por ilegibilidad en tamaños
  pequeños.
- Generar imágenes nuevas del personaje: se descarta para preservar la consistencia visual.
- Mostrar la celebración de forma optimista antes de la respuesta del servidor: se rechaza
  porque podría felicitar por un check-in fallido o duplicado.

## Referencias

- `docs/IDENTIDAD.md`.
- Requisitos RN-27 a RN-32, HU-26 a HU-29, RF-90 a RF-98 y RNF-25 a RNF-28.
- `docs/AVENTURAS.md`, `docs/FUENTES-RAG.md` y `docs/WIREFRAMES.md`.
