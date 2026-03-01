import * as cron from 'node-cron';
import { config } from '../config';
import { agentRegistry } from './AgentRegistryService';
import './agentCapabilities';
import { notificationService } from './NotificationService';
import { ProjectService, type Project } from './ProjectService';
import { ScheduleService } from './ScheduleService';
import { AgentActivityLogService } from './AgentActivityLogService';
import { webhookService } from './WebhookService';
import { dagWorkflowService } from './DagWorkflowService';
import { databaseService } from '../database/connection';

export class AgentSchedulerService {
  private task: cron.ScheduledTask | null = null;
  private overdueTask: cron.ScheduledTask | null = null;
  private flaggedOverdue = new Set<string>();
  private projectService = new ProjectService();
  private scheduleService = new ScheduleService();
  private activityLog = new AgentActivityLogService();

  start(): void {
    if (!config.AGENT_ENABLED) {
      console.log('[Agent] Agent is disabled (AGENT_ENABLED=false)');
      return;
    }

    const schedule = config.AGENT_CRON_SCHEDULE;
    console.log(`[Agent] Starting agent scheduler on cron: "${schedule}"`);

    this.task = cron.schedule(schedule, async () => {
      console.log(`[Agent] Cron triggered at ${new Date().toISOString()}`);
      try {
        await this.runScan();
      } catch (error) {
        console.error('[Agent] Scan failed:', error);
      }
    });

    // Overdue-task scanner — runs more frequently to trigger date_passed workflows
    const overdueMinutes = config.AGENT_OVERDUE_SCAN_MINUTES;
    const overdueCron = `*/${overdueMinutes} * * * *`;
    console.log(`[Agent] Starting overdue-task scanner on cron: "${overdueCron}"`);

    this.overdueTask = cron.schedule(overdueCron, async () => {
      try {
        await this.runOverdueScan();
      } catch (error) {
        console.error('[Agent] Overdue scan failed:', error);
      }
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    if (this.overdueTask) {
      this.overdueTask.stop();
      this.overdueTask = null;
    }
    console.log('[Agent] Stopped agent scheduler');
  }

  async runScan(): Promise<{
    projectsScanned: number;
    schedulesScanned: number;
    delaysDetected: number;
    proposalsGenerated: number;
    notificationsSent: number;
    budgetAlertsCreated: number;
    mcAlertsCreated: number;
    meetingAlertsCreated: number;
  }> {
    console.log('[Agent] Starting scan...');

    const stats = {
      projectsScanned: 0,
      schedulesScanned: 0,
      delaysDetected: 0,
      proposalsGenerated: 0,
      notificationsSent: 0,
      budgetAlertsCreated: 0,
      mcAlertsCreated: 0,
      meetingAlertsCreated: 0,
    };

    const thresholdDays = config.AGENT_DELAY_THRESHOLD_DAYS;

    // Get all active/planning projects
    const allProjects = await this.projectService.findAll();
    const projects = allProjects.filter(
      (p) => p.status === 'active' || p.status === 'planning',
    );

    console.log(`[Agent] Found ${projects.length} active/planning projects`);

    for (const project of projects) {
      stats.projectsScanned++;

      const schedules = await this.scheduleService.findByProjectId(project.id);

      // --- Agent 1: Auto-Reschedule ---
      for (const schedule of schedules) {
        stats.schedulesScanned++;

        try {
          const ctx = { actorId: 'system' as const, actorType: 'system' as const, source: 'system' as const, projectId: project.id };
          const result = await agentRegistry.invoke('auto-reschedule-v1', { scheduleId: schedule.id, thresholdDays }, ctx);

          if (!result.success) {
            throw new Error(result.error || 'Auto-reschedule agent failed');
          }

          const { delays: significant, proposal } = result.output;
          stats.delaysDetected += significant.length;

          if (significant.length === 0) {
            await this.activityLog.log({
              projectId: project.id,
              agentName: 'auto_reschedule',
              result: 'skipped',
              summary: `No significant delays in "${schedule.name}" (threshold: ${thresholdDays}d)`,
              details: { scheduleId: schedule.id, scheduleName: schedule.name, thresholdDays },
            });
            continue;
          }

          console.log(
            `[Agent] ${project.name} / ${schedule.name}: ${significant.length} significant delay(s)`,
          );

          stats.proposalsGenerated++;

          // Notify project owner
          const notifyUserId = project.projectManagerId || project.createdBy;

          await notificationService.create({
            userId: notifyUserId,
            type: 'reschedule_proposal',
            severity: significant.some((d: any) => d.severity === 'critical')
              ? 'critical'
              : significant.some((d: any) => d.severity === 'high')
                ? 'high'
                : 'medium',
            title: `Auto-Reschedule: ${significant.length} delay(s) in "${schedule.name}"`,
            message: `${proposal.proposedChanges.length} date change(s) proposed. Impact: ${proposal.estimatedImpact.daysChange} day(s). Review the proposal to approve or reject.`,
            projectId: project.id,
            scheduleId: schedule.id,
            linkType: 'proposal',
            linkId: proposal.id,
          });
          stats.notificationsSent++;

          await this.activityLog.log({
            projectId: project.id,
            agentName: 'auto_reschedule',
            result: 'alert_created',
            summary: `${significant.length} significant delay(s) in "${schedule.name}". ${proposal.proposedChanges.length} change(s) proposed.`,
            details: { scheduleId: schedule.id, scheduleName: schedule.name, significantDelays: significant.length, proposedChanges: proposal.proposedChanges.length, daysImpact: proposal.estimatedImpact.daysChange },
          });
        } catch (error) {
          console.error(
            `[Agent] Error processing schedule ${schedule.id} (${schedule.name}):`,
            error,
          );
          await this.activityLog.log({
            projectId: project.id,
            agentName: 'auto_reschedule',
            result: 'error',
            summary: `Error processing schedule "${schedule.name}": ${error instanceof Error ? error.message : String(error)}`,
            details: { scheduleId: schedule.id, scheduleName: schedule.name },
          }).catch(() => {});
        }
      }

      // --- Agent 2: Budget Burn-Rate ---
      try {
        const budgetAlerts = await this.runBudgetBurnRateAgent(project);
        stats.budgetAlertsCreated += budgetAlerts;
      } catch (error) {
        console.error(`[Agent:Budget] Error for project ${project.id} (${project.name}):`, error);
        await this.activityLog.log({
          projectId: project.id,
          agentName: 'budget',
          result: 'error',
          summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }).catch(() => {});
      }

      // --- Agent 3: Monte Carlo Confidence ---
      try {
        const mcAlerts = await this.runMonteCarloConfidenceAgent(project, schedules);
        stats.mcAlertsCreated += mcAlerts;
      } catch (error) {
        console.error(`[Agent:MonteCarlo] Error for project ${project.id} (${project.name}):`, error);
        await this.activityLog.log({
          projectId: project.id,
          agentName: 'monte_carlo',
          result: 'error',
          summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }).catch(() => {});
      }

      // --- Agent 4: Meeting Follow-Up ---
      try {
        const meetingAlerts = await this.runMeetingFollowUpAgent(project);
        stats.meetingAlertsCreated += meetingAlerts;
      } catch (error) {
        console.error(`[Agent:Meeting] Error for project ${project.id} (${project.name}):`, error);
        await this.activityLog.log({
          projectId: project.id,
          agentName: 'meeting',
          result: 'error',
          summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }).catch(() => {});
      }
    }

    console.log('[Agent] Scan complete:', stats);
    webhookService.dispatch('agent.scan_completed', { stats }, undefined);
    return stats;
  }

  // ---------------------------------------------------------------------------
  // Overdue-Task Scanner (frequent cron)
  // ---------------------------------------------------------------------------

  async runOverdueScan(): Promise<number> {
    let rows: any[];
    try {
      rows = await databaseService.query(
        `SELECT * FROM tasks WHERE end_date < CURDATE() AND status NOT IN ('completed', 'cancelled')`,
      );
    } catch {
      // Tables may not exist yet
      return 0;
    }

    let triggered = 0;
    for (const row of rows) {
      const taskId = row.id;
      if (this.flaggedOverdue.has(taskId)) continue;

      this.flaggedOverdue.add(taskId);
      const task = await this.scheduleService.findTaskById(taskId);
      if (!task) continue;

      // Fire date_passed triggers via workflow engine
      dagWorkflowService.evaluateTaskChange(task, task, this.scheduleService).catch(err =>
        console.error('[Agent] Overdue workflow trigger error:', err)
      );
      triggered++;
    }

    if (triggered > 0) {
      console.log(`[Agent] Overdue scan: triggered workflows for ${triggered} newly-overdue task(s)`);
    }
    return triggered;
  }

  // ---------------------------------------------------------------------------
  // Agent 2 — Budget Burn-Rate
  // ---------------------------------------------------------------------------

  private async runBudgetBurnRateAgent(project: Project): Promise<number> {
    if (!project.budgetAllocated) {
      await this.activityLog.log({
        projectId: project.id,
        agentName: 'budget',
        result: 'skipped',
        summary: 'No budget allocated for this project',
      });
      return 0;
    }

    const ctx = { actorId: 'system' as const, actorType: 'system' as const, source: 'system' as const, projectId: project.id };
    const result = await agentRegistry.invoke('budget-forecast-v1', { projectId: project.id }, ctx);
    if (!result.success) throw new Error(result.error || 'Budget agent failed');
    const forecast = result.output.forecast;
    const { CPI, VAC } = forecast.currentMetrics;
    const overrunProbability = forecast.aiPredictions?.overrunProbability;

    const cpiThreshold = config.AGENT_BUDGET_CPI_THRESHOLD;
    const overrunThreshold = config.AGENT_BUDGET_OVERRUN_THRESHOLD;

    const problems: string[] = [];

    if (CPI < cpiThreshold) {
      problems.push(`CPI ${CPI.toFixed(2)} below threshold ${cpiThreshold}`);
    }
    if (VAC < 0) {
      problems.push(`VAC is negative ($${VAC.toFixed(0)})`);
    }
    if (overrunProbability !== undefined && overrunProbability > overrunThreshold) {
      problems.push(`AI overrun probability ${overrunProbability}% exceeds ${overrunThreshold}%`);
    }

    if (problems.length === 0) {
      await this.activityLog.log({
        projectId: project.id,
        agentName: 'budget',
        result: 'skipped',
        summary: `Metrics within thresholds — CPI ${CPI.toFixed(2)} (threshold ${cpiThreshold}), VAC $${VAC.toFixed(0)}${overrunProbability !== undefined ? `, overrun ${overrunProbability}% (threshold ${overrunThreshold}%)` : ''}`,
        details: { CPI, VAC, overrunProbability, cpiThreshold, overrunThreshold },
      });
      return 0;
    }

    const notifyUserId = project.projectManagerId || project.createdBy;
    const severity = CPI < 0.8 || (overrunProbability !== undefined && overrunProbability > 75)
      ? 'critical'
      : CPI < cpiThreshold
        ? 'high'
        : 'medium';

    await notificationService.create({
      userId: notifyUserId,
      type: 'budget_alert',
      severity,
      title: `Budget Alert: "${project.name}"`,
      message: problems.join('. ') + '.',
      projectId: project.id,
      linkType: 'evm',
    });

    console.log(`[Agent:Budget] Alert created for "${project.name}": ${problems.join('; ')}`);

    await this.activityLog.log({
      projectId: project.id,
      agentName: 'budget',
      result: 'alert_created',
      summary: problems.join('. ') + '.',
      details: { CPI, VAC, overrunProbability, cpiThreshold, overrunThreshold },
    });

    return 1;
  }

  // ---------------------------------------------------------------------------
  // Agent 3 — Monte Carlo Confidence
  // ---------------------------------------------------------------------------

  private async runMonteCarloConfidenceAgent(
    project: Project,
    schedules: Array<{ id: string; name: string; endDate: string }>,
  ): Promise<number> {
    let alertCount = 0;
    const confidenceLevel = config.AGENT_MC_CONFIDENCE_LEVEL;
    const pKey = `p${confidenceLevel}` as 'p50' | 'p80' | 'p90';

    for (const schedule of schedules) {
      const ctx = { actorId: 'system' as const, actorType: 'system' as const, source: 'system' as const, projectId: project.id };
      const invocationResult = await agentRegistry.invoke('monte-carlo-v1', { scheduleId: schedule.id }, ctx);
      if (!invocationResult.success) {
        console.error(`[Agent:MonteCarlo] Invocation failed for schedule ${schedule.id}: ${invocationResult.error}`);
        continue;
      }
      const result = invocationResult.output.result;

      // Check if the confidence-level completion date exceeds the schedule end date
      const pDateStr = result.completionDate[pKey];
      if (!pDateStr || !schedule.endDate) continue;

      const pDate = new Date(pDateStr);
      const endDate = new Date(schedule.endDate);

      if (pDate > endDate) {
        const daysOver = Math.ceil((pDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

        // Flag highly critical tasks
        const criticalTasks = result.criticalityIndex
          .filter((t: any) => t.criticalityPercent > 80)
          .map((t: any) => t.taskName);

        const notifyUserId = project.projectManagerId || project.createdBy;

        await notificationService.create({
          userId: notifyUserId,
          type: 'monte_carlo_alert',
          severity: daysOver > 14 ? 'critical' : daysOver > 7 ? 'high' : 'medium',
          title: `Schedule Risk: "${schedule.name}"`,
          message: `P${confidenceLevel} completion is ${daysOver} day(s) past deadline.${
            criticalTasks.length > 0
              ? ` Critical tasks: ${criticalTasks.slice(0, 3).join(', ')}.`
              : ''
          }`,
          projectId: project.id,
          scheduleId: schedule.id,
          linkType: 'schedule',
        });

        console.log(`[Agent:MonteCarlo] Alert for "${schedule.name}": P${confidenceLevel} +${daysOver}d`);
        alertCount++;

        await this.activityLog.log({
          projectId: project.id,
          agentName: 'monte_carlo',
          result: 'alert_created',
          summary: `P${confidenceLevel} completion for "${schedule.name}" is ${daysOver} day(s) past deadline`,
          details: { scheduleId: schedule.id, scheduleName: schedule.name, confidenceLevel, daysOver, criticalTasks: criticalTasks.slice(0, 5) },
        });
      } else {
        await this.activityLog.log({
          projectId: project.id,
          agentName: 'monte_carlo',
          result: 'skipped',
          summary: `"${schedule.name}" P${confidenceLevel} completion is on time`,
          details: { scheduleId: schedule.id, scheduleName: schedule.name, confidenceLevel, pDate: pDateStr, endDate: schedule.endDate.toString() },
        });
      }
    }

    return alertCount;
  }

  // ---------------------------------------------------------------------------
  // Agent 4 — Meeting Follow-Up
  // ---------------------------------------------------------------------------

  private async runMeetingFollowUpAgent(project: Project): Promise<number> {
    const ctx = { actorId: 'system' as const, actorType: 'system' as const, source: 'system' as const, projectId: project.id };
    const invocationResult = await agentRegistry.invoke('meeting-followup-v1', { projectId: project.id }, ctx);
    if (!invocationResult.success) throw new Error(invocationResult.error || 'Meeting agent failed');
    const analyses = invocationResult.output.analyses;
    if (analyses.length === 0) {
      await this.activityLog.log({
        projectId: project.id,
        agentName: 'meeting',
        result: 'skipped',
        summary: 'No meeting analyses found for this project',
      });
      return 0;
    }

    let alertCount = 0;
    const notifyUserId = project.projectManagerId || project.createdBy;

    for (const analysis of analyses) {
      const problems: string[] = [];

      // Check for unapplied task updates
      const unappliedUpdates = analysis.taskUpdates.filter(
        (_: any, idx: number) => !analysis.appliedItems.includes(idx),
      );
      if (unappliedUpdates.length > 0) {
        problems.push(`${unappliedUpdates.length} unapplied task update(s)`);
      }

      // Check for overdue action items
      const now = new Date();
      const overdueItems = analysis.actionItems.filter((item: any) => {
        if (!item.dueDate) return false;
        return new Date(item.dueDate) < now;
      });
      if (overdueItems.length > 0) {
        problems.push(`${overdueItems.length} overdue action item(s)`);
      }

      if (problems.length === 0) {
        await this.activityLog.log({
          projectId: project.id,
          agentName: 'meeting',
          result: 'skipped',
          summary: `Meeting analysis "${analysis.id}" — nothing overdue or unapplied`,
        });
        continue;
      }

      await notificationService.create({
        userId: notifyUserId,
        type: 'meeting_followup',
        severity: overdueItems.length > 2 ? 'high' : 'medium',
        title: `Meeting Follow-Up: "${project.name}"`,
        message: problems.join('. ') + '.',
        projectId: project.id,
        linkType: 'meeting',
        linkId: analysis.id,
      });

      console.log(`[Agent:Meeting] Alert for "${project.name}": ${problems.join('; ')}`);
      alertCount++;

      await this.activityLog.log({
        projectId: project.id,
        agentName: 'meeting',
        result: 'alert_created',
        summary: problems.join('. ') + '.',
        details: { analysisId: analysis.id, unappliedUpdates: unappliedUpdates.length, overdueItems: overdueItems.length },
      });
    }

    return alertCount;
  }
}

export const agentScheduler = new AgentSchedulerService();
