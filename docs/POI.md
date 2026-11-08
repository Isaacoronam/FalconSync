# Puntos de interés (POI) — catálogo y verificación

Fecha de verificación: 2026-11-07.

Este documento describe el modelo de puntos de interés, las reglas de publicación, los
filtros públicos y administrativos, el catálogo cargado por el seed y el estado de las
imágenes. No atribuye el diseño a una unidad académica: las transcripciones de las
Unidades 2 a 7 todavía no están incorporadas en `.opencode/knowledge/`.

La fuente de verdad del catálogo es
[`falcon-sync-backend/scripts/seedLocations.js`](../falcon-sync-backend/scripts/seedLocations.js).
Si este documento y el seed difieren, prevalece el seed.

## Modelo

El modelo `Location` incorpora, además de los campos del CRUD administrativo:

| Campo | Tipo | Uso |
|---|---|---|
| `address` | texto, hasta 240 caracteres | Dirección o referencia legible. |
| `circuits` | lista de circuitos | Agrupación temática para filtros y recorridos. |
| `tags` | lista de etiquetas | Características del lugar para filtros y fichas. |
| `imageCredits` | lista de créditos | Autor, licencia, enlace a la licencia y origen de cada imagen. |
| `coordinateSource` | texto, hasta 500 caracteres | Fuente cartográfica o documental de las coordenadas. |
| `coordinateVerifiedAt` | fecha o `null` | Fecha de verificación de coordenadas. Obligatoria para publicar. |
| `verificationLevel` | `unverified`, `single-source`, `verified` | Nivel de confianza de la ubicación. |
| `isProvisional` | booleano | Marca ubicaciones o datos pendientes de verificación. |
| `isCatalogVisible` | booleano | Control editorial de inclusión en el catálogo y el mapa públicos. |

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

Los 17 POI del seed que todavía no tienen coordenadas verificadas se cargan como
`draft` y `isProvisional=true`. No se publican hasta completar la verificación en campo.
El mapa puede mostrarlos como referencias provisionales; eso no los convierte en publicados
ni habilita check-in o paradas de aventura.

La lista pública normal, el detalle, la búsqueda cercana y las aventuras aplican:

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

El seed contiene 23 POI: **6 publicados y 17 borradores provisionales**. El mapa muestra
los 23: los 6 publicados y los 17 borradores provisionales visibles.

| Comando | Comportamiento |
|---|---|
| `npm run seed` | Inserta los POI ausentes y elimina el registro retirado de Mirador del Pueblo; no sobrescribe el resto. |
| `npm run seed:sync` | Actualiza fichas y visibilidad, sincroniza las coordenadas del Parque Nacional Médanos de Coro y elimina Mirador del Pueblo; no inserta POI ausentes ni cambia el estado o `isProvisional`. Conserva las coordenadas editadas del resto del catálogo. |
| `npm run seed:verify` | Comprueba existencia, estado, fecha de verificación en publicados, desviación de coordenadas y ausencia de Mirador del Pueblo. |

El 2026-11-07 se sincronizaron imágenes para los POI del catálogo y se eliminó de la base
local Mirador del Pueblo. Después del ajuste de coordenadas de Parque Nacional Médanos de
Coro, la sincronización local se ejecutó y la verificación confirmó los 23 POI:

```text
[seed:sync] 23 actualizados, 0 sin cambios, 0 ausentes. Solo se sincronizaron las coordenadas del Parque Nacional Médanos de Coro; estado e isProvisional se preservan.
[seed:verify] parque-nacional-medanos-de-coro: draft (provisional), unverified, distancia 0 m
[seed:verify] 23 POI revisados sin desviaciones ni publicaciones inválidas.
```

La sincronización de coordenadas está limitada a `parque-nacional-medanos-de-coro`;
los demás puntos conservan las coordenadas que ya tengan en la base de datos.

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

### Borradores provisionales

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

Todos los borradores tienen `isProvisional=true`, `verificationLevel=unverified` y
`coordinateVerifiedAt=null`.

### Discrepancias conocidas

- **Casa Museo Locos de la Vela:** la ficha consultada y el Plus Code difieren en unos
  100 m. Debe resolverse con verificación en campo antes de publicar.
- **Conservación:** los 23 POI tienen `conservationStatus=unknown`; no se encontró una
  fuente verificada de estado de conservación.
- **Cruz de los Enconchados:** no se incluyó porque no se encontró una fuente
  cartográfica o documental confiable para su ubicación.

## Imágenes y créditos

El manifiesto legible por máquina está en
[`falcon-sync-frontend/public/images/locations/manifest.json`](../falcon-sync-frontend/public/images/locations/manifest.json)
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

- El mapa consume `/api/locations?includeProvisional=true` y recibe 23 POI: 6 publicados y
  17 borradores provisionales visibles.
- El mapa permite filtrar únicamente por categoría. Los marcadores provisionales conservan
  un estilo visual diferenciado, sin avisos de provisionalidad en la ficha pública.
- La vista provisional no permite publicar, consultar el detalle individual, buscar como
  cercano, añadir a aventuras ni hacer check-in.
- Los marcadores se agrupan en píxeles con un radio de 52 px y se recalculan al mover el
  mapa. No se añadió una dependencia externa de clustering.
- Al seleccionar una ficha de la lista, el POI elegido se separa del clúster, se centra y
  abre su popup.
- La lista lateral de «Puntos de interés» tiene desplazamiento propio dentro del panel; no
  depende del scroll de la página.
- El popup muestra dirección, circuitos, etiquetas, nivel de verificación, conservación y
  crédito de la imagen cuando existe.

## Verificación ejecutada en la sesión actual

| Comprobación | Comando | Resultado real (2026-11-07) |
|---|---|---|
| Pruebas backend | `npm run test:backend` | 58/58 aprobadas |
| Pruebas frontend | `npm run test:frontend` | 29/29 aprobadas |
| Build de producción | `npm run build` | Correcto, sin warnings |
| E2E Chromium | `npm run e2e` | 13/13 aprobadas |
| Idempotencia del seed | `test/seedLocations.test.js` | 23 insertados la primera vez, 0 la segunda; verificación correcta |
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

- Los 17 borradores necesitan verificación de coordenadas en campo antes de publicarse.
- Una ubicación tiene discrepancias documentadas y no debe publicarse sin resolverlas.
- La autoría y licencia de 18 imágenes sigue pendiente de verificación.
- No se generan miniaturas ni se eliminan metadatos EXIF de las imágenes.
- El estado de conservación no está verificado para ningún POI.
- El catálogo de circuitos y etiquetas es cerrado; agregar uno nuevo exige actualizar el
  modelo, el seed, las pruebas y las etiquetas del frontend.

## Trazabilidad académica

El contenido de este documento es de ingeniería y se basa en el código, el seed y las
pruebas ejecutadas. No se atribuye a una unidad académica porque las transcripciones de
las Unidades 2 a 7 todavía no existen en `.opencode/knowledge/`.
