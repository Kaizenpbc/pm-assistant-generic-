import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([{ 1: 1 }]),
  },
}));

vi.mock('../../../services/claudeService', () => ({
  claudeService: {
    isAvailable: vi.fn().mockReturnValue(true),
  },
}));

import { DegradationHandler } from '../../../services/agents/DegradationHandler';
import { claudeService } from '../../../services/claudeService';
import { databaseService } from '../../../database/connection';

describe('DegradationHandler', () => {
  let handler: DegradationHandler;

  beforeEach(() => {
    handler = new DegradationHandler();
    vi.clearAllMocks();
  });

  describe('canAgentRun', () => {
    it('allows agents with no history (closed breaker)', () => {
      const result = handler.canAgentRun('agent-a');
      expect(result.allowed).toBe(true);
    });

    it('allows agents after successful runs', () => {
      handler.recordSuccess('agent-a');
      const result = handler.canAgentRun('agent-a');
      expect(result.allowed).toBe(true);
    });

    it('allows agents with fewer than 3 consecutive failures', () => {
      handler.recordFailure('agent-a');
      handler.recordFailure('agent-a');
      const result = handler.canAgentRun('agent-a');
      expect(result.allowed).toBe(true);
    });

    it('blocks agents after 3 consecutive failures', () => {
      handler.recordFailure('agent-a');
      handler.recordFailure('agent-a');
      handler.recordFailure('agent-a');
      const result = handler.canAgentRun('agent-a');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Circuit breaker open');
    });

    it('resets breaker on success', () => {
      handler.recordFailure('agent-a');
      handler.recordFailure('agent-a');
      handler.recordSuccess('agent-a');
      handler.recordFailure('agent-a');
      // Only 1 consecutive failure now
      const result = handler.canAgentRun('agent-a');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkDatabaseHealth', () => {
    it('returns healthy when SELECT 1 succeeds', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([{ 1: 1 }] as any);
      const result = await handler.checkDatabaseHealth();
      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy when database fails', async () => {
      vi.mocked(databaseService.query).mockRejectedValue(new Error('connection lost'));
      const result = await handler.checkDatabaseHealth();
      expect(result.healthy).toBe(false);
    });
  });

  describe('getRecommendedScanScope', () => {
    it('returns full when everything is healthy', () => {
      expect(handler.getRecommendedScanScope(true, true, 50)).toBe('full');
    });

    it('returns none when database is down', () => {
      expect(handler.getRecommendedScanScope(true, false, 5000)).toBe('none');
    });

    it('returns critical_only when DB latency is very high', () => {
      expect(handler.getRecommendedScanScope(true, true, 2500)).toBe('critical_only');
    });

    it('returns reduced when Claude is unavailable', () => {
      expect(handler.getRecommendedScanScope(false, true, 100)).toBe('reduced');
    });

    it('returns critical_only when Claude is down and DB is slow', () => {
      expect(handler.getRecommendedScanScope(false, true, 600)).toBe('critical_only');
    });
  });

  describe('getHealthStatus', () => {
    it('returns combined health status', async () => {
      vi.mocked(claudeService.isAvailable).mockReturnValue(true);
      vi.mocked(databaseService.query).mockResolvedValue([{ 1: 1 }] as any);

      handler.recordFailure('test-agent');

      const status = await handler.getHealthStatus();
      expect(status.claudeAvailable).toBe(true);
      expect(status.databaseHealthy).toBe(true);
      expect(status.circuitBreakers['test-agent']).toBeDefined();
      expect(status.circuitBreakers['test-agent'].consecutiveFailures).toBe(1);
      expect(status.recommendedScope).toBe('full');
    });
  });
});
