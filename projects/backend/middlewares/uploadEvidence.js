import multer from 'multer';
import { config } from '../helpers/env.js';
import { HttpError } from '../helpers/HttpError.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.evidence.maxBytes,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new HttpError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'La evidencia debe ser JPEG, PNG, WebP o PDF',
        ),
      );
    }

    callback(null, true);
  },
});

export function uploadEvidenceFile(request, response, next) {
  upload.single('file')(request, response, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(
        new HttpError(
          413,
          'EVIDENCE_TOO_LARGE',
          'La evidencia supera el tamaño máximo permitido',
        ),
      );
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(
        new HttpError(
          400,
          'INVALID_UPLOAD',
          'El archivo debe enviarse en el campo file',
        ),
      );
    }

    next(error);
  });
}
