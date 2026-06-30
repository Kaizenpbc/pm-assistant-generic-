import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
    getConnection: vi.fn(),
  },
}));

vi.mock('../../../services/agents/AgentCostTracker', () => ({
  agentCostTracker: {
    checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
    record: vi.fn().mockResolvedValue(undefined),
    estimateCost: vi.fn().mockReturnValue(0.01),
  },
}));

vi.mock('../../../services/agents/KillSwitchService', () => ({
  killSwitchService: { canRun: vi.fn().mockReturnValue({ allowed: true }) },
}));

vi.mock('../../../services/agents/ProposalRateLimiter', () => ({
  proposalRateLimiter: { check: vi.fn().mockResolvedValue({ allowed: true }) },
}));

vi.mock('../../../services/agents/DegradationHandler', () => ({
  degradationHandler: {
    canAgentRun: vi.fn().mockReturnValue({ allowed: true }),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

vi.mock('../../../services/agents/ConfidenceCalculator', () => ({
  confidenceCalculator: {
    log: vi.fn().mockResolvedValue(undefined),
    compute: vi.fn().mockReturnValue({ score: 75, label: 'medium', canPropose: true, canAutoExecute: false, factors: {} }),
    computeDataQuality: vi.fn().mockReturnValue(70),
    computeHistoricalAccuracy: vi.fn().mockResolvedValue(65),
  },
}));

vi.mock('../../../services/agents/ReasoningEngine', () => ({
  reasoningEngine: { generateDependencyAnalysis: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../../services/agents/ActionProposalService', () => ({
  actionProposalService: { create: vi.fn().mockResolvedValue({ id: 'proposal-1' }) },
}));

vi.mock('../../../services/NotificationService', () => ({
  notificationService: { create: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../services/ScheduleService', () => ({
  scheduleService: {
    findByProjectId: vi.fn().mockResolvedValue([]),
    findTasksByScheduleIds: vi.fn().mockResolvedValue([]),
  },
}));

import { DependencyRiskAgent } from '../../../services/agents/DependencyRiskAgent';

describe('DependencyRiskAgent', () => {
  let agent: DependencyRiskAgent;

  beforeEach(() => {
    agent = new DependencyRiskAgent();
    vi.clearAllMocks();
  });

  it('has correct agent ID and version', () => {
    expect(DependencyRiskAgent.AGENT_ID).toBe('dependency-risk-v1');
    expect(DependencyRiskAgent.AGENT_VERSION).toBe('1.0.0');
  });

  it('skips when no schedules exist', async () => {
    const result = await agent.run({ projectId: 'proj-1', userId: 'user-1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No significant');
  });

  it('returns empty indicators when no tasks exist', async () => {
    const indicators = await agent.gatherIndicators('proj-1');
    expect(indicators.blockedChains).toHaveLength(0);
    expect(indicators.bottleneckTasks).toHaveLength(0);
    expect(indicators.longChains).toHaveLength(0);
    expect(indicators.totalDependencies).toBe(0);
  });

  it('detects bottleneck tasks with 3+ dependents', async () => {
    const { scheduleService } = await import('../../../services/ScheduleService');
    vi.mocked(scheduleService.findByProjectId).mockResolvedValueOnce([{ id: 's1' }] as any);
    vi.mocked(scheduleService.findTasksByScheduleIds).mockResolvedValueOnce([
      { id: 't1', name: 'Core Module', status: 'in_progress', dependency: null },
      { id: 't2', name: 'Feature A', status: 'pending', dependency: 't1' },
      { id: 't3', name: 'Feature B', status: 'pending', dependency: 't1' },
      { id: 't4', name: 'Feature C', status: 'pending', dependency: 't1' },
    ] as any);

    const indicators = await agent.gatherIndicators('proj-1');
    expect(indicators.bottleneckTasks.length).toBe(1);
    expect(indicators.bottleneckTasks[0].taskName).toBe('Core Module');
    expect(indicators.bottleneckTasks[0].dependentCount).toBe(3);
  });

  it('skips when cost budget is exhausted', async () => {
    const { agentCostTracker } = await import('../../../services/agents/AgentCostTracker');
    vi.mocked(agentCostTracker.checkBudget).mockResolvedValueOnce({ allowed: false, reason: 'Over budget' });

    const result = await agent.run({ projectId: 'proj-1', userId: 'user-1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Over budget');
  });
});
