import { reasoningEngine, ReasoningInput, RecoveryPlan } from './ReasoningEngine';
import { actionProposalService, CreateProposalInput, Proposal } from './ActionProposalService';
import { confidenceCalculator } from './ConfidenceCalculator';
import { agentCostTracker } from './AgentCostTracker';
import { notificationService } from '../NotificationService';
import { RiskLevel } from './ActionProposalService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleRecoveryInput {
  projectId: string;
  scheduleId: string;
  delays: Array<{
    taskId: string;
    taskName: string;
    delayDays: number;
    isOnCriticalPath: boolean;
    currentProgress: number;
    expectedEndDate: string;
    estimatedEndDate: string;
  }>;
  userId: string;     // Project owner
  scanId?: string;
}

export interface ScheduleRecoveryOutput {
  recoveryPlan: RecoveryPlan | null;
  proposal: Proposal | null;
  skipped: boolean;
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ScheduleRecoveryAgent {
  static readonly AGENT_ID = 'schedule-recovery-v1';
  static readonly AGENT_VERSION = '1.0.0';

  /**
   * Main entry point: detect delays → reason → propose recovery.
   */
  async run(input: ScheduleRecoveryInput): Promise<ScheduleRecoveryOutput> {
    // 1. Check cost budget
    const budget = await agentCostTracker.checkBudget(ScheduleRecoveryAgent.AGENT_ID, input.projectId);
    if (!budget.allowed) {
      return { recoveryPlan: null, proposal: null, skipped: true, skipReason: budget.reason };
    }

    // 2. Filter to significant delays (>= 2 days or on critical path)
    const significantDelays = input.delays.filter(
      d => d.delayDays >= 2 || d.isOnCriticalPath,
    );

    if (significantDelays.length === 0) {
      return { recoveryPlan: null, proposal: null, skipped: true, skipReason: 'No significant delays detected' };
    }

    // 3. Run reasoning engine
    const reasoningInput: ReasoningInput = {
      projectId: input.projectId,
      scheduleId: input.scheduleId,
      delays: significantDelays,
      scanId: input.scanId,
    };

    const plan = await reasoningEngine.generateRecoveryPlan(reasoningInput);
    if (!plan) {
      return { recoveryPlan: null, proposal: null, skipped: true, skipReason: 'Reasoning engine returned no plan (Claude unavailable or parse failure)' };
    }

    // 4. Log confidence
    await confidenceCalculator.log(
      ScheduleRecoveryAgent.AGENT_ID,
      input.projectId,
      plan.confidence,
    );

    // 5. Check if confidence allows proposals
    if (!plan.confidence.canPropose) {
      // Notify but don't propose
      await notificationService.create({
        userId: input.userId,
        type: 'agent_low_confidence',
        severity: 'low',
        title: 'Schedule delays detected (low confidence)',
        message: `${significantDelays.length} delay(s) detected but agent confidence is too low (${plan.confidence.score}%) to propose a recovery plan. Review delays manually.`,
        projectId: input.projectId,
        scheduleId: input.scheduleId,
      });

      return { recoveryPlan: plan, proposal: null, skipped: true, skipReason: `Confidence too low: ${plan.confidence.score}%` };
    }

    // 6. Pick the best option (rank 1) and create a proposal
    const bestOption = plan.options[0];
    if (!bestOption || bestOption.actions.length === 0) {
      return { recoveryPlan: plan, proposal: null, skipped: true, skipReason: 'No actionable options in recovery plan' };
    }

    // 7. Determine risk level
    const riskLevel = this.assessRiskLevel(bestOption.actions.length, significantDelays);

    // 8. Build data snapshot version (hash of delay state)
    const snapshotVersion = this.computeSnapshotVersion(significantDelays);

    // 9. Create the proposal
    const proposalInput: CreateProposalInput = {
      projectId: input.projectId,
      scheduleId: input.scheduleId,
      agentId: ScheduleRecoveryAgent.AGENT_ID,
      agentVersion: ScheduleRecoveryAgent.AGENT_VERSION,
      title: bestOption.title,
      reasoning: plan.reasoning,
      summary: `${plan.rootCause}\n\n**Impact if no action taken:** ${plan.impactAnalysis}\n\n**Recommended:** ${bestOption.description}`,
      confidenceScore: plan.confidence.score,
      confidenceFactors: plan.confidence.factors as unknown as Record<string, unknown>,
      riskLevel,
      dataSnapshotVersion: snapshotVersion,
      createdBy: input.userId,
      actions: bestOption.actions.map((a, idx) => ({
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

    // 10. Update confidence log with proposal ID
    await confidenceCalculator.log(
      ScheduleRecoveryAgent.AGENT_ID,
      input.projectId,
      plan.confidence,
      proposal.id,
    );

    // 11. Notify project owner
    const confidenceLabel = plan.confidence.label === 'low' ? ' (low confidence)' : '';
    await notificationService.create({
      userId: input.userId,
      type: 'agent_proposal',
      severity: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium',
      title: `Recovery plan proposed${confidenceLabel}`,
      message: `Agent detected ${significantDelays.length} delay(s) and proposes: "${bestOption.title}". Confidence: ${plan.confidence.score}%. ${bestOption.actions.length} action(s) pending your approval.`,
      projectId: input.projectId,
      scheduleId: input.scheduleId,
      linkType: 'proposal',
      linkId: proposal.id,
    });

    return { recoveryPlan: plan, proposal, skipped: false };
  }

  private assessRiskLevel(actionCount: number, delays: Array<{ isOnCriticalPath: boolean }>): RiskLevel {
    // Critical: >5 actions or bulk changes
    if (actionCount > 5) return 'critical';

    // High: affects critical path tasks
    const criticalPathDelays = delays.filter(d => d.isOnCriticalPath);
    if (criticalPathDelays.length > 0) return 'high';

    // Medium: date changes
    return 'medium';
  }

  private computeSnapshotVersion(delays: Array<{ taskId: string; delayDays: number; currentProgress: number }>): string {
    // Simple hash of delay state for staleness detection
    const data = delays.map(d => `${d.taskId}:${d.delayDays}:${d.currentProgress}`).join('|');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

export const scheduleRecoveryAgent = new ScheduleRecoveryAgent();
