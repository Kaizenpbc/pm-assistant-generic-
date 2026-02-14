import { ScheduleService, Task } from './ScheduleService';
import { CriticalPathService } from './CriticalPathService';
import { claudeService } from './claudeService';
import { config } from '../config';
import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';
import {
  DelayedTask,
  ProposedChange,
  RescheduleProposal,
  RescheduleAIResponseSchema,
  RescheduleAIResponse,
} from '../schemas/autoRescheduleSchemas';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export class AutoRescheduleService {
  private static proposals: RescheduleProposal[] = [];

  private scheduleService = new ScheduleService();
  private criticalPathService = new CriticalPathService();

  private get useDb() { return databaseService.isHealthy(); }

  private rowToProposal(row: any): RescheduleProposal {
    const c = toCamelCaseKeys(row);
    return {
      ...c,
      delayedTasks: typeof c.delayedTasks === 'string' ? JSON.parse(c.delayedTasks) : c.delayedTasks,
      proposedChanges: typeof c.proposedChanges === 'string' ? JSON.parse(c.proposedChanges) : c.proposedChanges,
      estimatedImpact: typeof c.estimatedImpact === 'string' ? JSON.parse(c.estimatedImpact) : c.estimatedImpact,
      createdAt: new Date(c.createdAt).toISOString(),
    } as RescheduleProposal;
  }

  // ---------------------------------------------------------------------------
  // Detect Delays
  // ---------------------------------------------------------------------------

  async detectDelays(scheduleId: string): Promise<DelayedTask[]> {
    const tasks = await this.scheduleService.findTasksByScheduleId(scheduleId);
    const criticalPathResult = await this.criticalPathService.calculateCriticalPath(scheduleId);
    const criticalIds = new Set(criticalPathResult.criticalPathTaskIds);

    const now = new Date();
    const delayed: DelayedTask[] = [];

    for (const task of tasks) {
      // Only check in-progress or pending tasks that have dates
      if (task.status === 'completed' || task.status === 'cancelled') continue;
      if (!task.startDate || !task.endDate) continue;

      const startDate = new Date(task.startDate);
      const endDate = new Date(task.endDate);

      // Skip tasks that haven't started yet (start date in the future)
      if (startDate.getTime() > now.getTime()) continue;

      const totalDuration = endDate.getTime() - startDate.getTime();
      if (totalDuration <= 0) continue;

      const elapsed = now.getTime() - startDate.getTime();
      const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);
      const actualProgress = task.progressPercentage ?? 0;

      // Flag as delayed if actual progress is more than 10% behind expected
      if (actualProgress < expectedProgress - 10) {
        // Estimate completion based on current velocity
        let estimatedEndDate: Date;
        if (actualProgress <= 0) {
          // No progress at all — estimate double the remaining duration from now
          const remainingMs = endDate.getTime() - now.getTime();
          estimatedEndDate = new Date(now.getTime() + remainingMs * 2);
        } else {
          // Project completion based on current velocity
          const msPerPercent = elapsed / actualProgress;
          const remainingPercent = 100 - actualProgress;
          const estimatedRemainingMs = remainingPercent * msPerPercent;
          estimatedEndDate = new Date(now.getTime() + estimatedRemainingMs);
        }

        const delayDays = Math.ceil(
          (estimatedEndDate.getTime() - endDate.getTime()) / DAY_MS,
        );

        if (delayDays <= 0) continue;

        const isOnCriticalPath = criticalIds.has(task.id);

        // Determine severity
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (isOnCriticalPath && delayDays > 14) {
          severity = 'critical';
        } else if (isOnCriticalPath || delayDays > 21) {
          severity = 'high';
        } else if (delayDays > 7) {
          severity = 'medium';
        } else {
          severity = 'low';
        }

        delayed.push({
          taskId: task.id,
          taskName: task.name,
          expectedEndDate: toDateStr(endDate),
          currentProgress: actualProgress,
          estimatedEndDate: toDateStr(estimatedEndDate),
          delayDays,
          isOnCriticalPath,
          severity,
        });
      }
    }

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    delayed.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return delayed;
  }

  // ---------------------------------------------------------------------------
  // Generate Proposal
  // ---------------------------------------------------------------------------

  async generateProposal(scheduleId: string, userId?: string): Promise<RescheduleProposal> {
    const delayedTasks = await this.detectDelays(scheduleId);
    const criticalPathResult = await this.criticalPathService.calculateCriticalPath(scheduleId);
    const allTasks = await this.scheduleService.findTasksByScheduleId(scheduleId);
    const schedule = await this.scheduleService.findById(scheduleId);

    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const originalEndDate = toDateStr(new Date(schedule.endDate));

    // Build task summary for AI context
    const taskSummary = allTasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate ? toDateStr(new Date(t.startDate)) : null,
      endDate: t.endDate ? toDateStr(new Date(t.endDate)) : null,
      progressPercentage: t.progressPercentage ?? 0,
      dependency: t.dependency ?? null,
      estimatedDays: t.estimatedDays ?? null,
    }));

    let proposedChanges: ProposedChange[];
    let rationale: string;
    let estimatedImpact: RescheduleProposal['estimatedImpact'];

    if (config.AI_ENABLED && claudeService.isAvailable() && delayedTasks.length > 0) {
      // Use AI to generate intelligent rescheduling proposal
      const systemPrompt = `You are an expert project scheduling AI. Your role is to analyze delayed tasks in a project schedule and propose minimal-disruption date changes to get the project back on track.

Rules:
- Only propose changes for tasks that NEED to be moved (delayed tasks and their dependents).
- Respect dependency chains: if task B depends on task A, B cannot start before A finishes.
- Minimize the overall project end date impact.
- Prefer compressing non-critical-path tasks over extending the critical path.
- Dates must be in YYYY-MM-DD format.
- Be realistic with proposed dates — account for the delays already detected.
- proposedEndDate in estimatedImpact should be the latest proposedEndDate among all tasks, or the original end date if it's later.
- daysChange should be positive if the project is extended, negative if shortened, 0 if unchanged.`;

      const userMessage = `Here is the current schedule state:

Schedule: ${schedule.name} (${scheduleId})
Original End Date: ${originalEndDate}

All Tasks:
${JSON.stringify(taskSummary, null, 2)}

Critical Path Task IDs: ${JSON.stringify(criticalPathResult.criticalPathTaskIds)}
Project Duration (days): ${criticalPathResult.projectDuration}

Detected Delays:
${JSON.stringify(delayedTasks, null, 2)}

Please propose date changes to reschedule affected tasks with minimal disruption. Only include tasks whose dates actually need to change.`;

      const aiResult = await claudeService.completeWithJsonSchema<RescheduleAIResponse>({
        systemPrompt,
        userMessage,
        schema: RescheduleAIResponseSchema,
        maxTokens: 4096,
      });

      const aiResponse = aiResult.data;

      // Map AI proposed changes to full ProposedChange objects with current dates
      proposedChanges = aiResponse.proposedChanges.map((pc) => {
        const task = allTasks.find((t) => t.id === pc.taskId);
        return {
          taskId: pc.taskId,
          taskName: pc.taskName,
          currentStartDate: task?.startDate ? toDateStr(new Date(task.startDate)) : '',
          currentEndDate: task?.endDate ? toDateStr(new Date(task.endDate)) : '',
          proposedStartDate: pc.proposedStartDate,
          proposedEndDate: pc.proposedEndDate,
          reason: pc.reason,
        };
      });

      rationale = aiResponse.rationale;
      estimatedImpact = {
        originalEndDate,
        proposedEndDate: aiResponse.estimatedImpact.proposedEndDate,
        daysChange: aiResponse.estimatedImpact.daysChange,
        criticalPathImpact: aiResponse.estimatedImpact.criticalPathImpact,
      };
    } else {
      // Fallback: generate a simple heuristic-based proposal without AI
      proposedChanges = [];

      for (const delayed of delayedTasks) {
        const task = allTasks.find((t) => t.id === delayed.taskId);
        if (!task || !task.startDate || !task.endDate) continue;

        const currentStart = toDateStr(new Date(task.startDate));
        const currentEnd = toDateStr(new Date(task.endDate));
        const newEndDate = new Date(new Date(task.endDate).getTime() + delayed.delayDays * DAY_MS);

        proposedChanges.push({
          taskId: task.id,
          taskName: task.name,
          currentStartDate: currentStart,
          currentEndDate: currentEnd,
          proposedStartDate: currentStart,
          proposedEndDate: toDateStr(newEndDate),
          reason: `Task is ${delayed.delayDays} days behind schedule (${delayed.currentProgress}% complete vs expected progress). Extending end date to accommodate current velocity.`,
        });

        // Also shift dependent tasks
        const dependents = allTasks.filter((t) => t.dependency === task.id);
        for (const dep of dependents) {
          if (!dep.startDate || !dep.endDate) continue;
          if (dep.status === 'completed' || dep.status === 'cancelled') continue;

          const depCurrentStart = new Date(dep.startDate);
          const depCurrentEnd = new Date(dep.endDate);
          const depDuration = depCurrentEnd.getTime() - depCurrentStart.getTime();

          // New start is after the delayed task's new end
          const depNewStart = new Date(newEndDate.getTime() + DAY_MS);
          const depNewEnd = new Date(depNewStart.getTime() + depDuration);

          // Only add if not already in proposedChanges
          if (!proposedChanges.find((pc) => pc.taskId === dep.id)) {
            proposedChanges.push({
              taskId: dep.id,
              taskName: dep.name,
              currentStartDate: toDateStr(depCurrentStart),
              currentEndDate: toDateStr(depCurrentEnd),
              proposedStartDate: toDateStr(depNewStart),
              proposedEndDate: toDateStr(depNewEnd),
              reason: `Shifted due to delay in dependency "${task.name}".`,
            });
          }
        }
      }

      // Calculate impact
      const latestProposedEnd = proposedChanges.reduce((latest, pc) => {
        const d = new Date(pc.proposedEndDate);
        return d > latest ? d : latest;
      }, new Date(originalEndDate));

      const daysChange = Math.round(
        (latestProposedEnd.getTime() - new Date(originalEndDate).getTime()) / DAY_MS,
      );

      rationale = delayedTasks.length > 0
        ? `Detected ${delayedTasks.length} delayed task(s). Proposed date adjustments extend delayed tasks to match current velocity and shift dependent tasks accordingly.`
        : 'No delays detected. Schedule is on track.';

      estimatedImpact = {
        originalEndDate,
        proposedEndDate: toDateStr(latestProposedEnd),
        daysChange,
        criticalPathImpact: delayedTasks.some((d) => d.isOnCriticalPath)
          ? 'Critical path is affected. Project end date will likely be extended.'
          : 'Critical path is not directly affected. Impact may be limited to non-critical tasks.',
      };
    }

    const proposal: RescheduleProposal = {
      id: `rp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scheduleId,
      status: 'pending',
      delayedTasks,
      proposedChanges,
      rationale,
      estimatedImpact,
      createdAt: new Date().toISOString(),
    };

    // Persist to DB
    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO reschedule_proposals (id, schedule_id, status, delayed_tasks, proposed_changes, rationale, estimated_impact, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proposal.id,
          proposal.scheduleId,
          proposal.status,
          JSON.stringify(proposal.delayedTasks),
          JSON.stringify(proposal.proposedChanges),
          proposal.rationale,
          JSON.stringify(proposal.estimatedImpact),
          new Date(proposal.createdAt),
        ],
      );
    }

    // Also keep in-memory
    AutoRescheduleService.proposals.push(proposal);

    // Log activity
    if (userId) {
      this.scheduleService.logActivity(
        scheduleId,
        userId,
        'System',
        'auto-reschedule-proposed',
        'proposal',
        undefined,
        `Proposal ${proposal.id}: ${delayedTasks.length} delayed task(s), ${proposedChanges.length} proposed change(s)`,
      );
    }

    return proposal;
  }

  // ---------------------------------------------------------------------------
  // Accept Proposal
  // ---------------------------------------------------------------------------

  async acceptProposal(proposalId: string): Promise<boolean> {
    const proposal = AutoRescheduleService.proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') return false;

    // Apply all proposed changes
    for (const change of proposal.proposedChanges) {
      await this.scheduleService.updateTask(change.taskId, {
        startDate: new Date(change.proposedStartDate),
        endDate: new Date(change.proposedEndDate),
      });

      this.scheduleService.logActivity(
        change.taskId,
        '1',
        'System',
        'auto-rescheduled',
        'dates',
        `${change.currentStartDate} - ${change.currentEndDate}`,
        `${change.proposedStartDate} - ${change.proposedEndDate}`,
      );
    }

    // Update DB
    if (this.useDb) {
      await databaseService.query(
        `UPDATE reschedule_proposals SET status = 'accepted' WHERE id = ?`,
        [proposalId],
      );
    }

    // Update in-memory
    proposal.status = 'accepted';
    return true;
  }

  // ---------------------------------------------------------------------------
  // Reject Proposal
  // ---------------------------------------------------------------------------

  async rejectProposal(proposalId: string, feedback?: string): Promise<boolean> {
    const proposal = AutoRescheduleService.proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') return false;

    // Update DB
    if (this.useDb) {
      await databaseService.query(
        `UPDATE reschedule_proposals SET status = 'rejected', feedback = ? WHERE id = ?`,
        [feedback || null, proposalId],
      );
    }

    // Update in-memory
    proposal.status = 'rejected';
    if (feedback) {
      proposal.feedback = feedback;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Modify Proposal
  // ---------------------------------------------------------------------------

  async modifyProposal(proposalId: string, modifications: ProposedChange[]): Promise<boolean> {
    const proposal = AutoRescheduleService.proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') return false;

    // Update DB
    if (this.useDb) {
      await databaseService.query(
        `UPDATE reschedule_proposals SET proposed_changes = ?, status = 'modified' WHERE id = ?`,
        [JSON.stringify(modifications), proposalId],
      );
    }

    // Update in-memory
    proposal.proposedChanges = modifications;
    proposal.status = 'modified';

    return true;
  }

  // ---------------------------------------------------------------------------
  // Get Proposals
  // ---------------------------------------------------------------------------

  async getProposals(scheduleId: string): Promise<RescheduleProposal[]> {
    if (this.useDb) {
      const rows = await databaseService.query(
        `SELECT * FROM reschedule_proposals WHERE schedule_id = ? ORDER BY created_at DESC`,
        [scheduleId],
      );
      return rows.map((r: any) => this.rowToProposal(r));
    }

    return AutoRescheduleService.proposals
      .filter((p) => p.scheduleId === scheduleId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
