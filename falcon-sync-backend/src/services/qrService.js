import QRCode from 'qrcode';
import { HttpError } from '../utils/HttpError.js';

export const QR_FORMATS = ['svg', 'png'];

/**
 * El QR codifica el identificador del POI y el token. El cliente debe enviar
 * ambos a POST /api/check-ins junto con las coordenadas del dispositivo.
 */
export function buildCheckInQrPayload({ locationId, token }) {
  return JSON.stringify({
    type: 'falconsync-check-in',
    locationId: String(locationId),
    token,
  });
}

export async function renderCheckInQr({ locationId, token, format = 'svg' }) {
  if (!QR_FORMATS.includes(format)) {
    throw new HttpError(
      400,
      'INVALID_QR_FORMAT',
      `El formato del QR debe ser uno de: ${QR_FORMATS.join(', ')}`,
    );
  }

  const payload = buildCheckInQrPayload({ locationId, token });

  if (format === 'png') {
    const buffer = await QRCode.toBuffer(payload, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
    });

    return {
      payload,
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    };
  }

  const svg = await QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
  });

  return {
    payload,
    dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
  };
}
