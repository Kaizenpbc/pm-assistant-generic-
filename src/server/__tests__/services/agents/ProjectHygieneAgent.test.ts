import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
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

vi.mock('../../../services/agents/ConfidenceCalculator', () => ({
  confidenceCalculator: {
    log: vi.fn().mockResolvedValue(undefined),
    compute: vi.fn().mockReturnValue({ score: 75, label: 'medium', canPropose: true, canAutoExecute: false, factors: {} }),
    computeDataQuality: vi.fn().mockReturnValue(70),
    computeHistoricalAccuracy: vi.fn().mockResolvedValue(65),
  },
}));

vi.mock('../../../services/agents/ReasoningEngine', () => ({
  reasoningEngine: {
    generateHygieneAnalysis: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../../services/agents/ActionProposalService', () => ({
  actionProposalService: {
    create: vi.fn().mockResolvedValue({ id: 'proposal-1' }),
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

import { ProjectHygieneAgent } from '../../../services/agents/ProjectHygieneAgent';

describe('ProjectHygieneAgent', () => {
  let agent: ProjectHygieneAgent;

  beforeEach(() => {
    agent = new ProjectHygieneAgent();
    vi.clearAllMocks();
  });

  it('has correct agent ID and version', () => {
    expect(ProjectHygieneAgent.AGENT_ID).toBe('project-hygiene-v1');
    expect(ProjectHygieneAgent.AGENT_VERSION).toBe('1.0.0');
  });

  it('skips when cost budget is exhausted', async () => {
    const { agentCostTracker } = await import('../../../services/agents/AgentCostTracker');
    vi.mocked(agentCostTracker.checkBudget).mockResolvedValueOnce({ allowed: false, reason: 'Budget exhausted' });

    const result = await agent.run({ projectId: 'proj-1', userId: 'user-1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Budget exhausted');
  });

  it('skips when no significant hygiene issues detected', async () => {
    const { scheduleService } = await import('../../../services/ScheduleService');
    vi.mocked(scheduleService.findByProjectId).mockResolvedValueOnce([{ id: 'sched-1', name: 'Main', projectId: 'proj-1', startDate: '2026-01-01', endDate: '2026-12-31', createdAt: '', updatedAt: '' }] as any);

    const result = await agent.run({ projectId: 'proj-1', userId: 'user-1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No significant');
  });

  it('returns empty indicators when no schedules exist', async () => {
    const indicators = await agent.gatherIndicators('proj-no-schedules');
    expect(indicators.staleTasks).toHaveLength(0);
    expect(indicators.missingDateTasks).toHaveLength(0);
    expect(indicators.abandonedSprints).toHaveLength(0);
  });

  it('skips when kill switch is active', async () => {
    const { killSwitchService } = await import('../../../services/agents/KillSwitchService');
    vi.mocked(killSwitchService.canRun).mockReturnValueOnce({ allowed: false, reason: 'Kill switch active' });

    const result = await agent.run({ projectId: 'proj-1', userId: 'user-1' });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Kill switch active');
  });
});
