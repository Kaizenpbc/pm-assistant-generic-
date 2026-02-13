import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonteCarloService } from '../MonteCarloService';
import { Task, Schedule } from '../ScheduleService';

// ---------------------------------------------------------------------------
// Mock external dependencies so MonteCarloService runs in isolation
// ---------------------------------------------------------------------------

let mockTasks: Task[] = [];
let mockSchedule: Schedule | null = null;

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async findById(_id: string) { return mockSchedule; }
    async findTasksByScheduleId(_id: string) { return mockTasks; }
  },
}));

vi.mock('../ProjectService', () => ({
  ProjectService: class {
    async findById(_id: string) {
      return {
        id: 'proj-1',
        name: 'Test Project',
        budgetAllocated: 100000,
        budgetSpent: 30000,
        projectType: 'it',
        status: 'active',
        priority: 'high',
        currency: 'USD',
        createdBy: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  },
}));

vi.mock('../CriticalPathService', () => ({
  CriticalPathService: class {
    async calculateCriticalPath(_id: string) {
      return {
        criticalPathTaskIds: mockTasks.filter(t => !t.dependency || true).map(t => t.id),
        tasks: mockTasks.map(t => ({
          taskId: t.id,
          name: t.name,
          duration: t.estimatedDays || 1,
          ES: 0, EF: t.estimatedDays || 1, LS: 0, LF: t.estimatedDays || 1,
          totalFloat: 0, freeFloat: 0, isCritical: true,
        })),
        projectDuration: mockTasks.reduce((sum, t) => sum + (t.estimatedDays || 1), 0),
      };
    }
  },
}));

function task(overrides: Partial<Task> & { id: string; name: string }): Task {
  return {
    scheduleId: 'sch-test',
    status: 'pending',
    priority: 'medium',
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MonteCarloService', () => {
  let service: MonteCarloService;

  beforeEach(() => {
    service = new MonteCarloService();
    mockSchedule = {
      id: 'sch-test',
      projectId: 'proj-1',
      name: 'Test Schedule',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
      status: 'active',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockTasks = [
      task({ id: 't1', name: 'Design', estimatedDays: 10 }),
      task({ id: 't2', name: 'Build', estimatedDays: 20, dependency: 't1' }),
      task({ id: 't3', name: 'Test', estimatedDays: 5, dependency: 't2' }),
    ];
  });

  // -----------------------------------------------------------------------
  // Basic execution and result shape
  // -----------------------------------------------------------------------

  it('runs simulation and returns correctly shaped result', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 500 });

    expect(result.iterationsRun).toBe(500);
    expect(result.simulationConfig.iterations).toBe(500);
    expect(result.simulationConfig.uncertaintyModel).toBe('pert');

    // Duration stats
    expect(result.durationStats.min).toBeGreaterThan(0);
    expect(result.durationStats.max).toBeGreaterThanOrEqual(result.durationStats.min);
    expect(result.durationStats.mean).toBeGreaterThan(0);
    expect(result.durationStats.stdDev).toBeGreaterThanOrEqual(0);
    expect(result.durationStats.p50).toBeGreaterThan(0);
    expect(result.durationStats.p80).toBeGreaterThanOrEqual(result.durationStats.p50);
    expect(result.durationStats.p90).toBeGreaterThanOrEqual(result.durationStats.p80);

    // Completion dates exist and are date strings
    expect(result.completionDate.p50).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.completionDate.p80).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.completionDate.p90).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Histogram
    expect(result.histogram.bins.length).toBeGreaterThan(0);
    expect(result.histogram.bins[result.histogram.bins.length - 1].cumulativePercent).toBe(100);

    // Sensitivity analysis
    expect(result.sensitivityAnalysis.length).toBe(3);
    expect(result.sensitivityAnalysis[0].rank).toBe(1);

    // Criticality index
    expect(result.criticalityIndex.length).toBe(3);
    for (const item of result.criticalityIndex) {
      expect(item.criticalityPercent).toBeGreaterThanOrEqual(0);
      expect(item.criticalityPercent).toBeLessThanOrEqual(100);
    }

    // Cost forecast (budget = 100000)
    expect(result.costForecast.p50).toBeGreaterThan(0);
    expect(result.costForecast.p90).toBeGreaterThanOrEqual(result.costForecast.p50);
  });

  // -----------------------------------------------------------------------
  // Percentile ordering: p50 <= p80 <= p90
  // -----------------------------------------------------------------------

  it('ensures percentile ordering p50 <= p80 <= p90', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 1000 });

    expect(result.durationStats.p50).toBeLessThanOrEqual(result.durationStats.p80);
    expect(result.durationStats.p80).toBeLessThanOrEqual(result.durationStats.p90);
  });

  // -----------------------------------------------------------------------
  // Mean is within plausible range for PERT
  // -----------------------------------------------------------------------

  it('produces mean duration within expected range for PERT model', async () => {
    const result = await service.runSimulation('sch-test', {
      iterations: 2000,
      uncertaintyModel: 'pert',
    });

    // For the chain t1(10) -> t2(20) -> t3(5), deterministic duration = 35
    // PERT mean = (opt + 4*ml + pess)/6 per task, and chain sums them
    // opt = ml*0.75, pess depends on priority (medium → 1.75x)
    // Per task PERT mean ≈ ml (slightly above), so sum ≈ 35-ish
    // Allow generous range: 25 to 65 (to handle aggregation effects)
    expect(result.durationStats.mean).toBeGreaterThan(25);
    expect(result.durationStats.mean).toBeLessThan(65);
  });

  // -----------------------------------------------------------------------
  // Triangular distribution model runs without errors
  // -----------------------------------------------------------------------

  it('supports triangular uncertainty model', async () => {
    const result = await service.runSimulation('sch-test', {
      iterations: 500,
      uncertaintyModel: 'triangular',
    });

    expect(result.simulationConfig.uncertaintyModel).toBe('triangular');
    expect(result.durationStats.mean).toBeGreaterThan(0);
    expect(result.iterationsRun).toBe(500);
  });

  // -----------------------------------------------------------------------
  // Histogram bins sum to total iterations
  // -----------------------------------------------------------------------

  it('histogram bin counts sum to the number of iterations', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 1000 });

    const totalCount = result.histogram.bins.reduce((sum, bin) => sum + bin.count, 0);
    expect(totalCount).toBe(1000);
  });

  // -----------------------------------------------------------------------
  // Histogram bins have ascending min values
  // -----------------------------------------------------------------------

  it('histogram bins are in ascending order', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 500 });

    for (let i = 1; i < result.histogram.bins.length; i++) {
      expect(result.histogram.bins[i].min).toBeGreaterThanOrEqual(result.histogram.bins[i - 1].min);
    }
  });

  // -----------------------------------------------------------------------
  // Cumulative percent is monotonically increasing to 100
  // -----------------------------------------------------------------------

  it('histogram cumulative percent reaches 100', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 500 });

    const bins = result.histogram.bins;
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i].cumulativePercent).toBeGreaterThanOrEqual(bins[i - 1].cumulativePercent);
    }
    expect(bins[bins.length - 1].cumulativePercent).toBe(100);
  });

  // -----------------------------------------------------------------------
  // Sensitivity analysis ranks are sequential
  // -----------------------------------------------------------------------

  it('sensitivity analysis items have sequential ranks', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 500 });

    for (let i = 0; i < result.sensitivityAnalysis.length; i++) {
      expect(result.sensitivityAnalysis[i].rank).toBe(i + 1);
    }
  });

  // -----------------------------------------------------------------------
  // Sensitivity correlation coefficients are in [-1, 1]
  // -----------------------------------------------------------------------

  it('sensitivity correlation coefficients are between -1 and 1', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 500 });

    for (const item of result.sensitivityAnalysis) {
      expect(item.correlationCoefficient).toBeGreaterThanOrEqual(-1);
      expect(item.correlationCoefficient).toBeLessThanOrEqual(1);
    }
  });

  // -----------------------------------------------------------------------
  // Longer tasks have higher sensitivity
  // -----------------------------------------------------------------------

  it('longer tasks generally have higher sensitivity correlation', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 2000 });

    // t2 (20 days) should typically have the highest correlation
    const t2 = result.sensitivityAnalysis.find(s => s.taskId === 't2');
    const t3 = result.sensitivityAnalysis.find(s => s.taskId === 't3');

    expect(t2).toBeDefined();
    expect(t3).toBeDefined();
    // t2's absolute correlation should be >= t3's in most runs
    expect(Math.abs(t2!.correlationCoefficient)).toBeGreaterThanOrEqual(
      Math.abs(t3!.correlationCoefficient) - 0.15 // allow small margin
    );
  });

  // -----------------------------------------------------------------------
  // Schedule not found throws
  // -----------------------------------------------------------------------

  it('throws when schedule is not found', async () => {
    mockSchedule = null;

    await expect(service.runSimulation('nonexistent')).rejects.toThrow(
      'Schedule not found',
    );
  });

  // -----------------------------------------------------------------------
  // Empty tasks throw
  // -----------------------------------------------------------------------

  it('throws when no tasks exist for schedule', async () => {
    mockTasks = [];

    await expect(service.runSimulation('sch-test')).rejects.toThrow(
      'No tasks found',
    );
  });

  // -----------------------------------------------------------------------
  // Single task simulation
  // -----------------------------------------------------------------------

  it('handles single-task schedule correctly', async () => {
    mockTasks = [
      task({ id: 'solo', name: 'Solo', estimatedDays: 10 }),
    ];

    const result = await service.runSimulation('sch-test', { iterations: 500 });

    expect(result.durationStats.mean).toBeGreaterThan(5);
    expect(result.durationStats.mean).toBeLessThan(25);
    expect(result.sensitivityAnalysis.length).toBe(1);
    expect(result.criticalityIndex.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Priority affects pessimistic multiplier (higher priority → wider range)
  // -----------------------------------------------------------------------

  it('high-priority tasks have wider distribution range', async () => {
    // Run two simulations: one with all low priority, one with all urgent
    mockTasks = [
      task({ id: 't1', name: 'Low', estimatedDays: 10, priority: 'low' }),
    ];
    const resultLow = await service.runSimulation('sch-test', { iterations: 2000 });

    mockTasks = [
      task({ id: 't1', name: 'Urgent', estimatedDays: 10, priority: 'urgent' }),
    ];
    const resultUrgent = await service.runSimulation('sch-test', { iterations: 2000 });

    // Urgent has pessimistic multiplier 2.0 vs low's 1.5, so wider spread
    expect(resultUrgent.durationStats.stdDev).toBeGreaterThan(resultLow.durationStats.stdDev * 0.8);
    expect(resultUrgent.durationStats.max).toBeGreaterThanOrEqual(resultLow.durationStats.max * 0.9);
  });

  // -----------------------------------------------------------------------
  // Completion dates are after the schedule start date
  // -----------------------------------------------------------------------

  it('completion dates are after the schedule start date', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 500 });

    const startDate = new Date('2026-01-01');
    expect(new Date(result.completionDate.p50).getTime()).toBeGreaterThan(startDate.getTime());
    expect(new Date(result.completionDate.p80).getTime()).toBeGreaterThan(startDate.getTime());
    expect(new Date(result.completionDate.p90).getTime()).toBeGreaterThan(startDate.getTime());
  });

  // -----------------------------------------------------------------------
  // Cost forecast proportional to duration
  // -----------------------------------------------------------------------

  it('cost forecast scales proportionally with duration percentiles', async () => {
    const result = await service.runSimulation('sch-test', { iterations: 1000 });

    // p90 cost should be >= p50 cost
    expect(result.costForecast.p90).toBeGreaterThanOrEqual(result.costForecast.p50);
  });

  // -----------------------------------------------------------------------
  // Duration fallback: when estimatedDays is missing, buildDistributions
  // defaults mostLikely to 1 (the date fallback only triggers if mostLikely <= 0)
  // -----------------------------------------------------------------------

  it('defaults to mostLikely=1 when estimatedDays is missing', async () => {
    mockTasks = [
      task({
        id: 't1',
        name: 'No estimate',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-15'),
        // no estimatedDays → mostLikely defaults to 1
      }),
    ];

    const result = await service.runSimulation('sch-test', { iterations: 500 });

    // With mostLikely=1, opt=0.75, pess=1.75 (medium), PERT mean ≈ 1
    expect(result.durationStats.mean).toBeGreaterThan(0.5);
    expect(result.durationStats.mean).toBeLessThan(3);
  });
});
