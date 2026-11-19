# Operación, SLO y recuperación — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.1 |
| Fecha | 2026-11-15 |
| Estado | Línea base de Fase 0; hosting, dominio y topología pendientes. Incluye el procedimiento de migración de índices únicos de conservación |
| Documentos relacionados | [`REQUISITOS.md`](./REQUISITOS.md), [`SEGURIDAD.md`](./SEGURIDAD.md), [`PLAN-IMPLEMENTACION.md`](./PLAN-IMPLEMENTACION.md) |

> Los valores son objetivos propuestos para congelar en Fase 0. No son resultados medidos ni
> compromisos contractuales hasta que exista un entorno de staging y una medición reproducible.

## 1. Servicios y criticidad

| Servicio | Criticidad | Usuarios |
|---|---|---|
| Catálogo público, mapa y fichas | Alta | Visitantes |
| Autenticación y perfil | Alta | Usuarios |
| Reporte e inspección | Crítica | Usuarios, inspectores |
| Evidencia | Crítica | Inspectores, auditores |
| Notificaciones Socket.IO | Alta | Usuarios, inspectores |
| Asistentes RAG | Media | Turistas, inspectores |
| Visita 360° | Media | Turistas |
| Administración de cuentas | Alta | Administradores |

## 2. SLO

| ID | Métrica | Objetivo | Ventana | Método |
|---|---|---|---|---|
| SLO-01 | Disponibilidad pública | 99.5 % | Mensual, excluyendo mantenimiento planificado | Comprobación sintética cada minuto desde dos regiones |
| SLO-02 | Disponibilidad interna de inspección | 99.0 % | Mensual, en horario de campo | Igual, con ventana declarada |
| SLO-03 | Latencia de API pública | p95 ≤ 800 ms | Mensual | Medición en staging y producción |
| SLO-04 | Flujo de reporte | p95 ≤ 45 s con foto en 4G | Por muestra | Inicio: toque “Reportar” con sesión iniciada; fin: confirmación 201 |
| SLO-05 | GPS | 90 % de lecturas con precisión reportada ≤ 10 m | Por muestra | Muestra de dispositivos y condiciones |
| SLO-06 | RAG primera respuesta visible | p95 ≤ 2 s corpus interno; ≤ 4 s con búsqueda externa | Por muestra | Medición separada de recuperación y primer token |
| SLO-07 | RAG respuesta completa | p95 ≤ 8 s para hasta 500 tokens | Por muestra | Extremo a extremo |
| SLO-08 | Socket.IO entrega | p95 ≤ 2 s desde el evento persistido hasta el `ack` | Mensual | Prueba de carga y telemetría |
| SLO-09 | Accesibilidad | WCAG 2.2 AA | Por release | Automatizado + revisión manual |
| SLO-10 | Seguridad | Sin hallazgos críticos o altos abiertos | Por release | Auditoría y pruebas |

### 2.1 Definiciones de cálculo

- **Disponibilidad:** `checks_exitosos / checks_totales` en la ventana, excluyendo
  mantenimiento anunciado con al menos 48 horas de antelación.
- **Latencia:** percentil 95 de la muestra; se reporta p50 y p95. No se usa el promedio para
  ocultar la cola.
- **Flujo de reporte:** desde el toque en “Reportar” con sesión iniciada hasta recibir 201;
  incluye selección de foto, GPS y envío. No incluye registro previo.
- **GPS:** se registra `accuracyMeters` informado por el navegador; una lectura > 10 m se
  marca y no se acepta en silencio. La muestra mínima es 30 lecturas por dispositivo y
  condición.
- **RAG:** se mide recuperación, primer token visible y respuesta completa por separado. Se
  declara modelo, versión, hardware, red, top-k, caché y fecha.
- **Socket.IO:** desde la persistencia de la notificación hasta el `ack` del cliente; se
  incluye reconexión y recuperación por cursor.

## 3. RPO, RTO y continuidad

| ID | Métrica | Objetivo | Nota |
|---|---|---|---|
| RPO-01 | Base de datos | 1 h | Si el proveedor solo permite backup diario, se declara 24 h y se compensa con versionado. |
| RPO-02 | Evidencia y archivos | 1 h | Versionado de objetos o copia incremental. |
| RTO-01 | Servicio completo | 4 h | Incluye base, archivos, API y frontend. |
| RTO-02 | Servicio de solo lectura | 2 h | Catálogo público mientras se restaura la escritura. |
| MTTR-01 | Incidente crítico | 4 h | Desde la detección hasta la recuperación. |

Backups:

- Regla 3-2-1: tres copias, dos medios, una fuera del sitio.
- Cifrado en reposo y en tránsito.
- Restauración probada antes del lanzamiento y después de cada cambio de esquema.
- Registro de la última copia verificada y de su checksum.
- Prueba de restauración con acta: fecha, responsable, duración, resultado y diferencias.

## 4. Entornos

| Entorno | Propósito | Datos | Acceso |
|---|---|---|---|
| Local | Desarrollo | Sintéticos o locales | Desarrollador |
| Test | Pruebas automatizadas | Sintéticos | CI |
| Staging | Validación y piloto | Sintéticos o anonimizados | Equipo autorizado |
| Producción | Servicio real | Reales | Operación y soporte con mínimo privilegio |

Reglas:

- Secretos separados por entorno; nunca se reutilizan.
- Staging no usa datos personales reales sin anonimización.
- Producción no se usa para pruebas manuales destructivas.
- El despliegue a producción requiere aprobación explícita.

## 5. Observabilidad

| Señal | Herramienta | Uso |
|---|---|---|
| Health/readiness | `/api/health`, endpoint de readiness | Detectar caída o dependencia no disponible. |
| Logs estructurados | JSON con `correlationId`, nivel y contexto | Diagnóstico sin secretos. |
| Métricas | Latencia, errores, saturación, colas, Socket.IO, RAG | SLO y capacidad. |
| Trazas | Petición API → base → proveedor RAG | Cuellos de botella. |
| Alertas | Disponibilidad, errores 5xx, latencia, backup, cola | Respuesta oportuna. |

Reglas:

- No registrar tokens, contraseñas, cookies, evidencia ni datos personales innecesarios.
- `correlationId` se propaga desde el cliente o se genera en la API.
- Las alertas tienen dueño, umbral, severidad y runbook.
- El panel de SLO muestra la ventana y la exclusión de mantenimiento.

## 6. Despliegue

1. Build reproducible y pruebas verdes.
2. Migraciones expand-contract; nunca `down` destructivo.
3. Backup y verificación previa.
4. Despliegue a staging y smoke tests.
5. Aprobación explícita.
6. Despliegue a producción con ventana y responsable.
7. Verificación de health, errores y SLO.
8. Registro de versión, cambios y rollback disponible.

### 6.1 Migración previa de índices únicos de conservación

`Report.inspectionId` e `Inspection.reportId` tienen índice único sparse. Un documento con el
campo presente y valor `null` sí entra al índice; dos `null` explícitos impiden crearlo con
`E11000`. Antes de desplegar sobre datos heredados:

1. Backup verificado y ventana autorizada.
2. Dry-run en staging o sobre una copia. `$type: 'null'` distingue el `null` explícito del
   campo ausente:

   ```js
   db.reports.countDocuments({ inspectionId: { $type: 'null' } })
   db.inspections.countDocuments({ reportId: { $type: 'null' } })
   db.reports.countDocuments({ state: 'converted', inspectionId: null })
   ```

   Un reporte `converted` sin vínculo es una inconsistencia real: no se corrige con `$unset`;
   se investiga y reconcilia antes de continuar.
3. Limpiar solo los nulos explícitos sin vínculo real:

   ```js
   db.reports.updateMany(
     { inspectionId: { $type: 'null' } },
     { $unset: { inspectionId: '' } },
   )
   db.inspections.updateMany(
     { reportId: { $type: 'null' } },
     { $unset: { reportId: '' } },
   )
   ```

4. Revisar `db.reports.getIndexes()` y `db.inspections.getIndexes()`; arrancar la API para que
   Mongoose cree los índices y confirmar que no hay error de duplicado.
5. Verificar que los conteos del paso 2 son cero y repetir una conversión de prueba.

Esta migración **no se ejecutó** en esta sesión: no hay datos heredados verificados ni
autorización de despliegue. La API serializa ambos campos como `null` sin escribirlos en el
documento.

Rollback:

- Imagen anterior y configuración anterior.
- Migraciones compatibles hacia atrás.
- Feature flags para desactivar RAG, Socket.IO o 360 sin revertir todo.
- Si el esquema cambió de forma incompatible, restaurar backup y documentar.

## 7. Runbook mínimo

### 7.1 API no responde

1. Verificar health y logs.
2. Confirmar MongoDB y almacenamiento.
3. Revisar saturación, errores 5xx y último despliegue.
4. Reiniciar solo si el procedimiento lo autoriza.
5. Si persiste, rollback.
6. Registrar incidente y postmortem.

### 7.2 Socket.IO no entrega

1. Verificar ticket y handshake.
2. Revisar conexiones, salas y adaptador.
3. Confirmar que las notificaciones se persisten.
4. Probar reconexión con `lastCursor`.
5. Si hay clúster, revisar Redis y sesiones pegajosas.
6. Si no se recupera, desactivar tiempo real y mantener polling/API.

### 7.3 Evidencia inaccesible

1. Confirmar autorización y pertenencia.
2. Verificar hash y estado `available`.
3. Revisar almacenamiento privado y logs de acceso.
4. No exponer la evidencia para “probar” que existe.
5. Escalar a seguridad si hay indicio de fuga.

### 7.4 RAG con latencia o errores

1. Verificar proveedor, cuota y región.
2. Revisar recuperación y top-k.
3. Activar caché o degradar a abstención.
4. Desactivar búsqueda externa si es la causa.
5. Registrar coste y latencia.

### 7.5 Restauración

1. Declarar incidente y ventana.
2. Aislar escritura si hay corrupción.
3. Restaurar base y archivos desde la última copia verificada.
4. Verificar checksums y consistencia.
5. Reabrir escritura con monitoreo.
6. Documentar RPO/RTO reales.

## 8. Capacidad y escalado

- Línea base: una instancia documentada.
- Si se usa clúster: sesiones pegajosas y adaptador Redis para Socket.IO.
- RAG y búsqueda externa se escalan por cuota y caché, no solo por CPU.
- La carga se prueba en staging con datos sintéticos.
- Los límites de subida, body, consultas y conexiones se configuran en API y proxy.

## 9. Costes

| Concepto | Control |
|---|---|
| LLM/embeddings | Cuota, caché, top-k, límite de tokens y alerta de gasto. |
| Almacenamiento | Retención, compresión y borrado lógico. |
| Base de datos | Índices, backups y tamaño. |
| CDN/360 | Cacheo y formatos optimizados. |
| Observabilidad | Retención de logs y muestreo. |

## 10. Decisiones pendientes

| ID | Decisión | Impacto |
|---|---|---|
| D-09 | Replica set de un nodo. | Transacciones y recuperación. |
| D-19 | Hosting, dominio, TLS y región. | Despliegue y latencia. |
| D-20 | Instancia única o clúster con Redis. | Socket.IO y escalado. |
| D-21 | Proveedor RAG y presupuesto. | Retirada en v1: RAG sin proveedor externo (2026-11-17). |
| D-22 | Herramienta de monitoreo y alertas. | Observabilidad. |
| D-23 | Política de retención de evidencia y conversaciones. | Privacidad y almacenamiento. |
