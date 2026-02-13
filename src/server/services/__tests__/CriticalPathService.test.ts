import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CriticalPathService, CriticalPathResult, CPMTaskResult } from '../CriticalPathService';
import { Task } from '../ScheduleService';

// ---------------------------------------------------------------------------
// Mock ScheduleService so we control the task graph exactly
// ---------------------------------------------------------------------------
vi.mock('../ScheduleService', () => {
  let mockTasks: Task[] = [];
  return {
    ScheduleService: class {
      static __setTasks(tasks: Task[]) { mockTasks = tasks; }
      async findTasksByScheduleId(_id: string): Promise<Task[]> {
        return mockTasks;
      }
    },
  };
});

// Import the mocked class so we can set tasks per test
import { ScheduleService as MockedScheduleService } from '../ScheduleService';
const setTasks = (MockedScheduleService as any).__setTasks as (tasks: Task[]) => void;

function task(overrides: Partial<Task> & { id: string; name: string }): Task {
  return {
    scheduleId: 'test',
    status: 'pending',
    priority: 'medium',
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CriticalPathService', () => {
  let service: CriticalPathService;

  beforeEach(() => {
    service = new CriticalPathService();
  });

  // -----------------------------------------------------------------------
  // Empty schedule
  // -----------------------------------------------------------------------

  it('returns empty result for schedule with no tasks', async () => {
    setTasks([]);
    const result = await service.calculateCriticalPath('empty');
    expect(result.criticalPathTaskIds).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.projectDuration).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Single task
  // -----------------------------------------------------------------------

  it('identifies a single task as the critical path', async () => {
    setTasks([
      task({ id: 'A', name: 'Only Task', estimatedDays: 5 }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    expect(result.projectDuration).toBe(5);
    expect(result.criticalPathTaskIds).toEqual(['A']);
    expect(result.tasks).toHaveLength(1);

    const t = result.tasks[0];
    expect(t.ES).toBe(0);
    expect(t.EF).toBe(5);
    expect(t.LS).toBe(0);
    expect(t.LF).toBe(5);
    expect(t.totalFloat).toBe(0);
    expect(t.isCritical).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Linear chain: A -> B -> C
  // -----------------------------------------------------------------------

  it('computes correct CPM for a linear chain', async () => {
    setTasks([
      task({ id: 'A', name: 'A', estimatedDays: 3 }),
      task({ id: 'B', name: 'B', estimatedDays: 4, dependency: 'A' }),
      task({ id: 'C', name: 'C', estimatedDays: 2, dependency: 'B' }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    expect(result.projectDuration).toBe(9); // 3 + 4 + 2

    // All tasks on critical path in a linear chain
    expect(result.criticalPathTaskIds).toEqual(['A', 'B', 'C']);

    const byId = new Map(result.tasks.map(t => [t.taskId, t]));

    // A: ES=0, EF=3, LS=0, LF=3
    expect(byId.get('A')!.ES).toBe(0);
    expect(byId.get('A')!.EF).toBe(3);
    expect(byId.get('A')!.LS).toBe(0);
    expect(byId.get('A')!.LF).toBe(3);
    expect(byId.get('A')!.totalFloat).toBe(0);

    // B: ES=3, EF=7, LS=3, LF=7
    expect(byId.get('B')!.ES).toBe(3);
    expect(byId.get('B')!.EF).toBe(7);
    expect(byId.get('B')!.LS).toBe(3);
    expect(byId.get('B')!.LF).toBe(7);
    expect(byId.get('B')!.totalFloat).toBe(0);

    // C: ES=7, EF=9, LS=7, LF=9
    expect(byId.get('C')!.ES).toBe(7);
    expect(byId.get('C')!.EF).toBe(9);
    expect(byId.get('C')!.totalFloat).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Parallel paths with float
  //   A(3) -> B(4) -> D(2)
  //   A(3) -> C(1) -> D(2)
  // Critical path: A -> B -> D (duration 9)
  // C has float = 3
  // -----------------------------------------------------------------------

  it('identifies critical vs non-critical paths and computes float', async () => {
    setTasks([
      task({ id: 'A', name: 'A', estimatedDays: 3 }),
      task({ id: 'B', name: 'B', estimatedDays: 4, dependency: 'A' }),
      task({ id: 'C', name: 'C', estimatedDays: 1, dependency: 'A' }),
      task({ id: 'D', name: 'D', estimatedDays: 2, dependency: 'B' }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    expect(result.projectDuration).toBe(9); // A(3) + B(4) + D(2)

    const byId = new Map(result.tasks.map(t => [t.taskId, t]));

    // A, B, D are critical
    expect(byId.get('A')!.isCritical).toBe(true);
    expect(byId.get('B')!.isCritical).toBe(true);
    expect(byId.get('D')!.isCritical).toBe(true);

    // C is NOT on the critical path (float > 0)
    expect(byId.get('C')!.isCritical).toBe(false);
    // C: ES=3, EF=4; LS=3+4-1=6, LF=7 => totalFloat = 6-3 = 3
    // Wait — C depends on A and D depends on B only, not C.
    // So C has no successors that lead to D. C's LF = projectDuration = 9.
    // C: ES=3, EF=4, LS=8, LF=9, totalFloat = 5
    expect(byId.get('C')!.ES).toBe(3);
    expect(byId.get('C')!.EF).toBe(4);
    expect(byId.get('C')!.totalFloat).toBe(5);
  });

  // -----------------------------------------------------------------------
  // Diamond: A -> B, A -> C, B -> D, C -> D
  // Critical path goes through the longer of B vs C
  // -----------------------------------------------------------------------

  it('handles diamond dependency with converging paths', async () => {
    setTasks([
      task({ id: 'A', name: 'A', estimatedDays: 2 }),
      task({ id: 'B', name: 'B', estimatedDays: 5, dependency: 'A' }),
      task({ id: 'C', name: 'C', estimatedDays: 3, dependency: 'A' }),
      task({ id: 'D', name: 'D', estimatedDays: 1, dependency: 'B' }),
      // Note: D only depends on B per the single-dependency model.
      // To make a true diamond, we'd need multi-deps. With single dep,
      // D depends on B, and C is independent.
    ]);

    const result = await service.calculateCriticalPath('s1');

    // A(2) + B(5) + D(1) = 8
    expect(result.projectDuration).toBe(8);

    const byId = new Map(result.tasks.map(t => [t.taskId, t]));

    expect(byId.get('A')!.isCritical).toBe(true);
    expect(byId.get('B')!.isCritical).toBe(true);
    expect(byId.get('D')!.isCritical).toBe(true);
    expect(byId.get('C')!.isCritical).toBe(false);

    // C: ES=2, EF=5, LF=8, LS=5, totalFloat=3
    expect(byId.get('C')!.totalFloat).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Duration fallback: estimatedDays missing, uses startDate/endDate
  // -----------------------------------------------------------------------

  it('computes duration from start/end dates when estimatedDays is missing', async () => {
    setTasks([
      task({
        id: 'X',
        name: 'X',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-11'), // 10 days
      }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    expect(result.projectDuration).toBe(10);
    expect(result.tasks[0].duration).toBe(10);
  });

  // -----------------------------------------------------------------------
  // Duration fallback: no estimatedDays, no dates -> defaults to 1
  // -----------------------------------------------------------------------

  it('defaults duration to 1 when no duration info available', async () => {
    setTasks([
      task({ id: 'Z', name: 'Z' }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    expect(result.projectDuration).toBe(1);
    expect(result.tasks[0].duration).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Parallel independent tasks
  // -----------------------------------------------------------------------

  it('handles independent parallel tasks', async () => {
    setTasks([
      task({ id: 'A', name: 'A', estimatedDays: 5 }),
      task({ id: 'B', name: 'B', estimatedDays: 3 }),
      task({ id: 'C', name: 'C', estimatedDays: 7 }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    // Project duration = max(5, 3, 7) = 7
    expect(result.projectDuration).toBe(7);

    const byId = new Map(result.tasks.map(t => [t.taskId, t]));

    // C is the longest → critical
    expect(byId.get('C')!.isCritical).toBe(true);
    expect(byId.get('C')!.totalFloat).toBe(0);

    // A has float = 7 - 5 = 2
    expect(byId.get('A')!.isCritical).toBe(false);
    expect(byId.get('A')!.totalFloat).toBe(2);

    // B has float = 7 - 3 = 4
    expect(byId.get('B')!.isCritical).toBe(false);
    expect(byId.get('B')!.totalFloat).toBe(4);
  });

  // -----------------------------------------------------------------------
  // Free float computation
  // -----------------------------------------------------------------------

  it('computes free float correctly', async () => {
    // A(3) -> C(2)
    // B(1) -> C(2)
    // Both A and B are predecessors to C (but single-dep model means C depends on one).
    // Let's use: A(3), B(1) depends on nothing, C(2) depends on A
    // B has total float = 5-1=4 and free float = 4 (no successors for B that need it)
    setTasks([
      task({ id: 'A', name: 'A', estimatedDays: 3 }),
      task({ id: 'B', name: 'B', estimatedDays: 1 }),
      task({ id: 'C', name: 'C', estimatedDays: 2, dependency: 'A' }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    expect(result.projectDuration).toBe(5);

    const byId = new Map(result.tasks.map(t => [t.taskId, t]));

    // B: no successors, freeFloat = totalFloat
    expect(byId.get('B')!.freeFloat).toBe(4);

    // A: successor is C (ES=3), freeFloat = 3 - 3 = 0
    expect(byId.get('A')!.freeFloat).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Task with invalid dependency (dependency not found) is treated as root
  // -----------------------------------------------------------------------

  it('treats tasks with nonexistent dependencies as root nodes', async () => {
    setTasks([
      task({ id: 'A', name: 'A', estimatedDays: 3, dependency: 'nonexistent' }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    expect(result.projectDuration).toBe(3);
    expect(result.criticalPathTaskIds).toEqual(['A']);
    expect(result.tasks[0].ES).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Multiple predecessors via longer chain
  // A(2), B(5), C(3) dep A, D(1) dep B
  // E(2) dep D
  // Project duration = B(5) + D(1) + E(2) = 8
  // -----------------------------------------------------------------------

  it('handles complex multi-path networks', async () => {
    setTasks([
      task({ id: 'A', name: 'A', estimatedDays: 2 }),
      task({ id: 'B', name: 'B', estimatedDays: 5 }),
      task({ id: 'C', name: 'C', estimatedDays: 3, dependency: 'A' }),
      task({ id: 'D', name: 'D', estimatedDays: 1, dependency: 'B' }),
      task({ id: 'E', name: 'E', estimatedDays: 2, dependency: 'D' }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    // Longest path: B(5) -> D(1) -> E(2) = 8
    expect(result.projectDuration).toBe(8);

    const byId = new Map(result.tasks.map(t => [t.taskId, t]));

    expect(byId.get('B')!.isCritical).toBe(true);
    expect(byId.get('D')!.isCritical).toBe(true);
    expect(byId.get('E')!.isCritical).toBe(true);

    // A: ES=0, EF=2, float = 8-2 = 6
    expect(byId.get('A')!.isCritical).toBe(false);
    // C: ES=2, EF=5, float = 8-5 = 3
    expect(byId.get('C')!.isCritical).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Result shape validation
  // -----------------------------------------------------------------------

  it('returns properly shaped CPMTaskResult objects', async () => {
    setTasks([
      task({ id: 'A', name: 'Task Alpha', estimatedDays: 4 }),
    ]);

    const result = await service.calculateCriticalPath('s1');

    const t = result.tasks[0];
    expect(t).toEqual(expect.objectContaining({
      taskId: 'A',
      name: 'Task Alpha',
      duration: 4,
      ES: expect.any(Number),
      EF: expect.any(Number),
      LS: expect.any(Number),
      LF: expect.any(Number),
      totalFloat: expect.any(Number),
      freeFloat: expect.any(Number),
      isCritical: expect.any(Boolean),
    }));
  });
});
