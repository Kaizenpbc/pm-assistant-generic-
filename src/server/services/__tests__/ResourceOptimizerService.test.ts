import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config BEFORE any service imports (prevents env var validation)
vi.mock('../../config', () => ({
  config: {
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

// Mock database connection so ResourceService/ScheduleService don't hit a real DB
vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
  },
}));

// ---------------------------------------------------------------------------
// Mock data holders – mutated per-test via beforeEach
// ---------------------------------------------------------------------------

import { ResourceWorkload, WeeklyUtilization, Resource, ResourceAssignment } from '../ResourceService';
import { Task, Schedule } from '../ScheduleService';

let mockWorkloads: ResourceWorkload[] = [];
let mockResources: Resource[] = [];
let mockAssignments: ResourceAssignment[] = [];
let mockSchedules: Schedule[] = [];
let mockTasks: Task[] = [];

// ---------------------------------------------------------------------------
// Mock ResourceService
// ---------------------------------------------------------------------------
vi.mock('../ResourceService', () => ({
  ResourceService: class {
    async computeWorkload(_projectId: string) {
      return mockWorkloads;
    }
    async findAllResources() {
      return mockResources;
    }
    async findAssignmentsBySchedule(scheduleId: string) {
      return mockAssignments.filter((a) => a.scheduleId === scheduleId);
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock ScheduleService
// ---------------------------------------------------------------------------
vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async findByProjectId(projectId: string) {
      return mockSchedules.filter((s) => s.projectId === projectId);
    }
    async findTasksByScheduleId(scheduleId: string) {
      return mockTasks.filter((t) => t.scheduleId === scheduleId);
    }
    async findTaskById(taskId: string) {
      return mockTasks.find((t) => t.id === taskId) || null;
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock claudeService
// ---------------------------------------------------------------------------
vi.mock('../claudeService', () => ({
  claudeService: {
    isAvailable: () => false,
    completeWithJsonSchema: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import the service under test AFTER all mocks are declared
// ---------------------------------------------------------------------------
import { ResourceOptimizerService } from '../ResourceOptimizerService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produce a future ISO date string offset by `weeksFromNow` weeks from the frozen time. */
function futureWeek(weeksFromNow: number): string {
  const base = new Date('2026-06-15');
  const d = new Date(base.getTime() + weeksFromNow * 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Build a WeeklyUtilization entry for a given week offset with specified utilization. */
function weekUtil(
  weeksFromNow: number,
  utilization: number,
  capacity = 40,
): WeeklyUtilization {
  const allocated = (utilization / 100) * capacity;
  return {
    weekStart: futureWeek(weeksFromNow),
    allocated,
    capacity,
    utilization,
  };
}

/** Build a ResourceWorkload entry. */
function workload(
  overrides: Partial<ResourceWorkload> & { resourceId: string; resourceName: string },
): ResourceWorkload {
  const weeks = overrides.weeks || [];
  const totalUtil = weeks.reduce((s, w) => s + w.utilization, 0);
  const avgUtil = weeks.length > 0 ? Math.round(totalUtil / weeks.length) : 0;
  return {
    role: 'Engineer',
    weeks,
    averageUtilization: overrides.averageUtilization ?? avgUtil,
    isOverAllocated: overrides.isOverAllocated ?? weeks.some((w) => w.utilization > 100),
    ...overrides,
  };
}

/** Build a minimal Resource. */
function resource(overrides: Partial<Resource> & { id: string; name: string }): Resource {
  return {
    role: 'Engineer',
    email: `${overrides.id}@example.com`,
    capacityHoursPerWeek: 40,
    skills: [],
    isActive: true,
    ...overrides,
  };
}

/** Build a minimal Task. */
function task(overrides: Partial<Task> & { id: string; name: string }): Task {
  return {
    scheduleId: 'sch-1',
    status: 'in_progress',
    priority: 'medium',
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ResourceOptimizerService', () => {
  let service: ResourceOptimizerService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15'));

    service = new ResourceOptimizerService();

    // Reset all mock data
    mockWorkloads = [];
    mockResources = [];
    mockAssignments = [];
    mockSchedules = [];
    mockTasks = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // predictBottlenecks
  // =========================================================================

  describe('predictBottlenecks', () => {
    // -----------------------------------------------------------------------
    // Empty / baseline
    // -----------------------------------------------------------------------

    it('returns empty result when there are no workloads', async () => {
      mockWorkloads = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(0);
      expect(result.burnoutRisks).toHaveLength(0);
      expect(result.capacityForecast).toHaveLength(0);
      expect(result.summary.totalResources).toBe(0);
      expect(result.summary.overAllocatedCount).toBe(0);
      expect(result.summary.averageUtilization).toBe(0);
    });

    it('returns no bottlenecks when all utilizations are under 100%', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 80), weekUtil(1, 90), weekUtil(2, 50)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(0);
      expect(result.summary.totalResources).toBe(1);
      expect(result.summary.overAllocatedCount).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Bottleneck detection
    // -----------------------------------------------------------------------

    it('detects bottleneck weeks where utilization > 100%', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 80), weekUtil(1, 110), weekUtil(2, 130)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(2);
      expect(result.bottlenecks.every((b) => b.utilization > 100)).toBe(true);
    });

    it('does not flag weeks exactly at 100% utilization as bottlenecks', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 100)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Severity classification
    // -----------------------------------------------------------------------

    it('classifies severity as "warning" for utilization 101-125%', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 115)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(1);
      expect(result.bottlenecks[0].severity).toBe('warning');
    });

    it('classifies severity as "critical" for utilization 126-150%', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 140)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(1);
      expect(result.bottlenecks[0].severity).toBe('critical');
    });

    it('classifies severity as "severe" for utilization > 150%', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 160)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(1);
      expect(result.bottlenecks[0].severity).toBe('severe');
    });

    it('classifies boundary value 125% as "warning" (not critical)', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 125)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(1);
      expect(result.bottlenecks[0].severity).toBe('warning');
    });

    it('classifies boundary value 150% as "critical" (not severe)', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 150)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.bottlenecks).toHaveLength(1);
      expect(result.bottlenecks[0].severity).toBe('critical');
    });

    // -----------------------------------------------------------------------
    // weeksAhead filtering
    // -----------------------------------------------------------------------

    it('only includes weeks within the weeksAhead window', async () => {
      // week 0 and 1 are within window of 2; week 5 is outside
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 120), weekUtil(1, 130), weekUtil(5, 180)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 2);

      // Only weeks 0 and 1 should appear; week 5 is beyond weeksAhead=2
      expect(result.bottlenecks).toHaveLength(2);
      expect(result.bottlenecks.every((b) => b.utilization <= 130)).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Burnout risk
    // -----------------------------------------------------------------------

    it('does not flag burnout risk when overload weeks < 3', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 110), weekUtil(1, 120), weekUtil(2, 80)],
          averageUtilization: 103,
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.burnoutRisks).toHaveLength(0);
    });

    it('flags burnout risk "low" for exactly 3 consecutive overload weeks', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 110), weekUtil(1, 120), weekUtil(2, 105)],
          averageUtilization: 112,
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.burnoutRisks).toHaveLength(1);
      expect(result.burnoutRisks[0].riskLevel).toBe('low');
      expect(result.burnoutRisks[0].consecutiveOverloadWeeks).toBe(3);
    });

    it('flags burnout risk "medium" for 4-5 consecutive overload weeks', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [
            weekUtil(0, 110),
            weekUtil(1, 120),
            weekUtil(2, 105),
            weekUtil(3, 115),
            weekUtil(4, 130),
          ],
          averageUtilization: 116,
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.burnoutRisks).toHaveLength(1);
      expect(result.burnoutRisks[0].riskLevel).toBe('medium');
      expect(result.burnoutRisks[0].consecutiveOverloadWeeks).toBe(5);
    });

    it('flags burnout risk "high" for 6-7 consecutive overload weeks', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [
            weekUtil(0, 110),
            weekUtil(1, 120),
            weekUtil(2, 105),
            weekUtil(3, 115),
            weekUtil(4, 130),
            weekUtil(5, 140),
          ],
          averageUtilization: 120,
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.burnoutRisks).toHaveLength(1);
      expect(result.burnoutRisks[0].riskLevel).toBe('high');
      expect(result.burnoutRisks[0].consecutiveOverloadWeeks).toBe(6);
    });

    it('flags burnout risk "critical" for 8+ consecutive overload weeks', async () => {
      const weeks = Array.from({ length: 9 }, (_, i) => weekUtil(i, 110 + i * 5));
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks,
          averageUtilization: 130,
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 12);

      expect(result.burnoutRisks).toHaveLength(1);
      expect(result.burnoutRisks[0].riskLevel).toBe('critical');
      expect(result.burnoutRisks[0].consecutiveOverloadWeeks).toBe(9);
    });

    it('uses max consecutive span when overload is interrupted', async () => {
      // Pattern: 3 overload, 1 break, 5 overload -> max = 5
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [
            weekUtil(0, 110),
            weekUtil(1, 120),
            weekUtil(2, 105),
            weekUtil(3, 80), // break
            weekUtil(4, 110),
            weekUtil(5, 120),
            weekUtil(6, 130),
            weekUtil(7, 115),
            weekUtil(8, 105),
          ],
          averageUtilization: 110,
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 12);

      expect(result.burnoutRisks).toHaveLength(1);
      expect(result.burnoutRisks[0].consecutiveOverloadWeeks).toBe(5);
      expect(result.burnoutRisks[0].riskLevel).toBe('medium');
    });

    // -----------------------------------------------------------------------
    // Capacity forecast
    // -----------------------------------------------------------------------

    it('computes surplus when capacity exceeds allocation', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [
            { weekStart: futureWeek(0), allocated: 20, capacity: 40, utilization: 50 },
          ],
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.capacityForecast.length).toBeGreaterThanOrEqual(1);
      const week = result.capacityForecast.find((w) => w.week === futureWeek(0));
      expect(week).toBeDefined();
      expect(week!.surplus).toBe(20);
      expect(week!.deficit).toBe(0);
    });

    it('computes deficit when allocation exceeds capacity', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [
            { weekStart: futureWeek(0), allocated: 60, capacity: 40, utilization: 150 },
          ],
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      const week = result.capacityForecast.find((w) => w.week === futureWeek(0));
      expect(week).toBeDefined();
      expect(week!.surplus).toBe(0);
      expect(week!.deficit).toBe(20);
    });

    it('aggregates capacity across multiple resources for the same week', async () => {
      const weekDate = futureWeek(1);
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [{ weekStart: weekDate, allocated: 30, capacity: 40, utilization: 75 }],
        }),
        workload({
          resourceId: 'r2',
          resourceName: 'Bob',
          weeks: [{ weekStart: weekDate, allocated: 35, capacity: 40, utilization: 88 }],
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      const week = result.capacityForecast.find((w) => w.week === weekDate);
      expect(week).toBeDefined();
      expect(week!.totalCapacity).toBe(80); // 40 + 40
      expect(week!.totalAllocated).toBe(65); // 30 + 35
      expect(week!.surplus).toBe(15);
      expect(week!.deficit).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------

    it('computes summary with totalResources, overAllocatedCount, and averageUtilization', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          averageUtilization: 80,
          isOverAllocated: false,
          weeks: [],
        }),
        workload({
          resourceId: 'r2',
          resourceName: 'Bob',
          averageUtilization: 120,
          isOverAllocated: true,
          weeks: [],
        }),
        workload({
          resourceId: 'r3',
          resourceName: 'Carol',
          averageUtilization: 100,
          isOverAllocated: false,
          weeks: [],
        }),
      ];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.summary.totalResources).toBe(3);
      expect(result.summary.overAllocatedCount).toBe(1);
      expect(result.summary.averageUtilization).toBe(100); // (80+120+100)/3 = 100
    });

    it('does not include AI rebalance suggestions when AI is disabled', async () => {
      mockWorkloads = [
        workload({
          resourceId: 'r1',
          resourceName: 'Alice',
          weeks: [weekUtil(0, 160)],
        }),
      ];
      mockSchedules = [];

      const result = await service.predictBottlenecks('proj-1', 8);

      expect(result.rebalanceSuggestions).toBeUndefined();
    });
  });

  // =========================================================================
  // findBestResourceForTask
  // =========================================================================

  describe('findBestResourceForTask', () => {
    // -----------------------------------------------------------------------
    // Task not found
    // -----------------------------------------------------------------------

    it('throws when the task does not exist', async () => {
      mockTasks = [];

      await expect(
        service.findBestResourceForTask('nonexistent', 'sch-1'),
      ).rejects.toThrow('Task not found: nonexistent');
    });

    // -----------------------------------------------------------------------
    // Basic skill matching
    // -----------------------------------------------------------------------

    it('returns empty array when no active resources exist', async () => {
      mockTasks = [task({ id: 't1', name: 'Build React Dashboard', description: 'React frontend' })];
      mockResources = [
        resource({ id: 'r1', name: 'Inactive Dev', isActive: false, skills: ['React'] }),
      ];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches).toHaveLength(0);
    });

    it('matches resource skill keyword found in task text', async () => {
      mockTasks = [
        task({ id: 't1', name: 'Build React Dashboard', description: 'Frontend development with React' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Dev A', skills: ['React', 'CSS'] }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedSkills).toContain('React');
      expect(matches[0].matchScore).toBe(50); // 1 of 2 skills matched
    });

    it('matches when task keyword appears in skill text (bidirectional)', async () => {
      mockTasks = [
        task({ id: 't1', name: 'Performance testing for API', description: 'Load test the API' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'QA', skills: ['Performance Testing', 'Automation'] }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches).toHaveLength(1);
      // "performance" from task text is in "Performance Testing" skill, and
      // "testing" from skill appears in task text
      expect(matches[0].matchedSkills).toContain('Performance Testing');
    });

    it('gives matchScore 0 to resources with no skills', async () => {
      mockTasks = [
        task({ id: 't1', name: 'Design system architecture', description: 'Architect the system' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'No Skills', skills: [] }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches).toHaveLength(1);
      expect(matches[0].matchScore).toBe(0);
      expect(matches[0].matchedSkills).toHaveLength(0);
    });

    it('computes matchScore as (matchedSkills / totalSkills) * 100', async () => {
      mockTasks = [
        task({ id: 't1', name: 'Docker deployment on AWS', description: 'Deploy containers to AWS' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'DevOps', skills: ['AWS', 'Docker', 'Terraform', 'Kubernetes'] }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      // "AWS" and "Docker" match -> 2/4 = 50
      expect(matches[0].matchScore).toBe(50);
      expect(matches[0].matchedSkills).toHaveLength(2);
      expect(matches[0].matchedSkills).toContain('AWS');
      expect(matches[0].matchedSkills).toContain('Docker');
    });

    // -----------------------------------------------------------------------
    // Available capacity
    // -----------------------------------------------------------------------

    it('computes full capacity when resource has no overlapping assignments', async () => {
      const taskStart = new Date('2026-07-01');
      const taskEnd = new Date('2026-07-31');
      mockTasks = [
        task({ id: 't1', name: 'Node.js API', description: 'Build API', startDate: taskStart, endDate: taskEnd }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Dev', skills: ['Node.js'], capacityHoursPerWeek: 40 }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches[0].availableCapacity).toBe(40);
    });

    it('subtracts overlapping assignment hours from available capacity', async () => {
      const taskStart = new Date('2026-07-01');
      const taskEnd = new Date('2026-07-31');
      mockTasks = [
        task({ id: 't1', name: 'Node.js API', description: 'Build API', startDate: taskStart, endDate: taskEnd }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Dev', skills: ['Node.js'], capacityHoursPerWeek: 40 }),
      ];
      mockAssignments = [
        {
          id: 'a1',
          resourceId: 'r1',
          taskId: 't-other',
          scheduleId: 'sch-1',
          hoursPerWeek: 15,
          startDate: '2026-06-15',
          endDate: '2026-07-15', // overlaps with t1
        },
      ];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches[0].availableCapacity).toBe(25); // 40 - 15
    });

    it('clamps available capacity at 0 when fully allocated', async () => {
      const taskStart = new Date('2026-07-01');
      const taskEnd = new Date('2026-07-31');
      mockTasks = [
        task({ id: 't1', name: 'Node.js API', description: 'Build API', startDate: taskStart, endDate: taskEnd }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Dev', skills: ['Node.js'], capacityHoursPerWeek: 40 }),
      ];
      mockAssignments = [
        {
          id: 'a1',
          resourceId: 'r1',
          taskId: 't-other1',
          scheduleId: 'sch-1',
          hoursPerWeek: 25,
          startDate: '2026-06-15',
          endDate: '2026-08-01',
        },
        {
          id: 'a2',
          resourceId: 'r1',
          taskId: 't-other2',
          scheduleId: 'sch-1',
          hoursPerWeek: 20,
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
      ];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      // 25 + 20 = 45 > 40 capacity, so available = max(0, 40-45) = 0
      expect(matches[0].availableCapacity).toBe(0);
    });

    it('ignores non-overlapping assignments when computing capacity', async () => {
      const taskStart = new Date('2026-07-01');
      const taskEnd = new Date('2026-07-31');
      mockTasks = [
        task({ id: 't1', name: 'Node.js API', description: 'Build API', startDate: taskStart, endDate: taskEnd }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Dev', skills: ['Node.js'], capacityHoursPerWeek: 40 }),
      ];
      mockAssignments = [
        {
          id: 'a1',
          resourceId: 'r1',
          taskId: 't-other',
          scheduleId: 'sch-1',
          hoursPerWeek: 30,
          startDate: '2026-01-01',
          endDate: '2026-06-30', // ends before task starts
        },
      ];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches[0].availableCapacity).toBe(40); // non-overlapping is ignored
    });

    // -----------------------------------------------------------------------
    // Ranking / sorting
    // -----------------------------------------------------------------------

    it('ranks resources by matchScore descending', async () => {
      mockTasks = [
        task({ id: 't1', name: 'React frontend with Docker', description: 'Build React Docker app' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Full Stack', skills: ['React', 'Docker', 'Python'] }), // 2/3 = 67
        resource({ id: 'r2', name: 'React Dev', skills: ['React'] }),                       // 1/1 = 100
        resource({ id: 'r3', name: 'Backend', skills: ['Java', 'SQL'] }),                    // 0/2 = 0
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches[0].resourceId).toBe('r2'); // 100%
      expect(matches[1].resourceId).toBe('r1'); // 67%
      expect(matches[2].resourceId).toBe('r3'); // 0%
    });

    it('breaks matchScore ties by availableCapacity descending', async () => {
      const taskStart = new Date('2026-07-01');
      const taskEnd = new Date('2026-07-31');
      mockTasks = [
        task({ id: 't1', name: 'React project', description: 'Build React app', startDate: taskStart, endDate: taskEnd }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Dev A', skills: ['React'], capacityHoursPerWeek: 40 }),
        resource({ id: 'r2', name: 'Dev B', skills: ['React'], capacityHoursPerWeek: 40 }),
      ];
      mockAssignments = [
        {
          id: 'a1',
          resourceId: 'r1',
          taskId: 't-other',
          scheduleId: 'sch-1',
          hoursPerWeek: 20,
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
        // r2 has no assignments, so full capacity
      ];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      // Both have matchScore 100, but r2 has 40 capacity vs r1 has 20
      expect(matches[0].resourceId).toBe('r2');
      expect(matches[0].availableCapacity).toBe(40);
      expect(matches[1].resourceId).toBe('r1');
      expect(matches[1].availableCapacity).toBe(20);
    });

    // -----------------------------------------------------------------------
    // Keyword extraction edge cases
    // -----------------------------------------------------------------------

    it('filters out stop words and short words from keyword matching', async () => {
      // "The" and "in" and "to" are stop words; "do" is too short (< 3 chars)
      mockTasks = [
        task({ id: 't1', name: 'The plan to do testing in QA', description: '' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'QA', skills: ['Testing', 'Automation'] }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      // "testing" from task matches "Testing" skill
      expect(matches[0].matchedSkills).toContain('Testing');
      expect(matches[0].matchScore).toBe(50); // 1 of 2 skills
    });

    it('handles task with no description gracefully', async () => {
      mockTasks = [
        task({ id: 't1', name: 'Docker setup' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'DevOps', skills: ['Docker', 'Kubernetes'] }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches[0].matchedSkills).toContain('Docker');
      expect(matches[0].matchScore).toBe(50); // 1 of 2
    });

    it('handles task with no dates by giving full capacity', async () => {
      // When task has no startDate/endDate, no overlap check happens
      mockTasks = [
        task({ id: 't1', name: 'React development', description: 'Build React' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Dev', skills: ['React'], capacityHoursPerWeek: 40 }),
      ];
      mockAssignments = [
        {
          id: 'a1',
          resourceId: 'r1',
          taskId: 't-other',
          scheduleId: 'sch-1',
          hoursPerWeek: 30,
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
      ];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      // Task has no dates -> overlap check is skipped -> capacity stays at full 40
      expect(matches[0].availableCapacity).toBe(40);
    });

    // -----------------------------------------------------------------------
    // Multiple resources with varied skill matches
    // -----------------------------------------------------------------------

    it('correctly scores multiple resources with varied skill overlap', async () => {
      mockTasks = [
        task({
          id: 't1',
          name: 'AWS Docker Node.js deployment',
          description: 'Deploy Node.js app in Docker on AWS',
        }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Full DevOps', skills: ['AWS', 'Docker', 'Node.js', 'Terraform'] }),   // 3/4 = 75
        resource({ id: 'r2', name: 'Cloud Only', skills: ['AWS', 'Azure'] }),                              // 1/2 = 50
        resource({ id: 'r3', name: 'Frontend', skills: ['React', 'CSS', 'HTML'] }),                        // 0/3 = 0
        resource({ id: 'r4', name: 'Backend', skills: ['Node.js', 'Docker'] }),                            // 2/2 = 100
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches[0].resourceId).toBe('r4'); // 100%
      expect(matches[0].matchScore).toBe(100);
      expect(matches[1].resourceId).toBe('r1'); // 75%
      expect(matches[1].matchScore).toBe(75);
      expect(matches[2].resourceId).toBe('r2'); // 50%
      expect(matches[2].matchScore).toBe(50);
      expect(matches[3].resourceId).toBe('r3'); // 0%
      expect(matches[3].matchScore).toBe(0);
    });

    it('only considers active resources', async () => {
      mockTasks = [
        task({ id: 't1', name: 'React project', description: 'React' }),
      ];
      mockResources = [
        resource({ id: 'r1', name: 'Active', skills: ['React'], isActive: true }),
        resource({ id: 'r2', name: 'Inactive', skills: ['React'], isActive: false }),
      ];
      mockAssignments = [];

      const matches = await service.findBestResourceForTask('t1', 'sch-1');

      expect(matches).toHaveLength(1);
      expect(matches[0].resourceId).toBe('r1');
    });
  });
});
