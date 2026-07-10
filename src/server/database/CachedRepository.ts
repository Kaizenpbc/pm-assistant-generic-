import { redisService } from '../services/RedisService';
import logger from '../utils/logger';

interface CacheOptions {
  prefix: string;       // Redis key prefix, e.g. 'cache:project'
  ttlSeconds: number;   // Cache TTL, e.g. 300 (5 minutes)
}

export class CachedRepository<T> {
  constructor(
    private readonly delegate: { findById(id: string): Promise<T | null> },
    private readonly options: CacheOptions,
  ) {}

  async findById(id: string): Promise<T | null> {
    const cacheKey = `${this.options.prefix}:${id}`;

    // Try cache first
    if (redisService.isConnected()) {
      const cached = await redisService.get(cacheKey);
      if (cached !== null) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          // Corrupted cache entry — fall through to DB
        }
      }
    }

    // Cache miss — query DB
    const result = await this.delegate.findById(id);

    // Store in cache (fire-and-forget)
    if (result !== null && redisService.isConnected()) {
      redisService.set(cacheKey, JSON.stringify(result), this.options.ttlSeconds).catch(() => {});
    }

    return result;
  }

  async invalidate(id: string): Promise<void> {
    const cacheKey = `${this.options.prefix}:${id}`;
    await redisService.del(cacheKey);
  }

  async invalidateAll(): Promise<void> {
    // For simplicity, we don't scan keys. Individual invalidation on write is sufficient.
    // If needed later, can use Redis SCAN with prefix pattern.
  }
}
