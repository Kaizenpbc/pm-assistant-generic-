import { redisService } from './RedisService';

export interface MetricsSnapshot {
  uptimeSeconds: number;
  requests: {
    total: number;
    byMethod: Record<string, number>;
    byStatusBucket: Record<string, number>;
    activeRequests: number;
  };
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  errors: {
    total4xx: number;
    total5xx: number;
  };
  ai: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalRequests: number;
  };
  db: {
    totalQueries: number;
  };
}

class MetricsService {
  private requestCount = 0;
  private methodCounts: Record<string, number> = {};
  private statusBucketCounts: Record<string, number> = {};
  private activeRequests = 0;
  private error4xx = 0;
  private error5xx = 0;
  private aiInputTokens = 0;
  private aiOutputTokens = 0;
  private aiRequests = 0;
  private dbQueryCount = 0;
  private durations: number[] = [];
  private startTime = Date.now();
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  private static readonly MAX_DURATIONS = 10000;
  private static readonly REDIS_KEY = 'metrics:snapshot';
  private static readonly REDIS_TOTAL_KEY = 'metrics:total_requests';
  private static readonly SYNC_INTERVAL_MS = 30_000;
  private static readonly REDIS_TTL = 86400;

  incrementActiveRequests(): void {
    this.activeRequests++;
  }

  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  recordRequest(method: string, _path: string, statusCode: number, durationMs: number): void {
    this.requestCount++;
    this.methodCounts[method] = (this.methodCounts[method] || 0) + 1;

    const bucket = `${Math.floor(statusCode / 100)}xx`;
    this.statusBucketCounts[bucket] = (this.statusBucketCounts[bucket] || 0) + 1;

    if (statusCode >= 400 && statusCode < 500) this.error4xx++;
    if (statusCode >= 500) this.error5xx++;

    this.durations.push(durationMs);
    if (this.durations.length > MetricsService.MAX_DURATIONS) {
      this.durations = this.durations.slice(-MetricsService.MAX_DURATIONS);
    }

    if (redisService.isConnected()) {
      redisService.incrby(MetricsService.REDIS_TOTAL_KEY, 1).catch(() => {});
    }
  }

  recordAIUsage(inputTokens: number, outputTokens: number): void {
    this.aiInputTokens += inputTokens;
    this.aiOutputTokens += outputTokens;
    this.aiRequests++;
  }

  incrementDbQueries(): void {
    this.dbQueryCount++;
  }

  startRedisSync(): void {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      if (!redisService.isConnected()) return;
      const counters = {
        requestCount: this.requestCount,
        methodCounts: this.methodCounts,
        statusBucketCounts: this.statusBucketCounts,
        error4xx: this.error4xx,
        error5xx: this.error5xx,
        aiInputTokens: this.aiInputTokens,
        aiOutputTokens: this.aiOutputTokens,
        aiRequests: this.aiRequests,
        dbQueryCount: this.dbQueryCount,
      };
      redisService
        .set(MetricsService.REDIS_KEY, JSON.stringify(counters), MetricsService.REDIS_TTL)
        .catch(() => {});
    }, MetricsService.SYNC_INTERVAL_MS);
  }

  stopRedisSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async loadFromRedis(): Promise<void> {
    if (!redisService.isConnected()) return;
    const raw = await redisService.get(MetricsService.REDIS_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      this.requestCount = data.requestCount ?? 0;
      this.methodCounts = data.methodCounts ?? {};
      this.statusBucketCounts = data.statusBucketCounts ?? {};
      this.error4xx = data.error4xx ?? 0;
      this.error5xx = data.error5xx ?? 0;
      this.aiInputTokens = data.aiInputTokens ?? 0;
      this.aiOutputTokens = data.aiOutputTokens ?? 0;
      this.aiRequests = data.aiRequests ?? 0;
      this.dbQueryCount = data.dbQueryCount ?? 0;
    } catch {
      // Corrupted snapshot — start fresh
    }
  }

  getSnapshot(): MetricsSnapshot {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const percentile = (p: number): number => {
      if (sorted.length === 0) return 0;
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    };

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      requests: {
        total: this.requestCount,
        byMethod: { ...this.methodCounts },
        byStatusBucket: { ...this.statusBucketCounts },
        activeRequests: this.activeRequests,
      },
      latency: {
        p50Ms: Math.round(percentile(50)),
        p95Ms: Math.round(percentile(95)),
        p99Ms: Math.round(percentile(99)),
      },
      errors: {
        total4xx: this.error4xx,
        total5xx: this.error5xx,
      },
      ai: {
        totalInputTokens: this.aiInputTokens,
        totalOutputTokens: this.aiOutputTokens,
        totalRequests: this.aiRequests,
      },
      db: {
        totalQueries: this.dbQueryCount,
      },
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.methodCounts = {};
    this.statusBucketCounts = {};
    this.activeRequests = 0;
    this.error4xx = 0;
    this.error5xx = 0;
    this.aiInputTokens = 0;
    this.aiOutputTokens = 0;
    this.aiRequests = 0;
    this.dbQueryCount = 0;
    this.durations = [];
    this.startTime = Date.now();

    if (redisService.isConnected()) {
      redisService.del(MetricsService.REDIS_KEY).catch(() => {});
      redisService.del(MetricsService.REDIS_TOTAL_KEY).catch(() => {});
    }
  }
}

export const metricsService = new MetricsService();
