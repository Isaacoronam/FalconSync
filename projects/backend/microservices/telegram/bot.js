import grammy from 'grammy';
import { registerHandlers } from './handlers.js';
import { RateLimiter } from './rateLimit.js';
import { ReportSessionStore } from './session.js';

const { Bot } = grammy;

export function createTelegramBot({
  token,
  mcp,
  limits,
  linkCodeTtlMinutes,
  webUrl,
  logger = console,
}) {
  const bot = new Bot(token);
  const sessions = new ReportSessionStore();
  const limiter = new RateLimiter();

  registerHandlers(bot, {
    mcp,
    sessions,
    limiter,
    limits,
    linkCodeTtlMinutes,
    webUrl,
    logger,
  });

  bot.catch(async (error) => {
    const detail = error?.error?.description ?? error?.error?.message ?? error?.message ?? String(error);
    logger.error('[telegram] Error no controlado:', detail);

    try {
      await error.ctx.reply(
        'No pude procesar ese mensaje. Inténtalo de nuevo o escribe /ayuda.',
      );
    } catch {
      // Si Telegram tampoco responde, no hay nada más que hacer.
    }
  });

  function cleanup() {
    sessions.cleanup();
    limiter.cleanup();
  }

  return { bot, sessions, limiter, cleanup };
}
