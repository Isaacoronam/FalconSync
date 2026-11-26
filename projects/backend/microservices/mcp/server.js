import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DAMAGE_CATEGORIES } from '../../databases/models/Report.js';
import { HttpError } from '../../helpers/HttpError.js';
import {
  buscarLugar,
  buscarLugarCercano,
  consultarGuia,
  consultarIncidencia,
  consultarMisIncidencias,
  crearIncidencia,
  desvincularTelegram,
  estadoVinculo,
  listarRutas,
  obtenerRuta,
  reclamarActualizacion,
  liberarActualizacion,
  vincularTelegram,
} from './tools.js';

const SERVER_NAME = 'falconsync-telegram';
const SERVER_VERSION = '1.0.0';

function ok(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

function fail(error) {
  if (error instanceof HttpError) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: {
              code: error.code,
              message: error.message,
              status: error.statusCode,
              details: error.details,
            },
          }),
        },
      ],
    };
  }

  console.error('[mcp] Error no controlado:', error);
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'No se pudo completar la operación.',
          },
        }),
      },
    ],
  };
}

function tool(handler) {
  return async (args) => {
    try {
      return ok(await handler(args));
    } catch (error) {
      return fail(error);
    }
  };
}

const telegramUserId = z.string().trim().min(1).max(64);

export function createMcpServer() {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    'consultar_guia',
    {
      title: 'Consultar la guía patrimonial',
      description:
        'Responde una pregunta turística sobre Coro con evidencia citada y abstención honesta.',
      inputSchema: {
        pregunta: z.string().trim().min(2).max(2000),
        contextLocationId: z.string().trim().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(consultarGuia),
  );

  server.registerTool(
    'buscar_lugar',
    {
      title: 'Buscar un lugar publicado',
      description: 'Busca puntos de interés publicados por nombre o dirección.',
      inputSchema: {
        texto: z.string().trim().min(2).max(120),
        limite: z.number().int().min(1).max(5).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(buscarLugar),
  );

  server.registerTool(
    'buscar_lugar_cercano',
    {
      title: 'Buscar lugares cercanos',
      description:
        'Devuelve puntos de interés publicados a menos de 2 km de una coordenada.',
      inputSchema: {
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        limite: z.number().int().min(1).max(5).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(buscarLugarCercano),
  );

  server.registerTool(
    'listar_rutas',
    {
      title: 'Listar recorridos peatonales',
      description:
        'Lista los recorridos publicados con su resumen, dificultad y número de paradas.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(listarRutas),
  );

  server.registerTool(
    'obtener_ruta',
    {
      title: 'Obtener un recorrido',
      description:
        'Devuelve las paradas ordenadas de un recorrido publicado, con coordenadas y aviso de alcance.',
      inputSchema: {
        slug: z.string().trim().min(1).max(140),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(obtenerRuta),
  );

  server.registerTool(
    'reclamar_actualizacion',
    {
      title: 'Reclamar una actualización de Telegram',
      description:
        'Registra un update_id para deduplicar reintentos. Solo lo invoca el bot.',
      inputSchema: {
        updateId: z.number().int().positive(),
        chatId: z.string().trim().max(64).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    tool(reclamarActualizacion),
  );

  server.registerTool(
    'liberar_actualizacion',
    {
      title: 'Liberar una actualización de Telegram',
      description:
        'Libera un update_id cuyo procesamiento falló para permitir el reintento. Solo lo invoca el bot.',
      inputSchema: {
        updateId: z.number().int().positive(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    tool(liberarActualizacion),
  );

  server.registerTool(
    'estado_vinculo',
    {
      title: 'Consultar el vínculo de Telegram',
      description:
        'Indica si el usuario de Telegram está vinculado a una cuenta de FalconSync.',
      inputSchema: { telegramUserId },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(estadoVinculo),
  );

  server.registerTool(
    'vincular_telegram',
    {
      title: 'Vincular Telegram',
      description:
        'Canjea un código de un solo uso generado desde el perfil web. Solo lo invoca el bot.',
      inputSchema: {
        codigo: z.string().trim().min(1).max(16),
        telegramUserId,
        chatId: z.string().trim().min(1).max(64),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    tool(vincularTelegram),
  );

  server.registerTool(
    'desvincular_telegram',
    {
      title: 'Desvincular Telegram',
      description: 'Elimina el vínculo activo entre Telegram y FalconSync.',
      inputSchema: { telegramUserId },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    tool(desvincularTelegram),
  );

  server.registerTool(
    'crear_incidencia',
    {
      title: 'Crear una incidencia patrimonial',
      description:
        'Crea un reporte de conservación para un POI publicado. Exige confirmación explícita y una clave de idempotencia.',
      inputSchema: {
        telegramUserId,
        locationSlug: z.string().trim().min(1).max(140).optional(),
        locationId: z.string().trim().min(1).max(64).optional(),
        category: z.enum(DAMAGE_CATEGORIES),
        description: z.string().trim().min(10).max(2000),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        accuracyMeters: z.number().min(0).max(10000).optional(),
        confirm: z.literal(true),
        idempotencyKey: z.string().trim().min(1).max(100),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    tool(crearIncidencia),
  );

  server.registerTool(
    'consultar_mis_incidencias',
    {
      title: 'Consultar mis incidencias',
      description:
        'Devuelve los reportes de conservación creados por la cuenta vinculada.',
      inputSchema: {
        telegramUserId,
        page: z.number().int().min(1).max(1000).optional(),
        limit: z.number().int().min(1).max(10).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(consultarMisIncidencias),
  );

  server.registerTool(
    'consultar_incidencia',
    {
      title: 'Consultar una incidencia propia',
      description:
        'Devuelve el detalle de una incidencia creada por la cuenta vinculada.',
      inputSchema: {
        telegramUserId,
        reportId: z.string().trim().min(1).max(64),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(consultarIncidencia),
  );

  return server;
}

export const MCP_SERVER_NAME = SERVER_NAME;
