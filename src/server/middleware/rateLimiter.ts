/**
 * Sliding window rate limiter.
 * Uses Redis when available for cross-restart persistence,
 * falling back to in-memory tracking for single-process deployments.
 */

import { redisService } from '../services/RedisService';

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
   * Async rate-limit check that uses Redis when connected, falling back
   * to the synchronous in-memory `check` method when Redis is unavailable.
   *
   * Callers that can await should prefer this method for cross-restart
   * consistency.
   */
  async checkAsync(
    key: string,
    limit: number,
    windowMs: number = 60000,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (!redisService.isConnected()) {
      return this.check(key, limit, windowMs);
    }

    const redisKey = `rl:${key}`;
    const windowSec = Math.ceil(windowMs / 1000);

    const count = await redisService.incr(redisKey);
    if (count === 1) {
      await redisService.expire(redisKey, windowSec);
    }

    const ttl = await redisService.ttl(redisKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return { allowed, remaining, resetAt };
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
