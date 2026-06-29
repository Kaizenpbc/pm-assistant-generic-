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
  reasoningEngine: { generateBudgetAnalysis: vi.fn().mockResolvedValue(null) },
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
vi.mock('../../../services/EVMForecastService', () => ({
  evmForecastService: { generateForecast: vi.fn() },
}));
vi.mock('../../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

import { BudgetIntelligenceAgent } from '../../../services/agents/BudgetIntelligenceAgent';
import { agentCostTracker } from '../../../services/agents/AgentCostTracker';
import { killSwitchService } from '../../../services/agents/KillSwitchService';
import { proposalRateLimiter } from '../../../services/agents/ProposalRateLimiter';
import { degradationHandler } from '../../../services/agents/DegradationHandler';
import { reasoningEngine } from '../../../services/agents/ReasoningEngine';
import { actionProposalService } from '../../../services/agents/ActionProposalService';
import { evmForecastService } from '../../../services/EVMForecastService';

const agent = new BudgetIntelligenceAgent();

const baseInput = {
  projectId: 'proj-1',
  userId: 'user-1',
  scanId: 'scan-1',
};

const healthyMetrics = {
  currentMetrics: { BAC: 100000, EV: 50000, AC: 50000, PV: 50000, CPI: 1.0, SPI: 1.0, EAC: 100000, ETC: 50000, VAC: 0, TCPI: 1.0 },
  aiPredictions: undefined,
};

const unhealthyMetrics = {
  currentMetrics: { BAC: 100000, EV: 40000, AC: 55000, PV: 50000, CPI: 0.727, SPI: 0.8, EAC: 137552, ETC: 82552, VAC: -37552, TCPI: 1.333 },
  aiPredictions: { overrunProbability: 72 },
};

function setupGuardsOk() {
  vi.mocked(agentCostTracker.checkBudget).mockResolvedValue({ allowed: true });
  vi.mocked(killSwitchService.canRun).mockReturnValue({ allowed: true });
  vi.mocked(proposalRateLimiter.check).mockResolvedValue({ allowed: true, reason: null, currentCount: 0, limit: 3, window: '24h' } as any);
  vi.mocked(degradationHandler.canAgentRun).mockReturnValue({ allowed: true });
}

describe('BudgetIntelligenceAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGuardsOk();
  });

  it('should have correct agent ID and version', () => {
    expect(BudgetIntelligenceAgent.AGENT_ID).toBe('budget-intelligence-v1');
    expect(BudgetIntelligenceAgent.AGENT_VERSION).toBe('1.0.0');
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

  it('should skip when budget metrics are healthy', async () => {
    vi.mocked(evmForecastService.generateForecast).mockResolvedValue(healthyMetrics as any);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Budget metrics within acceptable thresholds');
    expect(result.indicators).toBeTruthy();
    expect(result.indicators!.CPI).toBe(1.0);
  });

  it('should skip when reasoning engine returns null', async () => {
    vi.mocked(evmForecastService.generateForecast).mockResolvedValue(unhealthyMetrics as any);
    vi.mocked(reasoningEngine.generateBudgetAnalysis).mockResolvedValue(null);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('no analysis');
  });

  it('should create proposal when budget issues detected and analysis is actionable', async () => {
    vi.mocked(evmForecastService.generateForecast).mockResolvedValue(unhealthyMetrics as any);
    vi.mocked(reasoningEngine.generateBudgetAnalysis).mockResolvedValue({
      hasBudgetIssue: true,
      severity: 'high',
      reasoning: 'CPI trending downward due to resource overallocation',
      rootCauses: ['Senior developer overtime', 'Scope additions without budget adjustment'],
      recommendations: ['Reallocate $15K from contingency', 'Defer non-critical features'],
      modelCertainty: 72,
      confidence: { score: 68, label: 'medium', factors: { dataQuality: 75, historicalAccuracy: 60, modelCertainty: 72 }, canPropose: true, canAutoExecute: false },
      suggestedActions: [
        { actionType: 'create_change_request' as any, targetEntityType: 'project', targetEntityId: 'proj-1', oldValue: {}, newValue: { description: 'Budget reallocation request' }, reasoning: 'Formal request needed' },
      ],
    });
    vi.mocked(actionProposalService.create).mockResolvedValue({ id: 'proposal-1' } as any);

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(false);
    expect(result.proposal).toEqual({ id: 'proposal-1' });
    expect(result.indicators!.CPI).toBe(0.727);
    expect(actionProposalService.create).toHaveBeenCalledOnce();
  });

  it('should skip when analysis finds no actionable issues', async () => {
    vi.mocked(evmForecastService.generateForecast).mockResolvedValue(unhealthyMetrics as any);
    vi.mocked(reasoningEngine.generateBudgetAnalysis).mockResolvedValue({
      hasBudgetIssue: false,
      severity: 'low',
      reasoning: 'Temporary dip expected to recover',
      rootCauses: [],
      recommendations: [],
      modelCertainty: 55,
      confidence: { score: 58, label: 'low', factors: { dataQuality: 60, historicalAccuracy: 55, modelCertainty: 55 }, canPropose: true, canAutoExecute: false },
      suggestedActions: [],
    });

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Analysis found no actionable budget issues');
  });

  it('should record failure when indicator gathering fails', async () => {
    vi.mocked(evmForecastService.generateForecast).mockRejectedValue(new Error('DB connection failed'));

    const result = await agent.run(baseInput);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('Failed to gather budget indicators');
    expect(degradationHandler.recordFailure).toHaveBeenCalledWith('budget-intelligence-v1');
  });
});
