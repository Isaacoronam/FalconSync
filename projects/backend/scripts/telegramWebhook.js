import grammy from 'grammy';
import { config } from '../helpers/env.js';

const { Bot } = grammy;

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

const action = process.argv[2];
const allowed = new Set(['set', 'delete', 'commands']);

if (!allowed.has(action)) {
  console.error('Uso: node scripts/telegramWebhook.js <set|delete|commands>');
  process.exit(1);
}

if (!config.telegram.enabled || !config.telegram.botToken) {
  console.error(
    'TELEGRAM_ENABLED=true y TELEGRAM_BOT_TOKEN son obligatorios para esta operación.',
  );
  process.exit(1);
}

const bot = new Bot(config.telegram.botToken);

try {
  if (action === 'commands') {
    await bot.api.setMyCommands(COMMANDS);
    console.log('Comandos de Telegram registrados.');
  } else if (action === 'delete') {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log('Webhook eliminado. El bot puede usar polling.');
  } else {
    if (!config.telegram.webhookUrl || !config.telegram.webhookSecret) {
      console.error(
        'TELEGRAM_WEBHOOK_URL y TELEGRAM_WEBHOOK_SECRET son obligatorios para set.',
      );
      process.exit(1);
    }
    await bot.api.setWebhook(config.telegram.webhookUrl, {
      secret_token: config.telegram.webhookSecret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
    console.log(
      `Webhook registrado en ${config.telegram.webhookUrl} (secreto configurado).`,
    );
  }
} catch (error) {
  console.error(
    `[FalconSync Telegram] Falló ${action}:`,
    error.description ?? error.message,
  );
  process.exit(1);
}
