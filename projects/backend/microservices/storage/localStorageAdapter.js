import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../helpers/env.js';
import { HttpError } from '../../helpers/HttpError.js';

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const EVIDENCE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ALLOWED_FOLDERS = new Set([
  'locations',
  'avatars',
  'check-ins',
  'evidence',
]);
const ALLOWED_EVIDENCE_EXTENSIONS = new Set(Object.values(EVIDENCE_EXTENSIONS));
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/;

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

function resolveInsideRoot(root, relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, absolutePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new HttpError(
      400,
      'INVALID_IMAGE_PATH',
      'La ruta de la imagen no es válida',
    );
  }

  return absolutePath;
}

function rootForFolder(folder) {
  return folder === 'locations'
    ? config.uploads.dir
    : config.uploads.privateDir;
}

function normalizeFolder(folder) {
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new HttpError(
      400,
      'INVALID_IMAGE_FOLDER',
      'El destino de la imagen no es válido',
    );
  }

  return folder;
}

export const localStorageAdapter = {
  /**
   * Guarda una imagen validada y devuelve sus metadatos. El archivo queda
   * fuera del prefijo público: solo se sirve mediante endpoints autenticados
   * cuando corresponde a un avatar o a una foto de check-in.
   */
  async saveImage({ buffer, folder }) {
    const mimeType = detectImageMime(buffer);

    if (!mimeType) {
      throw new HttpError(
        400,
        'INVALID_IMAGE',
        'La imagen debe ser JPEG, PNG o WebP y tener contenido válido',
      );
    }

    const destination = normalizeFolder(folder);
    const directory = resolveInsideRoot(rootForFolder(destination), destination);
    await mkdir(directory, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`;
    await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });

    return {
      filename,
      folder: destination,
      mimeType,
      size: buffer.length,
    };
  },

  async saveLocationImage({ buffer }) {
    const image = await this.saveImage({ buffer, folder: 'locations' });

    return {
      ...image,
      url: `${config.uploads.publicPrefix}/locations/${image.filename}`,
    };
  },

  resolveImagePath(folder, filename) {
    const destination = normalizeFolder(folder);

    if (typeof filename !== 'string' || !SAFE_FILENAME_PATTERN.test(filename)) {
      throw new HttpError(
        400,
        'INVALID_IMAGE_PATH',
        'La ruta de la imagen no es válida',
      );
    }

    return resolveInsideRoot(
      rootForFolder(destination),
      `${destination}/${filename}`,
    );
  },

  async removeByFilename(folder, filename) {
    const absolutePath = this.resolveImagePath(folder, filename);

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

  /**
   * Guarda un binario de evidencia en el almacenamiento privado. La clave
   * devuelta es interna y nunca se expone como URL pública.
   */
  async saveEvidence({ buffer, mimeType }) {
    const extension = EVIDENCE_EXTENSIONS[mimeType];

    if (!extension || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new HttpError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'El tipo de evidencia no está permitido',
      );
    }

    const directory = resolveInsideRoot(config.uploads.privateDir, 'evidence');
    await mkdir(directory, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });

    return {
      storageKey: `evidence/${filename}`,
      filename,
      bytes: buffer.length,
    };
  },

  resolveEvidencePath(storageKey) {
    if (
      typeof storageKey !== 'string' ||
      !/^evidence\/[A-Za-z0-9._-]+$/.test(storageKey)
    ) {
      throw new HttpError(
        400,
        'INVALID_EVIDENCE_PATH',
        'La ruta de la evidencia no es válida',
      );
    }

    const filename = storageKey.slice('evidence/'.length);

    if (
      !SAFE_FILENAME_PATTERN.test(filename) ||
      !ALLOWED_EVIDENCE_EXTENSIONS.has(path.extname(filename).slice(1))
    ) {
      throw new HttpError(
        400,
        'INVALID_EVIDENCE_PATH',
        'La ruta de la evidencia no es válida',
      );
    }

    return resolveInsideRoot(config.uploads.privateDir, storageKey);
  },

  async readEvidence(storageKey) {
    return readFile(this.resolveEvidencePath(storageKey));
  },

  async removeEvidence(storageKey) {
    const absolutePath = this.resolveEvidencePath(storageKey);

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

  async removeByUrl(url) {
    const prefix = `${config.uploads.publicPrefix}/`;

    if (typeof url !== 'string' || !url.startsWith(prefix)) {
      return false;
    }

    const relativePath = url.slice(prefix.length);
    const absolutePath = resolveInsideRoot(config.uploads.dir, relativePath);

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
