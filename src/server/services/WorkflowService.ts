import { Task, ScheduleService } from './ScheduleService';

export type TriggerType = 'status_change' | 'date_passed' | 'progress_threshold';
export type ActionType = 'update_field' | 'log_activity' | 'send_notification';

export interface TriggerConfig {
  type: TriggerType;
  fromStatus?: string;
  toStatus?: string;
  progressThreshold?: number;
  progressDirection?: 'above' | 'below';
}

export interface ActionConfig {
  type: ActionType;
  field?: string;
  value?: string;
  message?: string;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: TriggerConfig;
  action: ActionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  ruleId: string;
  ruleName: string;
  taskId: string;
  taskName: string;
  actionType: string;
  result: string;
  executedAt: string;
}

export class WorkflowService {
  private static rules: WorkflowRule[] = [
    {
      id: 'wf-1',
      name: 'Auto-complete on 100% progress',
      description: 'When a task reaches 100% progress, automatically set status to completed',
      enabled: true,
      trigger: { type: 'progress_threshold', progressThreshold: 100, progressDirection: 'above' },
      action: { type: 'update_field', field: 'status', value: 'completed' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'wf-2',
      name: 'Log when task starts',
      description: 'Log activity when a task moves to in_progress',
      enabled: true,
      trigger: { type: 'status_change', toStatus: 'in_progress' },
      action: { type: 'log_activity', message: 'Task work has started' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'wf-3',
      name: 'Notify on cancellation',
      description: 'Send notification when a task is cancelled',
      enabled: false,
      trigger: { type: 'status_change', toStatus: 'cancelled' },
      action: { type: 'send_notification', message: 'A task has been cancelled' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  private static executions: WorkflowExecution[] = [];

  findAll(): WorkflowRule[] {
    return [...WorkflowService.rules];
  }

  findById(id: string): WorkflowRule | undefined {
    return WorkflowService.rules.find(r => r.id === id);
  }

  create(data: Omit<WorkflowRule, 'id' | 'createdAt' | 'updatedAt'>): WorkflowRule {
    const rule: WorkflowRule = {
      id: `wf-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    WorkflowService.rules.push(rule);
    return rule;
  }

  update(id: string, data: Partial<Omit<WorkflowRule, 'id' | 'createdAt'>>): WorkflowRule | null {
    const idx = WorkflowService.rules.findIndex(r => r.id === id);
    if (idx === -1) return null;
    WorkflowService.rules[idx] = {
      ...WorkflowService.rules[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return WorkflowService.rules[idx];
  }

  delete(id: string): boolean {
    const idx = WorkflowService.rules.findIndex(r => r.id === id);
    if (idx === -1) return false;
    WorkflowService.rules.splice(idx, 1);
    return true;
  }

  getExecutions(): WorkflowExecution[] {
    return [...WorkflowService.executions].sort((a, b) =>
      new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    );
  }

  /**
   * Evaluate all enabled rules against a task change.
   * Returns list of executed actions.
   */
  evaluateTaskChange(
    task: Task,
    oldTask: Task | null,
    scheduleService: ScheduleService,
  ): WorkflowExecution[] {
    const results: WorkflowExecution[] = [];
    const enabledRules = WorkflowService.rules.filter(r => r.enabled);

    for (const rule of enabledRules) {
      if (this.triggerMatches(rule.trigger, task, oldTask)) {
        const result = this.executeAction(rule, task, scheduleService);
        if (result) {
          WorkflowService.executions.push(result);
          results.push(result);
        }
      }
    }

    return results;
  }

  private triggerMatches(trigger: TriggerConfig, task: Task, oldTask: Task | null): boolean {
    switch (trigger.type) {
      case 'status_change': {
        if (!oldTask) return false;
        const statusChanged = oldTask.status !== task.status;
        if (!statusChanged) return false;
        if (trigger.fromStatus && oldTask.status !== trigger.fromStatus) return false;
        if (trigger.toStatus && task.status !== trigger.toStatus) return false;
        return true;
      }
      case 'progress_threshold': {
        const progress = task.progressPercentage ?? 0;
        const threshold = trigger.progressThreshold ?? 0;
        if (trigger.progressDirection === 'above') return progress >= threshold;
        if (trigger.progressDirection === 'below') return progress <= threshold;
        return progress >= threshold;
      }
      case 'date_passed': {
        if (!task.endDate) return false;
        return new Date(task.endDate) < new Date();
      }
      default:
        return false;
    }
  }

  private executeAction(
    rule: WorkflowRule,
    task: Task,
    scheduleService: ScheduleService,
  ): WorkflowExecution | null {
    const action = rule.action;

    switch (action.type) {
      case 'update_field': {
        if (action.field && action.value) {
          scheduleService.updateTask(task.id, { [action.field]: action.value } as any);
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            taskId: task.id,
            taskName: task.name,
            actionType: action.type,
            result: `Set ${action.field} to "${action.value}"`,
            executedAt: new Date().toISOString(),
          };
        }
        return null;
      }
      case 'log_activity': {
        scheduleService.logActivity(
          task.id, '1', 'Workflow', 'workflow-action',
          undefined, undefined, action.message || rule.name
        );
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          taskId: task.id,
          taskName: task.name,
          actionType: action.type,
          result: action.message || 'Activity logged',
          executedAt: new Date().toISOString(),
        };
      }
      case 'send_notification': {
        // In-memory: just log it
        console.log(`[Workflow Notification] ${action.message || rule.name} - Task: ${task.name}`);
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          taskId: task.id,
          taskName: task.name,
          actionType: action.type,
          result: `Notification: ${action.message || rule.name}`,
          executedAt: new Date().toISOString(),
        };
      }
      default:
        return null;
    }
  }
}
