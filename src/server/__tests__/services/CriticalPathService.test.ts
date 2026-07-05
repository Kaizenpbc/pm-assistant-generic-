import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindTasks = vi.fn();
vi.mock('../../services/ScheduleService', () => ({
  scheduleService: { findTasksByScheduleId: (...args: any[]) => mockFindTasks(...args) },
}));

import { CriticalPathService } from '../../services/CriticalPathService';

function makeTask(id: string, name: string, opts: {
  estimatedDays?: number;
  startDate?: string;
  endDate?: string;
  dependencies?: Array<{ dependencyId: string; dependencyType?: string; lagDays?: number }>;
} = {}) {
  return {
    id,
    name,
    estimatedDays: opts.estimatedDays ?? 0,
    startDate: opts.startDate ?? null,
    endDate: opts.endDate ?? null,
    dependencies: opts.dependencies ?? [],
    status: 'not_started',
  };
}

describe('CriticalPathService', () => {
  let service: CriticalPathService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CriticalPathService();
  });

  it('returns empty result for no tasks', async () => {
    mockFindTasks.mockResolvedValue([]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.criticalPathTaskIds).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.projectDuration).toBe(0);
  });

  it('single task is always critical', async () => {
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Task 1', { estimatedDays: 5 }),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.criticalPathTaskIds).toEqual(['t1']);
    expect(result.projectDuration).toBe(5);
    expect(result.tasks[0].isCritical).toBe(true);
    expect(result.tasks[0].totalFloat).toBe(0);
  });

  it('two sequential tasks (FS dependency)', async () => {
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Task 1', { estimatedDays: 3 }),
      makeTask('t2', 'Task 2', { estimatedDays: 4, dependencies: [{ dependencyId: 't1', dependencyType: 'FS' }] }),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.projectDuration).toBe(7); // 3 + 4
    expect(result.criticalPathTaskIds).toContain('t1');
    expect(result.criticalPathTaskIds).toContain('t2');
    // t1: ES=0, EF=3; t2: ES=3, EF=7
    const t1 = result.tasks.find(t => t.taskId === 't1')!;
    const t2 = result.tasks.find(t => t.taskId === 't2')!;
    expect(t1.ES).toBe(0);
    expect(t1.EF).toBe(3);
    expect(t2.ES).toBe(3);
    expect(t2.EF).toBe(7);
  });

  it('parallel tasks — shorter path has float', async () => {
    // t1(3) -> t3(2) = 5 days (critical)
    // t2(2) -> t3(2) = 4 days (t2 has float)
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Task 1', { estimatedDays: 3 }),
      makeTask('t2', 'Task 2', { estimatedDays: 2 }),
      makeTask('t3', 'Task 3', { estimatedDays: 2, dependencies: [
        { dependencyId: 't1', dependencyType: 'FS' },
        { dependencyId: 't2', dependencyType: 'FS' },
      ]}),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.projectDuration).toBe(5);

    const t1 = result.tasks.find(t => t.taskId === 't1')!;
    const t2 = result.tasks.find(t => t.taskId === 't2')!;
    const t3 = result.tasks.find(t => t.taskId === 't3')!;

    expect(t1.isCritical).toBe(true);
    expect(t3.isCritical).toBe(true);
    expect(t2.isCritical).toBe(false);
    expect(t2.totalFloat).toBe(1); // can slip 1 day
  });

  it('handles FS dependency with lag', async () => {
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Task 1', { estimatedDays: 3 }),
      makeTask('t2', 'Task 2', { estimatedDays: 2, dependencies: [{ dependencyId: 't1', dependencyType: 'FS', lagDays: 2 }] }),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.projectDuration).toBe(7); // 3 + 2(lag) + 2
    const t2 = result.tasks.find(t => t.taskId === 't2')!;
    expect(t2.ES).toBe(5); // EF of t1 (3) + lag (2)
    expect(t2.EF).toBe(7);
  });

  it('handles SS (Start-to-Start) dependency', async () => {
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Task 1', { estimatedDays: 5 }),
      makeTask('t2', 'Task 2', { estimatedDays: 3, dependencies: [{ dependencyId: 't1', dependencyType: 'SS', lagDays: 1 }] }),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    const t2 = result.tasks.find(t => t.taskId === 't2')!;
    expect(t2.ES).toBe(1); // SS: ES of t1 (0) + lag (1)
    expect(t2.EF).toBe(4);
  });

  it('defaults to 1-day duration when no estimate or dates', async () => {
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Task 1'),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.tasks[0].duration).toBe(1);
    expect(result.projectDuration).toBe(1);
  });

  it('calculates duration from start/end dates when no estimate', async () => {
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Task 1', { startDate: '2026-01-01', endDate: '2026-01-04' }),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.tasks[0].duration).toBe(3);
  });

  it('handles diamond dependency pattern', async () => {
    //   t1
    //  / \
    // t2   t3
    //  \ /
    //   t4
    mockFindTasks.mockResolvedValue([
      makeTask('t1', 'Start', { estimatedDays: 2 }),
      makeTask('t2', 'Path A', { estimatedDays: 5, dependencies: [{ dependencyId: 't1' }] }),
      makeTask('t3', 'Path B', { estimatedDays: 3, dependencies: [{ dependencyId: 't1' }] }),
      makeTask('t4', 'End', { estimatedDays: 1, dependencies: [
        { dependencyId: 't2' },
        { dependencyId: 't3' },
      ]}),
    ]);
    const result = await service.calculateCriticalPath('sch-1');
    expect(result.projectDuration).toBe(8); // t1(2) + t2(5) + t4(1)

    const t2 = result.tasks.find(t => t.taskId === 't2')!;
    const t3 = result.tasks.find(t => t.taskId === 't3')!;
    expect(t2.isCritical).toBe(true);
    expect(t3.isCritical).toBe(false);
    expect(t3.totalFloat).toBe(2);
  });
});
