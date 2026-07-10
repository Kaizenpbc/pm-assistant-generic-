import { claudeService } from '../claudeService';
import { databaseService } from '../../database/connection';
import { MS_PER_MINUTE } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BreakerState = 'closed' | 'open' | 'half_open';

interface CircuitBreaker {
  state: BreakerState;
  consecutiveFailures: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  retryAfterMs: number;
}

export type ScanScope = 'full' | 'reduced' | 'critical_only' | 'none';

export interface HealthStatus {
  claudeAvailable: boolean;
  databaseHealthy: boolean;
  databaseLatencyMs: number;
  circuitBreakers: Record<string, { state: BreakerState; consecutiveFailures: number }>;
  recommendedScope: ScanScope;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FAILURES = 3;
const INITIAL_RETRY_MS = 60 * 60 * 1000;   // 1 hour
const ESCALATED_RETRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const DB_LATENCY_WARN_MS = 500;
const DB_LATENCY_CRITICAL_MS = 2000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DegradationHandler {
  private breakers = new Map<string, CircuitBreaker>();

  private getOrCreateBreaker(agentId: string): CircuitBreaker {
    let breaker = this.breakers.get(agentId);
    if (!breaker) {
      breaker = {
        state: 'closed',
        consecutiveFailures: 0,
        lastFailureAt: 0,
        lastSuccessAt: 0,
        retryAfterMs: INITIAL_RETRY_MS,
      };
      this.breakers.set(agentId, breaker);
    }
    return breaker;
  }

  /**
   * Check if an agent is allowed to run based on its circuit breaker state.
   */
  canAgentRun(agentId: string): { allowed: boolean; reason?: string } {
    const breaker = this.getOrCreateBreaker(agentId);

    if (breaker.state === 'closed') {
      return { allowed: true };
    }

    if (breaker.state === 'open') {
      const elapsed = Date.now() - breaker.lastFailureAt;
      if (elapsed >= breaker.retryAfterMs) {
        // Transition to half-open for a retry attempt
        breaker.state = 'half_open';
        return { allowed: true };
      }
      const waitMinutes = Math.ceil((breaker.retryAfterMs - elapsed) / MS_PER_MINUTE);
      return { allowed: false, reason: `Circuit breaker open for ${agentId}. Retry in ${waitMinutes}m.` };
    }

    // half_open — allow one retry
    return { allowed: true };
  }

  recordSuccess(agentId: string): void {
    const breaker = this.getOrCreateBreaker(agentId);
    breaker.state = 'closed';
    breaker.consecutiveFailures = 0;
    breaker.lastSuccessAt = Date.now();
    breaker.retryAfterMs = INITIAL_RETRY_MS;
  }

  recordFailure(agentId: string): void {
    const breaker = this.getOrCreateBreaker(agentId);
    breaker.consecutiveFailures++;
    breaker.lastFailureAt = Date.now();

    if (breaker.consecutiveFailures >= MAX_FAILURES) {
      breaker.state = 'open';
      // Escalate retry delay if already failed after half-open retry
      if (breaker.retryAfterMs === INITIAL_RETRY_MS && breaker.consecutiveFailures > MAX_FAILURES) {
        breaker.retryAfterMs = ESCALATED_RETRY_MS;
      }
    }
  }

  /**
   * Quick database health check via SELECT 1.
   */
  async checkDatabaseHealth(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await databaseService.query('SELECT 1');
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Combined health status for monitoring.
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const claudeAvailable = claudeService.isAvailable();
    const dbHealth = await this.checkDatabaseHealth();

    const circuitBreakers: Record<string, { state: BreakerState; consecutiveFailures: number }> = {};
    for (const [agentId, breaker] of this.breakers) {
      circuitBreakers[agentId] = {
        state: breaker.state,
        consecutiveFailures: breaker.consecutiveFailures,
      };
    }

    const recommendedScope = this.getRecommendedScanScope(claudeAvailable, dbHealth.healthy, dbHealth.latencyMs);

    return {
      claudeAvailable,
      databaseHealthy: dbHealth.healthy,
      databaseLatencyMs: dbHealth.latencyMs,
      circuitBreakers,
      recommendedScope,
    };
  }

  /**
   * Determine scan scope based on infrastructure health.
   */
  getRecommendedScanScope(claudeAvailable?: boolean, dbHealthy?: boolean, dbLatencyMs?: number): ScanScope {
    const claude = claudeAvailable ?? claudeService.isAvailable();

    if (dbHealthy === false) return 'none';
    if (dbLatencyMs !== undefined && dbLatencyMs > DB_LATENCY_CRITICAL_MS) return 'critical_only';
    if (!claude && dbLatencyMs !== undefined && dbLatencyMs > DB_LATENCY_WARN_MS) return 'critical_only';
    if (!claude) return 'reduced';
    if (dbLatencyMs !== undefined && dbLatencyMs > DB_LATENCY_WARN_MS) return 'reduced';
    return 'full';
  }
}

export const degradationHandler = new DegradationHandler();
