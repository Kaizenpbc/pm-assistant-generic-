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
  reasoningEngine: { generateRiskEscalation: vi.fn().mockResolvedValue(null) },
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

import { RiskEscalationAgent, ProjectAgentResults } from '../../../services/agents/RiskEscalationAgent';
import { agentCostTracker } from '../../../services/agents/AgentCostTracker';
import { killSwitchService } from '../../../services/agents/KillSwitchService';
import { proposalRateLimiter } from '../../../services/agents/ProposalRateLimiter';
import { degradationHandler } from '../../../services/agents/DegradationHandler';
import { reasoningEngine } from '../../../services/agents/ReasoningEngine';
import { actionProposalService } from '../../../services/agents/ActionProposalService';

const agent = new RiskEscalationAgent();

const singleFlagProject: ProjectAgentResults = {
  projectId: 'p1',
  projectName: 'Project Alpha',
  agentFlags: { scheduleDelay: true, budgetOverrun: false, scopeCreep: false, resourceBottleneck: false, meetingOverdue: false },
  details: { scheduleDelay: '3 delays detected' },
};

const compoundRiskProject: ProjectAgentResults = {
  projectId: 'p2',
  projectName: 'Project Beta',
  agentFlags: { scheduleDelay: true, budgetOverrun: true, scopeCreep: false, resourceBottleneck: true, meetingOverdue: false },
  details: { scheduleDelay: '5 delays', budgetBurnRate: 'CPI 0.72', resourceOptimization: '2 over-allocated' },
};

const tripleRiskProject: ProjectAgentResults = {
  projectId: 'p3',
  projectName: 'Project Gamma',
  agentFlags: { scheduleDelay: true, budgetOverrun: true, scopeCreep: true, resourceBottleneck: false, meetingOverdue: false },
  details: { scheduleDelay: '2 delays', budgetIntelligence: 'CPI 0.85', scopeCreep: 'Task growth +40%' },
};

const baseInput = {
  userId: 'user-1',
  projectResults: [singleFlagProject, compoundRiskProject],
  scanId: 'scan-1',
};

function setupGuardsOk() {
  vi.mocked(agentCostTracker.checkBudget).mockResolvedValue({ allowed: true });
  vi.mocked(killSwitchService.canRun).mockReturnValue({ allowed: true });
  vi.mocked(proposalRateLimiter.check).mockResolvedValue({ allowed: true, reason: null, currentCount: 0, limit: 3, window: '24h' } as any);
  vi.mocked(degradationHandler.canAgentRun).mockReturnValue({ allowed: true });
}

describe('RiskEscalationAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGuardsOk();
  });

  it('should have correct agent ID and version', () => {
    expect(RiskEscalationAgent.AGENT_ID).toBe('risk-escalation-v1');
    expect(RiskEscalationAgent.AGENT_VERSION).toBe('1.0.0');
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

  it('should skip when no compound risks detected (all projects have single flags)', async () => {
    const result = await agent.run({
      userId: 'user-1',
      projectResults: [singleFlagProject],
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No compound risks detected');
    expect(result.indicators).toBeTruthy();
    expect(result.indicators!.compoundRiskProjects.length).toBe(0);
  });

  it('should correctly identify compound risk projects (2+ flags)', () => {
    const indicators = agent.gatherIndicators([singleFlagProject, compoundRiskProject, tripleRiskProject]);
    expect(indicators.compoundRiskProjects.length).toBe(2); // Beta (3 flags) + Gamma (3 flags)
    expect(indicators.maxFlagsOnSingleProject).toBe(3);
    expect(indicators.flagDistribution.scheduleDelay).toBe(3);
    expect(indicators.flagDistribution.budgetOverrun).toBe(2);
  });

  it('should skip when reasoning engine returns null', async () => {
    vi.mocked(reasoningEngine.generateRiskEscalation).mockResolvedValue(null);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('no analysis');
  });

  it('should create proposal when compound risks detected and analysis is actionable', async () => {
    vi.mocked(reasoningEngine.generateRiskEscalation).mockResolvedValue({
      hasCompoundRisk: true,
      severity: 'critical',
      reasoning: 'Project Beta has schedule, budget, and resource issues converging',
      escalations: ['Project Beta requires immediate executive review'],
      compoundRisks: ['Schedule delay + budget overrun + resource bottleneck = high failure risk'],
      recommendations: ['Assign dedicated recovery team', 'Reduce scope by 20%'],
      modelCertainty: 78,
      confidence: { score: 72, label: 'medium', factors: { dataQuality: 70, historicalAccuracy: 68, modelCertainty: 78 }, canPropose: true, canAutoExecute: false },
      suggestedActions: [
        { actionType: 'send_notification' as any, targetEntityType: 'project', targetEntityId: 'p2', oldValue: {}, newValue: { description: 'Escalate to executive' }, reasoning: 'Compound risk critical' },
      ],
    });
    vi.mocked(actionProposalService.create).mockResolvedValue({ id: 'proposal-1' } as any);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(false);
    expect(result.proposal).toEqual({ id: 'proposal-1' });
    expect(result.indicators!.compoundRiskProjects.length).toBe(1);
    expect(actionProposalService.create).toHaveBeenCalledOnce();
  });

  it('should skip when analysis finds no actionable compound risks', async () => {
    vi.mocked(reasoningEngine.generateRiskEscalation).mockResolvedValue({
      hasCompoundRisk: false,
      severity: 'low',
      reasoning: 'Flags are independent, not compounding',
      escalations: [],
      compoundRisks: [],
      recommendations: [],
      modelCertainty: 55,
      confidence: { score: 58, label: 'low', factors: { dataQuality: 60, historicalAccuracy: 55, modelCertainty: 55 }, canPropose: true, canAutoExecute: false },
      suggestedActions: [],
    });

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Analysis found no actionable compound risks');
  });

  it('should record failure when reasoning engine throws', async () => {
    vi.mocked(reasoningEngine.generateRiskEscalation).mockRejectedValue(new Error('Claude API error'));

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('Reasoning engine failed');
    expect(degradationHandler.recordFailure).toHaveBeenCalledWith('risk-escalation-v1');
  });
});
