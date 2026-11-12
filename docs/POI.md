# Puntos de interés (POI) — catálogo editorial, visitas y verificación

Fecha de verificación: 2026-11-08.

Este documento describe las fichas turísticas de cada punto de interés (POI), las reglas
de publicación, los filtros públicos y administrativos, el catálogo cargado por el seed y
el estado de las imágenes. La experiencia pública se organiza por lugares, no por rutas:
`/lugares` muestra el catálogo y `/lugares/:slug` presenta la historia y los detalles de
interés. El QR registra la visita al POI y otorga su insignia; la información editorial y
sus fuentes deben revisarse antes de publicar.

No atribuye el diseño a una unidad académica: las transcripciones de las Unidades 2 a 7
todavía no están incorporadas en `.opencode/knowledge/`.

La fuente de verdad del catálogo es
[`projects/backend/scripts/seedLocations.js`](../projects/backend/scripts/seedLocations.js).
Si este documento y el seed difieren, prevalece el seed.

## Modelo

El modelo `Location` incorpora, además de los campos del CRUD administrativo:

| Campo | Tipo | Uso |
|---|---|---|
| `address` | texto, hasta 240 caracteres | Dirección o referencia legible. |
| `circuits` | lista de circuitos | Agrupación temática para filtros y recorridos. |
| `tags` | lista de etiquetas | Características del lugar para filtros y fichas. |
| `historicalStory` | texto, hasta 10000 caracteres | Historia editorial del lugar. |
| `interestingFacts` | hasta 8 textos de 280 caracteres | Datos breves de interés para turistas. |
| `visitorInfo` | texto, hasta 2000 caracteres | Información práctica para planificar la visita. |
| `contentSources` | hasta 10 URL http(s) | Referencias de la historia y el contenido editorial. |
| `imageCredits` | lista de créditos | Autor, licencia, enlace a la licencia y origen de cada imagen. |
| `coordinateSource` | texto, hasta 500 caracteres | Fuente cartográfica o documental de las coordenadas. |
| `coordinateVerifiedAt` | fecha o `null` | Fecha de verificación de coordenadas. Obligatoria para publicar. |
| `verificationLevel` | `unverified`, `single-source`, `verified` | Nivel de confianza de la ubicación. |
| `isProvisional` | booleano | Marca ubicaciones o datos pendientes de verificación. |
| `isCatalogVisible` | booleano | Control editorial de inclusión en el catálogo y el mapa públicos. |

El formulario administrativo edita la historia, los datos de interés, la información para
visitantes y las fuentes editoriales por separado de la fuente cartográfica. Las fuentes
editoriales no se inventan ni se deducen de `sourceUrl` o `coordinateSource`. Los campos
son opcionales durante esta transición para no invalidar POI ya publicados; una ficha sin
`historicalStory` muestra explícitamente que la reseña ampliada está pendiente de fuentes
verificadas.

### Criterio editorial del catálogo inicial

Las reseñas ampliadas del catálogo se incorporan al seed y se sincronizan con la base
existente mediante `npm run seed:editorial`, un comando que solo llena los cuatro campos
editoriales y se aborta si encuentra contenido previo; no elimina POI ni modifica otros
campos. Se usó la ficha oficial de UNESCO para el contexto urbano de Coro y La Vela; esta
fuente describe sus técnicas constructivas y advierte que la Catedral y la Plaza Bolívar,
aunque son atributos relevantes, no están dentro de los límites actuales del bien inscrito.
La ficha de los Médanos usa una referencia secundaria para contexto general del parque.

El material recibido para varios POI contiene detalles que no se pudieron corroborar en una
fuente patrimonial o institucional accesible (por ejemplo, fechas exactas, autorías,
dimensiones, procedencia de piezas, colecciones y servicios actuales). Esos datos no se
presentan como hechos confirmados: se excluyeron o quedaron señalados en la reseña para
verificación posterior. Los horarios, tarifas, actividades y accesos deben confirmarse con
cada lugar antes de la visita.

### Categorías

`architecture`, `monument`, `nature`, `religious`, `urban`, `museum`, `viewpoint`,
`commerce`, `service`.

### Circuitos

`casco-historico`, `museos`, `naturaleza-miradores`, `espacios-urbanos`, `la-vela`,
`comercio-servicios`.

### Etiquetas

`colonial`, `unesco`, `gastronomy`, `theater`, `sports`, `promenade`, `market`, `crafts`,
`family`, `photogenic`, `free-entry`, `guided-tour`.

## Reglas de publicación

Un POI solo puede guardarse con `status=published` cuando:

1. `isProvisional` es `false`;
2. `coordinateVerifiedAt` contiene una fecha válida.

La regla se aplica en tres capas:

- **Modelo:** hook `pre('validate')` de Mongoose que invalida el documento.
- **Controlador administrativo:** validación previa con mensajes de error legibles.
- **Formulario Angular:** bloqueo antes de enviar la petición.

Los 23 POI del seed se publicaron el 2026-11-07 tras una revisión documental. La fecha
`coordinateVerifiedAt` registra esa revisión, no una verificación en campo. Quince POI
tienen nivel `single-source`; el Parque Nacional Médanos de Coro queda como `unverified`
porque su coordenada es aproximada. La verificación en campo sigue pendiente para todo el
catálogo.

La lista pública, el detalle, la búsqueda cercana y la API heredada de aventuras aplican:

```js
{
  status: 'published',
  deletedAt: null,
  isProvisional: { $ne: true }
  isCatalogVisible: { $ne: false }
}
```

La lista pública admite `includeProvisional=true` para el mapa. Esa opción añade únicamente
POI visibles en catálogo con `status=draft` e `isProvisional=true`; no cambia el detalle,
la búsqueda cercana, las aventuras ni el check-in. Los borradores internos, archivados y
los POI excluidos del catálogo nunca se incluyen.

## Filtros

### API pública

```text
GET /api/locations?category=museum&circuit=museos&tag=guided-tour
```

- `category`: una categoría del enum.
- `circuit`: un circuito del enum.
- `tag`: una etiqueta del enum.
- `includeProvisional=true`: añade borradores provisionales visibles para el mapa; el mapa
  los identifica y advierte que no son destinos verificados.

Los valores desconocidos responden `400` con `INVALID_CATEGORY`, `INVALID_CIRCUIT` o
`INVALID_TAG`.

### API administrativa

```text
GET /api/admin/locations?q=&status=&category=&circuit=&tag=&page=&limit=
```

Además de los filtros públicos, admite `status` (`draft`, `published`, `archived`) y
búsqueda textual `q`. El panel administrativo ofrece selectores de categoría, circuito y
etiqueta.

## Seed

El seed contiene 23 POI: **23 publicados y 0 borradores**. El mapa muestra los 23.

| Comando | Comportamiento |
|---|---|
| `npm run seed` | Inserta los POI ausentes y elimina el registro retirado de Mirador del Pueblo; no sobrescribe el resto. |
| `npm run seed:sync` | Actualiza fichas, visibilidad, metadatos de verificación y radios de check-in, sincroniza las coordenadas del Parque Nacional Médanos de Coro y elimina Mirador del Pueblo; no inserta POI ausentes ni cambia el estado o `isProvisional`. Conserva las coordenadas editadas del resto del catálogo. |
| `npm run seed:verify` | Comprueba existencia, estado, fecha de verificación en publicados, desviación de coordenadas y ausencia de Mirador del Pueblo. |
| `npm run publish:pois` | Publica los POI del seed que sigan en borrador. Sin `--apply` simula; con `--apply` guarda. Omite archivados. |
| `npm run qr:generate` | Rota tokens QR de POI publicados sin token vigente y guarda los SVG en `.qr-codes/`. Sin `--apply` simula; `--force` invalida los QR existentes. |

El 2026-11-07 se publicaron los 17 POI restantes y se generaron los 23 QR de check-in. La
publicación y la generación de QR se ejecutaron con los scripts nuevos:

```text
[publish:pois] 17 publicados, 6 ya publicados, 0 omitidos, 0 ausentes.
[seed:sync] 23 actualizados, 0 sin cambios, 0 ausentes.
[seed:verify] parque-nacional-medanos-de-coro: published, unverified, distancia 0 m
[seed:verify] 23 POI revisados sin desviaciones ni publicaciones inválidas.
[qr:generate] 23 generados, 0 omitidos por tener QR vigente.
```

Los 23 POI tienen token QR en versión 1. Los SVG se guardaron en
`projects/backend/.qr-codes/`, fuera de Git.

La sincronización de coordenadas está limitada a `parque-nacional-medanos-de-coro`;
los demás puntos conservan las coordenadas que ya tengan en la base de datos. La
sincronización sí actualiza `coordinateVerifiedAt`, `verificationLevel`,
`coordinateSource` y `checkInRadiusMeters` para que el seed siga siendo la fuente de
verdad.

## Catálogo

Coordenadas en formato `[longitud, latitud]`, tal como se guardan en MongoDB.

### Publicados

| POI | Categoría | Circuitos | Coordenadas | Fuente | Verificación |
|---|---|---|---|---|---|
| Catedral de Coro | `religious` | `casco-historico` | `[-69.6778073, 11.4075246]` | OpenStreetMap way 370610638 | `single-source` |
| Casa de las Ventanas de Hierro | `architecture` | `casco-historico` | `[-69.6799844, 11.4089625]` | Plus Code `773GC85C+H2J` | `single-source` |
| Casa del Sol | `architecture` | `casco-historico` | `[-69.6790501, 11.4089358]` | OpenStreetMap node 1122775758 | `single-source` |
| Arco de la Federación | `monument` | `casco-historico`, `espacios-urbanos` | `[-69.6713859, 11.410797]` | Wikipedia en español | `single-source` |
| Médanos de Coro | `nature` | `naturaleza-miradores` | `[-69.6577925, 11.4384496]` | OpenStreetMap relation 3461483 | `single-source` |
| Plaza Bolívar de Coro | `urban` | `casco-historico`, `espacios-urbanos` | `[-69.6782276, 11.4072929]` | OpenStreetMap way 370610469 | `single-source` |

Los 6 tienen `coordinateVerifiedAt=2026-11-06T00:00:00.000Z`,
`isProvisional=false` y una imagen con crédito pendiente de confirmar.

### Publicados el 2026-11-07

| POI | Categoría | Circuitos | Coordenadas | Fuente | Imagen |
|---|---|---|---|---|---|
| Parque Nacional Médanos de Coro | `nature` | `naturaleza-miradores` | `[-69.6677, 11.437]` | Ubicación aproximada junto a Antigua Carretera y el par vial Coro–Punto Fijo; referencia OpenStreetMap way 573233913 | `parque-nacional-medanos-de-coro.jpg` |
| Iglesia de San Francisco | `religious` | `casco-historico` | `[-69.6780331, 11.4094245]` | OpenStreetMap node 1757367724 | Janethrodri, CC BY-SA 4.0 |
| Iglesia de San Clemente | `religious` | `casco-historico` | `[-69.6789163, 11.4091188]` | OpenStreetMap way 1194221626 | Janethrodri, CC BY-SA 4.0 |
| Cruz de San Clemente | `monument` | `casco-historico` | `[-69.6786578, 11.4091267]` | Google Maps Plus Code `C85C+MG4` | Zerojosefer, CC BY-SA 4.0 |
| Casa Balcón de los Arcaya | `architecture` | `casco-historico` | `[-69.6791503, 11.4089915]` | Google Maps Plus Code `C85C+H8X` | Zerojosefer, CC BY-SA 4.0 |
| Museo de Arte de Coro | `museum` | `casco-historico`, `museos` | `[-69.6768188, 11.4082394]` | Wikidata Q51077695 y Plus Code `C85F+77V` | Janethrodri, CC BY-SA 4.0 |
| Museo Alberto Henríquez | `museum` | `casco-historico`, `museos` | `[-69.6765199, 11.4082434]` | OpenStreetMap way 504410904 | `museo-alberto-herique-coro.jpg` |
| Museo Guadalupano | `museum` | `casco-historico`, `museos` | `[-69.6802642, 11.4088278]` | Google Maps Plus Code `C859+GVQ` | `museo-guadalupano.jpg` |
| Museo Diocesano | `museum` | `casco-historico`, `museos` | `[-69.6778133, 11.4094739]` | Google Maps Plus Code `C85C+QV` | `museo-diocesano-de-coro.jpg` |
| Monumento de las Madres | `monument` | `espacios-urbanos` | `[-69.6441837, 11.4316237]` | Google Maps, referencia del paseo | `monumento-de-las-madres-coro.jpg` |
| Teatro Armonía | `urban` | `casco-historico`, `espacios-urbanos` | `[-69.6821997, 11.4075936]` | Google Maps Plus Code `C859+24M` | `teatro-armonia.jpg` |
| Gelatería El Sol | `commerce` | `casco-historico`, `comercio-servicios` | `[-69.6739281, 11.4012389]` | Google Maps Plus Code `C82G+FCW` | `Gelateria-el-sol.jpeg` |
| Paseo Independencia | `urban` | `espacios-urbanos` | `[-69.6479324, 11.4229136]` | Google Maps Plus Code `C9F2+5R8` | `paseo-independencia-coro.jpg` |
| Casa Museo Locos de la Vela | `museum` | `la-vela`, `museos` | `[-69.5749945, 11.4536306]` | Google Maps Plus Code `FC3G+F2X`; discrepancia de unos 100 m con la ficha “Casa Museo” | `Casa-Museo-Locos-de-la-Vela.jpg` |
| Mirador Alí Primera | `viewpoint` | `naturaleza-miradores` | `[-69.6617382, 11.3761342]` | Google Maps Plus Code `98GQ+F82` | `mirador-ali-primera.jpg` |
| Ciudad Deportiva | `service` | `espacios-urbanos`, `comercio-servicios` | `[-69.660002, 11.4208232]` | Google Maps Plus Code `C8CQ+8XH` | `ciudad-deportiva-coro.jpg` |
| Plaza Antillana | `urban` | `la-vela`, `espacios-urbanos` | `[-69.5702697, 11.4593277]` | Google Maps, consulta directa | `plaza-antillana-coro.jpg` |

Todos tienen `coordinateVerifiedAt=2026-11-07T00:00:00.000Z` e `isProvisional=false`.
Quince son `single-source`. El Parque Nacional Médanos de Coro es `unverified` por
coordenada aproximada y usa un radio de check-in de 200 m; Casa Museo Locos de la Vela
usa 100 m por la discrepancia documentada.

### Discrepancias conocidas

- **Casa Museo Locos de la Vela:** la ficha consultada y el Plus Code difieren en unos
  100 m. Se publicó con radio de check-in de 100 m; debe resolverse con verificación en
  campo.
- **Parque Nacional Médanos de Coro:** la referencia OpenStreetMap way 573233913
  corresponde a la vía Antigua Carretera, no a la entrada del parque. La coordenada es
  aproximada y se publicó con nivel `unverified` y radio de check-in de 200 m.
- **Conservación:** los 23 POI tienen `conservationStatus=unknown`; no se encontró una
  fuente verificada de estado de conservación.
- **Cruz de los Enconchados:** no se incluyó porque no se encontró una fuente
  cartográfica o documental confiable para su ubicación.

## Imágenes y créditos

El manifiesto legible por máquina está en
[`projects/frontend/public/images/locations/manifest.json`](../projects/frontend/public/images/locations/manifest.json)
y se sirve en `/images/locations/manifest.json`.

| Archivo | POI | Autor | Licencia | Estado |
|---|---|---|---|---|
| `catedral-de-coro.jpg` | Catedral de Coro | Pendiente | Pendiente | Sin verificar |
| `casa-de-las-ventanas-de-hierro.jpg` | Casa de las Ventanas de Hierro | Pendiente | Pendiente | Sin verificar |
| `casa-del-sol.jpg` | Casa del Sol | Pendiente | Pendiente | Sin verificar |
| `arco-de-la-federacion.jpg` | Arco de la Federación | Pendiente | Pendiente | Sin verificar |
| `medanos-de-coro.jpg` | Médanos de Coro | Pendiente | Pendiente | Sin verificar |
| `plaza-bolivar-de-coro.jpg` | Plaza Bolívar de Coro | Pendiente | Pendiente | Sin verificar |
| `iglesia-de-san-francisco.jpg` | Iglesia de San Francisco | Janethrodri | CC BY-SA 4.0 | Acreditada |
| `iglesia-de-san-clemente.jpg` | Iglesia de San Clemente | Janethrodri | CC BY-SA 4.0 | Acreditada |
| `cruz-de-san-clemente.jpg` | Cruz de San Clemente | Zerojosefer | CC BY-SA 4.0 | Acreditada |
| `casa-balcon-de-los-arcaya.jpg` | Casa Balcón de los Arcaya | Zerojosefer | CC BY-SA 4.0 | Acreditada |
| `museo-de-arte-de-coro.jpg` | Museo de Arte de Coro | Janethrodri | CC BY-SA 4.0 | Acreditada |
| `Casa-Museo-Locos-de-la-Vela.jpg` | Casa Museo Locos de la Vela | Pendiente | Pendiente | Sin verificar |
| `ciudad-deportiva-coro.jpg` | Ciudad Deportiva | Pendiente | Pendiente | Sin verificar |
| `mirador-ali-primera.jpg` | Mirador Alí Primera | Pendiente | Pendiente | Sin verificar |
| `monumento-de-las-madres-coro.jpg` | Monumento de las Madres | Pendiente | Pendiente | Sin verificar |
| `museo-alberto-herique-coro.jpg` | Museo Alberto Henríquez | Pendiente | Pendiente | Sin verificar |
| `museo-diocesano-de-coro.jpg` | Museo Diocesano | Pendiente | Pendiente | Sin verificar |
| `museo-guadalupano.jpg` | Museo Guadalupano | Pendiente | Pendiente | Sin verificar |
| `paseo-independencia-coro.jpg` | Paseo Independencia | Pendiente | Pendiente | Sin verificar |
| `plaza-antillana-coro.jpg` | Plaza Antillana | Pendiente | Pendiente | Sin verificar |
| `teatro-armonia.jpg` | Teatro Armonía | Pendiente | Pendiente | Sin verificar |
| `Gelateria-el-sol.jpeg` | Gelatería El Sol | Pendiente | Pendiente | Sin verificar |
| `parque-nacional-medanos-de-coro.jpg` | Parque Nacional Médanos de Coro | Pendiente | Pendiente | Sin verificar |

Las cinco imágenes acreditadas se tomaron de Wikimedia Commons y sus autores, licencia,
enlace a la licencia y página de origen están registrados en `imageCredits` y se muestran
en el popup del mapa. Las otras 18 imágenes fueron suministradas por el responsable del
proyecto y **no tienen autoría ni licencia verificadas**; deben confirmarse antes de publicar
el sitio.

## Mapa público y clustering

- El mapa consume `/api/locations?includeProvisional=true` y recibe 23 POI publicados.
- El mapa permite filtrar únicamente por categoría. Ya no hay marcadores provisionales.
- Los 23 POI permiten detalle, búsqueda cercana y check-in por QR.
- Los marcadores se agrupan en píxeles con un radio de 52 px y se recalculan al mover el
  mapa. No se añadió una dependencia externa de clustering.
- Al seleccionar una ficha de la lista, el POI elegido se separa del clúster, se centra y
  abre su popup.
- La lista lateral de «Puntos de interés» tiene desplazamiento propio dentro del panel; no
  depende del scroll de la página.
- El popup muestra dirección, circuitos, etiquetas, nivel de verificación, conservación y
  crédito de la imagen cuando existe.

## Verificación ejecutada en la sesión actual

| Comprobación | Comando | Resultado real (2026-11-08) |
|---|---|---|
| Pruebas backend | `npm run test:backend` | 75/75 aprobadas |
| Pruebas frontend | `npm run test:frontend` | 51/51 aprobadas |
| Build de producción | `npm run build` | Correcto, sin advertencias |
| E2E Edge local | `npm run e2e` | 16/16 aprobadas |
| E2E Chromium (CI) | `$env:CI=1; npm run e2e` | Pendiente de repetir tras los cambios de insignias y galería |
| Idempotencia del seed | `test/seedLocations.test.js` | 23 insertados la primera vez, 0 la segunda; verificación correcta |
| Contenido editorial del seed | `node --test test/seedLocations.test.js` | 4/4 aprobadas; las 23 fichas incluyen historia, datos de interés e información para visitantes |
| Sincronización editorial | `npm run seed:editorial` | Actualiza solo los campos editoriales; aborta si ya hay contenido para no sobrescribirlo |
| Sincronización local | `npm run seed:sync` | 23 registros actualizados; coordenada del Parque Nacional sincronizada; 23 POI verificados sin desviaciones |
| Verificación del seed | `npm run seed:verify` | 23 POI sin desviaciones; Gelatería El Sol dentro del catálogo |

Las pruebas nuevas cubren:

- publicación rechazada si el POI es provisional o no tiene fecha de verificación;
- check-in rechazado en un POI provisional aunque tenga token vigente;
- POI provisional oculto en la lista normal, el detalle y la búsqueda cercana, pero visible
  sin aviso textual en el mapa bajo `includeProvisional=true`; rechazado en aventuras y
  check-in;
- inclusión explícita de provisionales visibles y exclusión de borradores internos;
- idempotencia del seed e incorporación de Gelatería El Sol al catálogo;
- filtros públicos por circuito y etiqueta, con rechazo de valores desconocidos;
- mapa público con 23 tarjetas, todas con imagen, filtros solo por categoría, sin avisos de
  provisionalidad ni Mirador del Pueblo.

## Límites y pendientes

- La verificación en campo de los 23 POI sigue pendiente; `coordinateVerifiedAt` registra
  revisión documental, no visita al lugar.
- El Parque Nacional Médanos de Coro tiene una coordenada aproximada y nivel `unverified`;
  Casa Museo Locos de la Vela mantiene una discrepancia documentada de unos 100 m.
- La autoría y licencia de 18 imágenes sigue pendiente de verificación.
- No se generan miniaturas ni se eliminan metadatos EXIF de las imágenes.
- Los SVG de `.qr-codes/` no se versionan porque contienen tokens de check-in. Si se
  pierden, deben rotarse de nuevo y los QR anteriores dejan de funcionar.
- El estado de conservación no está verificado para ningún POI.
- El catálogo de circuitos y etiquetas es cerrado; agregar uno nuevo exige actualizar el
  modelo, el seed, las pruebas y las etiquetas del frontend.

## Trazabilidad académica

El contenido de este documento es de ingeniería y se basa en el código, el seed y las
pruebas ejecutadas. No se atribuye a una unidad académica porque las transcripciones de
las Unidades 2 a 7 todavía no están incorporadas; las fuentes PDF están en
`.opencode/knowledge/fuentes/`.
