import * as cron from 'node-cron';
import { config } from '../config';
import { AutoRescheduleService } from './AutoRescheduleService';
import { notificationService } from './NotificationService';
import { ProjectService } from './ProjectService';
import { ScheduleService } from './ScheduleService';

export class AgentSchedulerService {
  private task: cron.ScheduledTask | null = null;
  private rescheduleService = new AutoRescheduleService();
  private projectService = new ProjectService();
  private scheduleService = new ScheduleService();

  start(): void {
    if (!config.AGENT_ENABLED) {
      console.log('[Agent] Agent is disabled (AGENT_ENABLED=false)');
      return;
    }

    const schedule = config.AGENT_CRON_SCHEDULE;
    console.log(`[Agent] Starting auto-reschedule agent on cron: "${schedule}"`);

    this.task = cron.schedule(schedule, async () => {
      console.log(`[Agent] Cron triggered at ${new Date().toISOString()}`);
      try {
        await this.runScan();
      } catch (error) {
        console.error('[Agent] Scan failed:', error);
      }
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[Agent] Stopped auto-reschedule agent');
    }
  }

  async runScan(): Promise<{
    projectsScanned: number;
    schedulesScanned: number;
    delaysDetected: number;
    proposalsGenerated: number;
    notificationsSent: number;
  }> {
    console.log('[Agent] Starting scan...');

    const stats = {
      projectsScanned: 0,
      schedulesScanned: 0,
      delaysDetected: 0,
      proposalsGenerated: 0,
      notificationsSent: 0,
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

      for (const schedule of schedules) {
        stats.schedulesScanned++;

        try {
          const delays = await this.rescheduleService.detectDelays(schedule.id);

          // Filter by threshold — only care about significant delays
          const significant = delays.filter(
            (d) => d.delayDays >= thresholdDays || d.isOnCriticalPath,
          );

          stats.delaysDetected += significant.length;

          if (significant.length === 0) continue;

          console.log(
            `[Agent] ${project.name} / ${schedule.name}: ${significant.length} significant delay(s)`,
          );

          // Generate proposal
          const proposal = await this.rescheduleService.generateProposal(
            schedule.id,
            undefined,
            'agent',
          );
          stats.proposalsGenerated++;

          // Notify project owner
          const notifyUserId = project.projectManagerId || project.createdBy;

          await notificationService.create({
            userId: notifyUserId,
            type: 'reschedule_proposal',
            severity: significant.some((d) => d.severity === 'critical')
              ? 'critical'
              : significant.some((d) => d.severity === 'high')
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
        } catch (error) {
          console.error(
            `[Agent] Error processing schedule ${schedule.id} (${schedule.name}):`,
            error,
          );
        }
      }
    }

    console.log('[Agent] Scan complete:', stats);
    return stats;
  }
}

export const agentScheduler = new AgentSchedulerService();
