import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../helpers/env.js';
import { HttpError } from '../../helpers/HttpError.js';

export const PANORAMA_FILES = Object.freeze({
  original: 'original.jpg',
  derivative: 'derivative.webp',
  thumbnail: 'thumbnail.webp',
});

const KEY_PATTERN =
  /^[a-f0-9]{24}\/(?:original\.jpg|derivative\.webp|thumbnail\.webp)$/;

function storageRoot() {
  return path.join(config.uploads.privateDir, 'panoramas');
}

function panoramaDirectory(id) {
  return path.join(storageRoot(), String(id));
}

function unavailable() {
  return new HttpError(
    503,
    'PANORAMA_INTEGRITY_ERROR',
    'La imagen de la visita 360° no está disponible temporalmente',
  );
}

export async function savePanoramaFiles(id, content) {
  const directory = panoramaDirectory(id);

  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o750 });
    await Promise.all([
      fs.writeFile(
        path.join(directory, PANORAMA_FILES.original),
        content.original.buffer,
        { mode: 0o640 },
      ),
      fs.writeFile(
        path.join(directory, PANORAMA_FILES.derivative),
        content.derivative.buffer,
        { mode: 0o640 },
      ),
      fs.writeFile(
        path.join(directory, PANORAMA_FILES.thumbnail),
        content.thumbnail.buffer,
        { mode: 0o640 },
      ),
    ]);
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  return {
    imageKey: `${id}/${PANORAMA_FILES.original}`,
    derivativeKey: `${id}/${PANORAMA_FILES.derivative}`,
    thumbnailKey: `${id}/${PANORAMA_FILES.thumbnail}`,
  };
}

export async function readPanoramaFile(key) {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw unavailable();
  }

  const root = storageRoot();
  const resolved = path.resolve(root, key);
  const relative = path.relative(root, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw unavailable();
  }

  try {
    return await fs.readFile(resolved);
  } catch {
    throw unavailable();
  }
}

export async function deletePanoramaFiles(id) {
  await fs.rm(panoramaDirectory(id), { recursive: true, force: true });
}
