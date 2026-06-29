import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/agents/AgentCostTracker', () => ({
  agentCostTracker: {
    checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

vi.mock('../../../services/agents/KillSwitchService', () => ({
  killSwitchService: {
    canRun: vi.fn().mockReturnValue({ allowed: true }),
  },
}));

vi.mock('../../../services/agents/ProposalRateLimiter', () => ({
  proposalRateLimiter: {
    check: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

vi.mock('../../../services/agents/DegradationHandler', () => ({
  degradationHandler: {
    canAgentRun: vi.fn().mockReturnValue({ allowed: true }),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

vi.mock('../../../services/agents/ReasoningEngine', () => ({
  reasoningEngine: {
    generateScopeAnalysis: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../../services/agents/ActionProposalService', () => ({
  actionProposalService: {
    create: vi.fn().mockResolvedValue({ id: 'proposal-1' }),
  },
}));

vi.mock('../../../services/agents/ConfidenceCalculator', () => ({
  confidenceCalculator: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../services/NotificationService', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../services/ScheduleService', () => ({
  scheduleService: {
    findByProjectId: vi.fn().mockResolvedValue([]),
  },
}));

import { ScopeCreepAgent } from '../../../services/agents/ScopeCreepAgent';
import { agentCostTracker } from '../../../services/agents/AgentCostTracker';
import { killSwitchService } from '../../../services/agents/KillSwitchService';
import { proposalRateLimiter } from '../../../services/agents/ProposalRateLimiter';
import { degradationHandler } from '../../../services/agents/DegradationHandler';
import { reasoningEngine } from '../../../services/agents/ReasoningEngine';
import { databaseService } from '../../../database/connection';
import { scheduleService } from '../../../services/ScheduleService';

describe('ScopeCreepAgent', () => {
  let agent: ScopeCreepAgent;

  beforeEach(() => {
    agent = new ScopeCreepAgent();
    vi.clearAllMocks();

    // Reset all mocks to default "allowed" state
    vi.mocked(agentCostTracker.checkBudget).mockResolvedValue({ allowed: true });
    vi.mocked(killSwitchService.canRun).mockReturnValue({ allowed: true });
    vi.mocked(proposalRateLimiter.check).mockResolvedValue({ allowed: true, currentCount: 0, limit: 3, window: 'none' });
    vi.mocked(degradationHandler.canAgentRun).mockReturnValue({ allowed: true });

    // Default: no schedules → no indicators
    vi.mocked(scheduleService.findByProjectId).mockResolvedValue([]);
  });

  it('has correct agent ID and version', () => {
    expect(ScopeCreepAgent.AGENT_ID).toBe('scope-creep-detection-v1');
    expect(ScopeCreepAgent.AGENT_VERSION).toBe('1.0.0');
  });

  it('skips when budget is exceeded', async () => {
    vi.mocked(agentCostTracker.checkBudget).mockResolvedValue({ allowed: false, reason: 'over budget' });
    const result = await agent.run({ projectId: 'p1', userId: 'u1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('over budget');
  });

  it('skips when kill switch is active', async () => {
    vi.mocked(killSwitchService.canRun).mockReturnValue({ allowed: false, reason: 'kill switch' });
    const result = await agent.run({ projectId: 'p1', userId: 'u1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('kill switch');
  });

  it('skips when rate limited', async () => {
    vi.mocked(proposalRateLimiter.check).mockResolvedValue({
      allowed: false, reason: 'rate limited', currentCount: 3, limit: 3, window: 'agent/24h',
    });
    const result = await agent.run({ projectId: 'p1', userId: 'u1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('rate limited');
  });

  it('skips when circuit breaker is open', async () => {
    vi.mocked(degradationHandler.canAgentRun).mockReturnValue({ allowed: false, reason: 'breaker open' });
    const result = await agent.run({ projectId: 'p1', userId: 'u1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('breaker open');
  });

  it('skips when no significant indicators', async () => {
    // No schedules → all indicators are 0
    const result = await agent.run({ projectId: 'p1', userId: 'u1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No significant');
    expect(result.indicators).toBeDefined();
  });

  it('skips when reasoning engine returns null', async () => {
    // Set up significant indicators
    vi.mocked(scheduleService.findByProjectId).mockResolvedValue([{ id: 's1' }] as any);
    vi.mocked(databaseService.query)
      .mockResolvedValueOnce([{ cnt: 20, total_est: 100 }] as any) // current tasks
      .mockResolvedValueOnce([{ snapshot_data: JSON.stringify({ tasks: Array(10).fill({ estimatedDays: 5 }) }) }] as any) // baseline
      .mockResolvedValueOnce([{ cnt: 3 }] as any); // change requests

    vi.mocked(reasoningEngine.generateScopeAnalysis).mockResolvedValue(null);

    const result = await agent.run({ projectId: 'p1', userId: 'u1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('Reasoning engine returned no analysis');
  });

  describe('detectIndicators', () => {
    it('returns zero indicators when no schedules', async () => {
      const indicators = await agent.detectIndicators('p1');
      expect(indicators.taskCountDelta).toBe(0);
      expect(indicators.estimateIncreaseDays).toBe(0);
    });

    it('computes delta from baseline', async () => {
      vi.mocked(scheduleService.findByProjectId).mockResolvedValue([{ id: 's1' }] as any);

      // detectIndicators calls databaseService.query 3 times:
      // 1. current tasks (cnt + total_est)
      // 2. baseline snapshot
      // 3. change request count
      let callCount = 0;
      vi.mocked(databaseService.query).mockImplementation(async (sql: string) => {
        callCount++;
        if (callCount === 1) return [{ cnt: 15, total_est: 80 }] as any;
        if (callCount === 2) return [{ snapshot_data: JSON.stringify({ tasks: Array(10).fill({ estimatedDays: 5 }) }) }] as any;
        if (callCount === 3) return [{ cnt: 2 }] as any;
        return [] as any;
      });

      const indicators = await agent.detectIndicators('p1');
      expect(indicators.taskCountDelta).toBe(5);  // 15 - 10
      expect(indicators.estimateIncreaseDays).toBe(30); // 80 - 50
      expect(indicators.changeRequestCount).toBe(2);
    });
  });
});
