export function notFoundHandler(_request, response) {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado',
    },
  });
}

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  if (error.name === 'ValidationError') {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos',
        details: Object.values(error.errors).map((item) => item.message),
      },
    });
  }

  if (error.name === 'CastError') {
    return response.status(400).json({
      error: {
        code: 'INVALID_IDENTIFIER',
        message: 'El identificador enviado no es válido',
      },
    });
  }

  if (error.code === 11000) {
    return response.status(409).json({
      error: {
        code: 'DUPLICATE_KEY',
        message: 'Ya existe un registro con ese valor único',
      },
    });
  }

  console.error('[FalconSync] Error no controlado:', error);

  return response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
    },
  });
}
