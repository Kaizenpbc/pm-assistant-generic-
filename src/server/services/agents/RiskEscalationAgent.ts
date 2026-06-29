import { reasoningEngine, RiskEscalationResult } from './ReasoningEngine';
import { actionProposalService, CreateProposalInput } from './ActionProposalService';
import { confidenceCalculator } from './ConfidenceCalculator';
import { agentCostTracker } from './AgentCostTracker';
import { killSwitchService } from './KillSwitchService';
import { proposalRateLimiter } from './ProposalRateLimiter';
import { degradationHandler } from './DegradationHandler';
import { notificationService } from '../NotificationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectAgentResults {
  projectId: string;
  projectName: string;
  agentFlags: {
    scheduleDelay: boolean;
    budgetOverrun: boolean;
    scopeCreep: boolean;
    resourceBottleneck: boolean;
    meetingOverdue: boolean;
  };
  details: Record<string, string>;
}

export interface RiskEscalationInput {
  userId: string;
  projectResults: ProjectAgentResults[];
  scanId?: string;
}

export interface EscalationIndicators {
  totalProjects: number;
  compoundRiskProjects: ProjectAgentResults[];
  maxFlagsOnSingleProject: number;
  flagDistribution: Record<string, number>;
}

export interface RiskEscalationOutput {
  analysis: RiskEscalationResult | null;
  proposal: { id: string } | null;
  indicators: EscalationIndicators | null;
  skipped: boolean;
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class RiskEscalationAgent {
  static readonly AGENT_ID = 'risk-escalation-v1';
  static readonly AGENT_VERSION = '1.0.0';

  /** Minimum number of agent flags on a single project to consider it a compound risk */
  static readonly COMPOUND_THRESHOLD = 2;

  async run(input: RiskEscalationInput): Promise<RiskEscalationOutput> {
    const skip = (reason: string): RiskEscalationOutput => ({
      analysis: null, proposal: null, indicators: null, skipped: true, skipReason: reason,
    });

    // 1. Check cost budget
    const budget = await agentCostTracker.checkBudget(RiskEscalationAgent.AGENT_ID, 'portfolio');
    if (!budget.allowed) return skip(budget.reason!);

    // 2. Check kill switch
    const ks = killSwitchService.canRun(RiskEscalationAgent.AGENT_ID, 'portfolio');
    if (!ks.allowed) return skip(ks.reason!);

    // 3. Check rate limit
    const rl = await proposalRateLimiter.check(RiskEscalationAgent.AGENT_ID, 'portfolio');
    if (!rl.allowed) return skip(rl.reason!);

    // 4. Check circuit breaker
    const cb = degradationHandler.canAgentRun(RiskEscalationAgent.AGENT_ID);
    if (!cb.allowed) return skip(cb.reason!);

    // 5. Analyze scan results for compound risks
    const indicators = this.gatherIndicators(input.projectResults);

    // 6. Check significance — need at least one project with 2+ agent flags
    if (indicators.compoundRiskProjects.length === 0) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'No compound risks detected — no project flagged by multiple agents' };
    }

    // 7. Run reasoning engine
    let analysis: RiskEscalationResult | null;
    try {
      analysis = await reasoningEngine.generateRiskEscalation({
        userId: input.userId,
        indicators,
        scanId: input.scanId,
      });
    } catch (err) {
      degradationHandler.recordFailure(RiskEscalationAgent.AGENT_ID);
      return skip(`Reasoning engine failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!analysis) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'Reasoning engine returned no analysis (Claude unavailable or parse failure)' };
    }

    // 8. Log confidence
    await confidenceCalculator.log(
      RiskEscalationAgent.AGENT_ID,
      'portfolio',
      analysis.confidence,
    );

    // 9. Check if confidence allows proposals
    if (!analysis.confidence.canPropose) {
      degradationHandler.recordSuccess(RiskEscalationAgent.AGENT_ID);

      await notificationService.create({
        userId: input.userId,
        type: 'agent_low_confidence',
        severity: 'low',
        title: 'Compound risks detected (low confidence)',
        message: `${indicators.compoundRiskProjects.length} project(s) flagged by multiple agents but confidence is too low (${analysis.confidence.score}%) to propose escalation.`,
      });

      return { analysis, proposal: null, indicators, skipped: true, skipReason: `Confidence too low: ${analysis.confidence.score}%` };
    }

    // 10. Create proposal if actionable
    if (!analysis.hasCompoundRisk || analysis.suggestedActions.length === 0) {
      degradationHandler.recordSuccess(RiskEscalationAgent.AGENT_ID);
      return { analysis, proposal: null, indicators, skipped: true, skipReason: 'Analysis found no actionable compound risks' };
    }

    const snapshotVersion = this.computeSnapshotVersion(indicators);

    const proposalInput: CreateProposalInput = {
      projectId: 'portfolio',
      agentId: RiskEscalationAgent.AGENT_ID,
      agentVersion: RiskEscalationAgent.AGENT_VERSION,
      title: `Risk Escalation: ${indicators.compoundRiskProjects.length} project(s) with compound risks`,
      reasoning: analysis.reasoning,
      summary: `**Compound Risk Projects:** ${indicators.compoundRiskProjects.map(p => `${p.projectName} (${this.countFlags(p)} flags)`).join(', ')}\\n\\n**Escalations:** ${analysis.escalations.join('; ')}\\n\\n**Recommendations:** ${analysis.recommendations.join('; ')}`,
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
      RiskEscalationAgent.AGENT_ID,
      'portfolio',
      analysis.confidence,
      proposal.id,
    );

    // 12. Notify user with high urgency
    await notificationService.create({
      userId: input.userId,
      type: 'agent_proposal',
      severity: analysis.severity === 'critical' ? 'critical' : 'high',
      title: `Risk escalation: ${indicators.compoundRiskProjects.length} project(s) need attention`,
      message: `Compound risks detected: ${indicators.compoundRiskProjects.map(p => `${p.projectName} (${this.describeFlags(p)})`).join('; ')}. ${analysis.suggestedActions.length} action(s) proposed.`,
      linkType: 'proposal',
      linkId: proposal.id,
    });

    degradationHandler.recordSuccess(RiskEscalationAgent.AGENT_ID);

    return { analysis, proposal: { id: proposal.id }, indicators, skipped: false };
  }

  /**
   * Analyze per-project agent results to find compound risks.
   */
  gatherIndicators(projectResults: ProjectAgentResults[]): EscalationIndicators {
    const flagDistribution: Record<string, number> = {
      scheduleDelay: 0,
      budgetOverrun: 0,
      scopeCreep: 0,
      resourceBottleneck: 0,
      meetingOverdue: 0,
    };

    for (const pr of projectResults) {
      if (pr.agentFlags.scheduleDelay) flagDistribution.scheduleDelay++;
      if (pr.agentFlags.budgetOverrun) flagDistribution.budgetOverrun++;
      if (pr.agentFlags.scopeCreep) flagDistribution.scopeCreep++;
      if (pr.agentFlags.resourceBottleneck) flagDistribution.resourceBottleneck++;
      if (pr.agentFlags.meetingOverdue) flagDistribution.meetingOverdue++;
    }

    const compoundRiskProjects = projectResults.filter(
      pr => this.countFlags(pr) >= RiskEscalationAgent.COMPOUND_THRESHOLD,
    );

    const maxFlagsOnSingleProject = projectResults.reduce(
      (max, pr) => Math.max(max, this.countFlags(pr)),
      0,
    );

    return {
      totalProjects: projectResults.length,
      compoundRiskProjects,
      maxFlagsOnSingleProject,
      flagDistribution,
    };
  }

  private countFlags(pr: ProjectAgentResults): number {
    const f = pr.agentFlags;
    return (f.scheduleDelay ? 1 : 0)
      + (f.budgetOverrun ? 1 : 0)
      + (f.scopeCreep ? 1 : 0)
      + (f.resourceBottleneck ? 1 : 0)
      + (f.meetingOverdue ? 1 : 0);
  }

  private describeFlags(pr: ProjectAgentResults): string {
    const flags: string[] = [];
    if (pr.agentFlags.scheduleDelay) flags.push('schedule');
    if (pr.agentFlags.budgetOverrun) flags.push('budget');
    if (pr.agentFlags.scopeCreep) flags.push('scope');
    if (pr.agentFlags.resourceBottleneck) flags.push('resources');
    if (pr.agentFlags.meetingOverdue) flags.push('meetings');
    return flags.join('+');
  }

  private computeSnapshotVersion(indicators: EscalationIndicators): string {
    const data = `${indicators.totalProjects}:${indicators.compoundRiskProjects.length}:${indicators.maxFlagsOnSingleProject}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

export const riskEscalationAgent = new RiskEscalationAgent();
