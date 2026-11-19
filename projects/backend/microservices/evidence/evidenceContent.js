import sharp from 'sharp';
import { HttpError } from '../../helpers/HttpError.js';
import { readExifHints } from './exif.js';

const MAX_PIXELS = 40_000_000;

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

export function detectEvidenceMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }

  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (buffer.subarray(0, 5).equals(PDF_SIGNATURE)) {
    return 'application/pdf';
  }

  return null;
}

function invalidContent(message = 'El archivo no contiene una imagen válida') {
  return new HttpError(422, 'INVALID_EVIDENCE_CONTENT', message);
}

function normalizeHintDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }

  if (value.getTime() > Date.now() + 5 * 60_000) {
    return null;
  }

  return value;
}

function normalizeHints(hints) {
  if (!hints) {
    return null;
  }

  const capturedAt = normalizeHintDate(hints.capturedAt);
  const gps =
    hints.gps &&
    Number.isFinite(hints.gps.latitude) &&
    Number.isFinite(hints.gps.longitude) &&
    hints.gps.latitude >= -90 &&
    hints.gps.latitude <= 90 &&
    hints.gps.longitude >= -180 &&
    hints.gps.longitude <= 180
      ? hints.gps
      : null;

  if (!capturedAt && !gps) {
    return null;
  }

  return { capturedAt, gps };
}

/**
 * Verifica la firma, decodifica el contenido, extrae pistas EXIF y vuelve a
 * codificar imágenes sin metadatos. Los PDF se aceptan con validación básica.
 */
export async function processEvidenceContent(buffer, declaredMime) {
  const detectedMime = detectEvidenceMime(buffer);

  if (!detectedMime) {
    throw new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'La evidencia debe ser JPEG, PNG, WebP o PDF',
    );
  }

  if (
    declaredMime &&
    declaredMime !== 'application/octet-stream' &&
    declaredMime !== detectedMime
  ) {
    throw new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'El tipo declarado no coincide con el contenido del archivo',
    );
  }

  if (detectedMime === 'application/pdf') {
    if (!buffer.includes(Buffer.from('%%EOF', 'ascii'))) {
      throw invalidContent('El PDF está incompleto o no es válido');
    }

    return {
      buffer,
      mimeType: detectedMime,
      bytes: buffer.length,
      width: null,
      height: null,
      exifStripped: true,
      hints: null,
    };
  }

  let metadata;
  try {
    metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_PIXELS,
    }).metadata();
  } catch {
    throw invalidContent();
  }

  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
    throw invalidContent('La imagen no tiene dimensiones válidas o es animada');
  }

  const hints = normalizeHints(readExifHints(metadata.exif));

  let pipeline = sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_PIXELS,
  }).rotate();

  if (detectedMime === 'image/jpeg') {
    pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  } else if (detectedMime === 'image/png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.webp({ quality: 90 });
  }

  let output;
  try {
    output = await pipeline.toBuffer({ resolveWithObject: true });
  } catch {
    throw invalidContent();
  }

  if (!output.info.width || !output.info.height) {
    throw invalidContent();
  }

  return {
    buffer: output.data,
    mimeType: detectedMime,
    bytes: output.data.length,
    width: output.info.width,
    height: output.info.height,
    exifStripped: true,
    hints,
  };
}
