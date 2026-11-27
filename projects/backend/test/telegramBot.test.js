import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATEGORY_LABELS,
  formatNearbyPois,
  formatReportConfirmation,
  formatReportCreated,
  formatReportDetail,
  formatReportList,
  formatRoute,
  formatRouteList,
  splitText,
} from '../microservices/telegram/format.js';
import { registerHandlers } from '../microservices/telegram/handlers.js';
import { RateLimiter } from '../microservices/telegram/rateLimit.js';
import { ReportSessionStore } from '../microservices/telegram/session.js';

describe('Formato y estado del bot de Telegram', () => {
  it('parte mensajes largos sin perder contenido ni superar el límite', () => {
    const paragraph = 'Una frase de prueba sobre el patrimonio de Coro. ';
    const text = paragraph.repeat(200);
    const chunks = splitText(text, 500);

    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 500);
      assert.ok(chunk.length > 0);
    }
    assert.equal(
      chunks.join(' ').replace(/\s+/g, ' ').trim(),
      text.replace(/\s+/g, ' ').trim(),
    );
  });

  it('incluye el aviso de alcance y las paradas del recorrido', () => {
    const text = formatRoute({
      title: 'Ruta del Casco Histórico',
      summary: 'Cinco hitos para leer la ciudad.',
      difficulty: 'easy',
      estimatedMinutes: 120,
      disclaimer: 'No es una ruta verificada paso a paso.',
      stops: [
        {
          order: 1,
          title: 'Catedral de Coro',
          address: 'Plaza Bolívar',
          mapUrl: 'https://www.openstreetmap.org/?mlat=11.4&mlon=-69.6',
          instructions: 'Ubícate frente a la entrada.',
        },
      ],
    });

    assert.match(text, /No es una ruta verificada paso a paso/);
    assert.match(text, /1\. Catedral de Coro/);
    assert.match(text, /openstreetmap/);
  });

  it('formatea la confirmación con latitud cero sin perder la ubicación', () => {
    const text = formatReportConfirmation({
      locationTitle: 'Catedral de Coro',
      category: 'cracks',
      description: 'Grieta visible en el muro lateral.',
      locationLatitude: 0,
      locationLongitude: -69.6,
    });

    assert.match(text, /Ubicación compartida \(0\.00000, -69\.60000\)/);
    assert.match(text, new RegExp(CATEGORY_LABELS.cracks));
  });

  it('formatea el reporte creado y la lista de recorridos', () => {
    const created = formatReportCreated({
      report: {
        id: 'report-1',
        state: 'received',
        category: 'moisture',
        location: { title: 'Catedral de Coro', slug: 'catedral-de-coro' },
      },
      nextStep: 'Quedó en revisión.',
    });
    assert.match(created, /report-1/);
    assert.match(created, /Recibido/);

    const list = formatRouteList([
      {
        title: 'Ruta del Casco Histórico',
        stopsCount: 5,
        estimatedMinutes: 120,
        difficulty: 'easy',
      },
    ]);
    assert.match(list, /5 paradas/);
    assert.match(list, /Fácil/);
  });

  it('formatea el detalle de una incidencia, los lugares cercanos y la paginación', () => {
    const detail = formatReportDetail(
      {
        report: {
          id: '64b000000000000000000000',
          category: 'cracks',
          state: 'accepted',
          description: 'Grieta visible en el muro lateral.',
          createdAt: '2026-11-25T12:00:00.000Z',
          gps: { type: 'Point', coordinates: [-69.6778, 11.4075] },
          location: { title: 'Catedral de Coro', slug: 'catedral-de-coro' },
          rejectionReason: null,
        },
      },
      'https://falconsync.test',
    );
    assert.match(detail, /Catedral de Coro/);
    assert.match(detail, /Aceptado/);
    assert.match(detail, /falconsync\.test\/reportes\/64b/);
    assert.match(detail, /GPS: 11\.4075, -69\.6778/);

    const nearby = formatNearbyPois(
      [
        {
          title: 'Catedral de Coro',
          slug: 'catedral-de-coro',
          address: 'Plaza Bolívar',
          distanceMeters: 25,
        },
      ],
      'https://falconsync.test',
    );
    assert.match(nearby, /a 25 m/);
    assert.match(nearby, /falconsync\.test\/lugares\/catedral-de-coro/);

    const page = formatReportList({
      reportes: [
        {
          id: 'report-1',
          category: 'moisture',
          state: 'received',
          createdAt: '2026-11-25T12:00:00.000Z',
          location: { title: 'Catedral de Coro', slug: 'catedral-de-coro' },
        },
      ],
      meta: { page: 2, total: 7, hasMore: true },
    });
    assert.match(page, /página 2/);
    assert.match(page, /de 7/);
  });

  it('canjea el código del deep link al recibir /start CODIGO', async () => {
    const calls = [];
    const replies = [];
    const handlers = registerHandlers(
      {
        command: () => {},
        on: () => {},
        use: () => {},
      },
      {
        mcp: {
          callTool: async (name, args) => {
            calls.push({ name, args });
            return {
              linked: true,
              user: { name: 'Turista' },
            };
          },
        },
        sessions: new ReportSessionStore(),
        limiter: new RateLimiter(),
        limits: { maxQueriesPerHour: 20, maxReportsPerDay: 3 },
        linkCodeTtlMinutes: 10,
        webUrl: 'https://falconsync.test',
      },
    );

    await handlers.handleStart({
      match: 'ABCD2345',
      chat: { id: 123, type: 'private' },
      from: { id: 123 },
      reply: async (text, extra) => {
        replies.push({ text, extra });
      },
    });

    assert.deepEqual(calls, [
      {
        name: 'vincular_telegram',
        args: {
          codigo: 'ABCD2345',
          telegramUserId: '123',
          chatId: '123',
        },
      },
    ]);
    assert.match(replies[0].text, /quedó vinculado/i);
  });

  it('devuelve los lugares cercanos y retira el teclado de ubicación', async () => {
    // Regresión: grammY no expone ReplyKeyboardRemove como clase; el teclado
    // se retira con el objeto { remove_keyboard: true }.

    const replies = [];
    const handlers = registerHandlers(
      {
        command: () => {},
        on: () => {},
        use: () => {},
      },
      {
        mcp: {
          callTool: async (name, args) => {
            assert.equal(name, 'buscar_lugar_cercano');
            assert.deepEqual(args, {
              latitude: 11.4,
              longitude: -69.6,
              limite: 5,
            });
            return {
              lugares: [
                {
                  title: 'Catedral de Coro',
                  slug: 'catedral-de-coro',
                  address: 'Plaza Bolívar',
                  distanceMeters: 25,
                },
              ],
            };
          },
        },
        sessions: new ReportSessionStore(),
        limiter: new RateLimiter(),
        limits: { maxQueriesPerHour: 20, maxReportsPerDay: 3 },
        linkCodeTtlMinutes: 10,
        webUrl: 'https://falconsync.test',
      },
    );

    await handlers.showNearby(
      {
        chat: { id: 123, type: 'private' },
        from: { id: 123 },
        reply: async (text, extra) => {
          replies.push({ text, extra });
        },
      },
      11.4,
      -69.6,
    );

    assert.match(replies[0].text, /Catedral de Coro/);
    assert.match(replies[0].text, /a 25 m/);
    assert.deepEqual(replies[0].extra, {
      reply_markup: { remove_keyboard: true },
    });
  });

  it('expira sesiones y limpia los contadores de rate limit', () => {
    let now = 1_000;
    const sessions = new ReportSessionStore({
      ttlMs: 100,
      now: () => now,
    });

    sessions.set('chat-1', { step: 'awaiting_poi', data: {} });
    assert.equal(sessions.get('chat-1').step, 'awaiting_poi');

    now += 101;
    assert.equal(sessions.get('chat-1'), null);

    const limiter = new RateLimiter({ now: () => now });
    assert.equal(limiter.consume('query', 'user-1', 2, 1000), true);
    assert.equal(limiter.consume('query', 'user-1', 2, 1000), true);
    assert.equal(limiter.consume('query', 'user-1', 2, 1000), false);

    now += 1001;
    assert.equal(limiter.consume('query', 'user-1', 2, 1000), true);
  });
});
