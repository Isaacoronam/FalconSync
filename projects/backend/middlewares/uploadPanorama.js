import multer from 'multer';
import { config } from '../helpers/env.js';
import { HttpError } from '../helpers/HttpError.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.panoramas.maxBytes,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new HttpError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'La panorámica debe ser una imagen JPEG, PNG o WebP',
        ),
      );
    }

    callback(null, true);
  },
});

export function uploadPanoramaImage(request, response, next) {
  upload.single('image')(request, response, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(
        new HttpError(
          413,
          'PANORAMA_TOO_LARGE',
          'La panorámica supera el tamaño máximo permitido',
        ),
      );
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(
        new HttpError(
          400,
          'INVALID_UPLOAD',
          'La panorámica debe enviarse en el campo image',
        ),
      );
    }

    next(error);
  });
}
