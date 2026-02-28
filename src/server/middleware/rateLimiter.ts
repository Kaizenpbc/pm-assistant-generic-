/**
 * Simple in-memory sliding window rate limiter.
 * No Redis dependency — suitable for single-process deployments.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private windows: Map<string, WindowEntry>;

  constructor() {
    this.windows = new Map();
  }

  /**
   * Check whether a request identified by `key` is allowed under the given
   * `limit` within a rolling window of `windowMs` milliseconds.
   *
   * Returns the current allowance state so callers can set rate-limit headers.
   */
  check(
    key: string,
    limit: number,
    windowMs: number = 60000,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.windows.get(key);

    // No existing window, or the window has expired — start a fresh one.
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    // Window still active — increment and compare.
    entry.count += 1;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);
    return { allowed, remaining, resetAt: entry.resetAt };
  }

  /**
   * Remove expired entries from the map.
   * Call this periodically to prevent unbounded memory growth.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Prune expired windows every 60 seconds.
const cleanupInterval = setInterval(() => {
  rateLimiter.cleanup();
}, 60_000);

// Allow the Node process to exit gracefully without the timer keeping it alive.
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
