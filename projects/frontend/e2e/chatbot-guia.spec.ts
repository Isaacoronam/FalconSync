import { expect, test, Page } from '@playwright/test';

/**
 * E2E de Chivito (/guia) conversando con el corpus RAG real.
 *
 * Dos modos, decididos por la disponibilidad que declara el propio backend:
 * - Por defecto (sin RAG_TOURIST_ENABLED/RAG_CORPUS_VERSION del entorno que
 *   lanza la suite): la guía está "en preparación"; los casos B y C se omiten
 *   y el caso D valida el estado bloqueado. `guia.spec.ts` no cambia.
 * - Con corpus: el backend ingiere las 14 fuentes de la evaluación dorada al
 *   arrancar y esta spec conversa de verdad con la guía.
 *
 * Cada pregunta deja evidencia en la salida: `[Q]` con la pregunta, `[A]` con
 * el texto literal de la respuesta visible en la UI y `[API]` con los
 * metadatos de la respuesta HTTP (tipo, abstención, fuentes citadas, latencia).
 */

const FALLBACK_MESSAGE =
  'No cuento con evidencia suficiente para responder, prueba con una pregunta sobre el patrimonio de Coro';
const SCHEDULE_ABSTENTION_MESSAGE =
  'Sin horarios confirmados. No cuento con una fuente verificada de horarios, tarifas ni estado de apertura; confirma directamente con el lugar antes de tu visita.';
const PRICE_ABSTENTION_MESSAGE =
  'Sin precios confirmados. No cuento con una fuente verificada de tarifas ni condiciones de entrada; confirma directamente con el lugar antes de tu visita.';

type CitaApi = {
  sourceId: string;
  quote: string;
  title: string;
};

type DatosRespuesta = {
  answer: string;
  answerType: string;
  abstained: boolean;
  abstentionReason: string | null;
  citations: CitaApi[];
  sources: Array<{ id: string; title: string }>;
  suggestions: string[];
  options: Array<{ id: string; title: string }>;
  poi: { id: string; slug: string; title: string } | null;
  latencyMs: number;
  corpusVersion: string;
};

type Observacion = {
  pregunta: string;
  respuestaUi: string;
  citasUi: number;
  errorUi: string | null;
  datos: DatosRespuesta | null;
};

/** Crea un perfil único por la UI y comprueba que la sesión queda iniciada. */
async function crearPerfilPorUi(page: Page): Promise<{ nombre: string; email: string }> {
  const sufijo = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const nombre = `Guia E2E ${sufijo.slice(-6)}`;
  const email = `guia-${sufijo}@example.com`;
  const contrasena = 'GuiaE2E123456';

  await page.goto('/registro');
  await page.locator('#register-name').fill(nombre);
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(contrasena);
  await page.locator('#register-confirm-password').fill(contrasena);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.site-nav__user')).toContainText(nombre);

  return { nombre, email };
}

/** Navega a /guia y devuelve la etiqueta de disponibilidad ya estabilizada. */
async function estadoGuia(page: Page): Promise<string> {
  await page.goto('/guia');
  await expect(page.locator('.chat__availability')).toHaveText(
    /(Chivito disponible|Chivito en preparación|No se pudo verificar el estado)/,
    { timeout: 20_000 },
  );

  return ((await page.locator('.chat__availability').textContent()) ?? '').trim();
}

/** Captura el JSON de cada POST a /api/assistant/tourist/query. */
function capturarConsultas(page: Page): () => Promise<DatosRespuesta | null> {
  let pendiente: Promise<DatosRespuesta | null> | null = null;

  page.on('response', (response) => {
    if (
      response.request().method() === 'POST' &&
      response.url().includes('/api/assistant/tourist/query')
    ) {
      // La API envuelve la respuesta en { data: ... }.
      pendiente = response
        .json()
        .then((json) => (json && json.data ? json.data : null))
        .catch(() => null);
    }
  });

  return async () => (pendiente ? await pendiente : null);
}

/**
 * Escribe la pregunta en el compositor, la envía, espera la respuesta visible
 * (o un error) y devuelve lo observado, dejando su rastro en la consola.
 */
async function hacerPregunta(
  page: Page,
  consultar: () => Promise<DatosRespuesta | null>,
  pregunta: string,
): Promise<Observacion> {
  const respuestas = page.locator('.chat-message--assistant');
  const error = page.locator('.chat__error');
  const antes = await respuestas.count();

  await page.locator('#chat-question').fill(pregunta);
  await page.getByRole('button', { name: 'Enviar pregunta' }).click();

  const nueva = respuestas.nth(antes);
  await Promise.race([
    nueva.waitFor({ state: 'visible', timeout: 60_000 }),
    error.waitFor({ state: 'visible', timeout: 60_000 }),
  ]);

  const errorUi = (await error.isVisible())
    ? ((await error.textContent()) ?? '').trim() || null
    : null;
  const respuestaUi = errorUi
    ? ''
    : ((await nueva.locator('.chat-message__content').textContent()) ?? '').trim();
  const citasUi = errorUi ? 0 : await nueva.locator('.chat-citations li').count();
  const datos = await consultar();

  console.log(`\n[Q] ${pregunta}`);
  console.log(`[A] ${respuestaUi || '(sin respuesta en la UI)'}`);
  if (datos) {
    const fuentes = datos.sources.map((fuente) => fuente.id).join(', ') || 'ninguna';
    console.log(
      `[API] answerType=${datos.answerType} abstained=${datos.abstained} ` +
        `reason=${datos.abstentionReason ?? '-'} poi=${datos.poi?.slug ?? '-'} ` +
        `fuentes=[${fuentes}] citas=${datos.citations.length} ` +
        `sugerencias=${datos.suggestions.length} latencia=${datos.latencyMs}ms`,
    );
    if (datos.suggestions.length) {
      console.log(`[API] sugerencias: ${datos.suggestions.join(' | ')}`);
    }
    if (datos.options.length) {
      console.log(
        `[API] opciones de aclaración: ${datos.options.map((opcion) => opcion.title).join(' | ')}`,
      );
    }
  } else {
    console.log('[API] no se capturó la respuesta JSON');
  }
  if (errorUi) {
    console.log(`[ERROR UI] ${errorUi}`);
  }

  return { pregunta, respuestaUi, citasUi, errorUi, datos };
}

function datosDe(observacion: Observacion): DatosRespuesta {
  expect(
    observacion.datos,
    `Sin respuesta JSON capturable para «${observacion.pregunta}»`,
  ).not.toBeNull();

  return observacion.datos as DatosRespuesta;
}

function fuentesDe(observacion: Observacion): string[] {
  return datosDe(observacion).sources.map((fuente) => fuente.id);
}

test('Caso A — crea un perfil por la UI y lo conserva al entrar a la guía', async ({ page }) => {
  const { nombre } = await crearPerfilPorUi(page);

  await page.reload();
  await expect(page.locator('.site-nav__user')).toContainText(nombre);

  await page.goto('/guia');
  await expect(page.locator('.site-nav__user')).toContainText(nombre);
  await expect(page.locator('#guide-title')).toContainText('Conoce Coro con Chivito');
});

test('Caso D — sin corpus disponible la guía queda en preparación y bloquea la consulta', async ({
  page,
}) => {
  const etiqueta = await estadoGuia(page);

  if (etiqueta.startsWith('Chivito disponible')) {
    test.skip(
      true,
      'Corpus RAG habilitado en este entorno: la rama bloqueada corresponde al modo por defecto.',
    );
  }

  await expect(page.locator('.chat__availability')).toHaveText('Chivito en preparación');
  await expect(page.locator('#chat-question')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Enviar pregunta' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '¿Qué es Coro?' })).toBeDisabled();

  // Sin selector de lugar: el lugar se resuelve desde el texto de la pregunta.
  await expect(page.locator('select')).toHaveCount(0);
});

/**
 * Precondición común de la batería: si la guía no está disponible, omite el
 * caso con un mensaje claro; si lo está, crea un perfil por la UI, vuelve a
 * /guia con sesión iniciada y devuelve el capturador de respuestas de la API.
 */
async function prepararGuiaConPerfil(page: Page): Promise<() => Promise<DatosRespuesta | null>> {
  const etiqueta = await estadoGuia(page);

  if (!etiqueta.startsWith('Chivito disponible')) {
    test.skip(
      true,
      'La guía no está disponible sin corpus RAG: la batería solo aplica con RAG_TOURIST_ENABLED y RAG_CORPUS_VERSION.',
    );
  }

  await crearPerfilPorUi(page);
  await page.goto('/guia');
  await expect(page.locator('#chat-question')).toBeEnabled();
  await expect(page.getByRole('button', { name: '¿Qué es Coro?' })).toBeEnabled();

  return capturarConsultas(page);
}

test('Caso B — la guía responde preguntas diversas con evidencia visible', async ({ page }) => {
  const consultar = await prepararGuiaConPerfil(page);

  // B1 — lugares publicados: se registra lo que responda (cita del registro o
  // abstención), sin forzar un resultado concreto.
  const b1 = await hacerPregunta(page, consultar, '¿Qué lugares publicados hay en Coro?');
  expect(b1.errorUi).toBeNull();
  expect(b1.respuestaUi.length).toBeGreaterThan(0);
  const b1Datos = datosDe(b1);
  expect(b1Datos.answer.length).toBeGreaterThan(0);
  // La respuesta visible en la UI es la que devolvió la API.
  expect(b1.respuestaUi.replace(/\s+/g, ' ')).toBe(b1Datos.answer.replace(/\s+/g, ' '));

  // B2 — estado patrimonial UNESCO (variante con «hoy» del caso her-02).
  const b2 = await hacerPregunta(
    page,
    consultar,
    '¿Coro está hoy en la Lista del Patrimonio Mundial en Peligro?',
  );
  expect(b2.errorUi).toBeNull();
  expect(datosDe(b2).abstained).toBe(false);
  expect(fuentesDe(b2)).toContain('S-003');

  // B3/B4 — adobe y tapia por separado.
  const b3 = await hacerPregunta(page, consultar, '¿Qué es el adobe?');
  expect(b3.errorUi).toBeNull();
  expect(datosDe(b3).abstained).toBe(false);
  expect(b3.citasUi).toBeGreaterThanOrEqual(1);

  const b4 = await hacerPregunta(page, consultar, '¿Qué es la tapia?');
  expect(b4.errorUi).toBeNull();
  expect(datosDe(b4).abstained).toBe(false);
  expect(b4.citasUi).toBeGreaterThanOrEqual(1);

  // B5/B6 — identidad de Coro (caso her-05) y del producto (caso faq-01).
  const b5 = await hacerPregunta(page, consultar, '¿Qué es Coro?');
  expect(b5.errorUi).toBeNull();
  expect(datosDe(b5).abstained).toBe(false);
  expect(fuentesDe(b5)).toContain('S-002');

  const b6 = await hacerPregunta(page, consultar, '¿Qué es FALCONSYNC?');
  expect(b6.errorUi).toBeNull();
  expect(datosDe(b6).abstained).toBe(false);
  expect(fuentesDe(b6)).toContain('S-022');
});

test('Caso B7 — un horario sin fuente publicada para el lugar preguntado se abstiene', async ({
  page,
}) => {
  const consultar = await prepararGuiaConPerfil(page);

  // Solo MUCOR (S-030) y las misas de la Catedral (S-031) tienen horario
  // publicado; para el resto de lugares la nota del corpus dice que responde
  // «Sin horarios confirmados…».
  const b7 = await hacerPregunta(page, consultar, '¿Cuál es el horario del Museo Diocesano?');
  expect(b7.errorUi).toBeNull();
  expect(datosDe(b7).abstained).toBe(true);
  expect(datosDe(b7).abstentionReason).toBe('NO_CURRENT_STATUS');
  expect(
    b7.respuestaUi.startsWith(SCHEDULE_ABSTENTION_MESSAGE),
    `Respuesta observada en B7: «${b7.respuestaUi}»`,
  ).toBe(true);
});

test('Caso E — saludos, identidad de Coro y producto sin enlaces internos', async ({ page }) => {
  const consultar = await prepararGuiaConPerfil(page);

  // E1/E2 — saludo de mensaje completo, incluida la forma de dos letras «hi».
  for (const saludo of ['hola', 'hi']) {
    const respuesta = await hacerPregunta(page, consultar, saludo);
    expect(respuesta.errorUi).toBeNull();
    const datos = datosDe(respuesta);
    expect(datos.answerType).toBe('greeting');
    expect(datos.abstained).toBe(false);
    expect(datos.citations).toHaveLength(0);
    expect(datos.suggestions).toHaveLength(3);
    expect(respuesta.respuestaUi).toContain('Chivito');
    await expect(page.locator('.chat-message--assistant').last().getByRole('button')).toHaveCount(
      3,
    );
  }

  // E3 — identidad de la ciudad: descripción general, sin posadas ni Médanos.
  const ciudad = await hacerPregunta(page, consultar, 'que es coro?');
  expect(ciudad.errorUi).toBeNull();
  const ciudadDatos = datosDe(ciudad);
  expect(ciudadDatos.abstained).toBe(false);
  expect(ciudadDatos.poi).toBeNull();
  expect(fuentesDe(ciudad)).toContain('S-002');
  expect(ciudad.respuestaUi).toMatch(/ciudad/i);
  expect(ciudad.respuestaUi).not.toMatch(/posadas|Médanos/i);

  // E4 — la variante «ciudad de Coro» tampoco se atribuye a Ciudad Deportiva.
  const ciudadVariante = await hacerPregunta(page, consultar, 'que es la ciudad de coro?');
  expect(ciudadVariante.errorUi).toBeNull();
  expect(datosDe(ciudadVariante).poi).toBeNull();
  expect(fuentesDe(ciudadVariante)).toContain('S-002');

  // E8 — «la ciudad» sin «de Coro» no debe activar la ficha de Ciudad Deportiva.
  const ciudadGenerica = await hacerPregunta(page, consultar, '¿Qué es la ciudad?');
  expect(ciudadGenerica.errorUi).toBeNull();
  expect(datosDe(ciudadGenerica).poi).toBeNull();
  expect(ciudadGenerica.respuestaUi).not.toMatch(/Ciudad Deportiva/i);

  // E9 — triple: cada parte en orden y aviso de ruta solo para la Catedral.
  const triple = await hacerPregunta(
    page,
    consultar,
    '¿Qué es Coro, qué es la Ciudad Deportiva y cómo llego a la Catedral?',
  );
  expect(triple.errorUi).toBeNull();
  expect(datosDe(triple).abstained).toBe(false);
  expect(triple.respuestaUi).toMatch(/Coro/);
  expect(triple.respuestaUi).toMatch(/Ciudad Deportiva/);
  expect(triple.respuestaUi).toContain('No tengo una ruta verificada');
  expect(triple.respuestaUi).toMatch(/Catedral de Coro/);

  // E5 — producto: responde desde la documentación interna, sin cita tangencial
  // ni enlace al repositorio.
  const producto = await hacerPregunta(page, consultar, 'que es falconsync');
  expect(producto.errorUi).toBeNull();
  const productoDatos = datosDe(producto);
  expect(productoDatos.abstained).toBe(false);
  expect(productoDatos.poi).toBeNull();
  expect(fuentesDe(producto)).toEqual(['S-022']);
  expect(productoDatos.citations).toHaveLength(1);
  expect(productoDatos.citations[0].sourceId).toBe('S-022');
  expect(producto.respuestaUi).toContain('plataforma digital');
  await expect(
    page.locator('.chat-message--assistant').last().locator('.chat-citations a'),
  ).toHaveCount(0);

  const enlaces = await page
    .locator('.chat-citations a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(enlaces.some((href) => href.includes('github.com'))).toBe(false);

  // E6 — ruta: avisa que no hay ruta verificada y mantiene la ficha.
  const ruta = await hacerPregunta(
    page,
    consultar,
    'como se puede llegar al monumento de las madres?',
  );
  expect(ruta.errorUi).toBeNull();
  expect(datosDe(ruta).poi?.slug).toBe('monumento-de-las-madres');
  expect(ruta.respuestaUi).toContain('No tengo una ruta verificada');
  expect(ruta.respuestaUi).toContain('Paseo Monseñor Iturriza');

  // E7 — construir con tapia ya no se rechaza como orientación técnica.
  const tapia = await hacerPregunta(page, consultar, 'como construir con tapia');
  expect(tapia.errorUi).toBeNull();
  expect(datosDe(tapia).abstained).toBe(false);
  expect(fuentesDe(tapia)).toContain('S-025');
  expect(tapia.respuestaUi).toMatch(/encofrado/i);
});

test('Caso C — preguntas compuestas: una sola respuesta y abstención completa ante partes sin evidencia', async ({
  page,
}) => {
  const consultar = await prepararGuiaConPerfil(page);

  // C1 — dos partes conocidas (misma pregunta que el caso comp-01 del
  // conjunto dorado): UNA respuesta con citas de las dos partes.
  const c1 = await hacerPregunta(page, consultar, '¿Qué es el adobe y qué es la tapia?');
  expect(c1.errorUi).toBeNull();
  expect(datosDe(c1).abstained).toBe(false);
  expect(fuentesDe(c1)).toContain('S-024');
  expect(fuentesDe(c1)).toContain('S-025');
  expect(c1.citasUi).toBeGreaterThanOrEqual(2);

  // C2 — mezcla conocida + precio sin fuente: el comportamiento real es una
  // abstención completa (una sola respuesta, sin responder a medias), con el
  // mensaje específico de precios.
  const c2 = await hacerPregunta(
    page,
    consultar,
    '¿Qué es FALCONSYNC y cuánto cuesta la entrada al MUCOR?',
  );
  expect(c2.errorUi).toBeNull();
  expect(datosDe(c2).abstained).toBe(true);
  expect(c2.citasUi).toBe(0);
  const abstencionC2 = [
    FALLBACK_MESSAGE,
    SCHEDULE_ABSTENTION_MESSAGE,
    PRICE_ABSTENTION_MESSAGE,
  ].some((mensaje) => c2.respuestaUi.startsWith(mensaje));
  expect(abstencionC2, `Respuesta observada en C2: «${c2.respuestaUi}»`).toBe(true);

  // C3 — mezcla conocida + desconocida que sí se divide en sub-consultas (la
  // forma con dos «¿…?» activa el particionado). Comportamiento real: si una
  // parte no tiene evidencia propia, la respuesta COMPLETA se abstiene
  // (NO_EVIDENCE) en lugar de responder lo que sí sabe; es el hallazgo
  // expected-vs-actual documentado en el informe.
  const c3 = await hacerPregunta(
    page,
    consultar,
    '¿En qué año se inscribió Coro? ¿Quién pintó la Mona Lisa?',
  );
  expect(c3.errorUi).toBeNull();
  expect(datosDe(c3).abstained).toBe(true);
  expect(datosDe(c3).abstentionReason).toBe('NO_EVIDENCE');
  expect(
    c3.respuestaUi.startsWith(FALLBACK_MESSAGE),
    `Respuesta observada en C3: «${c3.respuestaUi}»`,
  ).toBe(true);
  expect(c3.citasUi).toBe(0);

  // C1b — compuesta que sí se divide y con las dos partes conocidas: una
  // respuesta única con evidencia de cada parte.
  const c1b = await hacerPregunta(
    page,
    consultar,
    '¿En qué año se inscribió Coro y qué es la Casa del Sol?',
  );
  expect(c1b.errorUi).toBeNull();
  expect(datosDe(c1b).abstained).toBe(false);
  expect(fuentesDe(c1b)).toContain('S-002');
  expect(fuentesDe(c1b).some((fuente) => fuente === 'S-020' || fuente === 'S-021')).toBe(true);
  expect(c1b.citasUi).toBeGreaterThanOrEqual(2);
});

test('Caso C3b — la forma «y quién» de la mezcla conocida+desconocida también debe abstenerse', async ({
  page,
}) => {
  const consultar = await prepararGuiaConPerfil(page);

  // Misma mezcla que C3 pero con el conector «y quién»: el usuario espera
  // abstención completa (o la respuesta de la parte conocida), nunca una
  // respuesta ajena a la pregunta.
  const c3b = await hacerPregunta(
    page,
    consultar,
    '¿En qué año se inscribió Coro y quién pintó la Mona Lisa?',
  );
  expect(c3b.errorUi).toBeNull();
  expect(datosDe(c3b).abstained).toBe(true);
  expect(datosDe(c3b).abstentionReason).toBe('NO_EVIDENCE');
  expect(
    c3b.respuestaUi.startsWith(FALLBACK_MESSAGE),
    `Respuesta observada en C3b: «${c3b.respuestaUi}»`,
  ).toBe(true);
  expect(c3b.citasUi).toBe(0);
});
