import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { config } from '../../helpers/env.js';
import { HttpError } from '../../helpers/HttpError.js';
import { detectEvidenceMime } from '../evidence/evidenceContent.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function invalid(message, code = 'INVALID_PANORAMA_CONTENT') {
  return new HttpError(422, code, message);
}

/**
 * Valida una panorámica equirectangular, genera un original normalizado sin
 * metadatos y dos derivados WebP: escena completa y miniatura. Devuelve los
 * buffers y checksums; no toca el disco.
 */
export async function processPanoramaContent(buffer, declaredMime) {
  const detectedMime = detectEvidenceMime(buffer);

  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
    throw new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'La panorámica debe ser una imagen JPEG, PNG o WebP válida',
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
      'El tipo declarado no coincide con el contenido de la imagen',
    );
  }

  let metadata;

  try {
    metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: config.panoramas.maxPixels,
    }).metadata();
  } catch {
    throw invalid('La imagen no se pudo decodificar');
  }

  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
    throw invalid('La imagen no tiene dimensiones válidas o es animada');
  }

  const ratio = metadata.width / metadata.height;

  if (Math.abs(ratio - 2) > 0.02) {
    throw invalid(
      'La panorámica debe ser equirectangular y mantener una relación 2:1',
    );
  }

  if (metadata.width < config.panoramas.minWidth) {
    throw invalid(
      `La panorámica debe tener al menos ${config.panoramas.minWidth} píxeles de ancho`,
    );
  }

  let original;
  let derivative;
  let thumbnail;

  try {
    original = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: config.panoramas.maxPixels,
    })
      .rotate()
      .flatten({ background: '#000000' })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw invalid('La imagen no se pudo normalizar');
  }

  const derivativeWidth =
    Math.min(config.panoramas.derivativeWidth, metadata.width) -
    (Math.min(config.panoramas.derivativeWidth, metadata.width) % 2);

  try {
    derivative = await sharp(original.data, {
      failOn: 'error',
      limitInputPixels: config.panoramas.maxPixels,
    })
      .resize(derivativeWidth, derivativeWidth / 2, { fit: 'fill' })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    thumbnail = await sharp(original.data, {
      failOn: 'error',
      limitInputPixels: config.panoramas.maxPixels,
    })
      .resize(config.panoramas.thumbnailWidth, config.panoramas.thumbnailWidth / 2, {
        fit: 'fill',
      })
      .webp({ quality: 75, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw invalid('No se pudieron generar los derivados de la panorámica');
  }

  if (!derivative.info.width || !derivative.info.height) {
    throw invalid('El derivado público no tiene dimensiones válidas');
  }

  return {
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    original: {
      buffer: original.data,
      bytes: original.data.length,
      checksum: sha256(original.data),
    },
    derivative: {
      buffer: derivative.data,
      bytes: derivative.data.length,
      checksum: sha256(derivative.data),
      width: derivative.info.width,
      height: derivative.info.height,
    },
    thumbnail: {
      buffer: thumbnail.data,
      bytes: thumbnail.data.length,
      checksum: sha256(thumbnail.data),
      width: thumbnail.info.width,
      height: thumbnail.info.height,
    },
  };
}
