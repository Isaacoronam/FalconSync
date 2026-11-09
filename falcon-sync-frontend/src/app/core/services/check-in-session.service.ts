import { Injectable } from '@angular/core';

interface StoredCheckInToken {
  token: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000;

/**
 * Guarda el token del QR solo en memoria. No se escribe en la URL, en
 * sessionStorage ni en localStorage: una recarga completa obliga a escanear
 * o pegar el token de nuevo.
 */
@Injectable({
  providedIn: 'root',
})
export class CheckInSessionService {
  private readonly tokens = new Map<string, StoredCheckInToken>();

  set(locationId: string, token: string, ttlMs = DEFAULT_TTL_MS): void {
    if (!locationId || !token) {
      return;
    }

    this.tokens.set(locationId, {
      token,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(locationId: string): string | null {
    const entry = this.tokens.get(locationId);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.tokens.delete(locationId);
      return null;
    }

    return entry.token;
  }

  has(locationId: string): boolean {
    return this.get(locationId) !== null;
  }

  consume(locationId: string): string | null {
    const token = this.get(locationId);
    this.tokens.delete(locationId);
    return token;
  }

  clear(locationId?: string): void {
    if (locationId) {
      this.tokens.delete(locationId);
      return;
    }

    this.tokens.clear();
  }
}
