import express from 'express';
import grammy from 'grammy';
import { config } from '../helpers/env.js';
import { createMcpClient } from '../microservices/telegram/mcpClient.js';
import { createTelegramBot } from '../microservices/telegram/bot.js';

const { webhookCallback } = grammy;

const COMMANDS = [
  { command: 'start', description: 'Iniciar la guía' },
  { command: 'guia', description: 'Preguntar sobre Coro' },
  { command: 'rutas', description: 'Ver recorridos peatonales' },
  { command: 'cerca', description: 'Ver lugares cerca de mí' },
  { command: 'reportar', description: 'Registrar una incidencia' },
  { command: 'misreportes', description: 'Consultar mis incidencias' },
  { command: 'vincular', description: 'Vincular mi cuenta' },
  { command: 'desvincular', description: 'Desvincular mi cuenta' },
  { command: 'privacidad', description: 'Información de privacidad' },
  { command: 'ayuda', description: 'Ver comandos' },
  { command: 'cancelar', description: 'Cancelar un reporte' },
];

if (!config.telegram.enabled) {
  console.error(
    '[FalconSync Telegram] TELEGRAM_ENABLED=false. Actívalo en .env cuando quieras iniciar el bot.',
  );
  process.exit(1);
}

const mcp = createMcpClient();
const { bot, cleanup } = createTelegramBot({
  token: config.telegram.botToken,
  mcp,
  limits: {
    maxQueriesPerHour: config.telegram.maxQueriesPerHour,
    maxReportsPerDay: config.telegram.maxReportsPerDay,
  },
  linkCodeTtlMinutes: config.telegram.linkCodeTtlMinutes,
  webUrl: config.telegram.webUrl,
});

let server = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[FalconSync Telegram] Cerrando por ${signal}...`);

  try {
    await bot.stop();
  } catch {
    // El bot pudo no haber arrancado todavía.
  }
  await mcp.close();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

async function main() {
  await bot.init();
  await bot.api
    .setMyCommands(COMMANDS)
    .catch((error) => console.error('[FalconSync Telegram] No se pudieron registrar los comandos:', error.description ?? error.message));

  const maintenance = setInterval(cleanup, 5 * 60 * 1000);
  maintenance.unref();

  if (config.telegram.mode === 'webhook') {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post(
      config.telegram.webhookPath,
      webhookCallback(bot, 'express', {
        secretToken: config.telegram.webhookSecret,
        timeoutMilliseconds: 25_000,
        onTimeout: 'return',
      }),
    );

    server = app.listen(config.telegram.webhookPort, '127.0.0.1', () => {
      console.log(
        `[FalconSync Telegram] Webhook local en http://127.0.0.1:${config.telegram.webhookPort}${config.telegram.webhookPath}`,
      );
    });
    server.on('error', (error) => {
      console.error('[FalconSync Telegram] Error del servidor webhook:', error.message);
      process.exit(1);
    });

    await bot.api.setWebhook(config.telegram.webhookUrl, {
      secret_token: config.telegram.webhookSecret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
    console.log(
      `[FalconSync Telegram] Bot @${bot.botInfo.username} en modo webhook.`,
    );
    return;
  }

  // En polling no debe quedar un webhook activo: Telegram rechaza getUpdates.
  await bot.api
    .deleteWebhook({ drop_pending_updates: false })
    .catch((error) => console.error('[FalconSync Telegram] No se pudo limpiar el webhook:', error.description ?? error.message));

  console.log(
    `[FalconSync Telegram] Bot @${bot.botInfo.username} en modo polling.`,
  );
  await bot.start({
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
}

main().catch(async (error) => {
  console.error(
    '[FalconSync Telegram] No se pudo iniciar el bot:',
    error?.description ?? error?.message ?? String(error),
  );
  await mcp.close();
  process.exit(1);
});
