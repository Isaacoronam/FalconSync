const DEFAULT_TTL_MS = 15 * 60 * 1000;

export class ReportSessionStore {
  constructor({ ttlMs = DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.sessions = new Map();
  }

  get(chatId) {
    const key = String(chatId);
    const session = this.sessions.get(key);

    if (!session) {
      return null;
    }
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(key);
      return null;
    }

    return session;
  }

  set(chatId, session) {
    this.sessions.set(String(chatId), {
      ...session,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  update(chatId, patch) {
    const current = this.get(chatId);
    if (!current) {
      return null;
    }

    const next = {
      ...current,
      ...patch,
      data: { ...current.data, ...(patch.data ?? {}) },
      expiresAt: this.now() + this.ttlMs,
    };
    this.sessions.set(String(chatId), next);
    return next;
  }

  clear(chatId) {
    this.sessions.delete(String(chatId));
  }

  cleanup() {
    const now = this.now();
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(key);
      }
    }
  }
}
