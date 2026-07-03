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

  private static readonly MAX_DURATIONS = 10000;

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
  }

  recordAIUsage(inputTokens: number, outputTokens: number): void {
    this.aiInputTokens += inputTokens;
    this.aiOutputTokens += outputTokens;
    this.aiRequests++;
  }

  incrementDbQueries(): void {
    this.dbQueryCount++;
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
  }
}

export const metricsService = new MetricsService();
