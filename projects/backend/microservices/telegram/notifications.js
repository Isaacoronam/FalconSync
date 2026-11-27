import ChannelLink from '../../databases/models/ChannelLink.js';
import { config } from '../../helpers/env.js';
import { stateLabel } from './format.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function notificationText(report, webUrl) {
  const shortId = String(report.id ?? '').slice(-6);
  const lines = [
    `Tu incidencia ${shortId} cambió de estado.`,
    `Nuevo estado: ${stateLabel(report.state)}.`,
  ];

  if (report.rejectionReason) {
    lines.push(`Motivo: ${report.rejectionReason}`);
  }

  lines.push('', `Detalle: ${webUrl}/reportes/${report.id}`);
  return lines.join('\n');
}

/**
 * Avisa al autor de una incidencia creada por Telegram cuando cambia su
 * estado. Es best-effort: un fallo de Telegram nunca revierte la transición.
 */
export async function notifyReportState(
  report,
  {
    enabled = config.telegram.enabled,
    token = config.telegram.botToken,
    webUrl = config.telegram.webUrl,
    fetchImpl = globalThis.fetch,
    apiBase = TELEGRAM_API_BASE,
  } = {},
) {
  if (
    !enabled ||
    !token ||
    !report?.id ||
    !report?.reporterId ||
    report.sourceChannel !== 'telegram'
  ) {
    return { sent: false, reason: 'not_applicable' };
  }

  const link = await ChannelLink.findOne({
    user: report.reporterId,
    channel: 'telegram',
  }).lean();

  if (!link?.chatId) {
    return { sent: false, reason: 'not_linked' };
  }

  const response = await fetchImpl(
    `${apiBase}/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: link.chatId,
        text: notificationText(report, webUrl),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!response?.ok) {
    throw new Error(`Telegram respondió ${response?.status ?? 'sin estado'}`);
  }

  return { sent: true };
}

export function notifyReportStateSafely(report, options) {
  void notifyReportState(report, options).catch((error) => {
    console.error(
      '[telegram] No se pudo notificar el cambio de estado:',
      error.message,
    );
  });
}
