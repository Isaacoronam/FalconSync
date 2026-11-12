import { localStorageAdapter } from './localStorageAdapter.js';

/**
 * Adaptador de almacenamiento activo.
 *
 * Contrato esperado:
 * - saveLocationImage({ buffer }) => { url, filename, mimeType, size }
 * - removeByUrl(url) => boolean
 *
 * Para migrar a almacenamiento de objetos se reemplaza esta exportación por
 * otra implementación del mismo contrato.
 */
export const storageAdapter = localStorageAdapter;
