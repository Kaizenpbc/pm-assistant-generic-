import { reasoningEngine, ScopeAnalysisResult } from './ReasoningEngine';
import { actionProposalService, CreateProposalInput } from './ActionProposalService';
import { confidenceCalculator } from './ConfidenceCalculator';
import { agentCostTracker } from './AgentCostTracker';
import { killSwitchService } from './KillSwitchService';
import { proposalRateLimiter } from './ProposalRateLimiter';
import { degradationHandler } from './DegradationHandler';
import { notificationService } from '../NotificationService';
import { scheduleService } from '../ScheduleService';
import { databaseService } from '../../database/connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScopeCreepInput {
  projectId: string;
  userId: string;
  scanId?: string;
}

export interface ScopeCreepIndicators {
  taskCountDelta: number;        // new tasks since baseline/last scan
  estimateIncreaseDays: number;  // total estimate growth
  changeRequestCount: number;    // open change requests
  originalTaskCount: number;
  currentTaskCount: number;
}

export interface ScopeCreepOutput {
  analysis: ScopeAnalysisResult | null;
  proposal: { id: string } | null;
  indicators: ScopeCreepIndicators | null;
  skipped: boolean;
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ScopeCreepAgent {
  static readonly AGENT_ID = 'scope-creep-detection-v1';
  static readonly AGENT_VERSION = '1.0.0';

  async run(input: ScopeCreepInput): Promise<ScopeCreepOutput> {
    const skip = (reason: string): ScopeCreepOutput => ({
      analysis: null, proposal: null, indicators: null, skipped: true, skipReason: reason,
    });

    // 1. Check cost budget
    const budget = await agentCostTracker.checkBudget(ScopeCreepAgent.AGENT_ID, input.projectId);
    if (!budget.allowed) return skip(budget.reason!);

    // 2. Check kill switch
    const ks = killSwitchService.canRun(ScopeCreepAgent.AGENT_ID, input.projectId);
    if (!ks.allowed) return skip(ks.reason!);

    // 3. Check rate limit
    const rl = await proposalRateLimiter.check(ScopeCreepAgent.AGENT_ID, input.projectId);
    if (!rl.allowed) return skip(rl.reason!);

    // 4. Check circuit breaker
    const cb = degradationHandler.canAgentRun(ScopeCreepAgent.AGENT_ID);
    if (!cb.allowed) return skip(cb.reason!);

    // 5. Detect indicators
    let indicators: ScopeCreepIndicators;
    try {
      indicators = await this.detectIndicators(input.projectId);
    } catch (err) {
      degradationHandler.recordFailure(ScopeCreepAgent.AGENT_ID);
      return skip(`Failed to detect indicators: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 6. Check if any indicators are significant
    const isSignificant =
      indicators.taskCountDelta >= 3 ||
      indicators.estimateIncreaseDays >= 5 ||
      indicators.changeRequestCount >= 2;

    if (!isSignificant) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'No significant scope creep indicators' };
    }

    // 7. Run reasoning engine
    let analysis: ScopeAnalysisResult | null;
    try {
      analysis = await reasoningEngine.generateScopeAnalysis({
        projectId: input.projectId,
        indicators,
        scanId: input.scanId,
      });
    } catch (err) {
      degradationHandler.recordFailure(ScopeCreepAgent.AGENT_ID);
      return skip(`Reasoning engine failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!analysis) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'Reasoning engine returned no analysis (Claude unavailable or parse failure)' };
    }

    // 8. Log confidence
    await confidenceCalculator.log(
      ScopeCreepAgent.AGENT_ID,
      input.projectId,
      analysis.confidence,
    );

    // 9. Check if confidence allows proposals
    if (!analysis.confidence.canPropose) {
      degradationHandler.recordSuccess(ScopeCreepAgent.AGENT_ID);

      await notificationService.create({
        userId: input.userId,
        type: 'agent_low_confidence',
        severity: 'low',
        title: 'Scope creep indicators detected (low confidence)',
        message: `Scope creep indicators detected but agent confidence is too low (${analysis.confidence.score}%) to propose actions. Review project scope manually.`,
        projectId: input.projectId,
      });

      return { analysis, proposal: null, indicators, skipped: true, skipReason: `Confidence too low: ${analysis.confidence.score}%` };
    }

    // 10. Create proposal
    if (!analysis.hasScopeCreep || analysis.suggestedActions.length === 0) {
      degradationHandler.recordSuccess(ScopeCreepAgent.AGENT_ID);
      return { analysis, proposal: null, indicators, skipped: true, skipReason: 'Analysis found no actionable scope creep' };
    }

    const snapshotVersion = this.computeSnapshotVersion(indicators);

    const proposalInput: CreateProposalInput = {
      projectId: input.projectId,
      agentId: ScopeCreepAgent.AGENT_ID,
      agentVersion: ScopeCreepAgent.AGENT_VERSION,
      title: `Scope Creep Alert: ${analysis.severity} severity`,
      reasoning: analysis.reasoning,
      summary: `**Root Causes:** ${analysis.rootCauses.join(', ')}\n\n**Recommendations:** ${analysis.recommendations.join('; ')}`,
      confidenceScore: analysis.confidence.score,
      confidenceFactors: analysis.confidence.factors as unknown as Record<string, unknown>,
      riskLevel: analysis.severity === 'critical' ? 'critical' : analysis.severity === 'high' ? 'high' : 'medium',
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
      ScopeCreepAgent.AGENT_ID,
      input.projectId,
      analysis.confidence,
      proposal.id,
    );

    // 12. Notify project owner
    await notificationService.create({
      userId: input.userId,
      type: 'agent_proposal',
      severity: analysis.severity === 'critical' ? 'critical' : analysis.severity === 'high' ? 'high' : 'medium',
      title: `Scope creep detected (${analysis.severity})`,
      message: `Agent detected scope creep: ${indicators.taskCountDelta} new tasks, ${indicators.estimateIncreaseDays}d estimate growth, ${indicators.changeRequestCount} change request(s). ${analysis.suggestedActions.length} action(s) proposed.`,
      projectId: input.projectId,
      linkType: 'proposal',
      linkId: proposal.id,
    });

    degradationHandler.recordSuccess(ScopeCreepAgent.AGENT_ID);

    return { analysis, proposal: { id: proposal.id }, indicators, skipped: false };
  }

  /**
   * Detect scope creep indicators by comparing current state against baselines.
   */
  async detectIndicators(projectId: string): Promise<ScopeCreepIndicators> {
    const schedules = await scheduleService.findByProjectId(projectId);
    if (schedules.length === 0) {
      return { taskCountDelta: 0, estimateIncreaseDays: 0, changeRequestCount: 0, originalTaskCount: 0, currentTaskCount: 0 };
    }

    // Current task count and total estimates
    const scheduleIds = schedules.map(s => s.id);
    const placeholders = scheduleIds.map(() => '?').join(',');

    const currentRows = await databaseService.query<{ cnt: number; total_est: number }>(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(estimated_days), 0) AS total_est
       FROM tasks WHERE schedule_id IN (${placeholders}) AND status != 'cancelled'`,
      scheduleIds,
    );
    const currentTaskCount = Number(currentRows[0]?.cnt ?? 0);
    const currentEstimate = Number(currentRows[0]?.total_est ?? 0);

    // Baseline task count (from earliest baseline, if any)
    let originalTaskCount = currentTaskCount;
    let originalEstimate = currentEstimate;

    try {
      const baselineRows = await databaseService.query<{ snapshot_data: string }>(
        `SELECT snapshot_data FROM baselines
         WHERE project_id = ? ORDER BY created_at ASC LIMIT 1`,
        [projectId],
      );

      if (baselineRows.length > 0 && baselineRows[0].snapshot_data) {
        const snapshot = JSON.parse(baselineRows[0].snapshot_data);
        if (snapshot.tasks && Array.isArray(snapshot.tasks)) {
          originalTaskCount = snapshot.tasks.length;
          originalEstimate = snapshot.tasks.reduce(
            (sum: number, t: any) => sum + (t.estimatedDays ?? t.estimated_days ?? 0),
            0,
          );
        }
      }
    } catch {
      // Baseline data optional — use current as baseline
    }

    // Count open change requests
    let changeRequestCount = 0;
    try {
      const crRows = await databaseService.query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM change_requests
         WHERE project_id = ? AND status IN ('pending', 'submitted')`,
        [projectId],
      );
      changeRequestCount = Number(crRows[0]?.cnt ?? 0);
    } catch {
      // Change requests table may not exist
    }

    return {
      taskCountDelta: currentTaskCount - originalTaskCount,
      estimateIncreaseDays: Math.max(0, currentEstimate - originalEstimate),
      changeRequestCount,
      originalTaskCount,
      currentTaskCount,
    };
  }

  private computeSnapshotVersion(indicators: ScopeCreepIndicators): string {
    const data = `${indicators.currentTaskCount}:${indicators.estimateIncreaseDays}:${indicators.changeRequestCount}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

export const scopeCreepAgent = new ScopeCreepAgent();
