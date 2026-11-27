// Investigación patrimonial incorporada el 2026-11-26.
// Cada ficha conserva los identificadores del seed y amplía el contenido
// editorial. Las fechas dudosas se presentan como aproximadas o como
// tradición, y los datos operativos sin confirmación se marcan como pendientes.

export const RESEARCH_REVIEWED_AT = new Date('2026-11-26T00:00:00.000Z');

const UNESCO = 'https://whc.unesco.org/en/list/658/';
const INPARQUES = 'https://www.inparques.gob.ve/';
const IAM = 'https://iamvenezuela.org/';
const ICOM = 'https://www.icom-venezuela.com/falcon-museos-directorio';
const LOCOS = 'https://museoscomunitarios.org/lavela';
const NUEVO_DIA_ARCO =
  'https://www.nuevodia.com.ve/que-significado-tiene-el-arco-de-la-federacion/';
const NOTICIAS_ARCAYA =
  'https://www.noticias24hrs.com.ve/vive-la-ciudad-de-coro-desde-la-historia-y-la-cultura-descubre-el-balcon-de-los-arcaya-y-su-valor-patrimonial/';
const NOTICIAS_MIRADOR =
  'https://www.noticias24hrs.com.ve/falconianos-realizaron-caminata-por-los-83-anos-del-natalicio-de-ali-primera-fotos/';
const LAC_GEO = 'https://lacgeo.com/coro-port-vela-venezuela';
const CRUZ_PDF =
  'https://media.diarioversionfinal.com/wp-content/uploads/2017/01/d2990.pdf';

export const locationResearch = {
  'arco-de-la-federacion': {
    historicalPeriod: 'Siglo XX (memoria del siglo XIX)',
    description:
      'Arco conmemorativo de la Guerra Federal y de Juan Crisóstomo Falcón, reconstruido en el siglo XX. Es un hito del paisaje urbano de Coro, distinto del Arco de la Federación de Caracas.',
    whatIs:
      'El Arco de la Federación de Coro es un monumento cívico de medio punto, con columnas y un remate escultórico femenino que las crónicas locales identifican con la libertad. No es un arco decimonónico: el original coriano se inauguró en 1920, fue demolido en 1953 y reconstruido después. Conmemora hechos de la Guerra Federal, iniciada con el Grito de la Federación del 20 de febrero de 1859, y el legado de Juan Crisóstomo Falcón.\n\nSu valor es principalmente simbólico y urbano. Ayuda a leer cómo la ciudad ha representado su memoria política y cómo un monumento puede ser a la vez hito visual, lugar de paso y soporte de ceremonias cívicas.',
    historicalStory:
      'El arco recuerda la Federación venezolana y la figura de Juan Crisóstomo Falcón, nacido en Falcón y protagonista de la Guerra Federal. El Grito de la Federación del 20 de febrero de 1859 marcó el inicio de ese conflicto. El monumento coriano se inauguró en 1920, fue demolido en 1953 y reconstruido posteriormente. Las fuentes consultadas discrepan sobre las fases de reconstrucción: una referencia patrimonial menciona 1997 y otras referencias locales citan una intervención en 1980. FalconSync conserva ambas referencias y no las simplifica.\n\nEl conjunto actual debe explicarse como una reconstrucción del siglo XX que conmemora hechos del XIX. Es distinto del Arco de la Federación de Caracas, inaugurado en 1895.',
    interestingFacts: [
      'El arco coriano se inauguró en 1920, fue demolido en 1953 y reconstruido después; no es una obra del siglo XIX.',
      'Las fuentes difieren entre una reconstrucción en 1980 y otra en 1997; la ficha conserva la discrepancia.',
      'El remate escultórico femenino representa la libertad según crónicas locales.',
      'El Grito de la Federación se produjo el 20 de febrero de 1859 y dio inicio a la Guerra Federal.',
      'No debe confundirse con el Arco de la Federación de Caracas, de 1895.',
    ],
    visitorInfo:
      'Se aprecia desde el espacio público y se combina bien con un recorrido por el casco histórico. Visítalo de día y observa el remate y los detalles del arco. Ten precaución si está junto a una vía vehicular y no subas a la estructura. Horarios, acceso y estado de conservación deben confirmarse en el sitio.',
    contentSources: [NUEVO_DIA_ARCO, UNESCO],
  },

  'casa-balcon-de-los-arcaya': {
    historicalPeriod: 'Cerca de 1725',
    description:
      'Casona colonial vinculada a la familia Arcaya, reconocible por su amplio balcón corrido de madera. Es una de las mejores escalas para entender la vivienda tradicional de Coro.',
    whatIs:
      'La Casa Balcón de los Arcaya es una casona colonial del casco histórico de Coro, asociada a la familia Arcaya y reconocible por su balcón corrido de madera con soportes visibles. La documentación técnica consultada sitúa su construcción aproximadamente hacia 1725; se reporta una restauración y adecuación museística en 2012.\n\nLa vivienda permite explicar la arquitectura doméstica de la ciudad: fachada de tierra, carpintería tradicional, patios y corredores pensados para el clima. Su interés está tanto en el edificio como en la relación entre vivienda, calle y vida familiar.',
    historicalStory:
      'La casa forma parte del tejido residencial histórico de Coro. La documentación disponible la vincula a la familia Arcaya y sitúa su origen alrededor de 1725, sin que sea posible fijar un día o un año exacto de construcción. En 2012 se reporta una restauración y adecuación como espacio museístico.\n\nComo otras casas del centro histórico, combina técnicas de tierra —tapia, adobe o bahareque— con carpintería de madera y soluciones de ventilación adaptadas al clima. El conjunto urbano de Coro y La Vela fue inscrito en la Lista del Patrimonio Mundial en 1993.',
    interestingFacts: [
      'El balcón corrido de madera es el rasgo más reconocible de la fachada.',
      'La documentación técnica sitúa la casa aproximadamente hacia 1725.',
      'Se reporta una restauración y adecuación museística en 2012.',
      'La arquitectura residencial de Coro combina técnicas de tierra con carpintería tradicional.',
      'El conjunto de Coro y La Vela fue inscrito por UNESCO en 1993.',
    ],
    visitorInfo:
      'Observa el balcón y la carpintería desde el espacio público. Antes de ir, confirma si hay visita interior o una exposición activa; no ingreses a áreas privadas sin autorización. Horarios, tarifas y accesibilidad están por confirmar.',
    contentSources: [NOTICIAS_ARCAYA, UNESCO],
  },

  'casa-museo-locos-de-la-vela': {
    historicalPeriod: 'Tradición del 28 de diciembre',
    description:
      'Casa museo dedicada a los Locos de La Vela, tradición de los Santos Inocentes que llena de máscaras, música y comparsas las calles de La Vela de Coro cada 28 de diciembre.',
    whatIs:
      'La Casa Museo Locos de la Vela es un espacio comunitario dedicado a la tradición festiva de los Locos de La Vela, expresión del municipio Colina asociada al Día de los Santos Inocentes. Reúne máscaras, trajes, personajes, memoria oral, artesanía y documentación de la fiesta.\n\nLa casa museo y la celebración son temas relacionados pero distintos: el museo conserva y explica la memoria; la fiesta ocurre en la calle con comparsas, música y participación comunitaria. Su valor es cultural y social, sostenido por portadores y artesanos locales.',
    historicalStory:
      'La celebración central de los Locos de La Vela se realiza tradicionalmente el 28 de diciembre, día de los Santos Inocentes. La tradición combina personajes, máscaras, música y recorridos comunitarios. La Casa Museo se dedica a preservar esa memoria y a explicar sus expresiones.\n\nNo se presenta la fiesta como inscrita en una lista de UNESCO sin evidencia oficial. La historia de la casa museo, su colección permanente y sus talleres deben confirmarse con la institución.',
    interestingFacts: [
      'La celebración se asocia tradicionalmente con el 28 de diciembre, Día de los Santos Inocentes.',
      'La tradición reúne máscaras, trajes, música, comparsas y participación comunitaria.',
      'La Casa Museo conserva memoria oral y documentación de la fiesta.',
      'La manifestación pertenece al municipio Colina, en La Vela de Coro.',
    ],
    visitorInfo:
      'Si deseas ver la celebración, planifica alrededor del 28 de diciembre y confirma programa, seguridad, transporte y apertura del museo. Respeta a portadores y artesanos al fotografiar. Fuera de esa fecha, consulta antes de desplazarte si la casa museo está abierta.',
    contentSources: [LOCOS, 'https://lamananadigital.com/casa-museo-locos-de-la-vela-recibio-visita-de-operadores-turisticos-de-polandia-y-rusia/', LAC_GEO],
  },

  'casa-de-las-ventanas-de-hierro': {
    historicalPeriod: 'Cerca de 1765 (siglo XVIII)',
    description:
      'Casona colonial emblemática por su portal monumental y sus ventanales protegidos con hierro forjado. La documentación técnica la sitúa hacia 1765, en el siglo XVIII.',
    whatIs:
      'La Casa de las Ventanas de Hierro es una de las casas más reconocibles del casco histórico de Coro. Debe su nombre a los ventanales protegidos por rejería de hierro forjado y destaca por un portal de gran escala. La documentación técnica consultada sitúa su construcción aproximadamente en 1765, en el siglo XVIII, y reporta una restauración y adecuación como museo de sí misma en 2012.\n\nLa ficha permite observar la relación entre ornamentación y vida cotidiana en la arquitectura doméstica coriana. La atribución de los hierros a importaciones de Sevilla se conserva como tradición o documentación por verificar, no como hecho cerrado.',
    historicalStory:
      'La documentación técnica consultada sitúa la Casa de las Ventanas de Hierro hacia 1765, en el siglo XVIII, y no en el siglo XVII como repiten otras fichas. La atribución del hierro forjado a Sevilla y la fecha antigua deben presentarse como tradición o documentación por verificar.\n\nLa casa pertenece al conjunto de viviendas históricas que distingue a Coro. Su portal y sus ventanales enrejados son los elementos que más han llamado la atención de viajeros y estudiosos. En 2012 se reporta una restauración y adecuación museística. La procedencia exacta del hierro y la historia de sus propietarios requieren documentación específica. La arquitectura tradicional de Coro combina tapia, adobe y bahareque con influencias hispánicas, mudéjares y neerlandesas.',
    interestingFacts: [
      'La documentación técnica sitúa la casa hacia 1765, no en el siglo XVII.',
      'El portal de gran escala y los ventanales enrejados son sus rasgos distintivos.',
      'Se reporta una restauración y adecuación como museo de sí misma en 2012.',
      'La atribución del hierro a Sevilla debe presentarse como tradición por verificar.',
      'Coro conserva ejemplos de tapia, adobe y bahareque, técnicas constructivas con tierra.',
    ],
    visitorInfo:
      'Detente en los ventanales y el portal desde la calle. Consulta antes si el interior está abierto y si hay mediación o guía; la ficha no confirma acceso permanente. Horarios, tarifas y accesibilidad están por confirmar.',
    contentSources: [IAM, UNESCO],
  },

  'casa-del-sol': {
    historicalPeriod: 'Cerca de 1680',
    description:
      'Vivienda colonial conocida por el emblema del sol sobre su puerta principal. La documentación de conservación la sitúa aproximadamente hacia 1680.',
    whatIs:
      'La Casa del Sol es una vivienda colonial del casco histórico de Coro, ubicada en el entorno de las calles Zamora y Federación, cerca de la Iglesia de San Clemente. Su rasgo identificador es el motivo ornamental del sol sobre la puerta principal, acompañado por una fachada de color intenso, molduras y rejas.\n\nLa documentación de conservación consultada sitúa la casa aproximadamente hacia 1680 y reporta una restauración entre 2013 y 2014. El emblema solar debe explicarse como detalle ornamental y símbolo del inmueble, sin inventar interpretaciones no documentadas.',
    historicalStory:
      'La casa forma parte del paisaje de viviendas históricas del centro de Coro. Su posición en esquina y la proximidad de San Clemente permiten leerla dentro de un recorrido urbano más amplio. La fecha de construcción se presenta como aproximada, alrededor de 1680, y la restauración de 2013-2014 como dato reportado por fuentes de conservación.\n\nEl relieve del sol es su seña visual, pero no debe convertirse en una leyenda sin respaldo. Su interés está en la arquitectura doméstica y en la continuidad de calles, materiales y técnicas tradicionales.',
    interestingFacts: [
      'El relieve con forma de sol sobre el portal da nombre a la casa.',
      'La documentación de conservación la sitúa aproximadamente hacia 1680.',
      'Se reporta una restauración entre 2013 y 2014.',
      'Su entorno conecta con la Iglesia y la Cruz de San Clemente.',
      'La fecha debe expresarse como aproximada, no como un año exacto de construcción.',
    ],
    visitorInfo:
      'Fotografía el emblema del sol desde el espacio público y enlaza la visita con San Clemente y otras casas coloniales cercanas. La información disponible no confirma acceso al interior; verifica localmente si hay visitas guiadas. Horarios y tarifas están por confirmar.',
    contentSources: ['https://www.minube.com/rincon/casa-del-sol-a2455419', UNESCO],
  },

  'catedral-de-coro': {
    historicalPeriod: 'Diócesis de 1531; templo de los siglos XVI-XVIII',
    description:
      'Basílica Catedral de Santa Ana, templo histórico frente a la Plaza Bolívar. La diócesis de Coro se estableció en 1531; el edificio actual es resultado de varias etapas constructivas. UNESCO la sitúa fuera de los límites actuales del bien inscrito, aunque forma parte del contexto histórico urbano.',
    whatIs:
      'La Basílica Catedral de Santa Ana es el principal templo histórico de Coro y se encuentra frente a la Plaza Bolívar. La diócesis de Coro fue establecida en 1531, la primera de tierra firme suramericana, pero esa fecha corresponde a la institución eclesiástica y no al edificio actual, que es resultado de etapas constructivas posteriores.\n\nSu valor es religioso, arquitectónico y urbano. La fachada, la nave y los espacios litúrgicos se relacionan directamente con la plaza y con el trazado histórico de la ciudad. UNESCO reconoce el conjunto de Coro y La Vela, pero señala que la Catedral y la Plaza Bolívar están fuera de los límites actuales del bien inscrito.',
    historicalStory:
      'La diócesis de Coro fue creada el 21 de julio de 1531 por el papa Clemente VII, según la fuente consultada. La construcción del templo se desarrolló desde el siglo XVI y tuvo etapas posteriores; la documentación disponible menciona, entre otros, trabajos iniciados en 1583 y la participación de Francisco Ramírez en la cúpula y bóvedas laterales entre 1608 y 1615, así como la continuidad de la obra bajo Bartolomé de Nevada desde 1615.\n\nLas fechas exactas de cada fase deben cotejarse con fuentes eclesiásticas y patrimoniales. La Catedral forma parte del contexto histórico urbano, aunque no esté dentro del polígono UNESCO actual.',
    interestingFacts: [
      'La diócesis de Coro fue establecida en 1531, la primera de tierra firme suramericana.',
      'La fecha de la diócesis no equivale a la fecha de construcción del edificio actual.',
      'La documentación consultada menciona obras iniciadas en 1583 y trabajos en la cúpula entre 1608 y 1615.',
      'La Catedral y la Plaza Bolívar están fuera de los límites actuales del bien UNESCO, según su ficha oficial.',
      'Su escala y relación con la plaza ayudan a entender el núcleo cívico y religioso de la ciudad.',
    ],
    visitorInfo:
      'Es un templo activo. Consulta los horarios de culto y las condiciones de visita antes de entrar; viste con respeto y evita interrumpir celebraciones. Solicita autorización para fotografiar el interior. El horario de misas publicado (lunes a sábado a las 6 p.m.; domingo a las 7:30 a.m. y 6 p.m.) es una referencia que debe confirmarse con la parroquia.',
    contentSources: [UNESCO, 'https://es.catholic.net/op/articulos/2374/catedral-baslica-menor-de-santa-ana.html'],
  },

  'ciudad-deportiva': {
    historicalPeriod: 'Infraestructura contemporánea',
    description:
      'Complejo deportivo universitario de Coro, conocido como Ciudad Deportiva Universitaria «500 años de Coro». No es un monumento colonial: es infraestructura contemporánea para el deporte y la recreación.',
    whatIs:
      'La Ciudad Deportiva Universitaria «500 años de Coro» es un complejo de infraestructura deportiva y recreativa de la ciudad contemporánea. Se han documentado espacios para fútbol, tenis, piscina, baloncesto, voleibol, fútbol sala, pádel, beach tennis y actividad biosaludable.\n\nSu interés turístico es distinto al del casco histórico: muestra la vida cotidiana y los servicios de una ciudad que también se organiza alrededor del deporte. La disponibilidad real de cada instalación, los horarios y las condiciones de acceso deben confirmarse con la administración.',
    historicalStory:
      'La Ciudad Deportiva no es un monumento colonial ni forma parte del conjunto patrimonial inscrito por UNESCO. Es una infraestructura contemporánea pensada para la práctica deportiva, la formación y la recreación. Su nombre conmemora los 500 años de Coro.\n\nLa documentación disponible no permite fijar con precisión la fecha de construcción ni el detalle de cada etapa. Por eso la ficha se limita a describir los usos reportados y remite a la administración para cualquier dato operativo.',
    interestingFacts: [
      'Se le conoce como Ciudad Deportiva Universitaria «500 años de Coro».',
      'Se han documentado instalaciones para fútbol, tenis, piscina, baloncesto y otras disciplinas.',
      'No es un monumento colonial: es infraestructura contemporánea.',
      'La disponibilidad de cada instalación y sus horarios deben confirmarse con la administración.',
    ],
    visitorInfo:
      'Antes de desplazarte, verifica disciplina, inscripción, horarios, acceso, tarifas, disponibilidad de baños y estacionamiento. Respeta las áreas reservadas para entrenamientos y eventos. La información operativa está por confirmar.',
    contentSources: ['https://nuevodia.com.ve/', 'https://www.google.com/maps/search/?api=1&query=Ciudad+Deportiva+Universitaria+500+a%C3%B1os+de+Coro'],
  },

  'cruz-de-san-clemente': {
    historicalPeriod: 'Tradición vinculada a la fundación',
    description:
      'Cruz monumental de madera en el entorno de la Iglesia de San Clemente. La tradición local la vincula con los primeros actos religiosos de Coro y con una misa de 1527.',
    whatIs:
      'La Cruz de San Clemente es una cruz monumental de madera situada junto a la Iglesia del mismo nombre, en el casco histórico de Coro. La tradición local la relaciona con los primeros actos religiosos de la ciudad y con una misa celebrada en 1527. Esa narración debe presentarse como tradición mientras no se aporte evidencia primaria.\n\nUna fuente periodística menciona que está hecha de madera de cují, árbol característico de la región. El templete que la protege y la plaza forman un pequeño conjunto donde conviven memoria, devoción y arquitectura histórica.',
    historicalStory:
      'La cruz ocupa un lugar especial en la memoria religiosa de Coro. La tradición la asocia con los primeros años de la ciudad, pero la antigüedad exacta, el material original y el uso en una primera misa requieren documentación especializada. La fuente consultada menciona madera de cují como dato periodístico, no como conclusión histórica cerrada.\n\nSu valor es religioso, simbólico y urbano. Forma conjunto con la Iglesia y la plaza de San Clemente, dentro del paisaje del casco histórico.',
    interestingFacts: [
      'La tradición local la vincula con los primeros actos religiosos de Coro y con una misa en 1527.',
      'Una fuente periodística menciona que está hecha de madera de cují.',
      'Forma conjunto con la Iglesia y la plaza de San Clemente.',
      'La antigüedad exacta y el material original deben presentarse como tradición o dato por verificar.',
    ],
    visitorInfo:
      'Visítala con respeto: es un lugar de significado religioso para la comunidad. Evita tocar la cruz o ingresar al templete si no está autorizado. Combina la visita con San Clemente y la Casa del Sol. Horarios y acceso están por confirmar.',
    contentSources: [CRUZ_PDF, UNESCO],
  },

  'heladeria-el-sol': {
    historicalPeriod: 'Comercio tradicional contemporáneo',
    description:
      'Gelatería de tradición local en la calle El Sol, entre Comercio y Ampíes. Es un comercio gastronómico, no un monumento, y forma parte de la memoria cotidiana del centro.',
    whatIs:
      'Gelatería El Sol es un establecimiento de helados ubicado en la calle El Sol, entre Comercio y Ampíes, en el centro de Coro. Es un comercio gastronómico y su valor turístico está en la experiencia cotidiana y en la memoria local, no en una declaratoria patrimonial.\n\nLa oferta, los sabores emblemáticos, la antigüedad, los precios, los horarios y la accesibilidad no deben afirmarse sin confirmación reciente del negocio o reseñas fechadas. La ficha invita a descubrirlo como parte del paseo por el centro, con prudencia sobre los datos operativos.',
    historicalStory:
      'Los comercios tradicionales también cuentan la historia de una ciudad: son lugares de encuentro, descanso y continuidad de prácticas cotidianas. La Gelatería El Sol se encuentra en una de las calles del centro histórico y complementa la visita a los hitos patrimoniales.\n\nNo se afirma que sea la heladería más antigua ni se atribuyen recetas o fechas de fundación, porque esos datos requieren testimonio o documentación del establecimiento.',
    interestingFacts: [
      'Está en la calle El Sol, entre Comercio y Ampíes.',
      'Es un comercio gastronómico, no un monumento patrimonial.',
      'Su historia y la disponibilidad de sabores deben confirmarse directamente en el local.',
      'Forma parte de la memoria cotidiana del centro de Coro.',
    ],
    visitorInfo:
      'Confirma que siga operativo, consulta horario y menú, y revisa opiniones recientes verificables antes de publicar puntuaciones. La disponibilidad de productos puede cambiar. Horarios, precios y accesibilidad están por confirmar.',
    contentSources: ['https://www.google.com/maps/search/?api=1&query=Gelateria+El+Sol+Coro+Falcon'],
  },

  'iglesia-de-san-clemente': {
    historicalPeriod: 'Inicios del siglo XVIII',
    description:
      'Templo católico colonial del casco histórico, con fachada de dos cuerpos y planta de cruz latina según la documentación arquitectónica consultada.',
    whatIs:
      'La Iglesia de San Clemente es un templo católico colonial de Coro. Una reseña arquitectónica consultada lo sitúa a comienzos del siglo XVIII y describe una planta de cruz latina, fachada con dos cuerpos, arco de medio punto, pilastras y ventanas-campanario.\n\nSu interés es religioso y arquitectónico, y su entorno forma conjunto con la Cruz y la plaza de San Clemente. Las fechas y los detalles constructivos deben cotejarse con fuentes patrimoniales específicas.',
    historicalStory:
      'El templo forma parte de la memoria religiosa del casco histórico. La documentación consultada lo sitúa a comienzos del siglo XVIII y describe muros tradicionales y cubierta de madera y teja. Su proximidad a la Cruz de San Clemente permite leer un conjunto urbano de iglesia, plaza y memoria fundacional.\n\nLas fechas de reconstrucción y los elementos interiores suelen describirse de manera distinta en reseñas secundarias; la ficha presenta solo los rasgos generales hasta contar con una fuente patrimonial específica.',
    interestingFacts: [
      'La documentación arquitectónica consultada lo sitúa a comienzos del siglo XVIII.',
      'Describe una planta de cruz latina y una fachada de dos cuerpos.',
      'Forma conjunto urbano con la Cruz y la plaza de San Clemente.',
      'Los detalles constructivos requieren verificación con una fuente patrimonial específica.',
    ],
    visitorInfo:
      'Observa la fachada y el entorno; combina la visita con la Cruz de San Clemente y la Casa del Sol. Confirma los horarios litúrgicos antes de entrar y respeta las celebraciones. El acceso y los horarios están por confirmar.',
    contentSources: [IAM, UNESCO],
  },

  'iglesia-de-san-francisco': {
    historicalPeriod: 'Época colonial',
    description:
      'Templo histórico vinculado a la presencia franciscana en Coro. Su conjunto se relaciona con el antiguo convento y con el desarrollo posterior del Museo Diocesano.',
    whatIs:
      'La Iglesia de San Francisco es un templo histórico del casco de Coro, vinculado a la presencia franciscana y al antiguo convento. Su fachada y volumetría forman parte del paisaje patrimonial de la ciudad.\n\nLa historia de la iglesia debe separarse de la del convento y del Museo Diocesano, que ocupa el antiguo Convento de Nuestra Señora de la Salceda. Las fechas y los accesos requieren fuentes específicas.',
    historicalStory:
      'La Iglesia de San Francisco integra la memoria religiosa de Coro y el conjunto de instituciones que dieron forma a la ciudad. Su estudio se conecta con el antiguo convento franciscano y con el desarrollo posterior del Museo Diocesano, pero no son el mismo edificio ni la misma historia.\n\nEl conjunto urbano de Coro y La Vela es reconocido por UNESCO por conservar una trama histórica y una arquitectura que combina tradiciones locales con influencias hispánicas, mudéjares y neerlandesas. La datación y los detalles de las etapas del templo requieren fuentes monográficas.',
    interestingFacts: [
      'El templo se vincula con la presencia franciscana en Coro.',
      'Su historia debe distinguirse de la del antiguo convento y del Museo Diocesano.',
      'La construcción tradicional de la ciudad incluye tapia, adobe y bahareque.',
      'Debe interpretarse dentro de un paisaje urbano histórico, no como un monumento aislado.',
    ],
    visitorInfo:
      'Visita la iglesia junto al Museo Diocesano si está abierto y confirma previamente acceso, culto y estado de conservación. Mantén silencio si hay una actividad religiosa. Horarios y acceso están por confirmar.',
    contentSources: [UNESCO, IAM],
  },

  'mirador-ali-primera': {
    historicalPeriod: 'Homenaje contemporáneo',
    description:
      'Mirador urbano de Coro nombrado en homenaje al cantautor falconiano Alí Primera, nacido en 1941. Las imágenes recientes muestran escalinatas, murales y un monumento en una colina.',
    whatIs:
      'El Mirador Alí Primera es un espacio elevado de Coro consagrado al cantautor falconiano Alí Primera, nacido en la ciudad en 1941. Las fuentes visuales recientes muestran una escalinata, murales coloridos y un monumento en una colina.\n\nSu interés combina paisaje, memoria cultural y arte urbano. La ficha no confirma altitud, horarios, accesibilidad ni servicios; esos datos deben verificarse en el sitio. También conviene comprobar que la fotografía y el punto correspondan exactamente a este mirador y no a otro homenaje al cantautor.',
    historicalStory:
      'Alí Primera nació en Coro en 1941 y se convirtió en una de las voces más reconocidas de la canción social venezolana. El mirador lleva su nombre y vincula el paisaje de la ciudad con la memoria del cantautor.\n\nLas imágenes recientes documentan murales y una escalinata, pero no permiten fijar la fecha de creación del mirador ni el programa completo de intervenciones. La ficha evita publicar datos operativos sin verificación.',
    interestingFacts: [
      'Alí Primera nació en Coro en 1941.',
      'El mirador combina vistas urbanas, murales y un monumento en una colina.',
      'Las imágenes recientes muestran una escalinata y murales coloridos.',
      'La identidad exacta del punto y su estado actual deben confirmarse en el sitio.',
    ],
    visitorInfo:
      'Visita con luz diurna, lleva agua y calzado cómodo. Confirma el acceso, la seguridad y las condiciones de las escaleras antes de subir. No se publican horarios ni accesibilidad sin verificación.',
    contentSources: [NOTICIAS_MIRADOR],
  },

  'monumento-de-las-madres': {
    historicalPeriod: 'Arte público contemporáneo',
    description:
      'Monumento urbano dedicado a las madres en el Paseo Monseñor Iturriza. La escultura figurativa se apoya en un pedestal y una fuente circular.',
    whatIs:
      'El Monumento de las Madres es una obra de arte público dedicada a la maternidad, ubicada en el Paseo Monseñor Iturriza. Según la fotografía localizada, se trata de una escultura figurativa sobre pedestal, con una fuente circular.\n\nLa fecha, la autoría, los materiales y el proceso de instalación requieren confirmación municipal o patrimonial. El estado operativo de la fuente debe comprobarse in situ y no debe afirmarse que funciona sin verificación.',
    historicalStory:
      'El monumento forma parte del paisaje de espacios públicos contemporáneos de Coro. Su tema reconoce la maternidad y el cuidado familiar, y su emplazamiento lo incorpora a la vida cotidiana del paseo.\n\nLas reseñas disponibles no permiten confirmar con seguridad la fecha de instalación, la autoría ni el programa de actos vinculados. Esos datos quedan pendientes de una fuente municipal o patrimonial.',
    interestingFacts: [
      'Está ubicado en el Paseo Monseñor Iturriza.',
      'La escultura representa la maternidad sobre un pedestal con fuente circular.',
      'La autoría y la fecha de instalación requieren confirmación documental.',
      'El funcionamiento actual de la fuente debe comprobarse en el sitio.',
    ],
    visitorInfo:
      'Visítalo de día y combina el paseo con otros espacios públicos de la ciudad. Mantén despejadas las áreas de circulación y cuida el mobiliario y la vegetación. No se afirma que la fuente esté funcionando; horarios y accesibilidad están por confirmar.',
    contentSources: ['https://mindtrip.ai/attraction/coro-central-western-region/monumento-de-las-madres/at-XG4qOipG', 'https://www.google.com/maps/search/?api=1&query=Monumento+de+las+Madres+Coro'],
  },

  'museo-alberto-henriquez': {
    historicalPeriod: 'Siglo XX',
    description:
      'Museo del casco histórico vinculado a la memoria de la comunidad judía sefardí de Coro y a los intercambios con las Antillas neerlandesas.',
    whatIs:
      'El Museo Alberto Henríquez es un espacio cultural del casco histórico de Coro. Su historia se relaciona con la memoria de la comunidad judía sefardí de la ciudad y con los intercambios comerciales y culturales con las Antillas neerlandesas, en particular Curazao.\n\nLa colección y los espacios interpretativos abordan historia sefardí, comercio antillano y vida religiosa y comunitaria. La sede, la colección expuesta y el horario actual deben verificarse con la institución; no debe confundirse con otros museos de temática religiosa.',
    historicalStory:
      'La presencia judía sefardí en Coro y su relación con el Caribe neerlandés forman parte de la historia urbana y comercial de la ciudad. El museo se vincula a ese legado y a la familia Senior, según la información consultada.\n\nLa administración actual, la colección expuesta y la historia de la sede deben confirmarse con la institución antes de atribuirle piezas, usos religiosos anteriores o actividades académicas específicas.',
    interestingFacts: [
      'El museo se relaciona con la memoria de la comunidad judía sefardí de Coro.',
      'Su temática incluye el comercio y los intercambios con las Antillas neerlandesas.',
      'La conexión histórica Coro-Curazao es clave para interpretar su colección.',
      'La sede, la colección y el horario deben confirmarse con la institución.',
    ],
    visitorInfo:
      'Confirma apertura, visitas guiadas, exposiciones y condiciones de acceso antes de ir. No lo confundas con otros museos de temática religiosa. Horarios, tarifas y accesibilidad están por confirmar.',
    contentSources: [ICOM, IAM],
  },

  'museo-diocesano': {
    historicalPeriod: 'Fundado en 1946; sede desde 1982',
    description:
      'Museo fundado en 1946 por monseñor Francisco José Iturriza Guillén, dedicado al patrimonio religioso de la diócesis. Desde 1982 ocupa el antiguo Convento de Nuestra Señora de la Salceda.',
    whatIs:
      'El Museo Diocesano Lucas Guillermo Castillo fue fundado en 1946 por monseñor Francisco José Iturriza Guillén y está dedicado a los bienes artísticos y religiosos de la diócesis de Coro. En 1982 se trasladó al antiguo Convento de Nuestra Señora de la Salceda.\n\nReúne piezas litúrgicas, pinturas, esculturas, mobiliario, orfebrería, retablos, campanas y ornamentos descritos en fuentes históricas. No debe asegurarse que toda la colección esté actualmente expuesta. Una publicación de 2018 informó de un cierre prolongado; el estado actual requiere verificación directa.',
    historicalStory:
      'La fundación del museo en 1946 y su traslado en 1982 al antiguo convento marcan dos etapas de su historia. El edificio que lo alberga forma parte del conjunto religioso y patrimonial de Coro.\n\nLas fuentes históricas describen una colección amplia de arte y objetos litúrgicos. La existencia de un cierre prolongado reportado en 2018 obliga a confirmar la apertura antes de recomendar una visita.',
    interestingFacts: [
      'Fue fundado en 1946 por monseñor Francisco José Iturriza Guillén.',
      'En 1982 se trasladó al antiguo Convento de Nuestra Señora de la Salceda.',
      'Reúne piezas litúrgicas, pinturas, esculturas, orfebrería y ornamentos.',
      'Una publicación de 2018 informó de un cierre prolongado; confirma la apertura actual.',
    ],
    visitorInfo:
      'No te desplaces sin confirmar apertura, acceso y visitas guiadas con el museo o la diócesis. Si está cerrado, considera alternativas cercanas como la Catedral, la Plaza Bolívar o el MUCOR. Horarios, tarifas y accesibilidad están por confirmar.',
    contentSources: [IAM, ICOM, UNESCO],
  },

  'museo-guadalupano': {
    historicalPeriod: 'Inaugurado en diciembre de 2012',
    description:
      'Museo de temática religiosa instalado en la antigua Casa del Tesoro. Fue inaugurado en diciembre de 2012 y está vinculado a la devoción guadalupana.',
    whatIs:
      'El Museo Guadalupano es un museo de temática religiosa instalado en la antigua Casa del Tesoro, en el casco histórico de Coro. Según la información institucional consultada, fue inaugurado en diciembre de 2012 y está vinculado a la devoción a la Virgen de Guadalupe.\n\nEl inmueble histórico y los objetos de temática religiosa permiten contextualizar la devoción guadalupana en la historia religiosa falconiana. Las exposiciones, los horarios y la accesibilidad actuales deben verificarse antes de publicar.',
    historicalStory:
      'La Casa del Tesoro es el inmueble que alberga el museo. Su inauguración en diciembre de 2012, según la información institucional consultada, marca el inicio de esta propuesta museística dedicada a la devoción guadalupana.\n\nLa relación exacta con el Santuario de Carrizal y el origen de cada pieza requieren confirmación directa. La ficha evita presentar como hechos cerrados los datos que no están documentados.',
    interestingFacts: [
      'Fue inaugurado en diciembre de 2012, según la información institucional consultada.',
      'Ocupa la antigua Casa del Tesoro, en el casco histórico de Coro.',
      'Su temática se relaciona con la devoción a la Virgen de Guadalupe en Falcón.',
      'Las piezas expuestas y las actividades pueden cambiar; verifica antes de la visita.',
    ],
    visitorInfo:
      'Consulta actividades y visitas guiadas antes de ir. Contextualiza la devoción guadalupana en la historia religiosa falconiana. Horarios, tarifas y accesibilidad están por confirmar.',
    contentSources: ['https://www.google.com/maps/search/?api=1&query=Museo+Guadalupano+Coro', ICOM],
  },

  'museo-de-arte-de-coro': {
    historicalPeriod: 'Fundado en 1988',
    description:
      'Museo de arte fundado el 26 de noviembre de 1988, con sede en una casona colonial conocida como Balcón Bolívar o Casa de los Senior. Programa exposiciones temporales y actividades artísticas.',
    whatIs:
      'El Museo de Arte de Coro (MUCOR) fue fundado el 26 de noviembre de 1988 para promover y difundir las artes visuales. Su sede histórica se asocia con una casona colonial conocida como Balcón Bolívar o Casa de los Senior.\n\nEl edificio, con balcón, patio y espacios expositivos, es tan interesante como la programación. El museo acoge exposiciones temporales y actividades vinculadas a artistas falconianos. No debe asumirse que una colección o una muestra histórica sigue expuesta.',
    historicalStory:
      'El MUCOR fue fundado el 26 de noviembre de 1988 y pertenece a la Fundación Museos Nacionales, según la información oficial consultada. Su sede colonial aporta una capa de historia urbana al contenido artístico contemporáneo.\n\nLa programación, los talleres y las exposiciones cambian con el tiempo. La ficha remite a la cartelera del museo y no fija una muestra permanente sin verificación.',
    interestingFacts: [
      'Fue fundado el 26 de noviembre de 1988.',
      'Su sede es una casona colonial conocida como Balcón Bolívar o Casa de los Senior.',
      'El edificio combina balcón, patio y espacios expositivos.',
      'La programación y las exposiciones son temporales; consulta la cartelera vigente.',
      'El museo abre de martes a sábado de 9:00 a.m. a 4:00 p.m., según su cuenta oficial consultada el 2026-11-24.',
    ],
    visitorInfo:
      'Consulta la cartelera, los talleres y las exposiciones antes de ir; valora tanto el edificio como el contenido artístico. El horario publicado por su cuenta oficial es una referencia: confírmalo antes de la visita. Tarifas y accesibilidad están por confirmar.',
    contentSources: [ICOM, 'https://www.instagram.com/museodeartecoro1988/'],
  },

  'medanos-de-coro': {
    historicalPeriod: 'Paisaje natural modelado por el viento',
    description:
      'Campo de dunas móviles al norte de Coro, dentro del Parque Nacional Médanos de Coro. Es un paisaje natural emblemático y un espacio protegido que cambia con el viento.',
    whatIs:
      'Los Médanos de Coro son un campo de dunas móviles al norte de la ciudad, dentro del Parque Nacional Médanos de Coro. La arena cambia de forma y posición por la acción del viento, por lo que el paisaje varía con el tiempo y las condiciones ambientales.\n\nEste punto corresponde al sector turístico de dunas y no debe confundirse con la totalidad del parque nacional. Es un ecosistema protegido, no una superficie recreativa sin límites; las dunas y la vegetación xerófila son sensibles al tránsito fuera de las zonas permitidas.',
    historicalStory:
      'El parque nacional fue creado en 1974 para proteger un paisaje singular del istmo de Paraguaná. Las dunas son su imagen más conocida, pero el área protegida incluye ambientes áridos y costeros, vegetación xerófila y ecosistemas asociados.\n\nLa modificación de la poligonal en 2021 estableció una superficie de 80.866 hectáreas según el decreto consultado. Esa cifra corresponde al parque nacional completo, no al sector turístico de dunas.',
    interestingFacts: [
      'El parque nacional fue creado en 1974.',
      'El viento modifica continuamente la forma de las dunas.',
      'La modificación de la poligonal de 2021 estableció 80.866 hectáreas, según el decreto consultado.',
      'El sector de dunas no equivale a la totalidad del parque nacional.',
      'La vegetación xerófila y los ambientes costeros forman parte del ecosistema protegido.',
    ],
    visitorInfo:
      'Lleva agua, protección solar y calzado apropiado; prefiere las primeras horas o la tarde. No dejes residuos ni conduzcas fuera de los sectores autorizados. Consulta las restricciones vigentes y no te detengas en la calzada para fotografiar. Horarios y accesos deben confirmarse con INPARQUES.',
    contentSources: [INPARQUES, UNESCO, 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Medanos.jpg/960px-Medanos.jpg'],
  },

  'parque-nacional-medanos-de-coro': {
    historicalPeriod: 'Creado en 1974; poligonal modificada en 2021',
    description:
      'Área natural protegida creada en 1974. La modificación de su poligonal en 2021 estableció 80.866 hectáreas. No es sinónimo del punto turístico de las dunas.',
    whatIs:
      'El Parque Nacional Médanos de Coro es un área natural protegida creada por decreto en 1974. La modificación de su poligonal en 2021 estableció una superficie de 80.866 hectáreas, según el decreto consultado.\n\nComprende ambientes de dunas, matorrales xerófilos, sectores costeros, manglares y ambientes marinos. La conservación ecológica es parte central de su valor. Esta ficha corresponde al área protegida completa y no debe confundirse con el punto turístico de las dunas.',
    historicalStory:
      'La creación del parque en 1974 respondió a la necesidad de proteger un paisaje costero singular del istmo de Paraguaná. Con el tiempo, la poligonal fue revisada; la modificación de 2021 fijó 80.866 hectáreas según la fuente consultada.\n\nEl parque incluye más que dunas: matorrales, costas, manglares y ambientes marinos. Su administración corresponde a INPARQUES y las normas de visita deben consultarse antes de organizar actividades.',
    interestingFacts: [
      'Fue creado por decreto en 1974.',
      'La modificación de la poligonal de 2021 estableció 80.866 hectáreas, según el decreto consultado.',
      'Incluye dunas, matorrales xerófilos, sectores costeros, manglares y ambientes marinos.',
      'El área protegida completa no es sinónimo del sector turístico de dunas.',
      'La conservación ecológica es parte central de su valor.',
    ],
    visitorInfo:
      'Respeta las normas de INPARQUES: no extraigas flora, fauna ni arena, no dejes residuos y verifica los accesos y actividades autorizadas. Lleva agua y protección solar. Horarios, tarifas y accesibilidad deben confirmarse con la administración del parque.',
    contentSources: [INPARQUES, UNESCO, 'https://es.wikipedia.org/wiki/Parque_nacional_Los_M%C3%A9danos_de_Coro'],
  },

  'paseo-independencia': {
    historicalPeriod: 'Espacio urbano contemporáneo',
    description:
      'Paseo urbano de Coro concebido para la circulación peatonal y la recreación. Forma parte de los espacios públicos de la ciudad contemporánea.',
    whatIs:
      'El Paseo Independencia es un espacio público urbano de Coro destinado a la circulación peatonal, el encuentro y la recreación. Su interés está en la vida cotidiana y en el uso del espacio público, no en una declaratoria patrimonial.\n\nLa fecha de creación, la autoría y la evolución urbanística no se han confirmado con documentación suficiente. La ficha describe solo los elementos observables y verificados: recorridos, mobiliario, vegetación, iluminación y accesibilidad.',
    historicalStory:
      'El paseo forma parte de la ciudad contemporánea y de sus lugares de encuentro. No debe atribuírsele una antigüedad colonial sin evidencia. Su historia urbana está pendiente de documentación específica.\n\nEl valor de la ficha es práctico: ayuda a recorrerlo y a entenderlo como espacio de recreación dentro de Coro.',
    interestingFacts: [
      'Es un espacio público destinado al tránsito y al encuentro.',
      'Permite conocer sectores de la ciudad fuera del casco histórico.',
      'No se le atribuye antigüedad colonial sin evidencia.',
      'El mobiliario y las actividades pueden variar; comprueba las condiciones en el sitio.',
    ],
    visitorInfo:
      'Recorre de día y verifica mantenimiento, iluminación, accesibilidad y actividades programadas. Usa las áreas peatonales y mantente atento al tránsito. Horarios y servicios están por confirmar.',
    contentSources: ['https://www.google.com/maps/search/?api=1&query=Paseo+Independencia+Coro'],
  },

  'plaza-antillana': {
    historicalPeriod: 'Inauguración reportada en 1974',
    description:
      'Plaza pública de La Vela de Coro vinculada simbólicamente con los intercambios entre Falcón y las Antillas neerlandesas. Se reporta una inauguración en 1974.',
    whatIs:
      'La Plaza Antillana es una plaza pública de La Vela de Coro, en el municipio Colina. Se relaciona simbólicamente con los vínculos históricos entre Falcón y las Antillas neerlandesas. Fuentes académicas y periodísticas describen una escultura de mujer neerlandesa y una inauguración en 1974; los detalles deben confirmarse con archivo municipal.\n\nLa imagen localizada corresponde a una plaza de La Vela, pero no está confirmada como la Plaza Antillana. Por eso la ficha no la presenta como fotografía verificada del lugar.',
    historicalStory:
      'La Vela fue el puerto histórico de Coro y un punto de intercambio con el Caribe. UNESCO describe la influencia neerlandesa introducida en la arquitectura de Coro y su puerto desde la segunda mitad del siglo XVII a través de islas como Curazao y Aruba.\n\nLa Plaza Antillana conmemora esa relación. La fecha de 1974 y la escultura de la mujer neerlandesa aparecen en fuentes consultadas, pero requieren confirmación documental local.',
    interestingFacts: [
      'Está en La Vela de Coro, municipio Colina.',
      'Se vincula simbólicamente con los intercambios entre Falcón y las Antillas neerlandesas.',
      'Fuentes consultadas describen una escultura de mujer neerlandesa y una inauguración en 1974.',
      'La imagen localizada no está confirmada como fotografía de esta plaza.',
    ],
    visitorInfo:
      'Combina la visita con el puerto, el Museo Comunitario y la Casa Museo Locos de La Vela. Explica el intercambio comercial y cultural con Curazao. Considera el sol y la brisa costera. Horarios y accesibilidad están por confirmar.',
    contentSources: [LAC_GEO, UNESCO, LOCOS],
  },

  'plaza-bolivar-de-coro': {
    historicalPeriod: 'Trazado urbano colonial',
    description:
      'Plaza central del casco histórico, frente a la Catedral. Es punto de partida del recorrido peatonal y espacio cívico de la ciudad.',
    whatIs:
      'La Plaza Bolívar de Coro es la plaza central del casco histórico y se encuentra frente a la Catedral. Su origen se relaciona con el trazado urbano colonial y con funciones cívicas, religiosas y comerciales.\n\nLa plaza está fuera de los límites actuales del bien UNESCO según la documentación consultada, aunque forma parte de su contexto histórico. Su valor está en la relación visual con la Catedral, el monumento a Bolívar y las casas del entorno.',
    historicalStory:
      'La plaza permite leer la estructura histórica de la ciudad: el templo, el espacio público y las edificaciones circundantes. UNESCO identifica la Plaza Bolívar y la Catedral como atributos relevantes que no están incluidos dentro de los límites actuales del bien inscrito.\n\nSu uso cívico y religioso se mantiene. El mobiliario, la vegetación y el estado actual deben registrarse en una visita reciente.',
    interestingFacts: [
      'Se encuentra frente a la Catedral de Santa Ana.',
      'Es punto de orientación y encuentro en el centro de Coro.',
      'UNESCO señala que la Plaza Bolívar no forma parte de los límites actuales del bien inscrito.',
      'Su relación con la Catedral y las casas del entorno define el paisaje de la plaza.',
    ],
    visitorInfo:
      'Úsala como punto de partida de un recorrido peatonal y visita con la Catedral y las calles patrimoniales cercanas. Respeta las actividades cívicas y comunitarias, cuida las áreas verdes y considera el sol y el calor. Horarios y accesibilidad están por confirmar.',
    contentSources: [UNESCO, 'https://es.wikipedia.org/wiki/Coro_(Venezuela)'],
  },

  'teatro-armonia': {
    historicalPeriod: '1891; sede actual de 1999',
    description:
      'Teatro histórico cuya primera sede se inauguró en 1891. El edificio original sufrió un incendio en 1945; la sede actual, inaugurada en 1999, funciona como complejo cultural.',
    whatIs:
      'El Teatro Armonía es un espacio cultural de Coro dedicado a las artes escénicas y musicales. Su primera sede fue inaugurada en 1891 por iniciativa de sociedades culturales locales. El edificio original sufrió un incendio en 1945.\n\nLa sede actual fue inaugurada en 1999 y funciona como complejo cultural vinculado a la Orquesta Sinfónica de Falcón. No debe confundirse arquitectónicamente con el teatro decimonónico desaparecido: la sede contemporánea tiene una concepción moderna.',
    historicalStory:
      'El Teatro Armonía nació en 1891 como iniciativa de sociedades culturales de Coro. El incendio de 1945 destruyó el edificio original. La sede actual se inauguró en 1999 y retomó la función de espacio para la música y las artes escénicas.\n\nSu historia permite explicar la continuidad de la vida cultural de la ciudad más allá del patrimonio colonial. La programación y la relación actual con la Orquesta Sinfónica de Falcón deben confirmarse con la administración.',
    interestingFacts: [
      'La primera sede fue inaugurada en 1891.',
      'El edificio original sufrió un incendio en 1945.',
      'La sede actual fue inaugurada en 1999.',
      'Funciona como complejo cultural vinculado a la Orquesta Sinfónica de Falcón.',
      'No debe confundirse la sede actual con el teatro decimonónico desaparecido.',
    ],
    visitorInfo:
      'Consulta cartelera, funciones, taquilla, accesibilidad y visitas antes de ir. La experiencia es especialmente recomendable durante conciertos o presentaciones. Horarios y tarifas dependen de cada evento.',
    contentSources: ['https://www.google.com/search?q=Teatro+Armonia+Coro+historia+Orquesta+Sinfonica+Falcon'],
  },
};
