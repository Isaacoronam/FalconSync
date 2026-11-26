import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export class TelegramToolError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'TelegramToolError';
    this.code = code;
    this.details = details;
  }
}

function childEnvironment() {
  const env = { ...process.env };
  // El servidor MCP no necesita el token del bot ni el secreto del webhook.
  // Se apaga el flag para que env.js no exija TELEGRAM_BOT_TOKEN en el hijo.
  env.TELEGRAM_ENABLED = 'false';
  delete env.TELEGRAM_BOT_TOKEN;
  delete env.TELEGRAM_WEBHOOK_SECRET;
  return env;
}

function parseToolResult(result) {
  const text = result?.content?.find((item) => item.type === 'text')?.text;

  if (!text) {
    throw new TelegramToolError(
      'INVALID_TOOL_RESPONSE',
      'El servidor MCP devolvió una respuesta vacía.',
    );
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new TelegramToolError(
      'INVALID_TOOL_RESPONSE',
      'El servidor MCP devolvió una respuesta ilegible.',
    );
  }

  if (result.isError) {
    const error = payload?.error ?? {};
    throw new TelegramToolError(
      error.code ?? 'TOOL_ERROR',
      error.message ?? 'No se pudo completar la operación.',
      error.details ?? null,
    );
  }

  return payload;
}

export function createMcpClient({
  serverPath = path.join(backendRoot, 'bin', 'mcpServer.js'),
  callTimeoutMs = 30_000,
  logger = console,
} = {}) {
  let client = null;
  let connecting = null;

  async function connect() {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      cwd: backendRoot,
      env: childEnvironment(),
      stderr: 'inherit',
    });
    const next = new Client({
      name: 'falconsync-telegram-bot',
      version: '1.0.0',
    });

    next.onclose = () => {
      client = null;
    };

    await next.connect(transport);
    client = next;
    return client;
  }

  async function ensureConnected() {
    if (client) {
      return client;
    }

    connecting ??= connect().finally(() => {
      connecting = null;
    });

    return connecting;
  }

  return {
    async callTool(name, args) {
      let active;
      try {
        active = await ensureConnected();
      } catch (error) {
        logger.error('[telegram] No se pudo iniciar el servidor MCP:', error);
        throw new TelegramToolError(
          'SERVICE_UNAVAILABLE',
          'La guía no está disponible en este momento. Inténtalo más tarde.',
        );
      }

      try {
        const result = await active.callTool(
          { name, arguments: args },
          undefined,
          { timeout: callTimeoutMs },
        );
        return parseToolResult(result);
      } catch (error) {
        if (error instanceof TelegramToolError) {
          throw error;
        }

        logger.error(`[telegram] Falló la herramienta ${name}:`, error);
        client = null;
        throw new TelegramToolError(
          'SERVICE_UNAVAILABLE',
          'La guía no está disponible en este momento. Inténtalo más tarde.',
        );
      }
    },

    async close() {
      if (!client) {
        return;
      }

      const active = client;
      client = null;
      await active.close().catch(() => {});
    },
  };
}
