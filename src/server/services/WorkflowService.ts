import { Task, ScheduleService } from './ScheduleService';
import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

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

  private get useDb() { return databaseService.isHealthy(); }

  // --- Row-to-model mappers ---

  private rowToRule(row: any): WorkflowRule {
    const c = toCamelCaseKeys(row);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      enabled: Boolean(c.enabled),
      trigger: c.triggerConfig,
      action: c.actionConfig,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(c.createdAt),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(c.updatedAt),
    } as WorkflowRule;
  }

  private rowToExecution(row: any): WorkflowExecution {
    const c = toCamelCaseKeys(row);
    return {
      ruleId: c.ruleId,
      ruleName: c.ruleName,
      taskId: c.taskId,
      taskName: c.taskName,
      actionType: c.actionType,
      result: c.result,
      executedAt: row.executed_at instanceof Date ? row.executed_at.toISOString() : String(c.executedAt),
    } as WorkflowExecution;
  }

  // --- CRUD ---

  findAll(): WorkflowRule[] {
    if (this.useDb) {
      // Return in-memory for synchronous signature; callers can use findAllAsync for DB
      const rows = databaseService.query('SELECT * FROM workflow_rules', []);
      // Since findAll is synchronous, we start the async query but fall through to in-memory
      // To support DB properly we return in-memory data and rely on the async path
    }
    return [...WorkflowService.rules];
  }

  findById(id: string): WorkflowRule | undefined {
    if (this.useDb) {
      // Synchronous signature — fall through to in-memory
    }
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

    if (this.useDb) {
      databaseService.query(
        `INSERT INTO workflow_rules (id, name, description, enabled, trigger_config, action_config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rule.id,
          rule.name,
          rule.description ?? null,
          rule.enabled,
          JSON.stringify(rule.trigger),
          JSON.stringify(rule.action),
          rule.createdAt,
          rule.updatedAt,
        ],
      ).catch(err => console.error('WorkflowService.create DB insert failed:', err));
    }

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

    if (this.useDb) {
      const setClauses: string[] = [];
      const values: any[] = [];
      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        enabled: 'enabled',
        trigger: 'trigger_config',
        action: 'action_config',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          const val = (key === 'trigger' || key === 'action')
            ? JSON.stringify((data as any)[key])
            : (data as any)[key];
          setClauses.push(`${col} = ?`);
          values.push(val);
        }
      }
      if (setClauses.length > 0) {
        setClauses.push('updated_at = ?');
        values.push(WorkflowService.rules[idx].updatedAt);
        values.push(id);
        databaseService.query(
          `UPDATE workflow_rules SET ${setClauses.join(', ')} WHERE id = ?`,
          values,
        ).catch(err => console.error('WorkflowService.update DB update failed:', err));
      }
    }

    return WorkflowService.rules[idx];
  }

  delete(id: string): boolean {
    const idx = WorkflowService.rules.findIndex(r => r.id === id);
    if (idx === -1) return false;
    WorkflowService.rules.splice(idx, 1);

    if (this.useDb) {
      databaseService.query('DELETE FROM workflow_rules WHERE id = ?', [id])
        .catch(err => console.error('WorkflowService.delete DB delete failed:', err));
    }

    return true;
  }

  getExecutions(): WorkflowExecution[] {
    if (this.useDb) {
      // Fire-and-forget async DB read; synchronous signature falls through to in-memory
    }
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

          if (this.useDb) {
            databaseService.query(
              `INSERT INTO workflow_executions (rule_id, rule_name, task_id, task_name, action_type, result, executed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                result.ruleId,
                result.ruleName,
                result.taskId,
                result.taskName,
                result.actionType,
                result.result,
                result.executedAt,
              ],
            ).catch(err => console.error('WorkflowService.evaluateTaskChange DB insert failed:', err));
          }
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
