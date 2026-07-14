import { AgentActivityLogService } from './AgentActivityLogService';
import { runOverdueScanImpl } from './scheduling/cronManager';
import { runScanImpl, ScanStats } from './scheduling/scanOrchestrator';

export class AgentSchedulerService {
  private flaggedOverdue = new Map<string, Set<string>>();
  private activityLog = new AgentActivityLogService();

  async runScan(projectId?: string): Promise<ScanStats> {
    return runScanImpl(this.activityLog, projectId);
  }

  async runOverdueScan(tenantKey: string = 'default'): Promise<number> {
    return runOverdueScanImpl(this.flaggedOverdue, tenantKey);
  }
}

export const agentScheduler = new AgentSchedulerService();
