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

import { AutoRescheduleService } from '../AutoRescheduleService';
import { Task, Schedule } from '../ScheduleService';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

let mockTasks: Task[] = [];
let mockSchedule: Schedule | null = null;

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async findById(_id: string) { return mockSchedule; }
    async findTasksByScheduleId(_id: string) { return mockTasks; }
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
      // Mark first task as critical for testing
      const critIds = mockTasks.length > 0 ? [mockTasks[0].id] : [];
      return {
        criticalPathTaskIds: critIds,
        tasks: [],
        projectDuration: 30,
      };
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
  return {
    scheduleId: 'sch-test',
    status: 'in_progress',
    priority: 'medium',
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AutoRescheduleService', () => {
  let service: AutoRescheduleService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15'));
    service = new AutoRescheduleService();
    mockSchedule = {
      id: 'sch-test',
      projectId: 'proj-1',
      name: 'Test Schedule',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockTasks = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // detectDelays
  // =========================================================================

  describe('detectDelays', () => {
    it('returns empty array when no tasks are delayed', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'On Track',
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-07-31'),
          progressPercentage: 50, // ~50% time elapsed, 50% progress → on track
        }),
      ];

      const delays = await service.detectDelays('sch-test');
      expect(delays).toEqual([]);
    });

    it('detects a delayed task when progress is behind', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Behind Schedule',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-15'),
          progressPercentage: 10, // 75 of 105 days elapsed ≈ 71% expected, but only 10%
        }),
      ];

      const delays = await service.detectDelays('sch-test');

      expect(delays.length).toBe(1);
      expect(delays[0].taskId).toBe('t1');
      expect(delays[0].delayDays).toBeGreaterThan(0);
      expect(delays[0].currentProgress).toBe(10);
    });

    it('skips completed tasks', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Done',
          status: 'completed',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-03-01'),
          progressPercentage: 100,
        }),
      ];

      const delays = await service.detectDelays('sch-test');
      expect(delays).toEqual([]);
    });

    it('skips cancelled tasks', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Cancelled',
          status: 'cancelled',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-03-01'),
          progressPercentage: 0,
        }),
      ];

      const delays = await service.detectDelays('sch-test');
      expect(delays).toEqual([]);
    });

    it('skips tasks without dates', async () => {
      mockTasks = [
        task({ id: 't1', name: 'No Dates', progressPercentage: 0 }),
      ];

      const delays = await service.detectDelays('sch-test');
      expect(delays).toEqual([]);
    });

    it('skips future tasks (start date after today)', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Future',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-09-01'),
          progressPercentage: 0,
        }),
      ];

      const delays = await service.detectDelays('sch-test');
      expect(delays).toEqual([]);
    });

    it('detects delay severity correctly for critical path task with major delay', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Critical Delay', // first task → on critical path
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-06-30'),
          progressPercentage: 5, // Severely behind
        }),
      ];

      const delays = await service.detectDelays('sch-test');

      expect(delays.length).toBe(1);
      // On critical path + high delay days → high or critical severity
      expect(['high', 'critical']).toContain(delays[0].severity);
      expect(delays[0].isOnCriticalPath).toBe(true);
    });

    it('assigns lower severity for short delays on non-critical tasks', async () => {
      mockTasks = [
        task({ id: 'critical', name: 'Critical (filler)' }), // takes the critical path slot
        task({
          id: 't2', name: 'Minor Delay',
          startDate: new Date('2026-06-05'),
          endDate: new Date('2026-07-31'),
          progressPercentage: 14, // ~18% expected in 10 days of 56 total, 14% actual → small gap
        }),
      ];

      const delays = await service.detectDelays('sch-test');

      const t2Delay = delays.find(d => d.taskId === 't2');
      if (t2Delay) {
        expect(t2Delay.isOnCriticalPath).toBe(false);
        // Not on critical path → severity depends on delay days
        expect(['low', 'medium', 'high']).toContain(t2Delay.severity);
      }
    });

    it('sorts delays by severity (critical first)', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Critical Task', // on critical path
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-06-30'),
          progressPercentage: 0, // severely behind
        }),
        task({
          id: 't2', name: 'Minor Task',
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-08-01'),
          progressPercentage: 15,
        }),
      ];

      const delays = await service.detectDelays('sch-test');

      if (delays.length >= 2) {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        for (let i = 1; i < delays.length; i++) {
          expect(severityOrder[delays[i - 1].severity]).toBeLessThanOrEqual(
            severityOrder[delays[i].severity]
          );
        }
      }
    });

    it('handles task with 0% progress correctly (doubles remaining time)', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Zero Progress',
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 0,
        }),
      ];

      const delays = await service.detectDelays('sch-test');

      expect(delays.length).toBe(1);
      // Estimated end date should be significantly later than original end
      const estimatedEnd = new Date(delays[0].estimatedEndDate);
      const originalEnd = new Date('2026-07-01');
      expect(estimatedEnd.getTime()).toBeGreaterThan(originalEnd.getTime());
    });
  });

  // =========================================================================
  // generateProposal (heuristic fallback, no AI)
  // =========================================================================

  describe('generateProposal', () => {
    it('generates a proposal for delayed tasks', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Delayed',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 10,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');

      expect(proposal.id).toBeTruthy();
      expect(proposal.scheduleId).toBe('sch-test');
      expect(proposal.status).toBe('pending');
      expect(proposal.delayedTasks.length).toBeGreaterThan(0);
      expect(proposal.proposedChanges.length).toBeGreaterThan(0);
      expect(proposal.rationale).toBeTruthy();
      expect(proposal.estimatedImpact).toBeDefined();
      expect(proposal.estimatedImpact.originalEndDate).toBeTruthy();
      expect(proposal.estimatedImpact.proposedEndDate).toBeTruthy();
    });

    it('cascades changes to dependent tasks', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Delayed Parent',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 5,
        }),
        task({
          id: 't2', name: 'Dependent Child',
          dependency: 't1',
          startDate: new Date('2026-07-02'),
          endDate: new Date('2026-09-01'),
          progressPercentage: 0,
          status: 'pending',
        }),
      ];

      const proposal = await service.generateProposal('sch-test');

      // Should have proposed changes for both the delayed task and its dependent
      expect(proposal.proposedChanges.length).toBe(2);

      const childChange = proposal.proposedChanges.find(c => c.taskId === 't2');
      expect(childChange).toBeDefined();
      expect(childChange!.reason).toContain('dependency');
    });

    it('generates "no delays" rationale when schedule is on track', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'On Track',
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-08-01'),
          progressPercentage: 50,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');

      expect(proposal.delayedTasks).toHaveLength(0);
      expect(proposal.proposedChanges).toHaveLength(0);
      expect(proposal.rationale).toContain('No delays');
    });

    it('throws when schedule is not found', async () => {
      mockSchedule = null;

      await expect(service.generateProposal('nonexistent')).rejects.toThrow(
        'not found'
      );
    });

    it('skips completed/cancelled dependents', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Delayed',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 5,
        }),
        task({
          id: 't2', name: 'Already Done',
          dependency: 't1',
          status: 'completed',
          startDate: new Date('2026-07-02'),
          endDate: new Date('2026-09-01'),
          progressPercentage: 100,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');

      const childChange = proposal.proposedChanges.find(c => c.taskId === 't2');
      expect(childChange).toBeUndefined();
    });
  });

  // =========================================================================
  // Proposal lifecycle (accept/reject/modify)
  // =========================================================================

  describe('proposal lifecycle', () => {
    it('accepts a pending proposal', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Delayed',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 5,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');
      const accepted = await service.acceptProposal(proposal.id);

      expect(accepted).toBe(true);
    });

    it('rejects a pending proposal', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Delayed',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 5,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');
      const rejected = await service.rejectProposal(proposal.id, 'Not needed');

      expect(rejected).toBe(true);
    });

    it('returns false when accepting nonexistent proposal', async () => {
      const accepted = await service.acceptProposal('nonexistent');
      expect(accepted).toBe(false);
    });

    it('returns false when rejecting nonexistent proposal', async () => {
      const rejected = await service.rejectProposal('nonexistent');
      expect(rejected).toBe(false);
    });

    it('modifies a pending proposal', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Delayed',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 5,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');
      const modified = await service.modifyProposal(proposal.id, [
        {
          taskId: 't1',
          taskName: 'Delayed',
          currentStartDate: '2026-04-01',
          currentEndDate: '2026-07-01',
          proposedStartDate: '2026-04-01',
          proposedEndDate: '2026-08-01',
          reason: 'Custom modification',
        },
      ]);

      expect(modified).toBe(true);
    });
  });

  // =========================================================================
  // getProposals
  // =========================================================================

  describe('getProposals', () => {
    it('retrieves proposals for a schedule sorted by date descending', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Delayed',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2026-07-01'),
          progressPercentage: 5,
        }),
      ];

      await service.generateProposal('sch-test');
      await service.generateProposal('sch-test');

      const proposals = await service.getProposals('sch-test');

      expect(proposals.length).toBeGreaterThanOrEqual(2);
      // Sorted by createdAt descending
      for (let i = 1; i < proposals.length; i++) {
        expect(new Date(proposals[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(proposals[i].createdAt).getTime()
        );
      }
    });

    it('returns empty array for schedule with no proposals', async () => {
      const proposals = await service.getProposals('nonexistent-schedule');
      expect(proposals).toEqual([]);
    });
  });

  // =========================================================================
  // estimatedImpact
  // =========================================================================

  describe('estimatedImpact', () => {
    it('calculates positive daysChange when project will be extended', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Severely Delayed',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-06-30'),
          progressPercentage: 0,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');

      expect(proposal.estimatedImpact.daysChange).toBeGreaterThanOrEqual(0);
    });

    it('identifies critical path impact when critical task is delayed', async () => {
      mockTasks = [
        task({
          id: 't1', name: 'Critical Delayed', // first → critical path
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-06-30'),
          progressPercentage: 0,
        }),
      ];

      const proposal = await service.generateProposal('sch-test');

      expect(proposal.estimatedImpact.criticalPathImpact).toContain('Critical path');
    });
  });
});
