# Identidad visual y Chivito — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-11-25 |
| Estado | Implementado en la SPA; derechos de las imágenes pendientes de registro formal |
| Relacionados | [`REQUISITOS.md`](./REQUISITOS.md), [`WIREFRAMES.md`](./WIREFRAMES.md), [`AVENTURAS.md`](./AVENTURAS.md), [`ADR-008`](./ADR/ADR-008-identidad-chivito.md) |

## 1. Objetivo

FalconSync debe sentirse como una plataforma turística de Falcón, no como una plantilla
genérica. La identidad se apoya en tres referencias aportadas por el responsable del proyecto:

1. El logo circular de FalconSync con Chivito, las dunas y el sol.
2. La hoja de personaje de Chivito.
3. El paisaje minimalista de los Médanos de Coro.

Chivito es el guía turístico virtual. No es un inspector, no emite diagnósticos y no sustituye
una fuente oficial.

## 2. Recursos y generación

Los maestros se conservan en `projects/frontend/design/source/` y no se publican en el build.
Los derivados se generan con `npm run brand:assets` desde
`projects/frontend/scripts/generate-brand-assets.mjs`.

| Recurso | Origen | Salida | Uso |
|---|---|---|---|
| Logo completo | `falconsync-logo-source.png` | `src/assets/brand/falconsync-logo.png` (512×512) | Referencia y touch icon |
| Logo para UI | Derivado del logo | `src/assets/brand/falconsync-logo-128.png` (128×128) | Header, sidebar administrativa y autenticación |
| Marca de cabeza | Recorte del logo | `src/assets/brand/falconsync-mark-96.png` | Variante compacta disponible; no se usa en la UI actual |
| Favicon | Logo completo | `favicon.ico`, `favicon-32.png` | Navegador |
| Touch icon | Logo completo sobre crema | `apple-touch-icon.png` (180×180) | Pantalla de inicio iOS |
| Avatar de Chivito | Hoja de personaje | `src/assets/brand/chivito-avatar.png` | Chat, perfil y check-in |
| Bienvenida | Hoja de personaje | `src/assets/brand/chivito-welcome.webp` | Estado vacío del chat, aplanada sobre blanco |
| Pensamiento | Hoja de personaje | `src/assets/brand/chivito-thinking.webp` | Indicador de espera del chat |
| Sorpresa | Hoja de personaje | `src/assets/brand/chivito-surprise.webp` | Reserva de expresión |
| Celebración | Hoja de personaje | `src/assets/brand/chivito-celebration.webp` | Modal de recompensa |
| Fondo | `fondo-medanos-source.png` | `src/assets/images/fondo-medanos.webp` | Fondo global |
| Insignias | Diseño propio | `src/assets/images/badges/*.svg` | Respaldo por categoría |

> El PNG del logo no tenía canal alfa: el damero estaba incrustado. El generador recorta el
> borde real, centra el badge en un lienzo transparente y aplica una máscara circular con un
> aro del mismo marrón del logo. No se redibuja el personaje.

Los iconos de `index.html` llevan un parámetro `?v=` para forzar la recarga del favicon en
navegadores que lo cachean de forma agresiva. Al regenerar los iconos hay que incrementar ese
valor en `projects/frontend/src/index.html`.

## 3. Paleta y superficies

Los tokens viven en `projects/frontend/src/styles.scss`:

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#2b1a13` | Texto principal |
| `--ink-soft` | `#5d4338` | Texto secundario |
| `--paper` | `#fbf7ef` | Fondo base |
| `--cream` | `#f6ecdc` | Superficies cálidas |
| `--sand` | `#ead9bf` | Footer y separadores |
| `--terracotta` | `#b4532a` | Acción principal |
| `--gold` | `#d99a2b` | Acento, focos, insignias |
| `--gold-deep` | `#96630f` | Texto dorado con contraste |
| `--orange` | `#e8751f` | Acento cálido |
| `--navy` | `#1f2a44` | Vestimenta de Chivito, botones del chat |
| `--surface` | `rgba(255,252,246,.94)` | Tarjetas y paneles |
| `--scrollbar-thumb` | `#c9ae86` | Pulgar de las barras de desplazamiento |
| `--scrollbar-hover` | `#a98a63` | Pulgar de la barra al pasar el cursor |

Reglas:

- El dorado no se usa como color de texto pequeño sobre crema; para texto se usa
  `--gold-deep`.
- El fondo nunca es el único portador de información.
- Las tarjetas densas mantienen superficie opaca o translúcida para conservar contraste.
- Las barras de desplazamiento son delgadas (9 px, con 5 px visibles de pulgar beige) y de
  riel transparente; Firefox usa `scrollbar-width: thin` con el mismo color.

## 4. Fondo responsive

- Escritorio: `center bottom / cover`, con overlay crema graduado.
- Móvil (`max-width: 640px`): `100% auto` y `center bottom`, para que el cartel de Médanos no
  se corte; el contenido queda sobre una base crema.
- La capa es `position: fixed`, `pointer-events: none` y `z-index: -1` dentro de
  `.app-shell` con `isolation: isolate`; no intercepta clics ni scroll.
- El panel de filtros del mapa usa una superficie translúcida (80 %) con desenfoque para
  integrarse con el paisaje sin perder contraste.
- En impresión se desactiva.

## 5. Chivito en el chat

- Nombre visible: **Chivito**.
- Rol: **Guía turístico de FalconSync**.
- Avatar en el encabezado y junto a los mensajes del asistente turístico.
- El modo técnico se rotula **Apoyo técnico** y no usa el avatar de Chivito.
- El estado vacío incluye saludo y sugerencias; el indicador de espera dice «Chivito está
  pensando…».
- El chat reutiliza el RAG existente por HTTP. No hay LLM generativo externo, WebSocket ni
  historial turístico persistente en esta iteración.
- Las respuestas conservan citas, fuentes y abstención. La personalidad no altera hechos.

## 6. Celebración del check-in

Flujo:

1. El usuario escanea el QR y el frontend envía `POST /api/check-ins`.
2. El backend valida token, publicación, geocerca y duplicados.
3. El backend registra el check-in y otorga la insignia de forma idempotente.
4. El frontend recibe `201` con `achievementsAwarded`.
5. Solo si hay una insignia nueva se abre el diálogo de celebración.
6. El diálogo muestra Chivito, el nombre del POI, la insignia, su categoría y su descripción.
7. «Ver mis insignias» navega al perfil; «Seguir explorando» cierra y devuelve el foco a la
   confirmación inline.

Estados:

| Caso | Resultado |
|---|---|
| Check-in válido con insignia nueva | Celebración + insignia inline |
| Check-in válido sin insignia nueva | Confirmación inline, sin celebración |
| QR inválido o expirado | Error, sin celebración |
| Fuera de geocerca | Error con distancia y radio, sin celebración |
| Duplicado | Error, sin celebración |
| Usuario no autenticado | Guard redirige a login |
| Error de red/backend | Error accionable, sin celebración |
| Doble clic | El botón se bloquea y el backend es idempotente |
| Respuesta tardía | Se ignora si el componente ya cambió de estado |

Accesibilidad:

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` y `aria-describedby`.
- Foco inicial en «Seguir explorando»; Tab atrapado; Escape y clic en el fondo cierran.
- El foco vuelve a la confirmación inline.
- `prefers-reduced-motion` desactiva la entrada y el confeti.
- La insignia no depende solo del color: tiene imagen, nombre y categoría textual.

## 7. Insignias sin imagen

`UserAchievement.image` puede ser `null` en registros anteriores. La UI usa
`achievementBadgeImage()` para resolver el medallón de la categoría real
(`architecture`, `monument`, `nature`, `religious`, `urban`, `museum`, `viewpoint`,
`commerce`, `service`, `adventure` o `default`). No se modifica la base de datos ni se
inventan nombres.

## 8. Verificación

| Comprobación | Comando / evidencia |
|---|---|
| Generación reproducible | `npm --prefix projects/frontend run brand:assets` |
| Tests de frontend | `npm run test:frontend` |
| Build | `npm run build` |
| Tests de backend | `npm run test:backend` (requiere MongoDB; conservation exige replica set en 27018) |
| E2E identidad | `npm run e2e -- e2e/identidad.spec.ts e2e/brand.spec.ts e2e/guia.spec.ts` → 9/9 aprobadas (2026-11-25) |
| E2E check-in | `npm run e2e -- e2e/coro-aventura.spec.ts` → 6/6 aprobadas, incluida la celebración y la ausencia de modal en duplicados (2026-11-25) |

Capturas: `projects/frontend/test-results/brand-header-desktop.png`,
`brand-header-mobile.png` y las que genere la suite E2E.

## 9. Pendientes

- Registrar autoría, licencia y permiso de publicación de las tres imágenes aportadas.
- Revisar el recorte de la pose de celebración en pantallas muy pequeñas.
- Si se exige una imagen persistida por insignia, añadir un backfill no destructivo; hoy el
  medallón de categoría es un respaldo de presentación.
- Un LLM conversacional o WebSocket requeriría una decisión y un ADR nuevos.
