# Wireframes y mapa de navegación — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.0-draft |
| Fecha | 2026-11-13 |
| Estado | Diseño de Fase 1; **propuesto, no implementado**. Los wireframes son de baja fidelidad. |
| Autoridad | [`PLAN-IMPLEMENTACION.md`](./PLAN-IMPLEMENTACION.md), [`REQUISITOS.md`](./REQUISITOS.md), [`RBAC.md`](./RBAC.md) |
| Documentos relacionados | [`CASOS-USO.md`](./CASOS-USO.md), [`MODELO-DATOS.md`](./MODELO-DATOS.md), [`EVENTOS-TIEMPO-REAL.md`](./EVENTOS-TIEMPO-REAL.md), [`360.md`](./360.md), [`openapi.yaml`](./openapi.yaml) |

> Estos esquemas describen la interfaz objetivo, no pantallas existentes. La SPA actual solo
> implementa mapa, catálogo, ficha, autenticación, perfil, check-in y el panel `/admin`. Las
> rutas marcadas como **propuesta** no están registradas en `app.routes.ts`.

## 1. Principios de interfaz

1. **El servidor decide.** Un guard de Angular mejora la experiencia; la capacidad se valida
   en la API. Ocultar un botón no sustituye la autorización.
2. **Un flujo, una decisión.** Cada pantalla muestra la acción principal y el estado actual;
   las acciones destructivas o irreversibles exigen confirmación y motivo.
3. **Estado visible.** Carga, vacío, error, sin permiso, sin conexión y reintento tienen un
   componente y un texto propios.
4. **Conservación no es diagnóstico ciudadano.** Un reporte se presenta como “aviso”; una
   inspección, como “actuación técnica verificada”.
5. **Evidencia privada.** Las miniaturas de evidencia no se sirven por URL pública; se piden
   al endpoint autenticado y el acceso queda auditado.
6. **Accesibilidad desde el wireframe.** Foco visible, etiquetas, orden de tabulación, texto
   alternativo, contraste y movimiento reducido se diseñan antes de programar.
7. **Móvil primero en campo.** El inspector usa tableta o teléfono; las acciones frecuentes
   quedan al alcance del pulgar y no dependen de `hover`.

## 2. Mapa de navegación

### 2.1 Rutas públicas y de turista

| Ruta | Pantalla | Acceso | Estado |
|---|---|---|---|
| `/` | Mapa y buscador de POI | Público | Existente |
| `/lugares` | Catálogo | Público | Existente |
| `/lugares/:slug` | Ficha del POI, conservación y 360 | Público | Existente; incluye panoramas publicados |
| `/panoramas` | Galería de visitas 360 publicadas | Público | Implementada |
| `/panoramas/:id` | Visor 360 con hotspots y fallback | Público | Implementada |
| `/asistente` | Guía turística con citas | Público con rate limit | Propuesta |
| `/login`, `/registro` | Autenticación | Visitante | Existente |
| `/perfil` | Perfil y check-ins | `user` autenticado | Existente |
| `/reportes/nuevo` | Crear reporte | `report.create` | Propuesta |
| `/reportes` | Mis reportes | `report.read.own` | Propuesta |
| `/reportes/:id` | Detalle de mi reporte | Dueño o inspector | Propuesta |
| `/notificaciones` | Centro de notificaciones | `notification.read.own` | Propuesta |
| `/acceso-denegado` | Sin permiso | Autenticado | Existente |

### 2.2 Rutas internas

| Ruta | Pantalla | Acceso | Estado |
|---|---|---|---|
| `/inspecciones` | Bandeja de triaje e inspecciones | `inspector` con capacidad | Propuesta |
| `/inspecciones/:id` | Detalle, hallazgos, evidencia e intervenciones | Inspector asignado o revisor | Propuesta |
| `/inspecciones/:id/revisar` | Revisión y cierre | `inspection.review` / `inspection.close` | Propuesta |
| `/admin` | Panel administrativo | `admin` | Existente |
| `/admin/usuarios` | Cuentas, rol, estado y sesiones | `admin` | Existente |
| `/admin/poi` | POI | `admin` | Existente |
| `/admin/auditoria` | Auditoría | `admin` | Existente |
| `/admin/fuentes` | Registro de fuentes RAG | `source.manage` | Propuesta |
| `/admin/panoramas` | Inventario, alta y configuración 360 | `panorama.manage` | Implementada |
| `/curaduria/panoramas` | Bandeja editorial de panoramas públicos | `panorama.publish` / `panorama.manage` | Implementada |
| `/curaduria/panoramas/:id` | Revisión, aprobación, publicación y archivo | `panorama.publish` / `panorama.manage` | Implementada |
| `/admin/activos` | Activos patrimoniales | `asset.manage` (propuesto) | Propuesta |
| `/contenido` | Mesa editorial del historiador | `content.edit` / `content.review` | Pendiente de alcance |

`/admin` no aloja la consola de inspección. La separación `/admin` y `/inspecciones` es la
decisión D-13, aún pendiente de aprobación formal; este documento la asume como propuesta.

### 2.3 Navegación por rol

```text
Visitante
  ├── Mapa / Lugares / Ficha
  ├── Panoramas 360
  ├── Guía turística
  └── Iniciar sesión / Registrarse

Turista (user)
  ├── Todo lo público
  ├── Reportar daño
  ├── Mis reportes
  ├── Notificaciones
  └── Perfil / Check-ins

Inspector
  ├── Bandeja de reportes
  ├── Bandeja de inspecciones
  ├── Detalle de inspección
  ├── Evidencia autorizada
  ├── Asistente técnico
  └── Notificaciones

Historiador
  ├── Curaduría de panoramas 360 (aprobar, publicar, archivar)
  ├── Mesa editorial (pendiente de alcance)
  ├── Consulta del asistente técnico
  └── Fuentes en solo lectura

Administrador
  ├── Panel
  ├── POI
  ├── Cuentas y sesiones
  ├── Auditoría
  ├── Fuentes RAG
  ├── Panoramas 360 (configuración técnica e inspección)
  └── Activos patrimoniales
```

## 3. Componentes transversales

| Componente | Uso | Reglas |
|---|---|---|
| `AppHeader` | Navegación pública | Enlace activo con `aria-current`; menú móvil accesible. |
| `RoleBadge` | Rol visible | Texto, no solo color; `moderator` se muestra como “Moderador (legacy)”. |
| `ConservationBadge` | Estado público | “Buen estado”, “Estado regular”, “Estado deficiente” o “Sin inspección verificada”; incluye fecha. |
| `StatePanel` | Carga, vacío, error | `role="status"` para carga; `role="alert"` para error; acción de reintento. |
| `ConfirmDialog` | Acciones críticas | `<dialog>` nativo, foco atrapado, Escape, motivo obligatorio cuando aplique. |
| `ReauthDialog` | Rol, estado, revocación | Pide contraseña actual; nunca la conserva tras cerrar. |
| `EvidenceThumb` | Evidencia privada | Carga autenticada; sin URL pública; texto alternativo genérico. |
| `Timeline` | Historial | Orden cronológico; estado y actor; no edita el pasado. |
| `Toast` | Resultado efímero | `aria-live="polite"`; no sustituye el mensaje persistente de error. |
| `RealtimeStatus` | Conexión Socket.IO | “En vivo”, “Reconectando…”, “Sin conexión”; no bloquea la navegación. |
| `Pagination` | Listas | Página, total y `hasMore`; conserva filtros en la URL. |
| `EmptyState` | Lista vacía | Explica por qué está vacía y cuál es el siguiente paso. |

## 4. Wireframes

### W-01 — Mapa y buscador (público)

```text
┌──────────────────────────────────────────────────────────────┐
│ FALCONSYNC   Mapa   Lugares   360   Asistente   [Ingresar]  │
├──────────────────────────────────────────────────────────────┤
│ Buscar lugar, categoría o tema…                    [Filtros] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                 [ Mapa de Coro con marcadores ]              │
│                                                              │
│   ┌────────────────────────────┐                             │
│   │ Catedral de Coro           │  ← tarjeta al seleccionar   │
│   │ Religioso · Centro         │                             │
│   │ Conservación: sin verificar│                             │
│   │ [Ver ficha]  [Visita 360]  │                             │
│   └────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- El marcador no usa color como único indicador de estado.
- La tarjeta muestra “Sin inspección verificada” mientras no exista proyección.
- “Visita 360” solo aparece si hay un panorama publicado para ese POI.
- En móvil, la tarjeta se convierte en hoja inferior y el mapa conserva el contexto.

### W-02 — Ficha del POI con conservación y 360

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Explorar otros lugares                                     │
│ Religioso · Periodo colonial                                 │
│ Catedral de Coro                                             │
│ Resumen histórico…                                           │
│ Dirección…                                                   │
├──────────────────────────────────────────────────────────────┤
│ [ Imagen principal ]                                         │
│ Autoría · Licencia · Ver original                            │
├───────────────────────────────────────────┬──────────────────┤
│ Historia                                  │ Datos del lugar  │
│ …                                         │ Conservación:    │
│                                           │ [Sin inspección  │
│ Detalles de interés                       │  verificada]     │
│ …                                         │ Última revisión: │
│                                           │ —                │
│ [Ver visita 360°]  [Reportar un daño]     │ Temas…           │
│                                           │                  │
│ Fuentes históricas                        │                  │
│ …                                         │                  │
└───────────────────────────────────────────┴──────────────────┘
```

Reglas:

- “Reportar un daño” exige sesión; si no hay, redirige a `/login` con `returnUrl`.
- La insignia de conservación solo aparece con inspección cerrada y revisada. Si no,
  “Sin inspección verificada”.
- La ficha no muestra identidad del inspector, evidencia, GPS exacto ni notas internas.
- La sección 360 se enlaza a `/panoramas/:id` y conserva el retorno a la ficha.

### W-03 — Crear reporte (turista autenticado)

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Volver                    Reportar un daño                 │
│ Lugar: Catedral de Coro (o activo seleccionado)              │
├──────────────────────────────────────────────────────────────┤
│ 1. ¿Qué observas?                                            │
│    ( ) Estructura   ( ) Humedad   ( ) Grietas               │
│    ( ) Pérdida de material   ( ) Vandalismo   ( ) Otro       │
│                                                              │
│ 2. Descripción *                                             │
│    ┌──────────────────────────────────────────────────────┐  │
│    │ Describe el daño y su ubicación aproximada…          │  │
│    └──────────────────────────────────────────────────────┘  │
│    0 / 2000                                                  │
│                                                              │
│ 3. Fecha y ubicación                                         │
│    Capturado: [13/11/2026 10:30]  Precisión: ±8 m           │
│    [Usar mi ubicación]  (opcional)                           │
│                                                              │
│ 4. Fotos (opcional, máximo 10)                               │
│    [ + Añadir foto ]  [miniatura] [miniatura]                │
│    Formatos: JPEG, PNG o WebP · máx. 10 MB cada una          │
│                                                              │
│ Aviso: tu reporte no es un diagnóstico ni cambia el estado   │
│ público hasta que un inspector lo revise.                    │
│                                                              │
│                              [Cancelar]  [Enviar reporte]    │
└──────────────────────────────────────────────────────────────┘
```

Estados:

| Estado | Comportamiento |
|---|---|
| Envío | Botón deshabilitado, `aria-busy="true"`, no se duplica el POST. |
| Éxito | `201`; muestra folio, estado “Recibido” y enlace a “Mis reportes”. |
| Error de validación | Errores junto al campo y resumen con `role="alert"`. |
| Sin conexión | Conserva el borrador local; no promete envío. |
| Evidencia rechazada | Explica el motivo (tipo, tamaño, cuarentena) sin borrar el resto del formulario. |

### W-04 — Mis reportes

```text
┌──────────────────────────────────────────────────────────────┐
│ Mis reportes                                  [+ Nuevo reporte]│
│ Filtros: [Todos ▾] [Fecha ▾]                                 │
├──────────────────────────────────────────────────────────────┤
│ Folio     Lugar              Categoría   Estado     Fecha     │
│ R-00124   Catedral de Coro   Humedad     Recibido   13/11     │
│ R-00119   Plaza Bolívar      Grietas     En revisión 08/11    │
│ R-00101   Museo…             Vandalismo  Rechazado  01/11     │
├──────────────────────────────────────────────────────────────┤
│ Mostrando 1–20 de 3                        [Anterior] [Sigu.]│
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- Solo aparecen reportes propios; la API filtra por `reporterId`.
- El estado se muestra con texto e icono, no solo color.
- Un reporte rechazado muestra el motivo de forma comprensible.
- El detalle conserva el historial y la evidencia autorizada.

### W-05 — Bandeja del inspector

```text
┌──────────────────────────────────────────────────────────────┐
│ Inspecciones        [Reportes por triar (3)] [Mis tareas (5)]│
├──────────────────────────────────────────────────────────────┤
│ Buscar por activo, folio o inspector…                        │
│ Filtros: [Estado ▾] [Tipo ▾] [Fecha ▾]                       │
├──────────────────────────────────────────────────────────────┤
│ Prioridad  Activo              Estado        Asignado  Fecha │
│ ● Alta     Catedral de Coro    Por triar     —         13/11 │
│ ● Media    Casa…               Planificada   A. Pérez 12/11 │
│ ● Baja     Plaza Bolívar       En revisión   M. Díaz  10/11 │
├──────────────────────────────────────────────────────────────┤
│ [Abrir]  [Tomar]  [Asignar]                                  │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- “Por triar” y “Mis tareas” son vistas separadas; no mezclan reportes con inspecciones.
- La prioridad es una señal de triaje, no una severidad confirmada.
- Un inspector no ve evidencia de un reporte que no le corresponde.
- La bandeja se actualiza por Socket.IO, pero siempre se puede recargar por API.

### W-06 — Detalle de inspección

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Bandeja        Inspección INS-0042        [Estado: En curso]│
│ Activo: Catedral de Coro · Tipo: Seguimiento · Inspector: A. │
│ Origen: Reporte R-00124 · Inicio: 13/11/2026 09:10           │
├──────────────────────────────────────────────────────────────┤
│ [Resumen] [Hallazgos (4)] [Evidencia (6)] [Intervenciones]   │
│ [Historial]                                                   │
├──────────────────────────────────────────────────────────────┤
│ Alcance                                                       │
│ Inspección visual de fachada y cubierta…                      │
│                                                               │
│ Hallazgos                                                     │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ H-01  Humedad ascendente   Propuesta: Alta   [Confirmar]  │ │
│ │ H-02  Grieta longitudinal  Propuesta: Media  [Confirmar]  │ │
│ │ H-03  Vegetación           Propuesta: Baja   [Descartar]  │ │
│ └───────────────────────────────────────────────────────────┘ │
│ [+ Añadir hallazgo]                                           │
│                                                               │
│ Evidencia                                                     │
│ [miniatura] [miniatura] [miniatura]  [Subir evidencia]        │
│                                                               │
│ Intervenciones                                                │
│ I-07 Reparación de cubierta · Aprobada · [Ver]                │
│                                                               │
│ [Guardar borrador] [Enviar a revisión]                        │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- “Enviar a revisión” exige al menos un hallazgo o “Sin hallazgos” declarado.
- La evidencia se muestra como miniatura autenticada, nunca como URL pública.
- “Confirmar” y “Descartar” son acciones del revisor, no del inspector que propuso.
- El historial es de solo lectura; una corrección se registra como evento nuevo.
- En móvil, las pestañas se convierten en acordeones y las acciones críticas quedan fijas
  al pie, sin tapar el contenido.

### W-07 — Revisión y cierre

```text
┌──────────────────────────────────────────────────────────────┐
│ Revisar inspección INS-0042                                  │
│ Inspector: A. Pérez · Revisor: M. Díaz                       │
├──────────────────────────────────────────────────────────────┤
│ Resultado de la inspección *                                 │
│ ( ) Buen estado   (•) Estado regular   ( ) Estado deficiente │
│                                                              │
│ Hallazgos                                                    │
│ H-01 Humedad   [Confirmar severidad: Alta ▾]  [Descartar]    │
│ H-02 Grieta    [Confirmar severidad: Media ▾] [Descartar]    │
│ H-03 Vegetación [Descartar]  Motivo: [____________________]  │
│                                                              │
│ Notas de revisión *                                          │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ …                                                        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Regla de cierre                                              │
│ ✓ H-01 tiene intervención verificada                         │
│ ✗ H-02 requiere intervención y aún no está verificada        │
│   Justificación excepcional: [___________________________]   │
│                                                              │
│ [Devolver al inspector]  [Aprobar revisión]  [Cerrar]        │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- “Aprobar revisión” y “Cerrar” son pasos distintos; el cierre exige la regla satisfecha.
- Si falta una intervención verificada, el botón “Cerrar” se deshabilita y explica por qué.
- La justificación excepcional exige motivo y queda auditada.
- El revisor no puede ser el inspector; la UI lo advierte antes de abrir el diálogo.

### W-08 — Evidencia privada

```text
┌──────────────────────────────────────────────────────────────┐
│ Evidencia EV-0091                          [Cerrar]           │
│ Inspección INS-0042 · Hallazgo H-01 · JPEG · 2.4 MB          │
│ SHA-256: 9f2c…a71  · Analizada: 13/11/2026 09:22             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  [ Imagen privada ]                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Motivo del acceso *  [Inspección asignada_____________]      │
│ [Descargar]                                                  │
│ Este acceso queda registrado con tu usuario, fecha y motivo. │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- El visor pide `purpose` antes de descargar; el servidor lo exige.
- Si el hash no coincide, se muestra “No se pudo verificar la integridad” y no se entrega.
- Si la evidencia está en cuarentena, no se muestra la imagen.
- El administrador no descarga binarios por su rol; solo metadatos y auditoría.

### W-09 — Notificaciones y estado de conexión

```text
┌──────────────────────────────────────────────────────────────┐
│ Notificaciones                            [Marcar todas leídas]│
│ Estado: ● En vivo                                            │
├──────────────────────────────────────────────────────────────┤
│ ● Inspección asignada          hace 2 min       [Abrir]      │
│   Catedral de Coro · INS-0042                                │
│ ○ Revisión devuelta            hace 1 h         [Abrir]      │
│   “Falta confirmar la severidad de H-02”.                    │
│ ○ Reporte recibido             ayer             [Abrir]      │
│   R-00124 · Catedral de Coro                                 │
├──────────────────────────────────────────────────────────────┤
│ [Cargar más]                                                 │
└──────────────────────────────────────────────────────────────┘
```

Estados de conexión:

| Estado | Texto | Acción |
|---|---|---|
| Conectado | “En vivo” | Ninguna. |
| Reconectando | “Reconectando…” | Backoff automático; no bloquea. |
| Sin conexión | “Sin conexión. Puedes seguir consultando.” | Reintentar y recargar notificaciones. |
| Sesión revocada | “Tu sesión cambió. Inicia sesión de nuevo.” | Redirigir a `/login`. |
| Sin permiso | “No tienes acceso a este recurso.” | Volver a la bandeja. |

### W-10 — Guía Chivito

```text
┌──────────────────────────────────────────────────────────────┐
│ (avatar) Chivito · Guía turístico de FalconSync              │
│          Chivito disponible · corpus 2026.11.20-1             │
├──────────────────────────────────────────────────────────────┤
│ (avatar) Chivito                                             │
│ Tú: ¿Qué puedo visitar cerca de la Catedral?                 │
│                                                              │
│ Chivito: La Catedral de Coro se encuentra en el Casco        │
│          Histórico. Puedes continuar hacia la Plaza Bolívar  │
│          y el Museo…                                         │
│                                                              │
│          Fuentes:                                            │
│          [1] Oficial local · Fundación… · ver cita           │
│          [2] Referencia · …                                  │
│          Etiqueta: Oficial local                             │
│                                                              │
│ Tú: ¿Cuál es el estado de conservación actual?               │
│                                                              │
│ Chivito: No consta una inspección verificada para este       │
│          lugar. Puedo mostrarte la información histórica     │
│          disponible, pero no un diagnóstico.                 │
├──────────────────────────────────────────────────────────────┤
│ [Escribe tu pregunta…]                            [Enviar]   │
│ Las respuestas se basan en fuentes citadas. No son un        │
│ diagnóstico ni una decisión oficial.                         │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- Chivito es el nombre y el avatar del guía turístico; no es el asistente técnico.
- Cada respuesta muestra citas y etiqueta de confianza.
- Si no hay evidencia suficiente, `abstained=true` y se explica qué falta.
- No se muestra una respuesta sin citas validadas.
- El chat usa HTTP/RAG; no hay WebSocket ni LLM generativo externo en esta iteración.
- El historial tiene altura máxima y barra de desplazamiento propia; el compositor y la franja
  de Telegram permanecen estables aunque aumenten los mensajes.
- El historial baja al último mensaje al enviar una pregunta, pero no arrastra la vista si la
  persona está leyendo mensajes anteriores. Es enfocable con teclado y tiene nombre accesible.
- El asistente técnico es una pantalla separada, solo para inspector/historiador.

### W-11 — Visor 360°

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Ficha del lugar        Catedral de Coro — Fachada          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [ Imagen fija 2:1 con texto alternativo y descripción ]    │
│                                                              │
│   [ Activar vista 360° ]                                     │
│                                                              │
│   Puntos interactivos                                        │
│   • Plaza Bolívar, escena                                    │
│   • Interior, escena                                         │
│   • Información del lugar                                    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Autoría · Licencia · Fecha                                   │
│ [Centrar] [Ver imagen fija]                                  │
└──────────────────────────────────────────────────────────────┘
```

Estados:

| Estado | Comportamiento |
|---|---|
| Inicial | Se muestra el fallback estático con alt, descripción y créditos; WebGL no se inicializa. |
| Activación | La persona pulsa «Activar vista 360°»; se descarga el derivado y se crea el renderer. |
| Cargando | Texto de carga discreto; la ficha y el fallback siguen disponibles. |
| Error de imagen | Se conserva el fallback y se explica el fallo sin lenguaje técnico. |
| Sin WebGL | Se informa que el navegador no admite la vista interactiva; el fallback permanece. |
| Teclado | Flechas para girar, `+`/`-` para zoom, controles con Tab y Enter. |
| Hotspots | El lienzo los dibuja como ayuda visual; la navegación accesible es una lista de enlaces reales. |
| Movimiento | Sin autogiro, autoplay, pantalla completa ni botón de movimiento. |
| Panorama de inspección | No se sirve por la API turística; 404. |

El detalle técnico está en [`360.md`](./360.md).

### W-12 — Administración de fuentes RAG

```text
┌──────────────────────────────────────────────────────────────┐
│ Administración › Fuentes RAG                  [Registrar fuente]│
│ Filtros: [Estado ▾] [Acceso ▾] [Nivel ▾]                     │
├──────────────────────────────────────────────────────────────┤
│ Título                  Institución   Nivel  Estado    Acción│
│ Informe UNESCO 2008     UNESCO        A      Activa    [Ver] │
│ Plan de gestión local   Municipio     B      Activa    [Ver] │
│ Artículo de prensa     Medio         E      Retirada  [Ver]  │
├──────────────────────────────────────────────────────────────┤
│ Solo usuarios con `source.manage` pueden activar o retirar.  │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- El registro muestra derechos, licencia, checksum y versión antes de activar.
- Una fuente retirada no se usa en respuestas nuevas; las citas históricas se conservan.
- El historiador consulta; no activa fuentes si `source.manage` sigue siendo solo de admin
  (ver OI-01 en [`CASOS-USO.md`](./CASOS-USO.md)).

### W-13 — Administración de panoramas

```text
┌──────────────────────────────────────────────────────────────┐
│ Administración › Panoramas                    [Subir panorama]│
│ Filtros: [Estado ▾] [Visibilidad ▾] [POI ▾]                  │
├──────────────────────────────────────────────────────────────┤
│ Título              POI              Visibilidad  Estado      │
│ Fachada Catedral    Catedral de Coro Pública      Publicado   │
│ Detalle cubierta    Catedral de Coro Inspección   Aprobado    │
├──────────────────────────────────────────────────────────────┤
│ Derechos: [✓] Autoría  [✓] Licencia  [✓] Consentimiento      │
│ [Previsualizar] [Aprobar] [Publicar] [Archivar]              │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- No se publica sin autoría, licencia, checksum y fallback.
- `visibility=inspection` nunca aparece en la API turística.
- El formulario no permite escribir una URL pública arbitraria; la imagen se sube y se
  valida.

### W-14 — Cuentas (existente, referencia)

La pantalla `/admin/usuarios` ya implementa tabla, acciones por fila, diálogo accesible,
reautenticación, avisos y errores. El wireframe no se duplica aquí; el contrato vigente está
en [`ADMINISTRACION.md`](./ADMINISTRACION.md) y [`RBAC.md`](./RBAC.md). Las nuevas pantallas
deben reutilizar el mismo patrón de diálogo y confirmación.

### W-15 — Activos patrimoniales

```text
┌──────────────────────────────────────────────────────────────┐
│ Administración › Activos patrimoniales       [Nuevo activo]  │
│ Filtros: [Estado ▾] [Tipo ▾] [UNESCO ▾] [POI ▾]             │
├──────────────────────────────────────────────────────────────┤
│ Código     Nombre              Tipo       UNESCO    Estado   │
│ COR-001    Catedral de Coro    Edificación Inscrito Activo   │
│ COR-014    Casa de…            Edificación Unknown   Borrador │
├──────────────────────────────────────────────────────────────┤
│ [Ver] [Editar] [Archivar]                                    │
│ El código no se reutiliza. UNESCO requiere fuente explícita. │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- `unescoStatus` no se deduce del POI; si es `inscribed` o `buffer_zone`, exige `sourceRefs`.
- Un activo `archived` no admite nuevas inspecciones.
- El enlace con un POI es opcional; un POI sin activo sigue siendo turístico.
- El admin gestiona el inventario, pero no inspecciona por su rol.

### W-16 — Celebración de check-in

```text
┌──────────────────────────────────────────────────────────────┐
│                    (fondo oscuro translúcido)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              [Chivito con brazos levantados]           │  │
│  │      Chivito · Guía turístico de FalconSync            │  │
│  │           ¡Felicidades! ¡Lo lograste!                  │  │
│  │      ¡Un lugar más descubierto en nuestro Falcón!      │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ [insignia]  NUEVA INSIGNIA                       │  │  │
│  │  │             Catedral de Coro                     │  │  │
│  │  │             Religioso                           │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │      Lugar visitado: Catedral de Coro                  │  │
│  │      [Ver mis insignias] [Seguir explorando]           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- Solo se abre con `201` y al menos una insignia nueva.
- El nombre, la categoría y la descripción salen de la respuesta del backend.
- El botón «Seguir explorando» recibe el foco inicial; Escape y el fondo cierran.
- Al cerrar, el foco vuelve a la confirmación inline del check-in.
- No se abre en errores, duplicados, QR inválido o fuera de geocerca.
- `prefers-reduced-motion` desactiva la entrada y el confeti.

## 5. Estados obligatorios por pantalla

| Pantalla | Carga | Vacío | Error | Sin permiso | Sin conexión |
|---|---|---|---|---|---|
| Mapa | Esqueleto del mapa | “No hay lugares con estos filtros” | “No se pudo cargar el mapa” | No aplica | Marcador y tarjetas en caché si existen |
| Ficha | Esqueleto | No aplica | “No se pudo cargar este lugar” | No aplica | Contenido previo si existe |
| Crear reporte | Envío con `aria-busy` | No aplica | Errores por campo + resumen | Redirige a login | Borrador local; no promete envío |
| Mis reportes | Filas esqueleto | “Aún no has reportado daños” | “No se pudieron cargar tus reportes” | No aplica | Última lista si existe |
| Bandeja inspector | Filas esqueleto | “No hay tareas pendientes” | “No se pudo cargar la bandeja” | “No tienes capacidad de inspección” | Última lista; aviso |
| Detalle inspección | Esqueleto | “Sin hallazgos todavía” | “No se pudo cargar la inspección” | 404 si no está asignada | Solo lectura; aviso |
| Revisión | Esqueleto | No aplica | Errores de regla de cierre | 403 | No permitir cierre sin conexión |
| Evidencia | Esqueleto | No aplica | Integridad/cuarentena | 404 | No cachear |
| Notificaciones | Esqueleto | “No tienes notificaciones” | “No se pudieron cargar” | No aplica | “Sin conexión”; reintentar |
| Chivito | “Chivito está pensando…” | “Haz una pregunta para empezar” | “Chivito no está disponible” | No aplica | “Sin conexión”; no enviar |
| Celebración | No aplica | No aplica | No se abre | No aplica | No se abre |
| 360 | Esqueleto | “Aún no hay visitas 360 publicadas” | Fallback estático | No aplica | Fallback estático |
| Fuentes RAG | Filas esqueleto | “No hay fuentes registradas” | “No se pudo cargar el registro” | “Solo administración” | Última lista si existe |
| Activos | Filas esqueleto | “No hay activos registrados” | “No se pudo cargar el inventario” | “No tienes `asset.read`” | Última lista si existe |

## 6. Formularios y validación

| Formulario | Campos obligatorios | Validación cliente | Validación servidor |
|---|---|---|---|
| Reporte | Categoría, descripción, fecha, destino | Longitud, fecha no futura, destino | Esquema, capacidad, destino existente, idempotencia |
| Triaje | Decisión, motivo | Motivo en rechazo/cierre | Transición, actor ≠ reportante, versión |
| Inspección | Activo, tipo, alcance | Longitud, activo activo | Estado del activo, inspector válido |
| Hallazgo | Categoría, descripción, severidad propuesta | Longitud, severidad | Inspección en curso, límite 50 |
| Revisión | Decisión, notas, resultado | Resultado y severidades | Revisor ≠ inspector, transición |
| Intervención | Inspección, hallazgos, tipo, descripción, ejecutor | Al menos un hallazgo | Pertenencia, estado, separación |
| Verificación | Notas | Longitud | Verificador ≠ ejecutor, evidencia disponible |
| Fuente RAG | Título, institución, versión, licencia, derechos, checksum | Campos y URL | Checksum, duplicado, derechos |
| Panorama | Título, imagen, autor, licencia, crédito, fallback | Relación 2:1, tamaño | Checksum, derechos, estado |

Mensajes:

- El error de campo se muestra junto al campo y se anuncia con `aria-describedby`.
- El resumen de errores usa `role="alert"` y enlaces al campo.
- Los mensajes no revelan si un recurso ajeno existe.
- Los códigos técnicos se conservan para soporte, pero no se muestran crudos.

## 7. Accesibilidad y responsive

- **WCAG 2.2 AA** como objetivo de aceptación, no como afirmación actual.
- Foco visible en todos los controles; no se elimina `outline` sin reemplazo.
- Orden de tabulación coherente con el orden visual.
- `<dialog>` nativo para confirmaciones; foco atrapado y retorno al disparador.
- No se usa solo color para estado, severidad ni conservación.
- Contraste mínimo 4.5:1 para texto normal y 3:1 para texto grande.
- Zoom al 200 % sin pérdida de contenido ni solapamiento.
- `prefers-reduced-motion`: sin animaciones automáticas en 360, mapas y transiciones.
- Imágenes con `alt` significativo; imágenes decorativas con `alt=""`.
- Videos/audio con subtítulos y transcripción cuando existan.
- Tablas con encabezados y caption; en móvil se transforman en tarjetas, no se ocultan datos.
- Puntos de ruptura propuestos: 360 px, 768 px, 1024 px y 1280 px.
- En campo, objetivos táctiles de al menos 44 × 44 px.

## 8. Contenido y tono

| Situación | Texto propuesto |
|---|---|
| Sin inspección | “Sin inspección verificada” |
| Inspección buena | “Buen estado · Verificado el 13/11/2026” |
| Inspección regular | “Estado regular · Verificado el 13/11/2026” |
| Inspección deficiente | “Estado deficiente · Verificado el 13/11/2026” |
| Reporte recibido | “Recibido. Un inspector lo revisará.” |
| Reporte rechazado | “No se aceptó el reporte. Motivo: …” |
| Inspección vacía | “Registra al menos un hallazgo o declara que no encontraste daños.” |
| Cierre bloqueado | “Falta verificar una intervención antes de cerrar.” |
| Evidencia en cuarentena | “La evidencia no está disponible porque no superó el análisis de seguridad.” |
| Sin conexión | “Sin conexión. Puedes seguir consultando; los cambios se enviarán cuando vuelvas.” |
| Sesión revocada | “Tu sesión cambió. Inicia sesión de nuevo.” |

No se usan mensajes que culpen al usuario ni términos como “error fatal”, “ilegal” o
“denegado” sin explicación. “Denegado” se reserva para `403` con una acción clara.

## 9. Trazabilidad

| Pantalla | Casos de uso | Requisitos |
|---|---|---|
| W-01, W-02 | UC-01, UC-16 | RF-16, RF-67 a RF-70 |
| W-03, W-04 | UC-01, UC-02 | RF-16, RF-17, RF-34 |
| W-05 | UC-03, UC-04, UC-05 | RF-18 a RF-20 |
| W-06 | UC-06, UC-07, UC-12 | RF-21, RF-22, RF-41, RF-42 |
| W-07 | UC-08, UC-11 | RF-23, RF-24, RF-27 |
| W-08 | UC-12 | RF-35 a RF-43 |
| W-09 | UC-13 | RF-44 a RF-52 |
| W-10 | UC-14, UC-15 | RF-59 a RF-66 |
| W-11 | UC-16 | RF-67 a RF-70 |
| W-12 | UC-17 | RF-53 a RF-55 |
| W-13 | UC-16 | RF-67 a RF-70 |
| W-14 | Fase 2 | RF-08 a RF-15 |
| W-15 | UC-19 | RF-11, RF-12 |
| W-16 | Check-in válido | RF-95, RF-96, HU-28 |

## 10. Decisiones pendientes

- **D-13:** separación `/admin` y `/inspecciones`; este documento la asume.
- **D-14:** `/admin` solo para administradores; no se amplía a inspectores.
- **D-17:** identidad del reportante visible a inspector/revisor; la UI la muestra solo en
  contexto autorizado.
- **D-18:** audio e idiomas; las pantallas de audio quedan condicionadas.
- **D-23:** retención; no se muestra una fecha de borrado al usuario hasta aprobarla.
- **OI-01:** capacidad del historiador para gestionar fuentes.
- **OI-02/OI-03:** capacidad y endpoint de aprobación de intervenciones.
- **Biblioteca 360°:** se elige tras verificar licencia y accesibilidad; no se declara en este
  documento.
- **Historiador:** la mesa editorial `/contenido` requiere alcance funcional antes de
  wireframearla en detalle.

## 11. Criterios de aceptación

- [ ] Cada ruta propuesta tiene guard, capacidad y estado de error definidos.
- [ ] Cada flujo de [`CASOS-USO.md`](./CASOS-USO.md) tiene al menos una pantalla asociada.
- [ ] Los wireframes cubren carga, vacío, error, sin permiso y sin conexión.
- [ ] La evidencia nunca se representa con una URL pública.
- [ ] La conservación pública solo se muestra con inspección cerrada y revisada.
- [ ] El visor 360 tiene fallback, teclado y movimiento reducido.
- [ ] Las acciones críticas usan diálogo nativo, motivo y confirmación.
- [ ] Los textos no prometen funcionalidad no implementada.
- [ ] La revisión de accesibilidad se hará sobre la implementación, no sobre este documento.
