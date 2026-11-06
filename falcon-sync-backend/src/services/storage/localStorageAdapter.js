import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/env.js';
import { HttpError } from '../../utils/HttpError.js';

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function resolveInsideUploads(relativePath) {
  const absolutePath = path.resolve(config.uploads.dir, relativePath);
  const relativeToUploads = path.relative(config.uploads.dir, absolutePath);

  if (relativeToUploads.startsWith('..') || path.isAbsolute(relativeToUploads)) {
    throw new HttpError(
      400,
      'INVALID_IMAGE_PATH',
      'La ruta de la imagen no es válida',
    );
  }

  return absolutePath;
}

export const localStorageAdapter = {
  /**
   * Guarda una imagen validada y devuelve su URL pública.
   * La interfaz es intencionalmente mínima para poder sustituir el adaptador
   * local por uno de objetos (S3, R2, etc.) sin tocar los controladores.
   */
  async saveLocationImage({ buffer }) {
    const mimeType = detectImageMime(buffer);

    if (!mimeType) {
      throw new HttpError(
        400,
        'INVALID_IMAGE',
        'La imagen debe ser JPEG, PNG o WebP y tener contenido válido',
      );
    }

    const directory = resolveInsideUploads('locations');
    await mkdir(directory, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`;
    await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });

    return {
      url: `${config.uploads.publicPrefix}/locations/${filename}`,
      filename,
      mimeType,
      size: buffer.length,
    };
  },

  async removeByUrl(url) {
    const prefix = `${config.uploads.publicPrefix}/`;

    if (typeof url !== 'string' || !url.startsWith(prefix)) {
      return false;
    }

    const relativePath = url.slice(prefix.length);
    const absolutePath = resolveInsideUploads(relativePath);

    try {
      await unlink(absolutePath);
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  },
};
