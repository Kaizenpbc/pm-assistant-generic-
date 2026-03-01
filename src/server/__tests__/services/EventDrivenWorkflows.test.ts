import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
const mockQuery = vi.fn().mockResolvedValue([]);
vi.mock('../../database/connection', () => ({
  databaseService: {
    query: (...args: any[]) => mockQuery(...args),
    testConnection: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../services/AuditLedgerService', () => ({
  auditLedgerService: {
    append: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/PolicyEngineService', () => ({
  policyEngineService: {
    evaluate: vi.fn().mockResolvedValue({ allowed: true, enforcement: 'allowed', matchedPolicies: [] }),
  },
}));

const mockNotificationCreate = vi.fn().mockResolvedValue({ id: 'notif-1' });
vi.mock('../../services/NotificationService', () => ({
  notificationService: {
    create: (...args: any[]) => mockNotificationCreate(...args),
  },
}));

vi.mock('../../services/WebSocketService', () => ({
  WebSocketService: { broadcast: vi.fn() },
}));

vi.mock('../../services/AgentRegistryService', () => ({
  agentRegistry: {
    invoke: vi.fn().mockResolvedValue({ success: true, output: {}, durationMs: 10 }),
  },
}));

import { dagWorkflowService, resolveTemplates } from '../../services/DagWorkflowService';
import type { Task } from '../../services/ScheduleService';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    scheduleId: 'sched-1',
    name: 'Test Task',
    status: 'in_progress',
    priority: 'medium',
    createdBy: 'user-1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

// Access the private matchesTrigger method for unit testing
const service = dagWorkflowService as any;

describe('EventDrivenWorkflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue([]);
  });

  // ── Trigger matching ──────────────────────────────────────────────────

  describe('matchesTrigger', () => {
    it('status_change: matches when status changes', () => {
      const config = { triggerType: 'status_change', toStatus: 'completed' };
      const task = makeTask({ status: 'completed' });
      const oldTask = makeTask({ status: 'in_progress' });
      expect(service.matchesTrigger(config, task, oldTask)).toBe(true);
    });

    it('status_change: does not match when status unchanged', () => {
      const config = { triggerType: 'status_change' };
      const task = makeTask({ status: 'in_progress' });
      const oldTask = makeTask({ status: 'in_progress' });
      expect(service.matchesTrigger(config, task, oldTask)).toBe(false);
    });

    it('task_created: fires when oldTask is null', () => {
      const config = { triggerType: 'task_created' };
      const task = makeTask();
      expect(service.matchesTrigger(config, task, null)).toBe(true);
    });

    it('task_created: does not fire when oldTask exists', () => {
      const config = { triggerType: 'task_created' };
      const task = makeTask();
      const oldTask = makeTask();
      expect(service.matchesTrigger(config, task, oldTask)).toBe(false);
    });

    it('task_created: respects statusFilter', () => {
      const config = { triggerType: 'task_created', statusFilter: 'urgent' };
      const task = makeTask({ status: 'in_progress' });
      // status doesn't match 'urgent'
      expect(service.matchesTrigger(config, task, null)).toBe(false);
    });

    it('priority_change: fires when priority changes', () => {
      const config = { triggerType: 'priority_change', toPriority: 'urgent' };
      const task = makeTask({ priority: 'urgent' });
      const oldTask = makeTask({ priority: 'medium' });
      expect(service.matchesTrigger(config, task, oldTask)).toBe(true);
    });

    it('priority_change: does not fire when priority unchanged', () => {
      const config = { triggerType: 'priority_change' };
      const task = makeTask({ priority: 'medium' });
      const oldTask = makeTask({ priority: 'medium' });
      expect(service.matchesTrigger(config, task, oldTask)).toBe(false);
    });

    it('priority_change: does not fire when toPriority filter mismatches', () => {
      const config = { triggerType: 'priority_change', toPriority: 'urgent' };
      const task = makeTask({ priority: 'high' });
      const oldTask = makeTask({ priority: 'medium' });
      expect(service.matchesTrigger(config, task, oldTask)).toBe(false);
    });

    it('assignment_change: fires when assignedTo changes', () => {
      const config = { triggerType: 'assignment_change' };
      const task = makeTask({ assignedTo: 'user-2' });
      const oldTask = makeTask({ assignedTo: 'user-1' });
      expect(service.matchesTrigger(config, task, oldTask)).toBe(true);
    });

    it('assignment_change: does not fire without oldTask', () => {
      const config = { triggerType: 'assignment_change' };
      const task = makeTask({ assignedTo: 'user-2' });
      expect(service.matchesTrigger(config, task, null)).toBe(false);
    });

    it('dependency_change: fires when dependency changes', () => {
      const config = { triggerType: 'dependency_change' };
      const task = makeTask({ dependency: 'task-2' });
      const oldTask = makeTask({ dependency: 'task-3' });
      expect(service.matchesTrigger(config, task, oldTask)).toBe(true);
    });

    it('date_passed: fires when endDate is in the past', () => {
      const config = { triggerType: 'date_passed' };
      const task = makeTask({ endDate: '2020-01-01' });
      expect(service.matchesTrigger(config, task, null)).toBe(true);
    });

    it('date_passed: does not fire when endDate is in the future', () => {
      const config = { triggerType: 'date_passed' };
      const task = makeTask({ endDate: '2099-12-31' });
      expect(service.matchesTrigger(config, task, null)).toBe(false);
    });

    it('budget_threshold: always returns false (handled by evaluateProjectChange)', () => {
      const config = { triggerType: 'budget_threshold' };
      const task = makeTask();
      expect(service.matchesTrigger(config, task, null)).toBe(false);
    });
  });

  // ── evaluateTaskChange integration ─────────────────────────────────────

  describe('evaluateTaskChange', () => {
    it('queries enabled workflows and matches triggers', async () => {
      // First call: ensureTablesExist
      mockQuery
        .mockResolvedValueOnce([{ id: 1 }]) // tables exist
        .mockResolvedValueOnce([]) // no enabled workflows
        ;

      const task = makeTask();
      const scheduleService = { findById: vi.fn() } as any;

      await dagWorkflowService.evaluateTaskChange(task, null, scheduleService);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM workflow_definitions WHERE is_enabled = 1',
        [],
      );
    });

    it('handles missing tables gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Table not found'));

      const task = makeTask();
      const scheduleService = {} as any;

      // Should not throw
      await dagWorkflowService.evaluateTaskChange(task, null, scheduleService);
    });
  });

  // ── evaluateProjectChange ──────────────────────────────────────────────

  describe('evaluateProjectChange', () => {
    it('queries enabled workflows for project events', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 1 }]) // tables exist
        .mockResolvedValueOnce([]) // no workflows
        ;

      await dagWorkflowService.evaluateProjectChange('proj-1', 'budget_update', {
        budgetAllocated: 100000,
        budgetSpent: 95000,
        utilization: 95,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM workflow_definitions WHERE is_enabled = 1',
      );
    });
  });

  // ── Fire-and-forget pattern ────────────────────────────────────────────

  describe('fire-and-forget pattern', () => {
    it('evaluateTaskChange does not throw even on internal error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));

      const task = makeTask();
      const scheduleService = {} as any;

      // The method catches internally, should resolve
      await expect(
        dagWorkflowService.evaluateTaskChange(task, null, scheduleService)
      ).resolves.toBeUndefined();
    });
  });
});
