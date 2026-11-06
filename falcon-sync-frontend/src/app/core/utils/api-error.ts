import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'No se pudo conectar con la API. Verifica tu conexión e inténtalo de nuevo.';
  }

  const body = error.error as
    | { error?: { message?: unknown; details?: unknown } }
    | undefined;
  const details = body?.error?.details;

  if (Array.isArray(details) && details.length > 0) {
    return details.filter((item): item is string => typeof item === 'string').join('. ');
  }

  const message = body?.error?.message;

  return typeof message === 'string' ? message : fallback;
}
