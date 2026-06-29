import { reasoningEngine, BudgetAnalysisResult } from './ReasoningEngine';
import { actionProposalService, CreateProposalInput } from './ActionProposalService';
import { confidenceCalculator } from './ConfidenceCalculator';
import { agentCostTracker } from './AgentCostTracker';
import { killSwitchService } from './KillSwitchService';
import { proposalRateLimiter } from './ProposalRateLimiter';
import { degradationHandler } from './DegradationHandler';
import { notificationService } from '../NotificationService';
import { evmForecastService } from '../EVMForecastService';
import { databaseService } from '../../database/connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetIntelligenceInput {
  projectId: string;
  userId: string;
  scanId?: string;
}

export interface BudgetIndicators {
  BAC: number;
  EV: number;
  AC: number;
  PV: number;
  CPI: number;
  SPI: number;
  EAC: number;
  VAC: number;
  TCPI: number;
  overrunProbability?: number;
  topCostTasks: Array<{ taskId: string; taskName: string; actualCost: number; budgetedCost: number; variance: number }>;
}

export interface BudgetIntelligenceOutput {
  analysis: BudgetAnalysisResult | null;
  proposal: { id: string } | null;
  indicators: BudgetIndicators | null;
  skipped: boolean;
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class BudgetIntelligenceAgent {
  static readonly AGENT_ID = 'budget-intelligence-v1';
  static readonly AGENT_VERSION = '1.0.0';

  async run(input: BudgetIntelligenceInput): Promise<BudgetIntelligenceOutput> {
    const skip = (reason: string): BudgetIntelligenceOutput => ({
      analysis: null, proposal: null, indicators: null, skipped: true, skipReason: reason,
    });

    // 1. Check cost budget
    const budget = await agentCostTracker.checkBudget(BudgetIntelligenceAgent.AGENT_ID, input.projectId);
    if (!budget.allowed) return skip(budget.reason!);

    // 2. Check kill switch
    const ks = killSwitchService.canRun(BudgetIntelligenceAgent.AGENT_ID, input.projectId);
    if (!ks.allowed) return skip(ks.reason!);

    // 3. Check rate limit
    const rl = await proposalRateLimiter.check(BudgetIntelligenceAgent.AGENT_ID, input.projectId);
    if (!rl.allowed) return skip(rl.reason!);

    // 4. Check circuit breaker
    const cb = degradationHandler.canAgentRun(BudgetIntelligenceAgent.AGENT_ID);
    if (!cb.allowed) return skip(cb.reason!);

    // 5. Gather budget indicators
    let indicators: BudgetIndicators;
    try {
      indicators = await this.gatherIndicators(input.projectId);
    } catch (err) {
      degradationHandler.recordFailure(BudgetIntelligenceAgent.AGENT_ID);
      return skip(`Failed to gather budget indicators: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 6. Check if indicators are significant enough to reason about
    const isSignificant =
      indicators.CPI < 0.9 ||           // CPI below 0.9 = cost overrun trend
      indicators.SPI < 0.9 ||           // SPI below 0.9 = behind schedule (affects cost)
      indicators.VAC < 0 ||             // Negative variance at completion
      (indicators.overrunProbability !== undefined && indicators.overrunProbability > 50);

    if (!isSignificant) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'Budget metrics within acceptable thresholds' };
    }

    // 7. Run reasoning engine
    let analysis: BudgetAnalysisResult | null;
    try {
      analysis = await reasoningEngine.generateBudgetAnalysis({
        projectId: input.projectId,
        indicators,
        scanId: input.scanId,
      });
    } catch (err) {
      degradationHandler.recordFailure(BudgetIntelligenceAgent.AGENT_ID);
      return skip(`Reasoning engine failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!analysis) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'Reasoning engine returned no analysis (Claude unavailable or parse failure)' };
    }

    // 8. Log confidence
    await confidenceCalculator.log(
      BudgetIntelligenceAgent.AGENT_ID,
      input.projectId,
      analysis.confidence,
    );

    // 9. Check if confidence allows proposals
    if (!analysis.confidence.canPropose) {
      degradationHandler.recordSuccess(BudgetIntelligenceAgent.AGENT_ID);

      await notificationService.create({
        userId: input.userId,
        type: 'agent_low_confidence',
        severity: 'low',
        title: 'Budget concerns detected (low confidence)',
        message: `Budget issues detected (CPI: ${indicators.CPI.toFixed(2)}, VAC: $${indicators.VAC.toFixed(0)}) but agent confidence is too low (${analysis.confidence.score}%) to propose actions. Review budget manually.`,
        projectId: input.projectId,
      });

      return { analysis, proposal: null, indicators, skipped: true, skipReason: `Confidence too low: ${analysis.confidence.score}%` };
    }

    // 10. Create proposal if there are actionable recommendations
    if (!analysis.hasBudgetIssue || analysis.suggestedActions.length === 0) {
      degradationHandler.recordSuccess(BudgetIntelligenceAgent.AGENT_ID);
      return { analysis, proposal: null, indicators, skipped: true, skipReason: 'Analysis found no actionable budget issues' };
    }

    const snapshotVersion = this.computeSnapshotVersion(indicators);

    const proposalInput: CreateProposalInput = {
      projectId: input.projectId,
      agentId: BudgetIntelligenceAgent.AGENT_ID,
      agentVersion: BudgetIntelligenceAgent.AGENT_VERSION,
      title: `Budget Alert: ${analysis.severity} severity — CPI ${indicators.CPI.toFixed(2)}`,
      reasoning: analysis.reasoning,
      summary: `**Root Causes:** ${analysis.rootCauses.join(', ')}\n\n**Forecast:** EAC $${indicators.EAC.toFixed(0)} (VAC $${indicators.VAC.toFixed(0)})\n\n**Recommendations:** ${analysis.recommendations.join('; ')}`,
      confidenceScore: analysis.confidence.score,
      confidenceFactors: analysis.confidence.factors as unknown as Record<string, unknown>,
      riskLevel: analysis.severity === 'critical' ? 'critical' : 'high',
      dataSnapshotVersion: snapshotVersion,
      createdBy: input.userId,
      actions: analysis.suggestedActions.map((a, idx) => ({
        executionOrder: idx + 1,
        actionType: a.actionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: a.oldValue,
        newValue: a.newValue,
        reasoning: a.reasoning,
      })),
    };

    const proposal = await actionProposalService.create(proposalInput);

    // 11. Update confidence log with proposal ID
    await confidenceCalculator.log(
      BudgetIntelligenceAgent.AGENT_ID,
      input.projectId,
      analysis.confidence,
      proposal.id,
    );

    // 12. Notify project owner
    await notificationService.create({
      userId: input.userId,
      type: 'agent_proposal',
      severity: analysis.severity === 'critical' ? 'critical' : 'high',
      title: `Budget recovery plan proposed (${analysis.severity})`,
      message: `Agent detected budget issues: CPI ${indicators.CPI.toFixed(2)}, VAC $${indicators.VAC.toFixed(0)}${indicators.overrunProbability !== undefined ? `, ${indicators.overrunProbability}% overrun probability` : ''}. ${analysis.suggestedActions.length} action(s) proposed.`,
      projectId: input.projectId,
      linkType: 'proposal',
      linkId: proposal.id,
    });

    degradationHandler.recordSuccess(BudgetIntelligenceAgent.AGENT_ID);

    return { analysis, proposal: { id: proposal.id }, indicators, skipped: false };
  }

  /**
   * Gather EVM metrics and top-cost tasks from existing EVM forecast service.
   */
  async gatherIndicators(projectId: string): Promise<BudgetIndicators> {
    // Use the EVM forecast service to get current metrics
    const forecast = await evmForecastService.generateForecast(projectId);
    const m = forecast.currentMetrics;

    // Get top cost-variance tasks
    let topCostTasks: BudgetIndicators['topCostTasks'] = [];
    try {
      const rows = await databaseService.query<{
        id: string; name: string; actual_cost: number; estimated_cost: number;
      }>(
        `SELECT t.id, t.name,
                COALESCE(t.actual_cost, 0) AS actual_cost,
                COALESCE(t.estimated_cost, 0) AS estimated_cost
         FROM tasks t
         JOIN schedules s ON t.schedule_id = s.id
         WHERE s.project_id = ?
           AND t.actual_cost > 0
         ORDER BY (t.actual_cost - COALESCE(t.estimated_cost, 0)) DESC
         LIMIT 10`,
        [projectId],
      );

      topCostTasks = rows.map(r => ({
        taskId: r.id,
        taskName: r.name,
        actualCost: Number(r.actual_cost),
        budgetedCost: Number(r.estimated_cost),
        variance: Number(r.actual_cost) - Number(r.estimated_cost),
      }));
    } catch {
      // Task cost columns may not exist — non-critical
    }

    return {
      BAC: m.BAC,
      EV: m.EV,
      AC: m.AC,
      PV: m.PV,
      CPI: m.CPI,
      SPI: m.SPI,
      EAC: m.EAC,
      VAC: m.VAC,
      TCPI: m.TCPI,
      overrunProbability: forecast.aiPredictions?.overrunProbability,
      topCostTasks,
    };
  }

  private computeSnapshotVersion(indicators: BudgetIndicators): string {
    const data = `${indicators.CPI}:${indicators.SPI}:${indicators.VAC}:${indicators.EAC}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

export const budgetIntelligenceAgent = new BudgetIntelligenceAgent();
