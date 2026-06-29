import { reasoningEngine, HygieneAnalysisResult } from './ReasoningEngine';
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

export interface ProjectHygieneInput {
  projectId: string;
  userId: string;
  scanId?: string;
}

export interface HygieneIndicators {
  staleTasks: Array<{ taskId: string; taskName: string; daysSinceUpdate: number; status: string }>;
  missingDateTasks: Array<{ taskId: string; taskName: string }>;
  unassignedTasks: Array<{ taskId: string; taskName: string }>;
  missingEstimateTasks: Array<{ taskId: string; taskName: string }>;
  abandonedSprints: Array<{ sprintId: string; sprintName: string; endDate: string }>;
  zeroProgressTasks: Array<{ taskId: string; taskName: string; daysSinceUpdate: number }>;
}

export interface ProjectHygieneOutput {
  analysis: HygieneAnalysisResult | null;
  proposal: { id: string } | null;
  indicators: HygieneIndicators | null;
  skipped: boolean;
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ProjectHygieneAgent {
  static readonly AGENT_ID = 'project-hygiene-v1';
  static readonly AGENT_VERSION = '1.0.0';

  async run(input: ProjectHygieneInput): Promise<ProjectHygieneOutput> {
    const skip = (reason: string): ProjectHygieneOutput => ({
      analysis: null, proposal: null, indicators: null, skipped: true, skipReason: reason,
    });

    // 1. Check cost budget
    const budget = await agentCostTracker.checkBudget(ProjectHygieneAgent.AGENT_ID, input.projectId);
    if (!budget.allowed) return skip(budget.reason!);

    // 2. Check kill switch
    const ks = killSwitchService.canRun(ProjectHygieneAgent.AGENT_ID, input.projectId);
    if (!ks.allowed) return skip(ks.reason!);

    // 3. Check rate limit
    const rl = await proposalRateLimiter.check(ProjectHygieneAgent.AGENT_ID, input.projectId);
    if (!rl.allowed) return skip(rl.reason!);

    // 4. Check circuit breaker
    const cb = degradationHandler.canAgentRun(ProjectHygieneAgent.AGENT_ID);
    if (!cb.allowed) return skip(cb.reason!);

    // 5. Gather indicators
    let indicators: HygieneIndicators;
    try {
      indicators = await this.gatherIndicators(input.projectId);
    } catch (err) {
      degradationHandler.recordFailure(ProjectHygieneAgent.AGENT_ID);
      return skip(`Failed to gather hygiene indicators: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 6. Check significance
    const isSignificant =
      indicators.staleTasks.length >= 3 ||
      indicators.missingDateTasks.length >= 5 ||
      indicators.abandonedSprints.length >= 1 ||
      indicators.zeroProgressTasks.length >= 3;

    if (!isSignificant) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'No significant hygiene issues detected' };
    }

    // 7. Run reasoning engine
    let analysis: HygieneAnalysisResult | null;
    try {
      analysis = await reasoningEngine.generateHygieneAnalysis({
        projectId: input.projectId,
        indicators,
        scanId: input.scanId,
      });
    } catch (err) {
      degradationHandler.recordFailure(ProjectHygieneAgent.AGENT_ID);
      return skip(`Reasoning engine failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!analysis) {
      return { analysis: null, proposal: null, indicators, skipped: true, skipReason: 'Reasoning engine returned no analysis (Claude unavailable or parse failure)' };
    }

    // 8. Log confidence
    await confidenceCalculator.log(
      ProjectHygieneAgent.AGENT_ID,
      input.projectId,
      analysis.confidence,
    );

    // 9. Check if confidence allows proposals
    if (!analysis.confidence.canPropose) {
      degradationHandler.recordSuccess(ProjectHygieneAgent.AGENT_ID);

      await notificationService.create({
        userId: input.userId,
        type: 'agent_low_confidence',
        severity: 'low',
        title: 'Project hygiene issues detected (low confidence)',
        message: `Hygiene issues detected but agent confidence is too low (${analysis.confidence.score}%) to propose actions. Review project data manually.`,
        projectId: input.projectId,
      });

      return { analysis, proposal: null, indicators, skipped: true, skipReason: `Confidence too low: ${analysis.confidence.score}%` };
    }

    // 10. Create proposal
    if (!analysis.hasHygieneIssues || analysis.suggestedActions.length === 0) {
      degradationHandler.recordSuccess(ProjectHygieneAgent.AGENT_ID);
      return { analysis, proposal: null, indicators, skipped: true, skipReason: 'Analysis found no actionable hygiene issues' };
    }

    const snapshotVersion = this.computeSnapshotVersion(indicators);

    const proposalInput: CreateProposalInput = {
      projectId: input.projectId,
      agentId: ProjectHygieneAgent.AGENT_ID,
      agentVersion: ProjectHygieneAgent.AGENT_VERSION,
      title: `Project Hygiene Alert: ${analysis.severity} severity`,
      reasoning: analysis.reasoning,
      summary: `**Issues:** ${analysis.issues.join(', ')}\n\n**Recommendations:** ${analysis.recommendations.join('; ')}`,
      confidenceScore: analysis.confidence.score,
      confidenceFactors: analysis.confidence.factors as unknown as Record<string, unknown>,
      riskLevel: 'low',
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
      ProjectHygieneAgent.AGENT_ID,
      input.projectId,
      analysis.confidence,
      proposal.id,
    );

    // 12. Notify project owner
    await notificationService.create({
      userId: input.userId,
      type: 'agent_proposal',
      severity: 'medium',
      title: `Project hygiene issues detected (${analysis.severity})`,
      message: `Agent found ${indicators.staleTasks.length} stale task(s), ${indicators.missingDateTasks.length} missing-date task(s), ${indicators.abandonedSprints.length} abandoned sprint(s), ${indicators.zeroProgressTasks.length} zero-progress task(s). ${analysis.suggestedActions.length} action(s) proposed.`,
      projectId: input.projectId,
      linkType: 'proposal',
      linkId: proposal.id,
    });

    degradationHandler.recordSuccess(ProjectHygieneAgent.AGENT_ID);

    return { analysis, proposal: { id: proposal.id }, indicators, skipped: false };
  }

  async gatherIndicators(projectId: string): Promise<HygieneIndicators> {
    const schedules = await scheduleService.findByProjectId(projectId);
    if (schedules.length === 0) {
      return { staleTasks: [], missingDateTasks: [], unassignedTasks: [], missingEstimateTasks: [], abandonedSprints: [], zeroProgressTasks: [] };
    }

    const scheduleIds = schedules.map(s => s.id);
    const placeholders = scheduleIds.map(() => '?').join(',');

    // Stale tasks: not completed/cancelled and not updated in 14 days
    const staleRows = await databaseService.query<{ id: string; name: string; days_since: number; status: string }>(
      `SELECT id, name, DATEDIFF(NOW(), updated_at) AS days_since, status
       FROM tasks
       WHERE schedule_id IN (${placeholders})
         AND status NOT IN ('completed', 'cancelled')
         AND updated_at < DATE_SUB(NOW(), INTERVAL 14 DAY)
       ORDER BY updated_at ASC LIMIT 20`,
      scheduleIds,
    );
    const staleTasks = staleRows.map(r => ({
      taskId: r.id, taskName: r.name, daysSinceUpdate: Number(r.days_since), status: r.status,
    }));

    // Missing dates
    const missingDateRows = await databaseService.query<{ id: string; name: string }>(
      `SELECT id, name FROM tasks
       WHERE schedule_id IN (${placeholders})
         AND status NOT IN ('completed', 'cancelled')
         AND (start_date IS NULL OR end_date IS NULL)
       LIMIT 20`,
      scheduleIds,
    );
    const missingDateTasks = missingDateRows.map(r => ({ taskId: r.id, taskName: r.name }));

    // Unassigned tasks
    const unassignedRows = await databaseService.query<{ id: string; name: string }>(
      `SELECT id, name FROM tasks
       WHERE schedule_id IN (${placeholders})
         AND status NOT IN ('completed', 'cancelled')
         AND (assigned_to IS NULL OR assigned_to = '')
       LIMIT 20`,
      scheduleIds,
    );
    const unassignedTasks = unassignedRows.map(r => ({ taskId: r.id, taskName: r.name }));

    // Missing estimates
    const missingEstRows = await databaseService.query<{ id: string; name: string }>(
      `SELECT id, name FROM tasks
       WHERE schedule_id IN (${placeholders})
         AND status NOT IN ('completed', 'cancelled')
         AND (estimated_days IS NULL OR estimated_days = 0)
       LIMIT 20`,
      scheduleIds,
    );
    const missingEstimateTasks = missingEstRows.map(r => ({ taskId: r.id, taskName: r.name }));

    // Abandoned sprints
    let abandonedSprints: Array<{ sprintId: string; sprintName: string; endDate: string }> = [];
    try {
      const sprintRows = await databaseService.query<{ id: string; name: string; end_date: string }>(
        `SELECT id, name, end_date FROM sprints
         WHERE project_id = ?
           AND status NOT IN ('completed')
           AND end_date < NOW()
         ORDER BY end_date ASC LIMIT 10`,
        [projectId],
      );
      abandonedSprints = sprintRows.map(r => ({ sprintId: r.id, sprintName: r.name, endDate: r.end_date }));
    } catch {
      // Sprints table may not exist
    }

    // Zero-progress tasks
    const zeroProgressRows = await databaseService.query<{ id: string; name: string; days_since: number }>(
      `SELECT id, name, DATEDIFF(NOW(), updated_at) AS days_since
       FROM tasks
       WHERE schedule_id IN (${placeholders})
         AND status = 'in_progress'
         AND (progress_percentage IS NULL OR progress_percentage = 0)
         AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY updated_at ASC LIMIT 20`,
      scheduleIds,
    );
    const zeroProgressTasks = zeroProgressRows.map(r => ({
      taskId: r.id, taskName: r.name, daysSinceUpdate: Number(r.days_since),
    }));

    return { staleTasks, missingDateTasks, unassignedTasks, missingEstimateTasks, abandonedSprints, zeroProgressTasks };
  }

  private computeSnapshotVersion(indicators: HygieneIndicators): string {
    const data = `${indicators.staleTasks.length}:${indicators.missingDateTasks.length}:${indicators.abandonedSprints.length}:${indicators.zeroProgressTasks.length}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

export const projectHygieneAgent = new ProjectHygieneAgent();
