# Corpus de POI: clasificación, historias y fuentes — FALCONSYNC

| Campo | Valor |
|---|---|
| Versión | 1.1 |
| Fecha | 2026-11-26 |
| Estado | Verificación documental y actualización aplicada al seed y al corpus S-033. Las propuestas de §4 se integraron en `seeders/locationResearch.js`; las fichas públicas y el chatbot ya las usan |
| Relacionados | [`FUENTES-RAG.md`](./FUENTES-RAG.md) v1.10, [`ADR/ADR-005-rag-fuentes.md`](./ADR/ADR-005-rag-fuentes.md), [`REQUISITOS.md`](./REQUISITOS.md) (RN-20 y RN-22) |

> Alcance: los 23 POI del seed. Las afirmaciones se citan con los identificadores S-### de `FUENTES-RAG.md` §5.
> **Verificado**: lo confirma una fuente A, o dos fuentes independientes de nivel B o C. **Puntero**: aparece solo en Wikipedia o Wikivoyage. **Pendiente**: no hay fuente suficiente.

## 1. Resumen

- **23 POI**, de los cuales **12 llevan la etiqueta `unesco`**. La ficha oficial contradice dos de ellos: Catedral de Coro y Plaza Bolívar. Los otros diez quedan pendientes del polígono oficial, que UNESCO todavía no publica.
- **Fuera del bien, verificado:** Catedral de Coro y Plaza Bolívar.
- **Natural:** Médanos de Coro y Parque Nacional Médanos de Coro. Se solapan (§3).
- **Turísticos sin designación:** la mayoría (comercio, museos, espacio público, deporte, mirador). Están en el sistema porque son atractivos de la ciudad, no porque sean patrimonio.
- **Prioridad alta:** el seed presenta el Museo Diocesano sin aclarar su estado. La última fuente (2018) lo describe cerrado al público.
- **Historias:** la mayoría de los textos cita solo la ficha de UNESCO. Esta revisión añade fuentes de alta credibilidad y propone correcciones (§4).

## 2. Tabla de los 23 POI

Códigos de estado según `FUENTES-RAG.md` §4: P-UNESCO-ENTORNO, P-UNESCO-FUERA, P-NACIONAL, NATURAL, TURÍSTICO.

| # | POI (`slug`) | Categoría | Estado patrimonial | `unesco` en seed | Historia documentada (fuente) | Acción |
|---|---|---|---|---|---|---|
| 1 | Catedral de Coro (`catedral-de-coro`) | Religioso | P-UNESCO-FUERA (S-002) | Sí, contradicha | Diócesis creada por bula de Clemente VII del 21/07/1531 (puntero S-006; pendiente S-014). Construcción iniciada en 1583. Torre en pie hacia 1620 y obra terminada hacia 1634, por estimación (S-006). Saqueada en 1567 por el pirata Nicolás Vallier (S-006) | Quitar `unesco`. Corregir la frase de pertenencia al bien |
| 2 | Casa de las Ventanas de Hierro (`casa-de-las-ventanas-de-hierro`) | Arquitectura | P-UNESCO-ENTORNO | Sí | Mansión del siglo XVII, levantada por José Francisco Garcés de la Colina. Portal de más de 8 m y rejería importada de Sevilla (S-006) | Añadir S-006 y S-014. No afirmar acceso al interior |
| 3 | Casa del Sol (`casa-del-sol`) | Arquitectura | P-UNESCO-ENTORNO | Sí | Esquina de Zamora y Federación, frente a la Iglesia de San Clemente. Siglo XVII. Relieve de sol sobre el portal. Vinculada a José Garcés, constructor de la Casa de las Ventanas de Hierro (S-006) | Añadir ubicación y fuente |
| 4 | Arco de la Federación (`arco-de-la-federacion`) | Monumento | TURÍSTICO (sin designación verificada) | Sí | Contexto: la Toma de Coro (20/02/1859) inició la Guerra Federal en Coro, con Zamora y Falcón como figuras centrales (S-010). Fecha y autoría del arco: no verificadas | Mantener la cautela. No atribuir fechas ni autores |
| 5 | Médanos de Coro (`medanos-de-coro`) | Natural | NATURAL (dentro del parque) | No | Dunas móviles modeladas por el viento (S-007) | Definir un rol distinto del parque o fusionar |
| 6 | Parque Nacional Médanos de Coro (`parque-nacional-medanos-de-coro`) | Natural | NATURAL. Creado el 06/02/1974 (S-007; decreto pendiente) | No | Administrado por INPARQUES (S-007). Superficie contradictoria dentro de S-007 (80 866 ha y 91 280 ha) | Quitar la superficie. Confirmar el decreto |
| 7 | Plaza Bolívar de Coro (`plaza-bolivar-de-coro`) | Urbano | P-UNESCO-FUERA (S-002) | Sí, contradicha | Frente a la Catedral y a la Gobernación del Estado. Lleva el nombre de Simón Bolívar (S-006) | Quitar `unesco` |
| 8 | Iglesia de San Francisco (`iglesia-de-san-francisco`) | Religioso | P-UNESCO-ENTORNO | Sí | Templo de tres naves. Torre neogótica de c. 1900, de 50 m. Reconstrucción profunda en 2006. Casa de los Capriles adquirida en 1985 (S-006 y S-011 coinciden) | Aclarar su relación con el Museo Diocesano (§3) |
| 9 | Iglesia de San Clemente (`iglesia-de-san-clemente`) | Religioso | P-UNESCO-ENTORNO | Sí | Origen en un templo del siglo XVI. Edificio actual del siglo XVIII. Planta de cruz (S-006, sin cita primaria) | Buscar fuente primaria (S-014) |
| 10 | Cruz de San Clemente (`cruz-de-san-clemente`) | Monumento | TURÍSTICO (sin designación) | No | Tradición local: vínculo con los primeros años de la ciudad y con una misa de 1527. Solo tradición | Mantener la etiqueta `Tradición local` |
| 11 | Casa Balcón de los Arcaya (`casa-balcon-de-los-arcaya`) | Arquitectura | P-NACIONAL (declarada en 1960 según S-006; Gaceta pendiente) y P-UNESCO-ENTORNO | Sí | Construcción estimada hacia 1725. Familia Arcaya desde mediados del siglo XIX. Sede del Museo José María Cruxent: arqueología, antropología y paleontología (S-006) | Añadir el museo. Verificar apertura |
| 12 | Museo de Arte de Coro (`museo-de-arte-de-coro`) | Museo | TURÍSTICO (institución) | Sí | Inaugurado el 26/11/1988 en la casona conocida como Balcón Bolívar o de los Sénior. Bolívar se alojó allí el 23/12/1826, «se dice» (S-006). Más de 200 exposiciones (S-006) | Sustituir «Casa de las Catorce Ventanas» (no sustentado) |
| 13 | Museo Alberto Henríquez (`museo-alberto-henriquez`) | Museo | TURÍSTICO (institución) | Sí | Sin fuente verificada | Quitar `unesco` hasta verificar. Pendiente |
| 14 | Museo Guadalupano (`museo-guadalupano`) | Museo | TURÍSTICO (institución) | Sí | La Virgen de Guadalupe es patrona del estado Falcón (S-008). Sin datos verificados del museo | Quitar `unesco`. Pendiente |
| 15 | Museo Diocesano Lucas Guillermo Castillo (`museo-diocesano`) | Museo religioso | TURÍSTICO. **Cerrado al público en 2018** (S-011) | Sí | Fundado en 1946 por Francisco José Iturriza Guillén. Cerrado desde 2007. Remodelado en 2012 y 2013. La reapertura anunciada para 2013 no se concretó hasta 2018 (S-011) | **Prioridad alta**: confirmar el estado con la Arquidiócesis. No presentarlo como abierto |
| 16 | Monumento de las Madres (`monumento-de-las-madres`) | Arte público | TURÍSTICO (sin designación) | No | En el Paseo Monseñor Iturriza, con una plaza dedicada a las madres, la entrada a los Médanos y una concha acústica (S-006) | Añadir ubicación y concha acústica. Autoría pendiente |
| 17 | Teatro Armonía (`teatro-armonia`) | Cultural | TURÍSTICO (sin designación verificada) | No | Aprobado el 01/08/1890. Proyecto materializado el 05/12/1891 en la calle Talavera. Incendio del 31/07/1945. Reconstruido por el arquitecto José Espósito. Previsto como sede permanente de la Orquesta Sinfónica de Falcón. Capacidad aproximada de 730 espectadores (S-006) | Reescribir con su historia. Confirmar la dirección actual |
| 18 | Gelatería El Sol (`heladeria-el-sol`) | Comercio | TURÍSTICO | No | Sin fuente de alta credibilidad | Mantener la cautela. Pendiente |
| 19 | Paseo Independencia (`paseo-independencia`) | Espacio público | TURÍSTICO | No | Sin fuente verificada. S-006 menciona la avenida Independencia, que no es el mismo lugar | Pendiente |
| 20 | Casa Museo Locos de la Vela (`casa-museo-locos-de-la-vela`) | Museo | TURÍSTICO | No | La fiesta de Los Locos de La Vela se celebra el 28/12, en el marco de los Santos Inocentes. Participantes «Locaínas» con trajes multicolores. Premio al mejor traje junto al monumento a la bandera (S-008) | Pendiente sobre la casa-museo |
| 21 | Mirador Alí Primera (`mirador-ali-primera`) | Mirador | TURÍSTICO | No | Alí Primera nació en Coro el 31/10/1941 (S-009; S-016 pendiente) | Confirmar instalaciones |
| 22 | Ciudad Deportiva (`ciudad-deportiva`) | Deporte | TURÍSTICO | No | Puede corresponder al Complejo Polideportivo Libertador Simón Bolívar, en el Parque Los Orumos. Sede de los Juegos Juveniles de 1983 y remodelado en 2009 (S-006) | Confirmar el nombre oficial |
| 23 | Plaza Antillana (`plaza-antillana`) | Urbano (La Vela) | P-UNESCO-ENTORNO (La Vela; sin polígono) | No | Escenario de los carnavales «Arena, Sol y Mar» (S-008) | Añadir el carnaval. No afirmar límites del bien |

## 3. Contradicciones y datos desactualizados

| # | Afirmación | Fuente | Conflicto | Tratamiento |
|---|---|---|---|---|
| 1 | Coro salió de la lista en peligro en 2018 | S-006 (Wikipedia) | S-002 y S-003: en la lista desde 2005; la decisión oficial 48 COM 7A.36 (2026) ordena mantener Coro y su puerto en la lista | Desestimar. Usar el estado oficial vigente |
| 2 | La Vela saldría de la lista de riesgo en 2016 | S-008 (Wikipedia) | Igual que el caso 1 | Desestimar |
| 3 | Coro fue fundada en 1577 | Texto en español de S-002 | S-002 en inglés dice 1527. S-006 da 1527 y vincula 1577 con el cambio de nombre a Coro | Mostrar 1527 y explicar 1577 como cambio de nombre |
| 4 | Inscripción número 633 | PDF S-001, p. 12 | S-002: ID 658. El 633 corresponde a Vladimir y Suzdal | Usar 658 |
| 5 | El Museo Diocesano está en el complejo de San Francisco y funciona | S-006 (Wikipedia) | S-011 (2018): convento de la Salceda, en la calle Zamora, cerrado al público | Verificar. No afirmar apertura |
| 6 | La casona del Museo de Arte es la «Casa de las Catorce Ventanas» | Seed (hipótesis marcada) | S-006 la nombra Balcón Bolívar o de los Sénior | Sustituir tras verificación |
| 7 | El Teatro Armonía es «infraestructura cultural moderna» | Seed | S-006: origen en 1891, incendio en 1945 y reconstrucción | Reescribir con la historia |
| 8 | Superficie del Parque Nacional | S-007 | Dentro del mismo artículo: 80 866 ha y 91 280 ha | No citar superficie |
| 9 | Presupuesto de 2006 | S-001, pp. 19, 29, 30 y 36 | US$32 M en p. 29; US$30 M en pp. 19, 30 y 36. Bolívares y bolívares fuertes sin conversión explicada | Citar solo con moneda y año, con la advertencia |
| 10 | Nombre de la institución de 1995 a 2001 | S-001, pp. 23–24 y 37 | «Corporación» en pp. 23–24; «Fundación» en p. 37 | Usar el nombre de la página citada |
| 11 | Altura de las dunas | S-013 (30 m) frente a S-007 (8 m en algunas dunas; 20 m en otra parte) | Inconsistente | No citar altura |
| 12 | Plaza Bolívar y Catedral «forman parte» del sitio | Seed (Catedral) | S-002: no están incluidas dentro de los límites | Corregir (§4) |
| 13 | La Vela se inscribió el 9/12/1993 | S-008 | S-002 solo da el año, 1993 | Usar el año |
| 14 | Precios de posadas | S-013 (Wikivoyage) | Datos de 2009 | No usar |

## 4. Propuestas de texto

Las propuestas son para aprobación del responsable de contenido. Esta versión de la documentación no cambia el seed ni la base de datos. Cada texto cita sus fuentes.

1. **Catedral de Coro** (descripción): «Basílica Menor de Santa Ana, frente a la Plaza Bolívar, en el entorno del casco histórico de Coro. La ficha oficial de UNESCO la sitúa fuera de los límites actuales del bien inscrito (S-002).»
2. **Catedral de Coro** (historia): «Coro fue sede de la primera diócesis de la América continental, según UNESCO (S-002). La bula de creación de la diócesis es del 21/07/1531 (S-006, pendiente de confirmar en S-014). La construcción del templo comenzó en 1583 y el edificio actual es fruto de etapas posteriores.»
3. **Museo Diocesano** (visita): «El último dato verificado, de 2018, indica que el museo estaba cerrado al público por falta de personal y de presupuesto (S-011). Confirma con la Arquidiócesis de Coro antes de planificar la visita.»
4. **Museo de Arte de Coro** (historia): «El museo se inauguró el 26/11/1988 en la casona conocida como Balcón Bolívar o de los Sénior (S-006). La tradición vincula la casa con la estancia de Bolívar en 1826; el dato debe confirmarse en S-014.»
5. **Teatro Armonía** (historia): «El proyecto se aprobó en 1890 y se materializó el 05/12/1891 en la calle Talavera. Un incendio lo destruyó el 31/07/1945, y fue reconstruido por el arquitecto José Espósito. Está previsto como sede permanente de la Orquesta Sinfónica de Falcón (S-006, pendiente de una segunda fuente).»
6. **Casa Balcón de los Arcaya** (visita): añadir: «Alberga el Museo José María Cruxent, de arqueología, antropología y paleontología (S-006). Verifica si está abierto antes de la visita.»
7. **Ciudad Deportiva**: «Confirma si este espacio corresponde al Complejo Polideportivo Libertador Simón Bolívar, en el Parque Los Orumos (S-006). La información sobre sus instalaciones debe verificarse localmente.»
8. **Monumento de las Madres**: «Está en el Paseo Monseñor Francisco José Iturriza, con una plaza dedicada a las madres, la entrada a los Médanos de Coro y una concha acústica (S-006).»
9. **Plaza Antillana**: añadir: «En la plaza se celebran los carnavales «Arena, Sol y Mar» (S-008). La fecha de la edición debe confirmarse.»

## 5. Pendientes prioritarios

1. Estado actual del Museo Diocesano, con la Arquidiócesis de Coro.
2. Decreto del Parque Nacional: fecha y superficie (Gaceta Oficial o INPARQUES; S-015 y S-017).
3. Designación del Balcón de los Arcaya (Gaceta Oficial o IPC).
4. Lectura directa de la bibliografía de S-014: González Batista, Blanca de Lima, Arcaya (1996), Beaujón (1982).
5. Dirección actual del Teatro Armonía y fecha de reinauguración (Orquesta Sinfónica de Falcón o Gobernación).
6. Identidad del informe de 2008 frente a la ficha 658, por comparación manual de SHA-256.
7. Texto íntegro del Informe SOC 2026, doc. 224543, y traducción revisada de las decisiones oficiales 48 COM 7A.36 y 48 COM 8C.2.
8. Horarios y accesos de los museos: Museo de Arte, Casa Museo Locos de la Vela, Museo Alberto Henríquez y Museo Guadalupano.
9. Nombre oficial del complejo deportivo («Ciudad Deportiva»).

## 6. Candidatos a nuevos POI (no añadidos)

- **Jardín Botánico Xerófito Dr. León Croizat**: fundado en 1970 según S-006, cerca de los Médanos.
- **Iglesia San Nicolás de Barí**: monumento nacional desde el 02/08/1960, Gaceta Oficial N.º 26.320 (S-012 y S-015). S-002 indica que los límites del bien deberían incluir San Nicolás.
- **Ateneo de Coro**: fundado el 13/05/1955 según S-006.

## 7. Fuentes consultadas y limitaciones

**Consultadas el 17/11/2026:** S-002 y S-003 (UNESCO, ficha 658 y lista en peligro), S-004 (Términos de Uso), S-006 a S-010 y S-013 (Wikipedia y Wikivoyage, como punteros), S-011 (IAM Venezuela, 2018), S-001 (informe de 2008, archivo local). **Consultadas directamente el 21/11/2026:** decisiones UNESCO 48 COM 7A.36 y 48 COM 8C.2; confirman que el bien sigue en la Lista en Peligro. Solo se consultó el texto oficial en inglés; no se indexó una traducción.

**Limitaciones:**
- Wikipedia es un puntero. Varias afirmaciones de sus artículos no tienen cita, y algunas contradicen fuentes oficiales.
- No se leyeron directamente los libros de S-014 ni la Gaceta Oficial (S-015).
- No se pudo acceder a la Academia Nacional de la Historia, INPARQUES, UNEFM ni IPC (S-017).
- Las coordenadas de los POI no se modificaron. Las distancias entre pares de POI se calcularon con las coordenadas del seed: Iglesia de San Francisco y Museo Diocesano, unos 25 m; Casa del Sol y Casa Balcón de los Arcaya, unos 13 m; Médanos de Coro y Parque Nacional, unos 1,1 km. Ninguno cae por debajo del umbral de duplicado de 10 m, pero los dos primeros pares deben revisarse como edificios distintos.

## 8. Alcance

La investigación de 2026-11-26 se aplicó mediante `projects/backend/seeders/locationResearch.js`, que
complementa —sin borrar— el contenido anterior de `seedLocations.js`. El corpus `S-033` se genera
desde ese archivo con `npm run rag:generate-poi` y sustituye a `S-021` en la ingesta E2E. Las
fichas públicas muestran `whatIs`, historia, detalles, visita, fuentes y fecha de revisión.

### Correcciones aplicadas respecto de la tabla §2

- **Arco de la Federación:** obra de 1920, demolida en 1953 y reconstruida; las fuentes difieren
  entre 1980 y 1997. No es un monumento del siglo XIX.
- **Casa de las Ventanas de Hierro:** la documentación técnica la sitúa hacia 1765 (siglo XVIII);
  la fecha del siglo XVII y el origen sevillano del hierro quedan como tradición por verificar.
- **Casa del Sol:** datación aproximada hacia 1680 y restauración reportada en 2013-2014.
- **Casa Balcón de los Arcaya:** datación aproximada hacia 1725 y adecuación museística en 2012.
- **Teatro Armonía:** primera sede en 1891, incendio en 1945 y sede actual inaugurada en 1999.
- **Museo Guadalupano:** inaugurado en diciembre de 2012 según su información institucional.
- **Museo de Arte de Coro (MUCOR):** fundado el 26 de noviembre de 1988.
- **Parque Nacional Médanos de Coro:** creado en 1974; la modificación de poligonal de 2021
  establece 80.866 hectáreas según el decreto consultado.
- **Museo Diocesano:** antecedente de cierre prolongado en 2018; la apertura actual sigue
  requiriendo confirmación directa.
- **Plaza Antillana y Mirador Alí Primera:** las imágenes de referencia requieren verificación de
  identidad; no se usaron como fotografías documentales nuevas.

Las propuestas de §4 se conservan como registro de la investigación previa; cuando difieren de la
investigación de 2026-11-26, prevalece la ficha enriquecida y se mantiene la atribución de ambas
fuentes en el texto público.
