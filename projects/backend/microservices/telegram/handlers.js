import grammy from 'grammy';
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  formatGuideAnswer,
  formatNearbyPois,
  formatReportConfirmation,
  formatReportCreated,
  formatReportDetail,
  formatReportList,
  formatRoute,
  formatRouteList,
  splitText,
} from './format.js';
import { TelegramToolError } from './mcpClient.js';

const { InlineKeyboard, Keyboard } = grammy;

function linkHelp(webUrl) {
  return [
    'Para reportar una incidencia necesitas vincular tu cuenta de FalconSync:',
    `1. Entra a ${webUrl}/perfil y abre la sección Canales.`,
    '2. Pulsa “Vincular Telegram”: puedes abrir el bot con el código o copiarlo.',
    '3. Si lo copias, envíame: /vincular CODIGO',
    '',
    'El código es de un solo uso y vence en pocos minutos.',
  ].join('\n');
}

const PRIVACY_TEXT = [
  'Privacidad:',
  '• Uso tus mensajes para responder y, si lo pides, crear reportes de conservación.',
  '• Telegram procesa los mensajes enviados por este canal.',
  '• FalconSync guarda tu ID de Telegram y el vínculo con tu cuenta; nunca tu contraseña.',
  '• Puedes desvincularte con /desvincular.',
  '• Los reportes siguen el flujo de revisión de conservación de FalconSync.',
].join('\n');

const HELP_TEXT = [
  'Comandos disponibles:',
  '/guia — preguntar sobre Coro y su patrimonio',
  '/rutas — ver recorridos peatonales publicados',
  '/cerca — ver lugares publicados cerca de ti',
  '/reportar — registrar una incidencia patrimonial',
  '/misreportes — consultar tus incidencias',
  '/vincular CODIGO — vincular tu cuenta',
  '/desvincular — revocar el vínculo',
  '/privacidad — información de datos',
  '/cancelar — salir de un reporte en curso',
].join('\n');

function mainMenu() {
  return new InlineKeyboard()
    .text('Guía', 'menu:guia')
    .text('Rutas', 'menu:rutas')
    .row()
    .text('Cerca', 'menu:cerca')
    .text('Reportar', 'menu:reportar')
    .row()
    .text('Mis reportes', 'menu:misreportes')
    .text('Vincular', 'menu:vincular')
    .row()
    .text('Ayuda', 'menu:ayuda');
}

function categoryKeyboard() {
  const keyboard = new InlineKeyboard();

  CATEGORY_OPTIONS.forEach((option, index) => {
    keyboard.text(option.label, `cat:${option.value}`);
    if (index % 2 === 1) {
      keyboard.row();
    }
  });

  return keyboard;
}

function confirmationKeyboard() {
  return new InlineKeyboard()
    .text('Confirmar', 'report:confirm')
    .text('Cancelar', 'report:cancel');
}

function routeKeyboard(routes) {
  const keyboard = new InlineKeyboard();

  routes.slice(0, 5).forEach((route, index) => {
    keyboard.text(route.title.slice(0, 40), `ruta:${index}`).row();
  });

  return keyboard;
}

function poiKeyboard(candidates) {
  const keyboard = new InlineKeyboard();

  candidates.forEach((poi, index) => {
    keyboard.text(poi.title.slice(0, 40), `poi:${index}`).row();
  });

  return keyboard;
}

function reportsKeyboard(result, page) {
  if (!result.reportes?.length) {
    return undefined;
  }

  const keyboard = new InlineKeyboard();
  result.reportes.forEach((report, index) => {
    keyboard.text(`Detalle ${index + 1}`, `rep:${report.id}`).row();
  });
  if (result.meta?.hasMore) {
    keyboard.text('Ver más', `reports:${page + 1}`);
  }

  return keyboard;
}

function isPrivateChat(ctx) {
  return ctx.chat?.type === 'private';
}

function userIdOf(ctx) {
  return ctx.from?.id ? String(ctx.from.id) : null;
}

function chatIdOf(ctx) {
  return ctx.chat?.id ? String(ctx.chat.id) : null;
}

async function replyLong(ctx, text, extra = undefined) {
  const chunks = splitText(text);
  for (let index = 0; index < chunks.length; index += 1) {
    await ctx.reply(chunks[index], index === chunks.length - 1 ? extra : undefined);
  }
}

async function safeAnswerCallback(ctx) {
  await ctx.answerCallbackQuery().catch(() => {});
}

function userFacingError(error, fallback, webUrl) {
  if (error instanceof TelegramToolError) {
    if (error.code === 'NOT_LINKED') {
      return linkHelp(webUrl);
    }
    if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return 'Debes cambiar tu contraseña en FalconSync antes de usar esta función.';
    }
    if (error.code === 'RATE_LIMITED') {
      return error.message;
    }
    if (error.code === 'ASSISTANT_UNAVAILABLE') {
      return 'La guía todavía no está disponible. Inténtalo más tarde.';
    }
    if (error.code === 'POI_NOT_FOUND' || error.code === 'ROUTE_NOT_FOUND') {
      return error.message;
    }

    return error.message;
  }

  return fallback;
}

export function registerHandlers(bot, {
  mcp,
  sessions,
  limiter,
  limits,
  linkCodeTtlMinutes,
  webUrl,
  logger = console,
}) {
  const userError = (error, fallback) => userFacingError(error, fallback, webUrl);

  async function requirePrivate(ctx) {
    if (isPrivateChat(ctx)) {
      return true;
    }

    await ctx.reply('Para proteger tus datos, escríbeme por privado.');
    return false;
  }

  async function linkStatus(ctx) {
    const telegramUserId = userIdOf(ctx);
    if (!telegramUserId) {
      return { linked: false };
    }

    return mcp.callTool('estado_vinculo', { telegramUserId });
  }

  async function ensureLinked(ctx) {
    const status = await linkStatus(ctx);
    if (!status.linked) {
      await replyLong(ctx, linkHelp(webUrl), { reply_markup: mainMenu() });
      return null;
    }

    return status;
  }

  async function handleGuide(ctx, question) {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    const telegramUserId = userIdOf(ctx);
    if (!telegramUserId) {
      return;
    }

    if (!limiter.consume('query', telegramUserId, limits.maxQueriesPerHour, 60 * 60 * 1000)) {
      await ctx.reply(
        `Has hecho demasiadas consultas. Espera un poco o inténtalo de nuevo en una hora.`,
      );
      return;
    }

    try {
      const answer = await mcp.callTool('consultar_guia', { pregunta: question });
      await replyLong(ctx, formatGuideAnswer(answer), {
        reply_markup: answer.answerType === 'greeting' ? mainMenu() : undefined,
      });
    } catch (error) {
      logger.error('[telegram] Error al consultar la guía:', error);
      await ctx.reply(
        userError(error, 'No pude consultar la guía en este momento. Inténtalo más tarde.'),
      );
    }
  }

  async function startReport(ctx) {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    const status = await ensureLinked(ctx);
    if (!status) {
      return;
    }

    sessions.set(chatIdOf(ctx), {
      step: 'awaiting_poi',
      data: {},
    });

    await replyLong(
      ctx,
      [
        'Vamos a registrar una incidencia patrimonial.',
        '',
        'Primero escribe el nombre del lugar. También puedes compartir su ubicación con el clip de Telegram.',
        'Escribe /cancelar para salir.',
      ].join('\n'),
    );
  }

  async function selectPoi(ctx, poi) {
    const chatId = chatIdOf(ctx);
    const session = sessions.update(chatId, {
      step: 'awaiting_category',
      data: {
        locationSlug: poi.slug,
        locationTitle: poi.title,
        candidates: [],
      },
    });

    if (!session) {
      await ctx.reply('La sesión venció. Escribe /reportar para empezar de nuevo.');
      return;
    }

    await ctx.reply(`Lugar: ${poi.title}\n\nElige la categoría:`, {
      reply_markup: categoryKeyboard(),
    });
  }

  async function handlePoiText(ctx, text) {
    try {
      const result = await mcp.callTool('buscar_lugar', {
        texto: text,
        limite: 5,
      });
      const candidates = result.lugares ?? [];

      if (candidates.length === 0) {
        await ctx.reply(
          'No encontré ese lugar entre los publicados. Prueba con otro nombre o comparte su ubicación.',
        );
        return;
      }
      if (candidates.length === 1) {
        await selectPoi(ctx, candidates[0]);
        return;
      }

      sessions.update(chatIdOf(ctx), {
        step: 'awaiting_poi',
        data: { candidates },
      });
      await ctx.reply('Encontré varios lugares. Elige uno:', {
        reply_markup: poiKeyboard(candidates),
      });
    } catch (error) {
      logger.error('[telegram] Error al buscar lugar:', error);
      await ctx.reply(userError(error, 'No pude buscar el lugar. Inténtalo de nuevo.'));
    }
  }

  async function handleNearby(ctx, latitude, longitude) {
    try {
      const result = await mcp.callTool('buscar_lugar_cercano', {
        latitude,
        longitude,
        limite: 3,
      });
      const candidates = result.lugares ?? [];

      if (candidates.length === 0) {
        await ctx.reply(
          'No encontré lugares publicados a menos de 2 km. Escribe el nombre del lugar.',
        );
        return;
      }

      sessions.update(chatIdOf(ctx), {
        step: 'awaiting_poi',
        data: {
          candidates,
          locationLatitude: latitude,
          locationLongitude: longitude,
        },
      });

      if (candidates.length === 1) {
        await selectPoi(ctx, candidates[0]);
        return;
      }

      await ctx.reply('Estos lugares están cerca. Elige uno:', {
        reply_markup: poiKeyboard(candidates),
      });
    } catch (error) {
      logger.error('[telegram] Error al buscar lugares cercanos:', error);
      await ctx.reply(
        userError(error, 'No pude buscar lugares cercanos. Escribe el nombre del lugar.'),
      );
    }
  }

  async function askNearby(ctx) {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    await ctx.reply(
      'Comparte tu ubicación y te muestro los lugares publicados a menos de 2 km.',
      {
        reply_markup: new Keyboard()
          .requestLocation('Compartir ubicación')
          .resized()
          .oneTime(),
      },
    );
  }

  async function showNearby(ctx, latitude, longitude) {
    try {
      const result = await mcp.callTool('buscar_lugar_cercano', {
        latitude,
        longitude,
        limite: 5,
      });
      await ctx.reply(formatNearbyPois(result.lugares ?? [], webUrl), {
        reply_markup: { remove_keyboard: true },
      });
    } catch (error) {
      logger.error('[telegram] Error al buscar lugares cercanos:', error);
      await ctx.reply(
        userError(error, 'No pude buscar lugares cercanos. Inténtalo de nuevo.'),
      );
    }
  }

  async function handleCategory(ctx, category) {
    const option = CATEGORY_OPTIONS.find((item) => item.value === category);
    if (!option) {
      await ctx.reply('Esa categoría no es válida. Escribe /reportar para empezar de nuevo.');
      return;
    }

    const session = sessions.update(chatIdOf(ctx), {
      step: 'awaiting_description',
      data: { category: option.value },
    });
    if (!session) {
      await ctx.reply('La sesión venció. Escribe /reportar para empezar de nuevo.');
      return;
    }

    await ctx.reply(
      `Categoría: ${option.label}\n\nDescribe lo que observas (entre 10 y 2000 caracteres).`,
    );
  }

  async function handleDescription(ctx, text) {
    const description = text.trim();

    if (description.length < 10 || description.length > 2000) {
      await ctx.reply('La descripción debe tener entre 10 y 2000 caracteres. Inténtalo de nuevo.');
      return;
    }

    const session = sessions.update(chatIdOf(ctx), {
      step: 'awaiting_location',
      data: { description },
    });
    if (!session) {
      await ctx.reply('La sesión venció. Escribe /reportar para empezar de nuevo.');
      return;
    }

    const keyboard = new Keyboard()
      .requestLocation('Compartir ubicación')
      .text('Omitir ubicación')
      .resized()
      .oneTime();

    await ctx.reply(
      'Descripción guardada. Comparte la ubicación del lugar o pulsa “Omitir ubicación”.',
      { reply_markup: keyboard },
    );
  }

  async function sendConfirmation(ctx) {
    const session = sessions.get(chatIdOf(ctx));
    if (!session || session.step !== 'awaiting_confirmation') {
      await ctx.reply('La sesión venció. Escribe /reportar para empezar de nuevo.');
      return;
    }

    await ctx.reply(formatReportConfirmation(session.data), {
      reply_markup: confirmationKeyboard(),
    });
  }

  async function handleLocationInWizard(ctx, latitude, longitude) {
    const session = sessions.get(chatIdOf(ctx));
    if (!session) {
      await showNearby(ctx, latitude, longitude);
      return;
    }

    if (session.step === 'awaiting_poi') {
      await handleNearby(ctx, latitude, longitude);
      return;
    }

    if (session.step !== 'awaiting_location') {
      await ctx.reply('Todavía no necesito la ubicación. Sigue las instrucciones del reporte.');
      return;
    }

    sessions.update(chatIdOf(ctx), {
      step: 'awaiting_confirmation',
      data: {
        locationLatitude: latitude,
        locationLongitude: longitude,
      },
    });

    await ctx.reply('Ubicación recibida.', {
      reply_markup: { remove_keyboard: true },
    });
    await sendConfirmation(ctx);
  }

  async function confirmReport(ctx) {
    const chatId = chatIdOf(ctx);
    const session = sessions.get(chatId);

    if (!session || session.step !== 'awaiting_confirmation') {
      await ctx.reply('No hay un reporte pendiente. Escribe /reportar para empezar.');
      return;
    }

    const telegramUserId = userIdOf(ctx);
    if (!telegramUserId) {
      return;
    }
    if (!limiter.consume('report', telegramUserId, limits.maxReportsPerDay, 24 * 60 * 60 * 1000)) {
      await ctx.reply(
        'Has alcanzado el límite de reportes desde Telegram en las últimas 24 horas.',
      );
      return;
    }

    try {
      const result = await mcp.callTool('crear_incidencia', {
        telegramUserId,
        locationSlug: session.data.locationSlug,
        category: session.data.category,
        description: session.data.description,
        latitude: session.data.locationLatitude,
        longitude: session.data.locationLongitude,
        confirm: true,
        idempotencyKey: String(ctx.update.update_id),
      });

      sessions.clear(chatId);
      await ctx.reply(formatReportCreated(result), {
        reply_markup: { remove_keyboard: true },
      });
    } catch (error) {
      logger.error('[telegram] Error al crear incidencia:', error);
      await ctx.reply(
        userError(error, 'No pude registrar la incidencia. Inténtalo de nuevo o escribe /cancelar.'),
      );
    }
  }

  async function cancelReport(ctx) {
    sessions.clear(chatIdOf(ctx));
    await ctx.reply('Reporte cancelado.', {
      reply_markup: { remove_keyboard: true },
    });
  }

  async function listReports(ctx, page = 1) {
    const status = await ensureLinked(ctx);
    if (!status) {
      return;
    }

    try {
      const result = await mcp.callTool('consultar_mis_incidencias', {
        telegramUserId: userIdOf(ctx),
        page,
        limit: 5,
      });
      await replyLong(ctx, formatReportList(result), {
        reply_markup: reportsKeyboard(result, page),
      });
    } catch (error) {
      logger.error('[telegram] Error al listar incidencias:', error);
      await ctx.reply(userError(error, 'No pude consultar tus incidencias.'));
    }
  }

  async function showReport(ctx, reportId) {
    const status = await ensureLinked(ctx);
    if (!status) {
      return;
    }

    try {
      const result = await mcp.callTool('consultar_incidencia', {
        telegramUserId: userIdOf(ctx),
        reportId,
      });
      await replyLong(ctx, formatReportDetail(result, webUrl));
    } catch (error) {
      logger.error('[telegram] Error al consultar incidencia:', error);
      await ctx.reply(userError(error, 'No pude consultar esa incidencia.'));
    }
  }

  async function listRoutes(ctx) {
    try {
      const result = await mcp.callTool('listar_rutas', {});
      const routes = result.rutas ?? [];

      if (routes.length === 0) {
        await ctx.reply('No hay recorridos publicados en este momento.');
        return;
      }

      await ctx.reply(formatRouteList(routes), {
        reply_markup: routeKeyboard(routes),
      });
    } catch (error) {
      logger.error('[telegram] Error al listar rutas:', error);
      await ctx.reply(userError(error, 'No pude consultar los recorridos.'));
    }
  }

  async function showRoute(ctx, index) {
    try {
      const list = await mcp.callTool('listar_rutas', {});
      const route = list.rutas?.[index];

      if (!route) {
        await ctx.reply('Ese recorrido ya no está disponible. Usa /rutas para ver la lista.');
        return;
      }

      const detail = await mcp.callTool('obtener_ruta', { slug: route.slug });
      await replyLong(ctx, formatRoute(detail));
    } catch (error) {
      logger.error('[telegram] Error al obtener ruta:', error);
      await ctx.reply(userError(error, 'No pude consultar el recorrido.'));
    }
  }

  async function linkAccount(ctx) {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    const code = (ctx.match ?? '').trim();
    if (!code) {
      await replyLong(
        ctx,
        [
          'Para vincular tu cuenta:',
          `1. Entra a ${webUrl}/perfil y abre la sección Canales.`,
          '2. Pulsa “Vincular Telegram”: puedes abrir el bot con el código o copiarlo.',
          `3. Si lo copias, envíame: /vincular CODIGO`,
          '',
          `El código vence en ${linkCodeTtlMinutes} minutos.`,
        ].join('\n'),
      );
      return;
    }

    const telegramUserId = userIdOf(ctx);
    if (
      !limiter.consume('link', telegramUserId, 10, 60 * 60 * 1000)
    ) {
      await ctx.reply(
        'Has intentado vincular demasiadas veces. Espera una hora o genera un código nuevo desde tu perfil.',
      );
      return;
    }

    try {
      const result = await mcp.callTool('vincular_telegram', {
        codigo: code,
        telegramUserId,
        chatId: chatIdOf(ctx),
      });
      await ctx.reply(
        `Listo, ${result.user?.name ?? 'explorador'}. Tu Telegram quedó vinculado a FalconSync. Ya puedes usar /reportar y /misreportes.`,
        { reply_markup: mainMenu() },
      );
    } catch (error) {
      logger.error('[telegram] Error al vincular cuenta:', error);
      await ctx.reply(userError(error, 'No pude vincular la cuenta. Verifica el código.'));
    }
  }

  async function askUnlink(ctx) {
    const status = await ensureLinked(ctx);
    if (!status) {
      return;
    }

    await ctx.reply(
      '¿Seguro que quieres desvincular tu Telegram? Podrás volver a vincularlo con un código nuevo.',
      {
        reply_markup: new InlineKeyboard()
          .text('Sí, desvincular', 'unlink:yes')
          .text('Cancelar', 'unlink:no'),
      },
    );
  }

  async function unlinkAccount(ctx) {
    try {
      await mcp.callTool('desvincular_telegram', {
        telegramUserId: userIdOf(ctx),
      });
      await ctx.reply('Tu Telegram quedó desvinculado.', {
        reply_markup: mainMenu(),
      });
    } catch (error) {
      logger.error('[telegram] Error al desvincular:', error);
      await ctx.reply(userError(error, 'No pude desvincular la cuenta.'));
    }
  }

  async function handleStart(ctx) {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    // Deep link del perfil web: https://t.me/<bot>?start=<codigo>
    if ((ctx.match ?? '').trim()) {
      await linkAccount(ctx);
      return;
    }

    let greeting = 'Hola, soy Chivito, tu guía patrimonial de Coro.';
    try {
      const status = await linkStatus(ctx);
      if (status.linked) {
        greeting += `\n\nQué bueno verte de nuevo, ${status.user?.name ?? 'explorador'}.`;
      }
    } catch (error) {
      logger.error('[telegram] Error al consultar el vínculo:', error);
    }

    await ctx.reply(
      [
        greeting,
        '',
        'Puedo contarte sobre la ciudad, sus lugares y su arquitectura; mostrarte recorridos publicados y registrar incidencias patrimoniales si vinculas tu cuenta.',
        '',
        HELP_TEXT,
      ].join('\n'),
      { reply_markup: mainMenu() },
    );
  }

  // Deduplica reintentos de Telegram. Si el servidor MCP no responde, el
  // mensaje sigue su curso y las escrituras conservan su propia idempotencia.
  bot.use(async (ctx, next) => {
    const updateId = ctx.update?.update_id;
    if (!updateId) {
      return next();
    }

    let claim;
    try {
      claim = await mcp.callTool('reclamar_actualizacion', {
        updateId,
        chatId: chatIdOf(ctx) ?? '',
      });
    } catch (error) {
      logger.error('[telegram] No se pudo reclamar la actualización:', error);
      return next();
    }

    if (claim.duplicate) {
      if (ctx.callbackQuery) {
        await safeAnswerCallback(ctx);
      }
      return;
    }

    try {
      await next();
    } catch (error) {
      await mcp
        .callTool('liberar_actualizacion', { updateId })
        .catch((releaseError) =>
          logger.error('[telegram] No se pudo liberar la actualización:', releaseError),
        );
      throw error;
    }
  });

  bot.command('start', handleStart);
  bot.command('ayuda', handleStart);
  bot.command('guia', async (ctx) => {
    await ctx.reply('Escríbeme tu pregunta sobre Coro y su patrimonio.');
  });
  bot.command('rutas', listRoutes);
  bot.command('cerca', askNearby);
  bot.command('reportar', startReport);
  bot.command('misreportes', (ctx) => listReports(ctx, 1));
  bot.command('vincular', linkAccount);
  bot.command('desvincular', askUnlink);
  bot.command('cancelar', cancelReport);
  bot.command('privacidad', async (ctx) => replyLong(ctx, PRIVACY_TEXT));

  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await safeAnswerCallback(ctx);

    if (data === 'menu:guia') {
      await ctx.reply('Escríbeme tu pregunta sobre Coro y su patrimonio.');
      return;
    }
    if (data === 'menu:rutas') {
      await listRoutes(ctx);
      return;
    }
    if (data === 'menu:cerca') {
      await askNearby(ctx);
      return;
    }
    if (data === 'menu:reportar') {
      await startReport(ctx);
      return;
    }
    if (data === 'menu:misreportes') {
      await listReports(ctx, 1);
      return;
    }
    if (data === 'menu:vincular') {
      await linkAccount(ctx);
      return;
    }
    if (data === 'menu:ayuda') {
      await handleStart(ctx);
      return;
    }

    const routeMatch = /^ruta:(\d+)$/.exec(data);
    if (routeMatch) {
      await showRoute(ctx, Number(routeMatch[1]));
      return;
    }

    const reportMatch = /^rep:([a-f0-9]{24})$/i.exec(data);
    if (reportMatch) {
      await showReport(ctx, reportMatch[1]);
      return;
    }

    const reportsMatch = /^reports:(\d+)$/.exec(data);
    if (reportsMatch) {
      await listReports(ctx, Number(reportsMatch[1]));
      return;
    }

    const poiMatch = /^poi:(\d+)$/.exec(data);
    if (poiMatch) {
      const session = sessions.get(chatIdOf(ctx));
      const poi = session?.data?.candidates?.[Number(poiMatch[1])];
      if (!poi) {
        await ctx.reply('Esa opción ya venció. Escribe el nombre del lugar de nuevo.');
        return;
      }
      await selectPoi(ctx, poi);
      return;
    }

    const categoryMatch = /^cat:(.+)$/.exec(data);
    if (categoryMatch) {
      await handleCategory(ctx, categoryMatch[1]);
      return;
    }

    if (data === 'report:confirm') {
      await confirmReport(ctx);
      return;
    }
    if (data === 'report:cancel') {
      await cancelReport(ctx);
      return;
    }
    if (data === 'unlink:yes') {
      await unlinkAccount(ctx);
      return;
    }
    if (data === 'unlink:no') {
      await ctx.reply('El vínculo se mantiene.');
    }
  });

  bot.on('message:location', async (ctx) => {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    const location = ctx.message.location;
    await handleLocationInWizard(ctx, location.latitude, location.longitude);
  });

  bot.on('message:photo', async (ctx) => {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    await ctx.reply(
      'Las fotos para incidencias estarán disponibles próximamente. Por ahora puedo registrar el reporte con texto y ubicación.',
    );
  });

  bot.on('message:text', async (ctx) => {
    if (!(await requirePrivate(ctx))) {
      return;
    }

    const text = ctx.message.text;
    if (text.startsWith('/')) {
      await ctx.reply('No reconozco ese comando. Usa /ayuda para ver las opciones disponibles.');
      return;
    }

    const session = sessions.get(chatIdOf(ctx));

    if (session?.step === 'awaiting_poi') {
      await handlePoiText(ctx, text);
      return;
    }
    if (session?.step === 'awaiting_description') {
      await handleDescription(ctx, text);
      return;
    }
    if (session?.step === 'awaiting_location') {
      if (/^omitir(?: ubicaci[oó]n)?$/i.test(text.trim())) {
        sessions.update(chatIdOf(ctx), {
          step: 'awaiting_confirmation',
          data: {
            locationLatitude: undefined,
            locationLongitude: undefined,
          },
        });
        await ctx.reply('Continuamos sin ubicación.', {
          reply_markup: { remove_keyboard: true },
        });
        await sendConfirmation(ctx);
        return;
      }

      await ctx.reply(
        'Comparte tu ubicación con el botón o escribe “Omitir ubicación” para continuar sin ella.',
      );
      return;
    }
    if (session?.step === 'awaiting_confirmation') {
      await ctx.reply('Usa los botones Confirmar o Cancelar del mensaje anterior.');
      return;
    }

    await handleGuide(ctx, text);
  });

  return {
    // Exportadas para pruebas de los flujos sin red de Telegram.
    handleStart,
    handleGuide,
    startReport,
    handlePoiText,
    handleCategory,
    handleDescription,
    confirmReport,
    listReports,
    showReport,
    showNearby,
    listRoutes,
  };
}
