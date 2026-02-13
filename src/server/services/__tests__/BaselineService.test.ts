import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before any service imports (prevents env var validation)
vi.mock('../../config', () => ({
  config: {
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

// Mock database connection — always unhealthy so we exercise in-memory path
vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
  },
}));

// ---------------------------------------------------------------------------
// Mock ScheduleService so we control the task list exactly
// ---------------------------------------------------------------------------
let mockTasks: import('../ScheduleService').Task[] = [];

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async findTasksByScheduleId(_id: string) {
      return mockTasks;
    }
  },
}));

import { BaselineService } from '../BaselineService';
import type { Task } from '../ScheduleService';
import type { BaselineComparison, TaskVariance } from '../BaselineService';

// ---------------------------------------------------------------------------
// Helper: build a Task object with sensible defaults
// ---------------------------------------------------------------------------
function task(overrides: Partial<Task> & { id: string; name: string }): Task {
  return {
    scheduleId: 'sched-1',
    status: 'pending',
    priority: 'medium',
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    progressPercentage: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: set mock tasks returned by ScheduleService
// ---------------------------------------------------------------------------
function setTasks(tasks: Task[]) {
  mockTasks = tasks;
}

describe('BaselineService', () => {
  let service: BaselineService;

  beforeEach(() => {
    // Clear in-memory store between tests
    (BaselineService as any).baselines = [];
    service = new BaselineService();
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('create', () => {
    it('creates a baseline with generated ID having bl- prefix', async () => {
      setTasks([
        task({
          id: 't1',
          name: 'Task 1',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-10'),
          estimatedDays: 9,
          progressPercentage: 50,
          status: 'in_progress',
        }),
      ]);

      const baseline = await service.create('sched-1', 'Sprint 1 Baseline', 'user-1');

      expect(baseline.id).toMatch(/^bl-/);
      expect(baseline.scheduleId).toBe('sched-1');
      expect(baseline.name).toBe('Sprint 1 Baseline');
      expect(baseline.createdBy).toBe('user-1');
      expect(baseline.createdAt).toBeTruthy();
      expect(baseline.tasks).toHaveLength(1);
    });

    it('captures task snapshot with correct fields', async () => {
      setTasks([
        task({
          id: 't1',
          name: 'Design Phase',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-02-15'),
          estimatedDays: 14,
          progressPercentage: 30,
          status: 'in_progress',
        }),
      ]);

      const baseline = await service.create('sched-1', 'Baseline A', 'user-1');
      const bt = baseline.tasks[0];

      expect(bt.taskId).toBe('t1');
      expect(bt.name).toBe('Design Phase');
      expect(bt.startDate).toBe(new Date('2026-02-01').toISOString());
      expect(bt.endDate).toBe(new Date('2026-02-15').toISOString());
      expect(bt.estimatedDays).toBe(14);
      expect(bt.progressPercentage).toBe(30);
      expect(bt.status).toBe('in_progress');
    });

    it('captures multiple tasks in a single baseline', async () => {
      setTasks([
        task({ id: 't1', name: 'A', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-05') }),
        task({ id: 't2', name: 'B', startDate: new Date('2026-01-06'), endDate: new Date('2026-01-10') }),
        task({ id: 't3', name: 'C', startDate: new Date('2026-01-11'), endDate: new Date('2026-01-20') }),
      ]);

      const baseline = await service.create('sched-1', 'Multi', 'user-1');
      expect(baseline.tasks).toHaveLength(3);
      expect(baseline.tasks.map((t) => t.taskId)).toEqual(['t1', 't2', 't3']);
    });
  });

  // =========================================================================
  // findByScheduleId()
  // =========================================================================
  describe('findByScheduleId', () => {
    it('returns all baselines for a given schedule', async () => {
      setTasks([task({ id: 't1', name: 'A' })]);

      await service.create('sched-1', 'BL1', 'user-1');
      await service.create('sched-1', 'BL2', 'user-1');
      await service.create('sched-2', 'BL3', 'user-1');

      const results = await service.findByScheduleId('sched-1');
      expect(results).toHaveLength(2);
      expect(results.map((b) => b.name)).toEqual(['BL1', 'BL2']);
    });

    it('returns empty array when no baselines exist for schedule', async () => {
      const results = await service.findByScheduleId('nonexistent');
      expect(results).toEqual([]);
    });
  });

  // =========================================================================
  // findById()
  // =========================================================================
  describe('findById', () => {
    it('returns a baseline by ID', async () => {
      setTasks([task({ id: 't1', name: 'A' })]);
      const created = await service.create('sched-1', 'My BL', 'user-1');

      const found = await service.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('My BL');
    });

    it('returns null when baseline not found', async () => {
      const found = await service.findById('bl-nonexistent');
      expect(found).toBeNull();
    });
  });

  // =========================================================================
  // delete()
  // =========================================================================
  describe('delete', () => {
    it('returns true and removes baseline when found', async () => {
      setTasks([task({ id: 't1', name: 'A' })]);
      const created = await service.create('sched-1', 'To Delete', 'user-1');

      const result = await service.delete(created.id);
      expect(result).toBe(true);

      const found = await service.findById(created.id);
      expect(found).toBeNull();
    });

    it('returns false when baseline not found', async () => {
      const result = await service.delete('bl-nonexistent');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // compareBaseline() — the critical method
  // =========================================================================
  describe('compareBaseline', () => {
    // Helper: create a baseline, then swap current tasks, then compare
    async function createAndCompare(
      baselineTasks: Task[],
      currentTasks: Task[],
      baselineName = 'Test BL',
    ): Promise<BaselineComparison | null> {
      setTasks(baselineTasks);
      const bl = await service.create('sched-1', baselineName, 'user-1');

      // Now set current tasks to the new state
      setTasks(currentTasks);
      return service.compareBaseline(bl.id);
    }

    // --------------------------------------------------------------------
    // Baseline not found
    // --------------------------------------------------------------------
    it('returns null when baseline does not exist', async () => {
      const result = await service.compareBaseline('bl-nonexistent');
      expect(result).toBeNull();
    });

    // --------------------------------------------------------------------
    // Empty task list
    // --------------------------------------------------------------------
    it('handles empty task lists gracefully', async () => {
      const result = await createAndCompare([], []);

      expect(result).not.toBeNull();
      expect(result!.taskVariances).toEqual([]);
      expect(result!.summary.totalTasks).toBe(0);
      expect(result!.summary.scheduleHealthPct).toBe(100);
      expect(result!.summary.newTasks).toBe(0);
      expect(result!.summary.removedTasks).toBe(0);
    });

    // --------------------------------------------------------------------
    // All tasks on track (no variance)
    // --------------------------------------------------------------------
    it('classifies all tasks as on track when dates are unchanged', async () => {
      const tasks = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 50, status: 'in_progress',
        }),
        task({
          id: 't2', name: 'Task B',
          startDate: new Date('2026-01-11'), endDate: new Date('2026-01-20'),
          progressPercentage: 20, status: 'pending',
        }),
      ];

      const result = await createAndCompare(tasks, tasks);

      expect(result!.summary.tasksOnTrack).toBe(2);
      expect(result!.summary.tasksSlipped).toBe(0);
      expect(result!.summary.tasksAhead).toBe(0);
      expect(result!.summary.scheduleHealthPct).toBe(100);
      expect(result!.summary.avgStartVarianceDays).toBe(0);
      expect(result!.summary.avgEndVarianceDays).toBe(0);
    });

    // --------------------------------------------------------------------
    // Tasks that slipped (delayed end dates)
    // --------------------------------------------------------------------
    it('detects slipped tasks when end dates are delayed by more than 1 day', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-03'), endDate: new Date('2026-01-15'),
          progressPercentage: 10, status: 'in_progress',
        }),
      ];

      const result = await createAndCompare(baseline, current);
      const tv = result!.taskVariances[0];

      expect(tv.startVarianceDays).toBe(2);   // 2 days late start
      expect(tv.endVarianceDays).toBe(5);      // 5 days late end
      expect(result!.summary.tasksSlipped).toBe(1);
      expect(result!.summary.tasksOnTrack).toBe(0);
      expect(result!.summary.tasksAhead).toBe(0);
    });

    // --------------------------------------------------------------------
    // Tasks that are ahead of schedule
    // --------------------------------------------------------------------
    it('detects tasks ahead of schedule when end dates are earlier by more than 1 day', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-20'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-15'),
          progressPercentage: 80, status: 'in_progress',
        }),
      ];

      const result = await createAndCompare(baseline, current);
      const tv = result!.taskVariances[0];

      expect(tv.endVarianceDays).toBe(-5);     // 5 days ahead
      expect(tv.startVarianceDays).toBe(0);
      expect(result!.summary.tasksAhead).toBe(1);
      expect(result!.summary.tasksSlipped).toBe(0);
      expect(result!.summary.tasksOnTrack).toBe(0);
    });

    // --------------------------------------------------------------------
    // Mix of slipped, ahead, and on-track
    // --------------------------------------------------------------------
    it('handles mixed variance classifications correctly', async () => {
      const baseline = [
        task({
          id: 't1', name: 'On Track',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 50, status: 'in_progress',
        }),
        task({
          id: 't2', name: 'Slipped',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 30, status: 'in_progress',
        }),
        task({
          id: 't3', name: 'Ahead',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-20'),
          progressPercentage: 10, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'On Track',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), // same => 0 variance
          progressPercentage: 50, status: 'in_progress',
        }),
        task({
          id: 't2', name: 'Slipped',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-15'), // +5 days
          progressPercentage: 30, status: 'in_progress',
        }),
        task({
          id: 't3', name: 'Ahead',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-15'), // -5 days
          progressPercentage: 60, status: 'in_progress',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.summary.totalTasks).toBe(3);
      expect(result!.summary.tasksOnTrack).toBe(1);
      expect(result!.summary.tasksSlipped).toBe(1);
      expect(result!.summary.tasksAhead).toBe(1);
      // scheduleHealthPct = (onTrack + ahead) / total * 100 = (1+1)/3*100 = 67
      expect(result!.summary.scheduleHealthPct).toBe(67);
    });

    // --------------------------------------------------------------------
    // New tasks added since baseline
    // --------------------------------------------------------------------
    it('counts new tasks that exist in current but not in baseline', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Original',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Original',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
        task({
          id: 't2', name: 'New Task',
          startDate: new Date('2026-01-05'), endDate: new Date('2026-01-12'),
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.summary.newTasks).toBe(1);
      expect(result!.summary.totalTasks).toBe(1); // varCount only includes matched tasks
      expect(result!.taskVariances).toHaveLength(1); // only matched tasks have variances
    });

    // --------------------------------------------------------------------
    // Tasks removed since baseline
    // --------------------------------------------------------------------
    it('counts removed tasks that exist in baseline but not in current', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Kept',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
        task({
          id: 't2', name: 'Removed',
          startDate: new Date('2026-01-05'), endDate: new Date('2026-01-15'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Kept',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.summary.removedTasks).toBe(1);
      expect(result!.summary.totalTasks).toBe(1); // only matched tasks
      expect(result!.taskVariances).toHaveLength(1);
    });

    // --------------------------------------------------------------------
    // Progress variance
    // --------------------------------------------------------------------
    it('calculates progress variance correctly', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 20, status: 'in_progress',
        }),
        task({
          id: 't2', name: 'Task B',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 60, status: 'in_progress',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 70, status: 'in_progress',
        }),
        task({
          id: 't2', name: 'Task B',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 40, status: 'in_progress',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      const t1Var = result!.taskVariances.find((v) => v.taskId === 't1')!;
      const t2Var = result!.taskVariances.find((v) => v.taskId === 't2')!;

      expect(t1Var.progressVariancePct).toBe(50);   // 70 - 20
      expect(t1Var.baselineProgress).toBe(20);
      expect(t1Var.actualProgress).toBe(70);

      expect(t2Var.progressVariancePct).toBe(-20);   // 40 - 60
      expect(t2Var.baselineProgress).toBe(60);
      expect(t2Var.actualProgress).toBe(40);

      // avgProgressVariancePct = (50 + (-20)) / 2 = 15
      expect(result!.summary.avgProgressVariancePct).toBe(15);
    });

    // --------------------------------------------------------------------
    // Status changes
    // --------------------------------------------------------------------
    it('detects status changes between baseline and current', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
        task({
          id: 't2', name: 'Task B',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 50, status: 'in_progress',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 30, status: 'in_progress', // changed from pending
        }),
        task({
          id: 't2', name: 'Task B',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 50, status: 'in_progress', // unchanged
        }),
      ];

      const result = await createAndCompare(baseline, current);

      const t1Var = result!.taskVariances.find((v) => v.taskId === 't1')!;
      const t2Var = result!.taskVariances.find((v) => v.taskId === 't2')!;

      expect(t1Var.statusChanged).toBe(true);
      expect(t1Var.baselineStatus).toBe('pending');
      expect(t1Var.actualStatus).toBe('in_progress');

      expect(t2Var.statusChanged).toBe(false);
      expect(t2Var.baselineStatus).toBe('in_progress');
      expect(t2Var.actualStatus).toBe('in_progress');
    });

    // --------------------------------------------------------------------
    // Duration variance
    // --------------------------------------------------------------------
    it('calculates duration variance correctly', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-11'), // 10 days
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-16'), // 15 days
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);
      const tv = result!.taskVariances[0];

      expect(tv.baselineDurationDays).toBe(10);
      expect(tv.actualDurationDays).toBe(15);
      expect(tv.durationVarianceDays).toBe(5); // 15 - 10
    });

    // --------------------------------------------------------------------
    // On-track boundary: endVariance = +1 is still on track
    // --------------------------------------------------------------------
    it('classifies endVariance of exactly +1 as on track', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Edge Case',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Edge Case',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-11'), // +1 day
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.taskVariances[0].endVarianceDays).toBe(1);
      expect(result!.summary.tasksOnTrack).toBe(1);
      expect(result!.summary.tasksSlipped).toBe(0);
    });

    // --------------------------------------------------------------------
    // On-track boundary: endVariance = -1 is still on track
    // --------------------------------------------------------------------
    it('classifies endVariance of exactly -1 as on track', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Edge Case',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Edge Case',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-09'), // -1 day
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.taskVariances[0].endVarianceDays).toBe(-1);
      expect(result!.summary.tasksOnTrack).toBe(1);
      expect(result!.summary.tasksAhead).toBe(0);
    });

    // --------------------------------------------------------------------
    // Slipped boundary: endVariance = +2 is slipped
    // --------------------------------------------------------------------
    it('classifies endVariance of +2 as slipped', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Boundary',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Boundary',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-12'), // +2 days
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.taskVariances[0].endVarianceDays).toBe(2);
      expect(result!.summary.tasksSlipped).toBe(1);
      expect(result!.summary.tasksOnTrack).toBe(0);
    });

    // --------------------------------------------------------------------
    // Ahead boundary: endVariance = -2 is ahead
    // --------------------------------------------------------------------
    it('classifies endVariance of -2 as ahead', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Boundary',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Boundary',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-08'), // -2 days
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.taskVariances[0].endVarianceDays).toBe(-2);
      expect(result!.summary.tasksAhead).toBe(1);
      expect(result!.summary.tasksOnTrack).toBe(0);
    });

    // --------------------------------------------------------------------
    // Average variance calculations
    // --------------------------------------------------------------------
    it('calculates average variance metrics across multiple tasks', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 10, status: 'pending',
        }),
        task({
          id: 't2', name: 'Task B',
          startDate: new Date('2026-01-05'), endDate: new Date('2026-01-15'),
          progressPercentage: 20, status: 'pending',
        }),
        task({
          id: 't3', name: 'Task C',
          startDate: new Date('2026-01-10'), endDate: new Date('2026-01-20'),
          progressPercentage: 30, status: 'in_progress',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-04'), endDate: new Date('2026-01-13'), // start +3, end +3
          progressPercentage: 40, status: 'in_progress',
        }),
        task({
          id: 't2', name: 'Task B',
          startDate: new Date('2026-01-05'), endDate: new Date('2026-01-15'), // start 0, end 0
          progressPercentage: 20, status: 'pending',
        }),
        task({
          id: 't3', name: 'Task C',
          startDate: new Date('2026-01-07'), endDate: new Date('2026-01-17'), // start -3, end -3
          progressPercentage: 60, status: 'in_progress',
        }),
      ];

      const result = await createAndCompare(baseline, current);

      // avgStartVarianceDays = (3 + 0 + (-3)) / 3 = 0
      expect(result!.summary.avgStartVarianceDays).toBe(0);
      // avgEndVarianceDays = (3 + 0 + (-3)) / 3 = 0
      expect(result!.summary.avgEndVarianceDays).toBe(0);
      // avgProgressVariancePct = ((40-10) + (20-20) + (60-30)) / 3 = (30 + 0 + 30) / 3 = 20
      expect(result!.summary.avgProgressVariancePct).toBe(20);
    });

    // --------------------------------------------------------------------
    // Schedule health percentage
    // --------------------------------------------------------------------
    it('computes scheduleHealthPct as (onTrack + ahead) / total * 100', async () => {
      const baseline = [
        task({ id: 't1', name: 'A', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't2', name: 'B', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't3', name: 'C', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't4', name: 'D', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
      ];
      const current = [
        task({ id: 't1', name: 'A', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),  // on track (0)
        task({ id: 't2', name: 'B', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-05'), progressPercentage: 0, status: 'pending' }),  // ahead (-5)
        task({ id: 't3', name: 'C', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-20'), progressPercentage: 0, status: 'pending' }),  // slipped (+10)
        task({ id: 't4', name: 'D', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-25'), progressPercentage: 0, status: 'pending' }),  // slipped (+15)
      ];

      const result = await createAndCompare(baseline, current);

      // onTrack=1, ahead=1, slipped=2 => health = (1+1)/4*100 = 50
      expect(result!.summary.tasksOnTrack).toBe(1);
      expect(result!.summary.tasksAhead).toBe(1);
      expect(result!.summary.tasksSlipped).toBe(2);
      expect(result!.summary.scheduleHealthPct).toBe(50);
    });

    // --------------------------------------------------------------------
    // Both new and removed tasks
    // --------------------------------------------------------------------
    it('handles simultaneous new and removed tasks', async () => {
      const baseline = [
        task({ id: 't1', name: 'Kept', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't2', name: 'Removed A', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't3', name: 'Removed B', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
      ];
      const current = [
        task({ id: 't1', name: 'Kept', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't4', name: 'New A', startDate: new Date('2026-01-05'), endDate: new Date('2026-01-15'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't5', name: 'New B', startDate: new Date('2026-01-06'), endDate: new Date('2026-01-16'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't6', name: 'New C', startDate: new Date('2026-01-07'), endDate: new Date('2026-01-17'), progressPercentage: 0, status: 'pending' }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.summary.totalTasks).toBe(1);     // only t1 matched
      expect(result!.summary.removedTasks).toBe(2);    // t2, t3
      expect(result!.summary.newTasks).toBe(3);         // t4, t5, t6
      expect(result!.taskVariances).toHaveLength(1);    // only t1
    });

    // --------------------------------------------------------------------
    // Comparison result shape
    // --------------------------------------------------------------------
    it('returns properly shaped BaselineComparison object', async () => {
      const tasks = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 50, status: 'in_progress',
        }),
      ];

      setTasks(tasks);
      const bl = await service.create('sched-1', 'Shape Test', 'user-1');
      setTasks(tasks);
      const result = await service.compareBaseline(bl.id);

      expect(result).toEqual(expect.objectContaining({
        baselineId: bl.id,
        baselineName: 'Shape Test',
        baselineDate: expect.any(String),
        scheduleId: 'sched-1',
        taskVariances: expect.any(Array),
        summary: expect.objectContaining({
          totalTasks: expect.any(Number),
          tasksSlipped: expect.any(Number),
          tasksAhead: expect.any(Number),
          tasksOnTrack: expect.any(Number),
          newTasks: expect.any(Number),
          removedTasks: expect.any(Number),
          avgStartVarianceDays: expect.any(Number),
          avgEndVarianceDays: expect.any(Number),
          avgProgressVariancePct: expect.any(Number),
          scheduleHealthPct: expect.any(Number),
        }),
      }));
    });

    // --------------------------------------------------------------------
    // TaskVariance shape
    // --------------------------------------------------------------------
    it('returns properly shaped TaskVariance objects', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 25, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-02'), endDate: new Date('2026-01-12'),
          progressPercentage: 40, status: 'in_progress',
        }),
      ];

      const result = await createAndCompare(baseline, current);
      const tv = result!.taskVariances[0];

      expect(tv).toEqual(expect.objectContaining({
        taskId: 't1',
        taskName: 'Task A',
        baselineStart: expect.any(String),
        baselineEnd: expect.any(String),
        actualStart: expect.any(String),
        actualEnd: expect.any(String),
        baselineProgress: 25,
        actualProgress: 40,
        startVarianceDays: expect.any(Number),
        endVarianceDays: expect.any(Number),
        baselineDurationDays: expect.any(Number),
        actualDurationDays: expect.any(Number),
        durationVarianceDays: expect.any(Number),
        progressVariancePct: 15,
        statusChanged: true,
        baselineStatus: 'pending',
        actualStatus: 'in_progress',
      }));
    });

    // --------------------------------------------------------------------
    // All tasks removed (edge case)
    // --------------------------------------------------------------------
    it('handles all baseline tasks being removed from current schedule', async () => {
      const baseline = [
        task({ id: 't1', name: 'A', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't2', name: 'B', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
      ];
      const current: Task[] = [];

      const result = await createAndCompare(baseline, current);

      expect(result!.summary.totalTasks).toBe(0);
      expect(result!.summary.removedTasks).toBe(2);
      expect(result!.summary.newTasks).toBe(0);
      expect(result!.summary.scheduleHealthPct).toBe(100); // 0 varCount => default 100
      expect(result!.taskVariances).toHaveLength(0);
    });

    // --------------------------------------------------------------------
    // All tasks new (edge case)
    // --------------------------------------------------------------------
    it('handles all current tasks being new (not in baseline)', async () => {
      const baseline: Task[] = [];
      const current = [
        task({ id: 't1', name: 'New A', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 0, status: 'pending' }),
        task({ id: 't2', name: 'New B', startDate: new Date('2026-01-05'), endDate: new Date('2026-01-15'), progressPercentage: 0, status: 'pending' }),
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.summary.totalTasks).toBe(0);
      expect(result!.summary.newTasks).toBe(2);
      expect(result!.summary.removedTasks).toBe(0);
      expect(result!.summary.scheduleHealthPct).toBe(100);
    });

    // --------------------------------------------------------------------
    // Start variance: positive = late start
    // --------------------------------------------------------------------
    it('computes positive start variance when actual start is later than baseline', async () => {
      const baseline = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'),
          progressPercentage: 0, status: 'pending',
        }),
      ];
      const current = [
        task({
          id: 't1', name: 'Task A',
          startDate: new Date('2026-01-08'), endDate: new Date('2026-01-17'),
          progressPercentage: 0, status: 'pending',
        }),
      ];

      const result = await createAndCompare(baseline, current);
      const tv = result!.taskVariances[0];

      expect(tv.startVarianceDays).toBe(7); // 7 days late start
      expect(tv.endVarianceDays).toBe(7);   // 7 days late end
      // avgStartVarianceDays with single task
      expect(result!.summary.avgStartVarianceDays).toBe(7);
      expect(result!.summary.avgEndVarianceDays).toBe(7);
    });

    // --------------------------------------------------------------------
    // Large multi-task scenario
    // --------------------------------------------------------------------
    it('handles large multi-task comparison with diverse variances', async () => {
      const baseline = [
        task({ id: 't1', name: 'Alpha',   startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 10, status: 'pending' }),
        task({ id: 't2', name: 'Beta',    startDate: new Date('2026-01-05'), endDate: new Date('2026-01-15'), progressPercentage: 20, status: 'pending' }),
        task({ id: 't3', name: 'Gamma',   startDate: new Date('2026-01-10'), endDate: new Date('2026-01-20'), progressPercentage: 30, status: 'in_progress' }),
        task({ id: 't4', name: 'Delta',   startDate: new Date('2026-01-15'), endDate: new Date('2026-01-25'), progressPercentage: 40, status: 'in_progress' }),
        task({ id: 't5', name: 'Epsilon', startDate: new Date('2026-01-20'), endDate: new Date('2026-01-30'), progressPercentage: 50, status: 'in_progress' }),
      ];
      const current = [
        task({ id: 't1', name: 'Alpha',   startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10'), progressPercentage: 10, status: 'pending' }),     // on track (0)
        task({ id: 't2', name: 'Beta',    startDate: new Date('2026-01-05'), endDate: new Date('2026-01-20'), progressPercentage: 15, status: 'in_progress' }),  // slipped (+5)
        task({ id: 't3', name: 'Gamma',   startDate: new Date('2026-01-10'), endDate: new Date('2026-01-15'), progressPercentage: 80, status: 'completed' }),    // ahead (-5)
        task({ id: 't4', name: 'Delta',   startDate: new Date('2026-01-15'), endDate: new Date('2026-01-26'), progressPercentage: 35, status: 'in_progress' }),  // on track (+1)
        task({ id: 't5', name: 'Epsilon', startDate: new Date('2026-01-20'), endDate: new Date('2026-02-05'), progressPercentage: 30, status: 'in_progress' }),  // slipped (+6)
      ];

      const result = await createAndCompare(baseline, current);

      expect(result!.summary.totalTasks).toBe(5);
      expect(result!.summary.tasksOnTrack).toBe(2);  // t1 (0), t4 (+1)
      expect(result!.summary.tasksSlipped).toBe(2);   // t2 (+5), t5 (+6)
      expect(result!.summary.tasksAhead).toBe(1);      // t3 (-5)

      // scheduleHealthPct = (2+1)/5*100 = 60
      expect(result!.summary.scheduleHealthPct).toBe(60);

      // End variances: 0, 5, -5, 1, 6 => avg = 7/5 = 1.4
      expect(result!.summary.avgEndVarianceDays).toBe(1.4);
    });
  });
});
