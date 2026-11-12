export interface CheckInQrPayload {
  locationId: string;
  token: string;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LOCATION_ID_PATTERN = /^[a-f0-9]{24}$/i;
const CHECK_IN_PATH = 'checkin';

function normalizePayload(
  locationId: unknown,
  token: unknown,
): CheckInQrPayload | null {
  if (
    typeof locationId !== 'string' ||
    !LOCATION_ID_PATTERN.test(locationId) ||
    typeof token !== 'string' ||
    !TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  return { locationId, token };
}

function payloadFromJson(raw: string): CheckInQrPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (
      record['type'] !== undefined &&
      record['type'] !== 'falconsync-check-in'
    ) {
      return null;
    }

    return normalizePayload(
      record['locationId'] ?? record['location_id'] ?? record['id'],
      record['token'],
    );
  } catch {
    return null;
  }
}

function readHashToken(hash: string): string | null {
  const value = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!value) {
    return null;
  }

  if (TOKEN_PATTERN.test(value)) {
    return value;
  }

  const params = new URLSearchParams(value);
  const token = params.get('t') ?? params.get('token');

  return token && TOKEN_PATTERN.test(token) ? token : null;
}

function payloadFromUrl(raw: string): CheckInQrPayload | null {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const allowedProtocols = new Set([
    'http:',
    'https:',
    'falconsync:',
  ]);

  if (!allowedProtocols.has(url.protocol)) {
    return null;
  }

  let locationId: string | null = null;
  let segments: string[];

  try {
    segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }

  if (url.protocol === 'falconsync:' && url.hostname === CHECK_IN_PATH) {
    locationId = segments[0] ?? null;
  } else {
    const checkInIndex = segments.indexOf(CHECK_IN_PATH);

    if (checkInIndex >= 0) {
      locationId = segments[checkInIndex + 1] ?? null;
    }
  }

  if (!locationId || !LOCATION_ID_PATTERN.test(locationId)) {
    return null;
  }

  const token =
    readHashToken(url.hash) ??
    url.searchParams.get('token') ??
    url.searchParams.get('t');

  return normalizePayload(locationId, token);
}

function payloadFromQueryString(raw: string): CheckInQrPayload | null {
  try {
    const params = new URLSearchParams(raw);
    return normalizePayload(
      params.get('locationId') ?? params.get('location_id'),
      params.get('token'),
    );
  } catch {
    return null;
  }
}

/**
 * Acepta el JSON del QR actual, URLs de check-in con token en el fragmento o
 * en la consulta, y una cadena de consulta suelta. Nunca acepta URLs
 * arbitrarias: el destino debe ser una ruta /checkin/:locationId.
 */
export function parseCheckInQr(raw: string): CheckInQrPayload | null {
  const value = raw.trim();

  if (!value) {
    return null;
  }

  if (value.startsWith('{')) {
    return payloadFromJson(value);
  }

  if (value.startsWith('?')) {
    return payloadFromQueryString(value);
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return payloadFromUrl(value);
  }

  if (value.startsWith('/')) {
    return payloadFromUrl(`https://falconsync.local${value}`);
  }

  return payloadFromQueryString(value);
}
