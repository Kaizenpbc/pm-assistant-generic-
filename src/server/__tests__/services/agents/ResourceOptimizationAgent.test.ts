import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing the agent
vi.mock('../../../services/agents/AgentCostTracker', () => ({
  agentCostTracker: { checkBudget: vi.fn().mockResolvedValue({ allowed: true }), record: vi.fn(), estimateCost: vi.fn(() => 0.01) },
}));
vi.mock('../../../services/agents/KillSwitchService', () => ({
  killSwitchService: { canRun: vi.fn().mockReturnValue({ allowed: true }) },
}));
vi.mock('../../../services/agents/ProposalRateLimiter', () => ({
  proposalRateLimiter: { check: vi.fn().mockResolvedValue({ allowed: true }) },
}));
vi.mock('../../../services/agents/DegradationHandler', () => ({
  degradationHandler: { canAgentRun: vi.fn().mockReturnValue({ allowed: true }), recordSuccess: vi.fn(), recordFailure: vi.fn() },
}));
vi.mock('../../../services/agents/ReasoningEngine', () => ({
  reasoningEngine: { generateResourceAnalysis: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../../services/agents/ActionProposalService', () => ({
  actionProposalService: { create: vi.fn() },
}));
vi.mock('../../../services/agents/ConfidenceCalculator', () => ({
  confidenceCalculator: { log: vi.fn() },
}));
vi.mock('../../../services/NotificationService', () => ({
  notificationService: { create: vi.fn() },
}));
vi.mock('../../../services/ResourceService', () => ({
  resourceService: { computeWorkload: vi.fn().mockResolvedValue([]) },
}));

import { ResourceOptimizationAgent } from '../../../services/agents/ResourceOptimizationAgent';
import { agentCostTracker } from '../../../services/agents/AgentCostTracker';
import { killSwitchService } from '../../../services/agents/KillSwitchService';
import { proposalRateLimiter } from '../../../services/agents/ProposalRateLimiter';
import { degradationHandler } from '../../../services/agents/DegradationHandler';
import { reasoningEngine } from '../../../services/agents/ReasoningEngine';
import { actionProposalService } from '../../../services/agents/ActionProposalService';
import { resourceService } from '../../../services/ResourceService';

const agent = new ResourceOptimizationAgent();

const baseInput = {
  projectId: 'proj-1',
  userId: 'user-1',
  scanId: 'scan-1',
};

const healthyWorkloads = [
  { resourceId: 'r1', resourceName: 'Alice', role: 'Developer', averageUtilization: 70, isOverAllocated: false, weeks: [{ utilization: 70 }] },
  { resourceId: 'r2', resourceName: 'Bob', role: 'Designer', averageUtilization: 60, isOverAllocated: false, weeks: [{ utilization: 60 }] },
];

const imbalancedWorkloads = [
  { resourceId: 'r1', resourceName: 'Alice', role: 'Developer', averageUtilization: 130, isOverAllocated: true, weeks: [{ utilization: 130 }, { utilization: 150 }] },
  { resourceId: 'r2', resourceName: 'Bob', role: 'Designer', averageUtilization: 25, isOverAllocated: false, weeks: [{ utilization: 25 }] },
  { resourceId: 'r3', resourceName: 'Charlie', role: 'Developer', averageUtilization: 90, isOverAllocated: false, weeks: [{ utilization: 90 }] },
];

function setupGuardsOk() {
  vi.mocked(agentCostTracker.checkBudget).mockResolvedValue({ allowed: true });
  vi.mocked(killSwitchService.canRun).mockReturnValue({ allowed: true });
  vi.mocked(proposalRateLimiter.check).mockResolvedValue({ allowed: true, reason: null, currentCount: 0, limit: 3, window: '24h' } as any);
  vi.mocked(degradationHandler.canAgentRun).mockReturnValue({ allowed: true });
}

describe('ResourceOptimizationAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGuardsOk();
  });

  it('should have correct agent ID and version', () => {
    expect(ResourceOptimizationAgent.AGENT_ID).toBe('resource-optimization-v1');
    expect(ResourceOptimizationAgent.AGENT_VERSION).toBe('1.0.0');
  });

  it('should skip when over budget', async () => {
    vi.mocked(agentCostTracker.checkBudget).mockResolvedValue({ allowed: false, reason: 'over budget' });

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('over budget');
  });

  it('should skip when kill switch is active', async () => {
    vi.mocked(killSwitchService.canRun).mockReturnValue({ allowed: false, reason: 'globally disabled' });

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('globally disabled');
  });

  it('should skip when rate limited', async () => {
    vi.mocked(proposalRateLimiter.check).mockResolvedValue({ allowed: false, reason: 'rate limited', currentCount: 3, limit: 3, window: '24h' } as any);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('rate limited');
  });

  it('should skip when circuit breaker is open', async () => {
    vi.mocked(degradationHandler.canAgentRun).mockReturnValue({ allowed: false, reason: 'circuit breaker open' });

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('circuit breaker open');
  });

  it('should skip when no resource imbalances detected', async () => {
    vi.mocked(resourceService.computeWorkload).mockResolvedValue(healthyWorkloads as any);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('No significant resource imbalances detected');
    expect(result.indicators).toBeTruthy();
    expect(result.indicators!.totalResources).toBe(2);
  });

  it('should skip when reasoning engine returns null', async () => {
    vi.mocked(resourceService.computeWorkload).mockResolvedValue(imbalancedWorkloads as any);
    vi.mocked(reasoningEngine.generateResourceAnalysis).mockResolvedValue(null);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('no analysis');
  });

  it('should create proposal when resource issues detected and analysis is actionable', async () => {
    vi.mocked(resourceService.computeWorkload).mockResolvedValue(imbalancedWorkloads as any);
    vi.mocked(reasoningEngine.generateResourceAnalysis).mockResolvedValue({
      hasResourceIssue: true,
      severity: 'high',
      reasoning: 'Alice is severely over-allocated while Bob is under-utilized',
      rootCauses: ['Uneven task distribution', 'No cross-training between roles'],
      recommendations: ['Reassign 2 tasks from Alice to Charlie', 'Consider hiring additional developer'],
      modelCertainty: 75,
      confidence: { score: 70, label: 'medium', factors: { dataQuality: 70, historicalAccuracy: 65, modelCertainty: 75 }, canPropose: true, canAutoExecute: false },
      suggestedActions: [
        { actionType: 'reassign_resource' as any, targetEntityType: 'task', targetEntityId: 'task-1', oldValue: {}, newValue: { description: 'Reassign from Alice to Charlie' }, reasoning: 'Rebalance workload' },
      ],
    });
    vi.mocked(actionProposalService.create).mockResolvedValue({ id: 'proposal-1' } as any);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(false);
    expect(result.proposal).toEqual({ id: 'proposal-1' });
    expect(result.indicators!.overAllocatedResources.length).toBe(1);
    expect(actionProposalService.create).toHaveBeenCalledOnce();
  });

  it('should skip when analysis finds no actionable issues', async () => {
    vi.mocked(resourceService.computeWorkload).mockResolvedValue(imbalancedWorkloads as any);
    vi.mocked(reasoningEngine.generateResourceAnalysis).mockResolvedValue({
      hasResourceIssue: false,
      severity: 'low',
      reasoning: 'Minor imbalance expected to self-correct',
      rootCauses: [],
      recommendations: [],
      modelCertainty: 55,
      confidence: { score: 58, label: 'low', factors: { dataQuality: 60, historicalAccuracy: 55, modelCertainty: 55 }, canPropose: true, canAutoExecute: false },
      suggestedActions: [],
    });

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Analysis found no actionable resource issues');
  });

  it('should record failure when indicator gathering fails', async () => {
    vi.mocked(resourceService.computeWorkload).mockRejectedValue(new Error('DB connection failed'));

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('Failed to gather resource indicators');
    expect(degradationHandler.recordFailure).toHaveBeenCalledWith('resource-optimization-v1');
  });
});
