import { AgentActivityLogService } from './AgentActivityLogService';
import { startCronTasks, stopCronTasks, runOverdueScanImpl, CronTasks } from './scheduling/cronManager';
import { runScanImpl, ScanStats } from './scheduling/scanOrchestrator';

export class AgentSchedulerService {
  private cronTasks: CronTasks = {
    task: null,
    overdueTask: null,
    recurrenceTask: null,
    digestTask: null,
    reportScheduleTask: null,
  };
  private flaggedOverdue = new Set<string>();
  private activityLog = new AgentActivityLogService();

  start(): void {
    this.cronTasks = startCronTasks(
      () => this.runScan().then(() => {}),
      () => this.runOverdueScan().then(() => {}),
    );
  }

  stop(): void {
    stopCronTasks(this.cronTasks);
  }

  async runScan(projectId?: string): Promise<ScanStats> {
    return runScanImpl(this.activityLog, projectId);
  }

  async runOverdueScan(): Promise<number> {
    return runOverdueScanImpl(this.flaggedOverdue);
  }
}

export const agentScheduler = new AgentSchedulerService();
