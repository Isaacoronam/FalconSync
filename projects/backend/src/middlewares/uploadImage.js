import multer from 'multer';
import { config } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploads.maxImageBytes,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new HttpError(
          400,
          'INVALID_IMAGE_TYPE',
          'Solo se admiten imágenes JPEG, PNG o WebP',
        ),
      );
    }

    callback(null, true);
  },
});

export const uploadImage = upload.single('image');
export const uploadLocationImage = uploadImage;
