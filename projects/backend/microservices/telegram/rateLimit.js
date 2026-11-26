export class RateLimiter {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.buckets = new Map();
  }

  consume(bucket, key, limit, windowMs) {
    const now = this.now();
    const bucketKey = `${bucket}:${key}`;
    const events = (this.buckets.get(bucketKey) ?? []).filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (events.length >= limit) {
      this.buckets.set(bucketKey, events);
      return false;
    }

    events.push(now);
    this.buckets.set(bucketKey, events);
    return true;
  }

  cleanup(windowMs = 24 * 60 * 60 * 1000) {
    const now = this.now();
    for (const [key, events] of this.buckets) {
      const recent = events.filter((timestamp) => now - timestamp < windowMs);
      if (recent.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, recent);
      }
    }
  }
}
