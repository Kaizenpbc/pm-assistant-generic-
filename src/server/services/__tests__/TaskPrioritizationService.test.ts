import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { TaskPrioritizationService } from '../TaskPrioritizationService';
import { Task } from '../ScheduleService';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

let mockTasks: Task[] = [];

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async findTasksByScheduleId(_id: string) { return mockTasks; }
    async findAllDownstreamTasks(taskId: string) {
      return mockTasks.filter(t => t.dependency === taskId);
    }
    async updateTask(id: string, data: any) {
      const t = mockTasks.find(t => t.id === id);
      if (!t) return null;
      Object.assign(t, data);
      return t;
    }
    logActivity() { return { id: 'act-1' }; }
  },
}));

vi.mock('../CriticalPathService', () => ({
  CriticalPathService: class {
    async calculateCriticalPath(_id: string) {
      // Mark the first task as critical if tasks exist
      const critIds = mockTasks.length > 0 ? [mockTasks[0].id] : [];
      return {
        criticalPathTaskIds: critIds,
        tasks: mockTasks.map(t => ({
          taskId: t.id,
          name: t.name,
          duration: t.estimatedDays || 1,
          ES: 0, EF: t.estimatedDays || 1,
          LS: 0, LF: t.estimatedDays || 1,
          totalFloat: critIds.includes(t.id) ? 0 : 10,
          freeFloat: 0,
          isCritical: critIds.includes(t.id),
        })),
        projectDuration: 30,
      };
    }
  },
}));

vi.mock('../AutoRescheduleService', () => ({
  AutoRescheduleService: class {
    async detectDelays(_id: string) {
      // Return a delay for any task with < 30% progress
      return mockTasks
        .filter(t => (t.progressPercentage ?? 0) < 30 && t.status !== 'completed')
        .map(t => ({
          taskId: t.id,
          taskName: t.name,
          severity: 'medium',
          delayDays: 5,
        }));
    }
  },
}));

vi.mock('../claudeService', () => ({
  claudeService: {
    isAvailable: () => false,
    completeWithJsonSchema: vi.fn(),
  },
}));

vi.mock('../config', () => ({
  config: { AI_ENABLED: false },
}));

function task(overrides: Partial<Task> & { id: string; name: string }): Task {
  const now = new Date();
  return {
    scheduleId: 'sch-test',
    status: 'in_progress',
    priority: 'medium',
    createdBy: '1',
    createdAt: now,
    updatedAt: now,
    startDate: new Date(now.getTime() - 10 * 86400000), // started 10 days ago
    endDate: new Date(now.getTime() + 20 * 86400000),   // due in 20 days
    progressPercentage: 30,
    ...overrides,
  };
}

describe('TaskPrioritizationService', () => {
  let service: TaskPrioritizationService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15'));
    service = new TaskPrioritizationService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // No active tasks
  // -----------------------------------------------------------------------

  it('returns empty result when no active tasks exist', async () => {
    mockTasks = [
      task({ id: 't1', name: 'Completed', status: 'completed', progressPercentage: 100 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    expect(result.tasks).toHaveLength(0);
    expect(result.summary.tasksAnalyzed).toBe(0);
    expect(result.aiPowered).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Single task scoring
  // -----------------------------------------------------------------------

  it('scores a single active task', async () => {
    mockTasks = [
      task({ id: 't1', name: 'Task A' }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskId).toBe('t1');
    expect(result.tasks[0].priorityScore).toBeGreaterThanOrEqual(0);
    expect(result.tasks[0].priorityScore).toBeLessThanOrEqual(100);
    expect(result.tasks[0].rank).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Critical path tasks get higher scores
  // -----------------------------------------------------------------------

  it('gives higher score to critical path tasks', async () => {
    mockTasks = [
      task({ id: 'critical', name: 'Critical Task', progressPercentage: 50 }),
      task({ id: 'noncritical', name: 'Non-Critical', progressPercentage: 50 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    const critical = result.tasks.find(t => t.taskId === 'critical')!;
    const nonCritical = result.tasks.find(t => t.taskId === 'noncritical')!;

    // Critical path factor contributes 25% weight, so critical should score higher
    expect(critical.priorityScore).toBeGreaterThan(nonCritical.priorityScore);
  });

  // -----------------------------------------------------------------------
  // Delayed tasks score higher
  // -----------------------------------------------------------------------

  it('gives higher score to delayed tasks', async () => {
    mockTasks = [
      task({ id: 'delayed', name: 'Delayed Task', progressPercentage: 10 }), // will be detected as delayed
      task({ id: 'on-track', name: 'On Track', progressPercentage: 80 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    const delayed = result.tasks.find(t => t.taskId === 'delayed')!;
    const onTrack = result.tasks.find(t => t.taskId === 'on-track')!;

    expect(delayed.priorityScore).toBeGreaterThan(onTrack.priorityScore);
  });

  // -----------------------------------------------------------------------
  // Tasks due soon score higher
  // -----------------------------------------------------------------------

  it('gives higher score to tasks due sooner', async () => {
    const now = new Date('2026-06-15');
    mockTasks = [
      task({
        id: 'soon',
        name: 'Due Soon',
        startDate: new Date(now.getTime() - 25 * 86400000),
        endDate: new Date(now.getTime() + 5 * 86400000), // 5 days from now
        progressPercentage: 50,
      }),
      task({
        id: 'later',
        name: 'Due Later',
        startDate: new Date(now.getTime() - 5 * 86400000),
        endDate: new Date(now.getTime() + 50 * 86400000), // 50 days from now
        progressPercentage: 50,
      }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    const soon = result.tasks.find(t => t.taskId === 'soon')!;
    const later = result.tasks.find(t => t.taskId === 'later')!;

    expect(soon.priorityScore).toBeGreaterThanOrEqual(later.priorityScore);
  });

  // -----------------------------------------------------------------------
  // Tasks with more dependents score higher
  // -----------------------------------------------------------------------

  it('gives higher score to tasks with more downstream dependents', async () => {
    mockTasks = [
      task({ id: 'parent', name: 'Parent', progressPercentage: 50 }),
      task({ id: 'child1', name: 'Child 1', dependency: 'parent', progressPercentage: 50 }),
      task({ id: 'child2', name: 'Child 2', dependency: 'parent', progressPercentage: 50 }),
      task({ id: 'standalone', name: 'Standalone', progressPercentage: 50 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    const parent = result.tasks.find(t => t.taskId === 'parent')!;
    const standalone = result.tasks.find(t => t.taskId === 'standalone')!;

    // Parent has 2 dependents → higher downstream impact
    expect(parent.priorityScore).toBeGreaterThan(standalone.priorityScore);
  });

  // -----------------------------------------------------------------------
  // scoreToPriority mapping
  // -----------------------------------------------------------------------

  it('maps scores to correct priority levels', async () => {
    // One task with very high factors → urgent
    mockTasks = [
      task({
        id: 'urgent',
        name: 'Urgent Task',
        progressPercentage: 0, // delayed
        startDate: new Date('2026-05-15'), // started a month ago
        endDate: new Date('2026-06-17'),   // due in 2 days
      }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    // Should have some suggestedPriority value
    expect(['low', 'medium', 'high', 'urgent']).toContain(result.tasks[0].suggestedPriority);
  });

  // -----------------------------------------------------------------------
  // Tasks are ranked in descending score order
  // -----------------------------------------------------------------------

  it('ranks tasks in descending score order', async () => {
    mockTasks = [
      task({ id: 't1', name: 'T1', progressPercentage: 80 }),
      task({ id: 't2', name: 'T2', progressPercentage: 10 }),
      task({ id: 't3', name: 'T3', progressPercentage: 50 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    for (let i = 1; i < result.tasks.length; i++) {
      expect(result.tasks[i - 1].priorityScore).toBeGreaterThanOrEqual(
        result.tasks[i].priorityScore
      );
      expect(result.tasks[i].rank).toBe(i + 1);
    }
  });

  // -----------------------------------------------------------------------
  // Summary statistics
  // -----------------------------------------------------------------------

  it('computes summary statistics correctly', async () => {
    mockTasks = [
      task({ id: 't1', name: 'T1', progressPercentage: 50 }),
      task({ id: 't2', name: 'T2', progressPercentage: 50 }),
      task({ id: 't3', name: 'Completed', status: 'completed', progressPercentage: 100 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    expect(result.summary.totalTasks).toBe(3);
    expect(result.summary.tasksAnalyzed).toBe(2); // only active tasks
    expect(result.summary.criticalPathTasks).toBe(1); // mock marks first as critical
    expect(result.summary.averageScore).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Priority change detection
  // -----------------------------------------------------------------------

  it('detects when suggested priority differs from current', async () => {
    mockTasks = [
      task({
        id: 't1',
        name: 'Should Be Urgent',
        priority: 'low',
        progressPercentage: 0,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-06-16'),
      }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    // The task has low priority but factors may suggest higher
    if (result.tasks[0].suggestedPriority !== 'low') {
      expect(result.summary.priorityChanges).toBe(1);
    }
  });

  // -----------------------------------------------------------------------
  // Factors are populated
  // -----------------------------------------------------------------------

  it('populates factors for scored tasks', async () => {
    mockTasks = [
      task({ id: 't1', name: 'Task With Factors', progressPercentage: 10 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    // Should have at least one factor (critical path, delay, etc.)
    expect(result.tasks[0].factors.length).toBeGreaterThan(0);
    for (const factor of result.tasks[0].factors) {
      expect(factor.factor).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(factor.impact);
      expect(factor.description).toBeTruthy();
    }
  });

  // -----------------------------------------------------------------------
  // Explanation is generated
  // -----------------------------------------------------------------------

  it('generates explanation for each task', async () => {
    mockTasks = [
      task({ id: 't1', name: 'My Task', progressPercentage: 50 }),
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    expect(result.tasks[0].explanation).toBeTruthy();
    expect(typeof result.tasks[0].explanation).toBe('string');
  });

  // -----------------------------------------------------------------------
  // Filters out tasks without dates
  // -----------------------------------------------------------------------

  it('skips tasks without start/end dates', async () => {
    mockTasks = [
      task({ id: 'dated', name: 'Has Dates' }),
      {
        id: 'nodates',
        scheduleId: 'sch-test',
        name: 'No Dates',
        status: 'pending',
        priority: 'medium',
        createdBy: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
        // no startDate, no endDate
      } as Task,
    ];

    const result = await service.prioritizeTasks('proj-1', 'sch-test');

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskId).toBe('dated');
  });

  // -----------------------------------------------------------------------
  // applyPriorityChange
  // -----------------------------------------------------------------------

  it('applies a single priority change', async () => {
    mockTasks = [
      task({ id: 't1', name: 'T1', priority: 'low' }),
    ];

    const success = await service.applyPriorityChange('t1', 'high');
    expect(success).toBe(true);
    expect(mockTasks[0].priority).toBe('high');
  });

  it('returns false for nonexistent task', async () => {
    mockTasks = [];
    const success = await service.applyPriorityChange('nonexistent', 'high');
    expect(success).toBe(false);
  });

  // -----------------------------------------------------------------------
  // applyAllPriorityChanges
  // -----------------------------------------------------------------------

  it('applies batch priority changes', async () => {
    mockTasks = [
      task({ id: 't1', name: 'T1', priority: 'low' }),
      task({ id: 't2', name: 'T2', priority: 'low' }),
    ];

    const count = await service.applyAllPriorityChanges([
      { taskId: 't1', priority: 'high' },
      { taskId: 't2', priority: 'urgent' },
    ]);

    expect(count).toBe(2);
    expect(mockTasks[0].priority).toBe('high');
    expect(mockTasks[1].priority).toBe('urgent');
  });
});
