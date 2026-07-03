import { describe, it, expect, beforeEach } from 'vitest';
import { metricsService } from '../../services/MetricsService';

describe('MetricsService', () => {
  beforeEach(() => {
    metricsService.reset();
  });

  it('records requests and updates counters', () => {
    metricsService.recordRequest('GET', '/api/v1/projects', 200, 50);
    metricsService.recordRequest('POST', '/api/v1/projects', 201, 120);
    metricsService.recordRequest('GET', '/api/v1/projects/1', 404, 10);

    const snapshot = metricsService.getSnapshot();
    expect(snapshot.requests.total).toBe(3);
    expect(snapshot.requests.byMethod['GET']).toBe(2);
    expect(snapshot.requests.byMethod['POST']).toBe(1);
    expect(snapshot.requests.byStatusBucket['2xx']).toBe(2);
    expect(snapshot.requests.byStatusBucket['4xx']).toBe(1);
    expect(snapshot.errors.total4xx).toBe(1);
    expect(snapshot.errors.total5xx).toBe(0);
  });

  it('tracks latency percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      metricsService.recordRequest('GET', '/', 200, i);
    }
    const snapshot = metricsService.getSnapshot();
    expect(snapshot.latency.p50Ms).toBe(50);
    expect(snapshot.latency.p95Ms).toBe(95);
    expect(snapshot.latency.p99Ms).toBe(99);
  });

  it('records AI usage', () => {
    metricsService.recordAIUsage(100, 200);
    metricsService.recordAIUsage(50, 80);
    const snapshot = metricsService.getSnapshot();
    expect(snapshot.ai.totalInputTokens).toBe(150);
    expect(snapshot.ai.totalOutputTokens).toBe(280);
    expect(snapshot.ai.totalRequests).toBe(2);
  });

  it('tracks active requests', () => {
    metricsService.incrementActiveRequests();
    metricsService.incrementActiveRequests();
    metricsService.decrementActiveRequests();
    const snapshot = metricsService.getSnapshot();
    expect(snapshot.requests.activeRequests).toBe(1);
  });

  it('tracks DB queries', () => {
    metricsService.incrementDbQueries();
    metricsService.incrementDbQueries();
    metricsService.incrementDbQueries();
    const snapshot = metricsService.getSnapshot();
    expect(snapshot.db.totalQueries).toBe(3);
  });

  it('reset clears all counters', () => {
    metricsService.recordRequest('GET', '/', 200, 10);
    metricsService.recordAIUsage(100, 200);
    metricsService.incrementDbQueries();
    metricsService.reset();
    const snapshot = metricsService.getSnapshot();
    expect(snapshot.requests.total).toBe(0);
    expect(snapshot.ai.totalInputTokens).toBe(0);
    expect(snapshot.db.totalQueries).toBe(0);
  });

  it('returns uptime', () => {
    const snapshot = metricsService.getSnapshot();
    expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns zero percentiles when no requests', () => {
    const snapshot = metricsService.getSnapshot();
    expect(snapshot.latency.p50Ms).toBe(0);
    expect(snapshot.latency.p95Ms).toBe(0);
    expect(snapshot.latency.p99Ms).toBe(0);
  });
});
