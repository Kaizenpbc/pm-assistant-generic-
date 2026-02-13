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

// Mock the database service to return isHealthy() = false so all tests use in-memory mode
vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
    query: vi.fn(),
    getPool: vi.fn(),
    transaction: vi.fn(),
  },
}));

import { ScheduleService, Schedule, Task, TaskComment, TaskActivityEntry } from '../ScheduleService';

// ---------------------------------------------------------------------------
// Helper: reset static arrays before each test
// ---------------------------------------------------------------------------
function resetStaticState() {
  (ScheduleService as any).schedules = [];
  (ScheduleService as any).tasks = [];
  (ScheduleService as any).comments = [];
  (ScheduleService as any).activities = [];
}

describe('ScheduleService', () => {
  let service: ScheduleService;

  beforeEach(() => {
    resetStaticState();
    service = new ScheduleService();
  });

  // =========================================================================
  // Schedule CRUD
  // =========================================================================
  describe('Schedule CRUD', () => {
    it('creates a schedule and assigns generated id, active status, timestamps', async () => {
      const schedule = await service.create({
        projectId: 'proj-1',
        name: 'Test Schedule',
        description: 'A test schedule',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        createdBy: 'user-1',
      });

      expect(schedule.id).toMatch(/^sch-/);
      expect(schedule.projectId).toBe('proj-1');
      expect(schedule.name).toBe('Test Schedule');
      expect(schedule.description).toBe('A test schedule');
      expect(schedule.status).toBe('active');
      expect(schedule.createdBy).toBe('user-1');
      expect(schedule.createdAt).toBeInstanceOf(Date);
      expect(schedule.updatedAt).toBeInstanceOf(Date);
    });

    it('findById returns the created schedule', async () => {
      const created = await service.create({
        projectId: 'proj-1',
        name: 'Find Me',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });

      const found = await service.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Find Me');
    });

    it('findById returns null for nonexistent id', async () => {
      const result = await service.findById('nonexistent-id');
      expect(result).toBeNull();
    });

    it('findByProjectId returns all schedules for a given project', async () => {
      await service.create({
        projectId: 'proj-A',
        name: 'Schedule A1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        createdBy: 'user-1',
      });
      await service.create({
        projectId: 'proj-A',
        name: 'Schedule A2',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });
      await service.create({
        projectId: 'proj-B',
        name: 'Schedule B1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });

      const projASchedules = await service.findByProjectId('proj-A');
      expect(projASchedules).toHaveLength(2);
      expect(projASchedules.map(s => s.name)).toContain('Schedule A1');
      expect(projASchedules.map(s => s.name)).toContain('Schedule A2');

      const projBSchedules = await service.findByProjectId('proj-B');
      expect(projBSchedules).toHaveLength(1);
    });

    it('findByProjectId returns empty array when no schedules match', async () => {
      const result = await service.findByProjectId('no-such-project');
      expect(result).toEqual([]);
    });

    it('update modifies schedule fields and updates the updatedAt timestamp', async () => {
      const created = await service.create({
        projectId: 'proj-1',
        name: 'Original Name',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });

      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure updatedAt differs
      await new Promise(r => setTimeout(r, 10));

      const updated = await service.update(created.id, {
        name: 'Updated Name',
        status: 'completed',
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.status).toBe('completed');
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('update returns null for nonexistent schedule', async () => {
      const result = await service.update('no-such-id', { name: 'foo' });
      expect(result).toBeNull();
    });

    it('delete removes the schedule and cascade-deletes its tasks', async () => {
      const schedule = await service.create({
        projectId: 'proj-1',
        name: 'To Delete',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });
      await service.createTask({
        scheduleId: schedule.id,
        name: 'Task in deleted schedule',
        createdBy: 'user-1',
      });

      const deleted = await service.delete(schedule.id);
      expect(deleted).toBe(true);

      const found = await service.findById(schedule.id);
      expect(found).toBeNull();

      const tasks = await service.findTasksByScheduleId(schedule.id);
      expect(tasks).toHaveLength(0);
    });

    it('delete returns false for nonexistent schedule', async () => {
      const result = await service.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Task CRUD
  // =========================================================================
  describe('Task CRUD', () => {
    let scheduleId: string;

    beforeEach(async () => {
      const schedule = await service.create({
        projectId: 'proj-1',
        name: 'Test Schedule',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });
      scheduleId = schedule.id;
    });

    it('creates a task with defaults for status, priority, and progressPercentage', async () => {
      const task = await service.createTask({
        scheduleId,
        name: 'New Task',
        createdBy: 'user-1',
      });

      expect(task.id).toMatch(/^task-/);
      expect(task.scheduleId).toBe(scheduleId);
      expect(task.name).toBe('New Task');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
      expect(task.progressPercentage).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('creates a task with explicit values overriding defaults', async () => {
      const task = await service.createTask({
        scheduleId,
        name: 'Custom Task',
        status: 'in_progress',
        priority: 'urgent',
        assignedTo: 'dev-1',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-04-30'),
        progressPercentage: 25,
        createdBy: 'user-1',
      });

      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('urgent');
      expect(task.assignedTo).toBe('dev-1');
      expect(task.progressPercentage).toBe(25);
    });

    it('findTaskById returns the created task', async () => {
      const created = await service.createTask({
        scheduleId,
        name: 'Find Me Task',
        createdBy: 'user-1',
      });

      const found = await service.findTaskById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Find Me Task');
    });

    it('findTaskById returns null for nonexistent task', async () => {
      const result = await service.findTaskById('no-task');
      expect(result).toBeNull();
    });

    it('findTasksByScheduleId returns all tasks belonging to a schedule', async () => {
      await service.createTask({ scheduleId, name: 'Task A', createdBy: 'user-1' });
      await service.createTask({ scheduleId, name: 'Task B', createdBy: 'user-1' });

      const tasks = await service.findTasksByScheduleId(scheduleId);
      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.name)).toContain('Task A');
      expect(tasks.map(t => t.name)).toContain('Task B');
    });

    it('findAllTasks returns every task across all schedules', async () => {
      const schedule2 = await service.create({
        projectId: 'proj-2',
        name: 'Another Schedule',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });

      await service.createTask({ scheduleId, name: 'Task in S1', createdBy: 'user-1' });
      await service.createTask({ scheduleId: schedule2.id, name: 'Task in S2', createdBy: 'user-1' });

      const allTasks = await service.findAllTasks();
      expect(allTasks).toHaveLength(2);
    });

    it('updateTask modifies fields and updates the timestamp', async () => {
      const task = await service.createTask({
        scheduleId,
        name: 'Original',
        status: 'pending',
        createdBy: 'user-1',
      });

      await new Promise(r => setTimeout(r, 10));

      const updated = await service.updateTask(task.id, {
        name: 'Renamed',
        status: 'in_progress',
        priority: 'high',
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Renamed');
      expect(updated!.status).toBe('in_progress');
      expect(updated!.priority).toBe('high');
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('updateTask returns null for nonexistent task', async () => {
      const result = await service.updateTask('nonexistent', { name: 'x' });
      expect(result).toBeNull();
    });

    it('deleteTask removes the task and returns true', async () => {
      const task = await service.createTask({
        scheduleId,
        name: 'To Delete',
        createdBy: 'user-1',
      });

      const deleted = await service.deleteTask(task.id);
      expect(deleted).toBe(true);

      const found = await service.findTaskById(task.id);
      expect(found).toBeNull();
    });

    it('deleteTask returns false for nonexistent task', async () => {
      const result = await service.deleteTask('nonexistent');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Dependency management
  // =========================================================================
  describe('Dependency management', () => {
    let scheduleId: string;

    beforeEach(async () => {
      const schedule = await service.create({
        projectId: 'proj-1',
        name: 'Dep Schedule',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });
      scheduleId = schedule.id;
    });

    it('findDependentTasks returns direct dependents of a task', async () => {
      const taskA = await service.createTask({ scheduleId, name: 'A', createdBy: 'u' });
      await service.createTask({
        scheduleId, name: 'B', dependency: taskA.id, createdBy: 'u',
      } as any);
      await service.createTask({
        scheduleId, name: 'C', dependency: taskA.id, createdBy: 'u',
      } as any);
      await service.createTask({ scheduleId, name: 'D', createdBy: 'u' });

      const dependents = await service.findDependentTasks(taskA.id);
      expect(dependents).toHaveLength(2);
      expect(dependents.map(t => t.name).sort()).toEqual(['B', 'C']);
    });

    it('findAllDownstreamTasks returns transitive dependents via BFS', async () => {
      // Chain: A -> B -> C -> D
      const taskA = await service.createTask({ scheduleId, name: 'A', createdBy: 'u' });
      const taskB = await service.createTask({
        scheduleId, name: 'B', dependency: taskA.id, createdBy: 'u',
      } as any);
      const taskC = await service.createTask({
        scheduleId, name: 'C', dependency: taskB.id, createdBy: 'u',
      } as any);
      await service.createTask({
        scheduleId, name: 'D', dependency: taskC.id, createdBy: 'u',
      } as any);

      const downstream = await service.findAllDownstreamTasks(taskA.id);
      expect(downstream).toHaveLength(3);
      expect(downstream.map(t => t.name)).toEqual(['B', 'C', 'D']);
    });

    it('findAllDownstreamTasks returns empty for leaf task with no dependents', async () => {
      const leaf = await service.createTask({ scheduleId, name: 'Leaf', createdBy: 'u' });
      const downstream = await service.findAllDownstreamTasks(leaf.id);
      expect(downstream).toHaveLength(0);
    });
  });

  // =========================================================================
  // Cascade Reschedule
  // =========================================================================
  describe('cascadeReschedule', () => {
    let scheduleId: string;

    beforeEach(async () => {
      const schedule = await service.create({
        projectId: 'proj-1',
        name: 'Cascade Schedule',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'user-1',
      });
      scheduleId = schedule.id;
    });

    it('positive delta shifts all downstream FS tasks forward', async () => {
      const taskA = await service.createTask({
        scheduleId,
        name: 'A',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        createdBy: 'u',
      });
      await service.createTask({
        scheduleId,
        name: 'B',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        createdBy: 'u',
      } as any);

      const result = await service.cascadeReschedule(
        taskA.id,
        new Date('2026-01-31'),
        new Date('2026-02-10'), // 10 day delay
      );

      expect(result.deltaDays).toBe(10);
      expect(result.triggeredByTaskId).toBe(taskA.id);
      expect(result.affectedTasks).toHaveLength(1);

      const change = result.affectedTasks[0];
      expect(change.taskName).toBe('B');
      expect(change.oldStartDate).toBe('2026-02-01');
      expect(change.newStartDate).toBe('2026-02-11');
      expect(change.oldEndDate).toBe('2026-02-28');
      expect(change.newEndDate).toBe('2026-03-10');
      expect(change.deltaDays).toBe(10);
    });

    it('negative delta shifts downstream tasks backward', async () => {
      const taskA = await service.createTask({
        scheduleId,
        name: 'A',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        createdBy: 'u',
      });
      await service.createTask({
        scheduleId,
        name: 'B',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        createdBy: 'u',
      } as any);

      const result = await service.cascadeReschedule(
        taskA.id,
        new Date('2026-01-31'),
        new Date('2026-01-26'), // 5 day acceleration
      );

      expect(result.deltaDays).toBe(-5);
      expect(result.affectedTasks).toHaveLength(1);
      expect(result.affectedTasks[0].newStartDate).toBe('2026-01-27');
      expect(result.affectedTasks[0].newEndDate).toBe('2026-02-23');
    });

    it('zero delta returns empty affectedTasks', async () => {
      const taskA = await service.createTask({
        scheduleId,
        name: 'A',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        createdBy: 'u',
      });
      await service.createTask({
        scheduleId,
        name: 'B',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        createdBy: 'u',
      } as any);

      const result = await service.cascadeReschedule(
        taskA.id,
        new Date('2026-01-31'),
        new Date('2026-01-31'), // same date
      );

      expect(result.deltaDays).toBe(0);
      expect(result.affectedTasks).toEqual([]);
    });

    it('only cascades FS dependency types, skips SS/FF/SF', async () => {
      const taskA = await service.createTask({
        scheduleId,
        name: 'A',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        createdBy: 'u',
      });

      // FS dependency -> should be affected
      await service.createTask({
        scheduleId,
        name: 'B-FS',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        dependencyType: 'FS',
        createdBy: 'u',
      } as any);

      // SS dependency -> should be skipped
      await service.createTask({
        scheduleId,
        name: 'C-SS',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        dependencyType: 'SS',
        createdBy: 'u',
      } as any);

      // FF dependency -> should be skipped
      await service.createTask({
        scheduleId,
        name: 'D-FF',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        dependencyType: 'FF',
        createdBy: 'u',
      } as any);

      // SF dependency -> should be skipped
      await service.createTask({
        scheduleId,
        name: 'E-SF',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        dependencyType: 'SF',
        createdBy: 'u',
      } as any);

      const result = await service.cascadeReschedule(
        taskA.id,
        new Date('2026-01-31'),
        new Date('2026-02-07'), // 7 day delay
      );

      expect(result.affectedTasks).toHaveLength(1);
      expect(result.affectedTasks[0].taskName).toBe('B-FS');
    });

    it('skips downstream tasks that have no start or end dates', async () => {
      const taskA = await service.createTask({
        scheduleId,
        name: 'A',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        createdBy: 'u',
      });

      // No dates on this dependent
      await service.createTask({
        scheduleId,
        name: 'No Dates',
        dependency: taskA.id,
        createdBy: 'u',
      } as any);

      const result = await service.cascadeReschedule(
        taskA.id,
        new Date('2026-01-31'),
        new Date('2026-02-10'),
      );

      expect(result.affectedTasks).toHaveLength(0);
    });

    it('multi-level chain: A -> B -> C all cascade', async () => {
      const taskA = await service.createTask({
        scheduleId,
        name: 'A',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        createdBy: 'u',
      });
      const taskB = await service.createTask({
        scheduleId,
        name: 'B',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        createdBy: 'u',
      } as any);
      await service.createTask({
        scheduleId,
        name: 'C',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        dependency: taskB.id,
        createdBy: 'u',
      } as any);

      const result = await service.cascadeReschedule(
        taskA.id,
        new Date('2026-01-31'),
        new Date('2026-02-07'), // 7 day delay
      );

      expect(result.deltaDays).toBe(7);
      expect(result.affectedTasks).toHaveLength(2);

      const bChange = result.affectedTasks.find(c => c.taskName === 'B')!;
      expect(bChange.newStartDate).toBe('2026-02-08');
      expect(bChange.newEndDate).toBe('2026-03-07');

      const cChange = result.affectedTasks.find(c => c.taskName === 'C')!;
      expect(cChange.newStartDate).toBe('2026-03-08');
      expect(cChange.newEndDate).toBe('2026-04-07');
    });

    it('cascade reschedule logs activities for each affected task', async () => {
      const taskA = await service.createTask({
        scheduleId,
        name: 'A',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        createdBy: 'u',
      });
      const taskB = await service.createTask({
        scheduleId,
        name: 'B',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        dependency: taskA.id,
        createdBy: 'u',
      } as any);

      await service.cascadeReschedule(
        taskA.id,
        new Date('2026-01-31'),
        new Date('2026-02-05'),
      );

      const activities = service.getActivities(taskB.id);
      expect(activities.length).toBeGreaterThanOrEqual(1);
      const rescheduleActivity = activities.find(a => a.action === 'auto-rescheduled');
      expect(rescheduleActivity).toBeDefined();
      expect(rescheduleActivity!.field).toBe('dates');
    });
  });

  // =========================================================================
  // Comments
  // =========================================================================
  describe('Comments', () => {
    it('addComment creates a comment with generated id and timestamp', () => {
      const comment = service.addComment('task-1', 'Hello world', 'user-1', 'Alice');

      expect(comment.id).toMatch(/^cmt-/);
      expect(comment.taskId).toBe('task-1');
      expect(comment.text).toBe('Hello world');
      expect(comment.userId).toBe('user-1');
      expect(comment.userName).toBe('Alice');
      expect(comment.createdAt).toBeDefined();
    });

    it('getComments returns comments for a task sorted descending by createdAt', async () => {
      // Add comments with slight time gaps
      service.addComment('task-X', 'First', 'u1', 'A');
      await new Promise(r => setTimeout(r, 10));
      service.addComment('task-X', 'Second', 'u2', 'B');
      await new Promise(r => setTimeout(r, 10));
      service.addComment('task-X', 'Third', 'u3', 'C');

      const comments = service.getComments('task-X');
      expect(comments).toHaveLength(3);
      // Should be sorted descending (newest first)
      expect(comments[0].text).toBe('Third');
      expect(comments[1].text).toBe('Second');
      expect(comments[2].text).toBe('First');
    });

    it('getComments returns empty array for task with no comments', () => {
      const comments = service.getComments('no-comments-task');
      expect(comments).toEqual([]);
    });

    it('deleteComment removes the comment and returns true', () => {
      const comment = service.addComment('task-1', 'To delete', 'u1', 'User');
      const result = service.deleteComment(comment.id);
      expect(result).toBe(true);

      const comments = service.getComments('task-1');
      expect(comments).toHaveLength(0);
    });

    it('deleteComment returns false for nonexistent comment', () => {
      const result = service.deleteComment('nonexistent-cmt');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Activities
  // =========================================================================
  describe('Activities', () => {
    it('logActivity creates an activity entry with generated id', () => {
      const entry = service.logActivity('task-1', 'user-1', 'Alice', 'created');

      expect(entry.id).toMatch(/^act-/);
      expect(entry.taskId).toBe('task-1');
      expect(entry.userId).toBe('user-1');
      expect(entry.userName).toBe('Alice');
      expect(entry.action).toBe('created');
      expect(entry.createdAt).toBeDefined();
    });

    it('logActivity stores field, oldValue, and newValue when provided', () => {
      const entry = service.logActivity('task-1', 'u1', 'Alice', 'updated', 'status', 'pending', 'in_progress');

      expect(entry.field).toBe('status');
      expect(entry.oldValue).toBe('pending');
      expect(entry.newValue).toBe('in_progress');
    });

    it('getActivities returns activities for a task sorted descending', async () => {
      service.logActivity('task-A', 'u1', 'U', 'first');
      await new Promise(r => setTimeout(r, 10));
      service.logActivity('task-A', 'u1', 'U', 'second');
      await new Promise(r => setTimeout(r, 10));
      service.logActivity('task-A', 'u1', 'U', 'third');

      const activities = service.getActivities('task-A');
      expect(activities).toHaveLength(3);
      expect(activities[0].action).toBe('third');
      expect(activities[2].action).toBe('first');
    });

    it('getActivitiesBySchedule returns activities for tasks in that schedule', async () => {
      const schedule = await service.create({
        projectId: 'p1',
        name: 'S',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'u',
      });
      const task = await service.createTask({
        scheduleId: schedule.id,
        name: 'T',
        createdBy: 'u',
      });

      service.logActivity(task.id, 'u1', 'User', 'created');
      service.logActivity('other-task', 'u1', 'User', 'unrelated');

      const activities = service.getActivitiesBySchedule(schedule.id);
      expect(activities).toHaveLength(1);
      expect(activities[0].taskId).toBe(task.id);
    });

    it('getAllActivities returns all activities sorted descending', async () => {
      service.logActivity('t1', 'u1', 'U', 'first');
      await new Promise(r => setTimeout(r, 10));
      service.logActivity('t2', 'u1', 'U', 'second');
      await new Promise(r => setTimeout(r, 10));
      service.logActivity('t3', 'u1', 'U', 'third');

      const all = service.getAllActivities();
      expect(all).toHaveLength(3);
      expect(all[0].action).toBe('third');
      expect(all[2].action).toBe('first');
    });
  });

  // =========================================================================
  // Auto-activity logging on updateTask
  // =========================================================================
  describe('Auto-activity logging on updateTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const schedule = await service.create({
        projectId: 'p1',
        name: 'Auto Log Schedule',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        createdBy: 'u',
      });
      const task = await service.createTask({
        scheduleId: schedule.id,
        name: 'Tracked Task',
        status: 'pending',
        priority: 'low',
        progressPercentage: 0,
        createdBy: 'u',
      });
      taskId = task.id;
    });

    it('logs activity when status changes', async () => {
      await service.updateTask(taskId, { status: 'in_progress' });

      const activities = service.getActivities(taskId);
      const statusActivity = activities.find(a => a.field === 'status');
      expect(statusActivity).toBeDefined();
      expect(statusActivity!.oldValue).toBe('pending');
      expect(statusActivity!.newValue).toBe('in_progress');
    });

    it('logs activity when priority changes', async () => {
      await service.updateTask(taskId, { priority: 'urgent' });

      const activities = service.getActivities(taskId);
      const priorityActivity = activities.find(a => a.field === 'priority');
      expect(priorityActivity).toBeDefined();
      expect(priorityActivity!.oldValue).toBe('low');
      expect(priorityActivity!.newValue).toBe('urgent');
    });

    it('logs activity when assignedTo changes', async () => {
      await service.updateTask(taskId, { assignedTo: 'dev-5' });

      const activities = service.getActivities(taskId);
      const assignActivity = activities.find(a => a.field === 'assignedTo');
      expect(assignActivity).toBeDefined();
      expect(assignActivity!.oldValue).toBe('');
      expect(assignActivity!.newValue).toBe('dev-5');
    });

    it('logs activity when progressPercentage changes', async () => {
      await service.updateTask(taskId, { progressPercentage: 50 });

      const activities = service.getActivities(taskId);
      const progressActivity = activities.find(a => a.field === 'progressPercentage');
      expect(progressActivity).toBeDefined();
      expect(progressActivity!.oldValue).toBe('0');
      expect(progressActivity!.newValue).toBe('50');
    });

    it('logs activity when name changes', async () => {
      await service.updateTask(taskId, { name: 'Renamed Task' });

      const activities = service.getActivities(taskId);
      const nameActivity = activities.find(a => a.field === 'name');
      expect(nameActivity).toBeDefined();
      expect(nameActivity!.oldValue).toBe('Tracked Task');
      expect(nameActivity!.newValue).toBe('Renamed Task');
    });

    it('does NOT log activity when the value is unchanged', async () => {
      await service.updateTask(taskId, { status: 'pending' }); // same value

      const activities = service.getActivities(taskId);
      const statusActivities = activities.filter(a => a.field === 'status');
      expect(statusActivities).toHaveLength(0);
    });

    it('logs multiple activities when multiple tracked fields change at once', async () => {
      await service.updateTask(taskId, {
        status: 'completed',
        priority: 'high',
        progressPercentage: 100,
      });

      const activities = service.getActivities(taskId);
      expect(activities.filter(a => a.field === 'status')).toHaveLength(1);
      expect(activities.filter(a => a.field === 'priority')).toHaveLength(1);
      expect(activities.filter(a => a.field === 'progressPercentage')).toHaveLength(1);
    });

    it('does NOT log activity for non-tracked fields like description', async () => {
      await service.updateTask(taskId, { description: 'Updated description' });

      const activities = service.getActivities(taskId);
      const descActivities = activities.filter(a => a.field === 'description');
      expect(descActivities).toHaveLength(0);
    });
  });
});
