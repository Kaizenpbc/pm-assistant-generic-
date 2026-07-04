import * as cron from 'node-cron';
import { config } from '../../config';
import { scheduleService } from '../ScheduleService';
import { dagWorkflowService } from '../DagWorkflowService';
import { databaseService } from '../../database/connection';

export interface CronTasks {
  task: cron.ScheduledTask | null;
  overdueTask: cron.ScheduledTask | null;
  recurrenceTask: cron.ScheduledTask | null;
  digestTask: cron.ScheduledTask | null;
  reportScheduleTask: cron.ScheduledTask | null;
}

export function startCronTasks(
  runScan: () => Promise<void>,
  runOverdueScan: () => Promise<void>,
): CronTasks {
  const tasks: CronTasks = {
    task: null,
    overdueTask: null,
    recurrenceTask: null,
    digestTask: null,
    reportScheduleTask: null,
  };

  // All cron jobs disabled — set AGENT_ENABLED=true to re-enable
  console.log('[Agent] All cron jobs disabled');
  return tasks;

  const schedule = config.AGENT_CRON_SCHEDULE;
  console.log(`[Agent] Starting agent scheduler on cron: "${schedule}"`);

  tasks.task = cron.schedule(schedule, async () => {
    console.log(`[Agent] Cron triggered at ${new Date().toISOString()}`);
    try {
      await runScan();
    } catch (error) {
      console.error('[Agent] Scan failed:', error);
    }
  });

  // Overdue-task scanner — runs more frequently to trigger date_passed workflows
  const overdueMinutes = config.AGENT_OVERDUE_SCAN_MINUTES;
  const overdueCron = `*/${overdueMinutes} * * * *`;
  console.log(`[Agent] Starting overdue-task scanner on cron: "${overdueCron}"`);

  tasks.overdueTask = cron.schedule(overdueCron, async () => {
    try {
      await runOverdueScan();
    } catch (error) {
      console.error('[Agent] Overdue scan failed:', error);
    }
  });

  // Recurring task generator — runs daily at 02:00
  console.log('[Agent] Starting recurring task generator (daily at 02:00)');
  tasks.recurrenceTask = cron.schedule('0 2 * * *', async () => {
    try {
      const { recurrenceService } = await import('../RecurrenceService');
      const count = await recurrenceService.generateInstances(14);
      if (count > 0) {
        console.log(`[Agent] Generated ${count} recurring task instance(s)`);
      }
    } catch (error) {
      console.error('[Agent] Recurrence generation failed:', error);
    }
  });

  // Email digest — runs daily at 07:00
  console.log('[Agent] Starting digest email sender (daily at 07:00)');
  tasks.digestTask = cron.schedule('0 7 * * *', async () => {
    try {
      const { digestService } = await import('../DigestService');
      await digestService.sendPendingDigests();
    } catch (error) {
      console.error('[Agent] Digest send failed:', error);
    }
  });

  // Scheduled report delivery — runs every 15 minutes
  console.log('[Agent] Starting report schedule executor (every 15 min)');
  tasks.reportScheduleTask = cron.schedule('*/15 * * * *', async () => {
    try {
      const { reportScheduleService } = await import('../ReportScheduleService');
      await reportScheduleService.executeDueSchedules();
    } catch (error) {
      console.error('[Agent] Report schedule execution failed:', error);
    }
  });

  return tasks;
}

export function stopCronTasks(tasks: CronTasks): void {
  if (tasks.task) { tasks.task.stop(); tasks.task = null; }
  if (tasks.overdueTask) { tasks.overdueTask.stop(); tasks.overdueTask = null; }
  if (tasks.recurrenceTask) { tasks.recurrenceTask.stop(); tasks.recurrenceTask = null; }
  if (tasks.digestTask) { tasks.digestTask.stop(); tasks.digestTask = null; }
  if (tasks.reportScheduleTask) { tasks.reportScheduleTask.stop(); tasks.reportScheduleTask = null; }
  console.log('[Agent] Stopped agent scheduler');
}

export async function runOverdueScanImpl(flaggedOverdue: Set<string>): Promise<number> {
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
    if (flaggedOverdue.has(taskId)) continue;

    flaggedOverdue.add(taskId);
    const task = await scheduleService.findTaskById(taskId);
    if (!task) continue;

    // Fire date_passed triggers via workflow engine
    dagWorkflowService.evaluateTaskChange(task, task, scheduleService).catch(err =>
      console.error('[Agent] Overdue workflow trigger error:', err)
    );
    triggered++;
  }

  if (triggered > 0) {
    console.log(`[Agent] Overdue scan: triggered workflows for ${triggered} newly-overdue task(s)`);
  }
  return triggered;
}
