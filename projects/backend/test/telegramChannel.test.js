import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  'mongodb://127.0.0.1:27018/falconsync_telegram_test?replicaSet=falconsyncTest';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-more-than-32-characters';
process.env.BCRYPT_COST = '10';
process.env.TELEGRAM_ENABLED = 'false';
process.env.RAG_TOURIST_ENABLED = 'false';

const { default: app } = await import('../index.js');
const { connectDB, disconnectDB } = await import('../databases/db.js');
const { InMemoryTransport } = await import(
  '@modelcontextprotocol/sdk/inMemory.js'
);
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { default: Adventure } = await import(
  '../databases/models/Adventure.js'
);
const { default: AdventureStop } = await import(
  '../databases/models/AdventureStop.js'
);
const { default: AuditLog } = await import(
  '../databases/models/AuditLog.js'
);
const { default: ChannelLink } = await import(
  '../databases/models/ChannelLink.js'
);
const { default: ChannelLinkCode } = await import(
  '../databases/models/ChannelLinkCode.js'
);
const { default: DomainEvent } = await import(
  '../databases/models/DomainEvent.js'
);
const { default: Location } = await import(
  '../databases/models/Location.js'
);
const { default: RefreshSession } = await import(
  '../databases/models/RefreshSession.js'
);
const { default: Report } = await import('../databases/models/Report.js');
const { default: TelegramUpdate } = await import(
  '../databases/models/TelegramUpdate.js'
);
const { default: User } = await import('../databases/models/User.js');
const { hashPassword } = await import('../microservices/authService.js');
const {
  createLinkCode,
  redeemLinkCode,
} = await import('../microservices/channelLinkService.js');
const { createMcpServer } = await import('../microservices/mcp/server.js');
const { notifyReportState } = await import(
  '../microservices/telegram/notifications.js'
);

const PASSWORD = 'UsuarioSegura123';

async function clearTestData() {
  await Promise.all([
    User.deleteMany({}),
    RefreshSession.deleteMany({}),
    AuditLog.deleteMany({}),
    ChannelLink.deleteMany({}),
    ChannelLinkCode.deleteMany({}),
    TelegramUpdate.deleteMany({}),
    Report.deleteMany({}),
    Location.deleteMany({}),
    AdventureStop.deleteMany({}),
    Adventure.deleteMany({}),
    DomainEvent.collection.deleteMany({}),
  ]);
}

async function createUser(email = 'telegram@test.local') {
  const username = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 30);

  return User.create({
    name: 'Turista Telegram',
    username,
    email,
    passwordHash: await hashPassword(PASSWORD),
    role: 'user',
    mustChangePassword: false,
  });
}

async function authorizationFor(email) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  return `Bearer ${response.body.data.accessToken}`;
}

async function createPoi() {
  return Location.create({
    title: 'Catedral de Coro',
    slug: 'catedral-de-coro',
    category: 'religious',
    description: 'Basílica Catedral de Santa Ana, en el casco histórico.',
    address: 'Plaza Bolívar, Coro',
    location: {
      type: 'Point',
      coordinates: [-69.6778, 11.4075],
    },
    coordinateVerifiedAt: new Date('2026-11-20T00:00:00.000Z'),
    verificationLevel: 'single-source',
    status: 'published',
    isProvisional: false,
    isCatalogVisible: true,
  });
}

async function createRoute(poi) {
  const adventure = await Adventure.create({
    title: 'Ruta del Casco Histórico de Coro',
    slug: 'ruta-del-casco-historico-de-coro',
    summary: 'Cinco hitos del casco histórico para leer la ciudad colonial.',
    description: 'Recorrido peatonal por el casco histórico de Coro.',
    difficulty: 'easy',
    estimatedMinutes: 120,
    status: 'published',
  });
  await AdventureStop.create({
    adventure: adventure._id,
    location: poi._id,
    order: 1,
    didacticText: 'La catedral preside la Plaza Bolívar.',
    instructions: 'Ubícate frente a la entrada principal.',
  });
  return adventure;
}

async function connectMcp() {
  const server = createMcpServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'telegram-test', version: '1.0.0' });
  await client.connect(clientTransport);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function payloadOf(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
}

describe('Canal de Telegram y MCP', () => {
  before(async () => {
    await connectDB();
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      AuditLog.init(),
      ChannelLink.init(),
      ChannelLinkCode.init(),
      TelegramUpdate.init(),
      Report.init(),
      Location.init(),
      Adventure.init(),
      AdventureStop.init(),
    ]);
  });

  beforeEach(clearTestData);

  after(async () => {
    await clearTestData();
    await disconnectDB();
  });

  it('genera un código de un solo uso, vincula, consulta y revoca', async () => {
    const user = await createUser();
    const authorization = await authorizationFor(user.email);

    const withoutAuth = await request(app).get('/api/channels/telegram');
    assert.equal(withoutAuth.status, 401);

    const created = await request(app)
      .post('/api/channels/telegram/link-code')
      .set('Authorization', authorization);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.data.code, /^[A-HJ-NP-Z2-9]{8}$/);

    const linked = await redeemLinkCode({
      code: created.body.data.code.toLowerCase(),
      externalId: '123456789',
      chatId: '123456789',
    });
    assert.equal(linked.linked, true);
    assert.equal(linked.user.id, user._id.toString());
    assert.equal(linked.user.email, undefined);

    const status = await request(app)
      .get('/api/channels/telegram')
      .set('Authorization', authorization);
    assert.equal(status.status, 200);
    assert.equal(status.body.data.linked, true);
    assert.equal(status.body.data.channel, 'telegram');

    await assert.rejects(
      () =>
        redeemLinkCode({
          code: created.body.data.code,
          externalId: '987654321',
          chatId: '987654321',
        }),
      /no es válido o ya venció/i,
    );

    const unlinked = await request(app)
      .delete('/api/channels/telegram')
      .set('Authorization', authorization);
    assert.equal(unlinked.status, 200);
    assert.equal(unlinked.body.data.linked, false);

    const afterUnlink = await request(app)
      .get('/api/channels/telegram')
      .set('Authorization', authorization);
    assert.equal(afterUnlink.body.data.linked, false);
  });

  it('rechaza un código vencido y evita que un Telegram se vincule a dos cuentas', async () => {
    const first = await createUser('first@telegram.local');
    const second = await createUser('second@telegram.local');
    const expired = await createLinkCode(first._id);
    await ChannelLinkCode.updateOne(
      { user: first._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    await assert.rejects(
      () =>
        redeemLinkCode({
          code: expired.code,
          externalId: '111',
          chatId: '111',
        }),
      /no es válido o ya venció/i,
    );

    const secondCode = await createLinkCode(second._id);
    await redeemLinkCode({
      code: secondCode.code,
      externalId: '111',
      chatId: '111',
    });

    const firstCode = await createLinkCode(first._id);
    await assert.rejects(
      () =>
        redeemLinkCode({
          code: firstCode.code,
          externalId: '111',
          chatId: '111',
        }),
      /ya está vinculado a otra cuenta/i,
    );
  });

  it('expone las herramientas MCP y crea una incidencia idempotente', async () => {
    const user = await createUser();
    const poi = await createPoi();
    await createRoute(poi);
    const code = await createLinkCode(user._id);
    await redeemLinkCode({
      code: code.code,
      externalId: '555',
      chatId: '555',
    });

    const mcp = await connectMcp();

    try {
      const tools = await mcp.client.listTools();
      const names = tools.tools.map((tool) => tool.name).sort();
      assert.deepEqual(names, [
        'buscar_lugar',
        'buscar_lugar_cercano',
        'consultar_guia',
        'consultar_incidencia',
        'consultar_mis_incidencias',
        'crear_incidencia',
        'desvincular_telegram',
        'estado_vinculo',
        'liberar_actualizacion',
        'listar_rutas',
        'obtener_ruta',
        'reclamar_actualizacion',
        'vincular_telegram',
      ]);

      const claimed = payloadOf(
        await mcp.client.callTool({
          name: 'reclamar_actualizacion',
          arguments: { updateId: 123, chatId: '555' },
        }),
      );
      assert.equal(claimed.duplicate, false);
      const duplicateUpdate = payloadOf(
        await mcp.client.callTool({
          name: 'reclamar_actualizacion',
          arguments: { updateId: 123, chatId: '555' },
        }),
      );
      assert.equal(duplicateUpdate.duplicate, true);
      await mcp.client.callTool({
        name: 'liberar_actualizacion',
        arguments: { updateId: 123 },
      });
      const reclaimed = payloadOf(
        await mcp.client.callTool({
          name: 'reclamar_actualizacion',
          arguments: { updateId: 123, chatId: '555' },
        }),
      );
      assert.equal(reclaimed.duplicate, false);

      const search = payloadOf(
        await mcp.client.callTool({
          name: 'buscar_lugar',
          arguments: { texto: 'catedral' },
        }),
      );
      assert.equal(search.lugares.length, 1);
      assert.equal(search.lugares[0].slug, 'catedral-de-coro');

      const routes = payloadOf(
        await mcp.client.callTool({
          name: 'listar_rutas',
          arguments: {},
        }),
      );
      assert.equal(routes.rutas.length, 1);
      assert.equal(routes.rutas[0].stopsCount, 1);

      const route = payloadOf(
        await mcp.client.callTool({
          name: 'obtener_ruta',
          arguments: { slug: routes.rutas[0].slug },
        }),
      );
      assert.equal(route.stops.length, 1);
      assert.match(route.disclaimer, /No es una ruta verificada/i);

      const created = payloadOf(
        await mcp.client.callTool({
          name: 'crear_incidencia',
          arguments: {
            telegramUserId: '555',
            locationSlug: 'catedral-de-coro',
            category: 'cracks',
            description: 'Se observa una grieta en el muro lateral de la catedral.',
            latitude: 11.4075,
            longitude: -69.6778,
            confirm: true,
            idempotencyKey: 'update-1',
          },
        }),
      );
      assert.equal(created.report.sourceChannel, 'telegram');
      assert.equal(created.report.location.slug, 'catedral-de-coro');

      const repeated = payloadOf(
        await mcp.client.callTool({
          name: 'crear_incidencia',
          arguments: {
            telegramUserId: '555',
            locationSlug: 'catedral-de-coro',
            category: 'cracks',
            description: 'Se observa una grieta en el muro lateral de la catedral.',
            latitude: 11.4075,
            longitude: -69.6778,
            confirm: true,
            idempotencyKey: 'update-1',
          },
        }),
      );
      assert.equal(repeated.report.id, created.report.id);
      assert.equal(await Report.countDocuments({}), 1);

      const own = payloadOf(
        await mcp.client.callTool({
          name: 'consultar_mis_incidencias',
          arguments: { telegramUserId: '555' },
        }),
      );
      assert.equal(own.reportes.length, 1);
      assert.equal(own.reportes[0].location.title, 'Catedral de Coro');

      const detail = payloadOf(
        await mcp.client.callTool({
          name: 'consultar_incidencia',
          arguments: {
            telegramUserId: '555',
            reportId: created.report.id,
          },
        }),
      );
      assert.equal(detail.report.id, created.report.id);
      assert.match(detail.report.description, /grieta/i);
      assert.equal(detail.report.state, 'received');

      const missing = await mcp.client.callTool({
        name: 'consultar_incidencia',
        arguments: {
          telegramUserId: '555',
          reportId: '000000000000000000000000',
        },
      });
      assert.equal(missing.isError, true);
      assert.match(missing.content[0].text, /REPORT_NOT_FOUND/);

      const report = await Report.findOne({});
      assert.equal(report.sourceChannel, 'telegram');
      assert.ok(report.sourceActionKey.startsWith('telegram:555:'));
      assert.ok(report.gps.coordinates[0] < 0);
    } finally {
      await mcp.close();
    }
  });

  it('rechaza reportar sin vínculo y no expone la clave de idempotencia por la API', async () => {
    const user = await createUser();
    const poi = await createPoi();
    const authorization = await authorizationFor(user.email);

    const mcp = await connectMcp();
    try {
      const rejected = await mcp.client.callTool({
        name: 'crear_incidencia',
        arguments: {
          telegramUserId: '999',
          locationSlug: poi.slug,
          category: 'moisture',
          description: 'Hay humedad visible en el zócalo de la fachada.',
          confirm: true,
          idempotencyKey: 'update-2',
        },
      });
      assert.equal(rejected.isError, true);
      assert.match(rejected.content[0].text, /NOT_LINKED|vincular/i);
    } finally {
      await mcp.close();
    }

    const code = await createLinkCode(user._id);
    await redeemLinkCode({
      code: code.code,
      externalId: '777',
      chatId: '777',
    });

    const mcpLinked = await connectMcp();
    try {
      const created = payloadOf(
        await mcpLinked.client.callTool({
          name: 'crear_incidencia',
          arguments: {
            telegramUserId: '777',
            locationSlug: poi.slug,
            category: 'moisture',
            description: 'Hay humedad visible en el zócalo de la fachada.',
            confirm: true,
            idempotencyKey: 'update-3',
          },
        }),
      );

      const detail = await request(app)
        .get(`/api/reports/${created.report.id}`)
        .set('Authorization', authorization);
      assert.equal(detail.status, 200, JSON.stringify(detail.body));
      assert.equal(detail.body.data.sourceChannel, 'telegram');
      assert.equal(detail.body.data.sourceActionKey, undefined);
    } finally {
      await mcpLinked.close();
    }
  });

  it('busca lugares cercanos y rechaza una confirmación ausente', async () => {
    const user = await createUser();
    const poi = await createPoi();
    const code = await createLinkCode(user._id);
    await redeemLinkCode({
      code: code.code,
      externalId: '888',
      chatId: '888',
    });

    const mcp = await connectMcp();
    try {
      const nearby = payloadOf(
        await mcp.client.callTool({
          name: 'buscar_lugar_cercano',
          arguments: { latitude: 11.4075, longitude: -69.6778 },
        }),
      );
      assert.equal(nearby.lugares[0].slug, 'catedral-de-coro');
      assert.ok(nearby.lugares[0].distanceMeters < 10);

      const rejected = await mcp.client.callTool({
        name: 'crear_incidencia',
        arguments: {
          telegramUserId: '888',
          locationSlug: poi.slug,
          category: 'other',
          description: 'Descripción suficientemente larga para el reporte.',
          confirm: false,
          idempotencyKey: 'update-4',
        },
      });
      assert.equal(rejected.isError, true);
      assert.equal(await Report.countDocuments({}), 0);
    } finally {
      await mcp.close();
    }
  });

  it('notifica al autor vinculado cuando cambia el estado de su incidencia', async () => {
    const user = await createUser('notify@telegram.local');
    await ChannelLink.create({
      user: user._id,
      channel: 'telegram',
      externalId: '321',
      chatId: '321',
    });

    const calls = [];
    const result = await notifyReportState(
      {
        id: '64b000000000000000000000',
        reporterId: user._id,
        sourceChannel: 'telegram',
        state: 'accepted',
        rejectionReason: null,
      },
      {
        enabled: true,
        token: 'test-token',
        webUrl: 'https://falconsync.test',
        fetchImpl: async (url, options) => {
          calls.push({ url, options });
          return { ok: true, status: 200 };
        },
      },
    );

    assert.equal(result.sent, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /bot.*\/sendMessage$/);
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.chat_id, '321');
    assert.match(body.text, /Aceptado/);
    assert.match(body.text, /falconsync\.test\/reportes\/64b000000000000000000000/);

    const webReport = await notifyReportState(
      {
        id: '64b000000000000000000001',
        reporterId: user._id,
        sourceChannel: 'web',
        state: 'accepted',
      },
      {
        enabled: true,
        token: 'test-token',
        webUrl: 'https://falconsync.test',
        fetchImpl: async () => {
          throw new Error('No debe llamarse para reportes web');
        },
      },
    );
    assert.equal(webReport.sent, false);

    const unlinked = await notifyReportState(
      {
        id: '64b000000000000000000002',
        reporterId: new User()._id,
        sourceChannel: 'telegram',
        state: 'accepted',
      },
      {
        enabled: true,
        token: 'test-token',
        webUrl: 'https://falconsync.test',
        fetchImpl: async () => {
          throw new Error('No debe llamarse sin vínculo');
        },
      },
    );
    assert.equal(unlinked.sent, false);
  });
});
