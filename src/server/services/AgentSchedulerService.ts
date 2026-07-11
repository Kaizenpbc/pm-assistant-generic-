import { AgentActivityLogService } from './AgentActivityLogService';
import { startCronTasks, stopCronTasks, runOverdueScanImpl, CronTasks, TenantInfo } from './scheduling/cronManager';
import { runScanImpl, ScanStats } from './scheduling/scanOrchestrator';

export class AgentSchedulerService {
  private cronTasks: CronTasks = {
    task: null,
    overdueTask: null,
    recurrenceTask: null,
    digestTask: null,
    reportScheduleTask: null,
    healthSnapshotTask: null,
  };
  private flaggedOverdue = new Map<string, Set<string>>();
  private activityLog = new AgentActivityLogService();

  start(): void {
    this.cronTasks = startCronTasks(
      (_tenant) => this.runScan().then(() => {}),
      (tenant) => this.runOverdueScan(tenant?.slug ?? 'default').then(() => {}),
    );
  }

  stop(): void {
    stopCronTasks(this.cronTasks);
  }

  async runScan(projectId?: string): Promise<ScanStats> {
    return runScanImpl(this.activityLog, projectId);
  }

  async runOverdueScan(tenantKey: string = 'default'): Promise<number> {
    return runOverdueScanImpl(this.flaggedOverdue, tenantKey);
  }
}

export const agentScheduler = new AgentSchedulerService();
