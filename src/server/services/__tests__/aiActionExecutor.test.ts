import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config BEFORE any service imports
// ---------------------------------------------------------------------------
vi.mock('../../config', () => ({
  config: {
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

// ---------------------------------------------------------------------------
// Mock database connection (in-memory mode)
// ---------------------------------------------------------------------------
vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
    query: vi.fn(),
    getPool: vi.fn(),
    transaction: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock ProjectService
// ---------------------------------------------------------------------------
const mockProjectCreate = vi.fn();
const mockProjectUpdate = vi.fn();
const mockProjectFindById = vi.fn();
const mockProjectFindAll = vi.fn();

vi.mock('../ProjectService', () => ({
  ProjectService: class {
    create = mockProjectCreate;
    update = mockProjectUpdate;
    findById = mockProjectFindById;
    findAll = mockProjectFindAll;
  },
}));

// ---------------------------------------------------------------------------
// Mock ScheduleService
// ---------------------------------------------------------------------------
const mockScheduleCreate = vi.fn();
const mockScheduleFindById = vi.fn();
const mockScheduleFindByProjectId = vi.fn();
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockFindTaskById = vi.fn();
const mockFindTasksByScheduleId = vi.fn();
const mockDeleteTask = vi.fn();
const mockFindAllDownstreamTasks = vi.fn();

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    create = mockScheduleCreate;
    findById = mockScheduleFindById;
    findByProjectId = mockScheduleFindByProjectId;
    createTask = mockCreateTask;
    updateTask = mockUpdateTask;
    findTaskById = mockFindTaskById;
    findTasksByScheduleId = mockFindTasksByScheduleId;
    deleteTask = mockDeleteTask;
    findAllDownstreamTasks = mockFindAllDownstreamTasks;
  },
}));

// ---------------------------------------------------------------------------
// Mock UserService (imported but unused by the executor)
// ---------------------------------------------------------------------------
vi.mock('../UserService', () => ({
  UserService: class {},
}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { AIActionExecutor, ActionResult, ActionContext } from '../aiActionExecutor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ctx: ActionContext = { userId: '1', userRole: 'admin' };

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    scheduleId: 'sch-1',
    name: 'Test Task',
    status: 'pending',
    priority: 'medium',
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSchedule(overrides: Record<string, any> = {}) {
  return {
    id: 'sch-1',
    projectId: 'proj-1',
    name: 'Test Schedule',
    status: 'active',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProject(overrides: Record<string, any> = {}) {
  return {
    id: 'proj-1',
    name: 'Test Project',
    status: 'active',
    priority: 'medium',
    projectType: 'it',
    budgetAllocated: 100000,
    budgetSpent: 25000,
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AIActionExecutor', () => {
  let executor: AIActionExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new AIActionExecutor();
  });

  // =========================================================================
  // 1. create_task
  // =========================================================================
  describe('create_task', () => {
    it('creates a task when the schedule exists', async () => {
      const schedule = makeSchedule();
      const task = makeTask({ id: 'task-new', name: 'New Task' });
      mockScheduleFindById.mockResolvedValue(schedule);
      mockCreateTask.mockResolvedValue(task);

      const result = await executor.execute('create_task', {
        scheduleId: 'sch-1',
        name: 'New Task',
        description: 'A new task',
        priority: 'high',
        assignedTo: 'user-2',
        dueDate: '2026-03-15',
        estimatedDays: 5,
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('create_task');
      expect(result.data.taskId).toBe('task-new');
      expect(result.data.name).toBe('New Task');
      expect(result.data.scheduleId).toBe('sch-1');
      expect(result.summary).toContain('Created task');
      expect(result.summary).toContain('assigned to user-2');
      expect(result.summary).toContain('due 2026-03-15');
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: 'sch-1',
          name: 'New Task',
          priority: 'high',
          createdBy: '1',
        }),
      );
    });

    it('returns error when schedule is not found', async () => {
      mockScheduleFindById.mockResolvedValue(null);

      const result = await executor.execute('create_task', {
        scheduleId: 'sch-missing',
        name: 'Task',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule not found');
      expect(result.summary).toContain('sch-missing');
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('defaults priority to medium when not provided', async () => {
      mockScheduleFindById.mockResolvedValue(makeSchedule());
      mockCreateTask.mockResolvedValue(makeTask());

      await executor.execute('create_task', {
        scheduleId: 'sch-1',
        name: 'Task',
      }, ctx);

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'medium' }),
      );
    });
  });

  // =========================================================================
  // 2. update_task
  // =========================================================================
  describe('update_task', () => {
    it('updates a task when it exists', async () => {
      const existing = makeTask({ name: 'Old Name' });
      const updated = makeTask({ name: 'New Name', status: 'in_progress' });
      mockFindTaskById.mockResolvedValue(existing);
      mockUpdateTask.mockResolvedValue(updated);

      const result = await executor.execute('update_task', {
        taskId: 'task-1',
        name: 'New Name',
        status: 'in_progress',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('update_task');
      expect(result.summary).toContain('Updated task');
      expect(result.summary).toContain('Old Name');
      expect(result.data.taskId).toBe('task-1');
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
        name: 'New Name',
        status: 'in_progress',
      }));
    });

    it('returns error when task is not found', async () => {
      mockFindTaskById.mockResolvedValue(null);

      const result = await executor.execute('update_task', {
        taskId: 'task-missing',
        name: 'Updated',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('converts dueDate string to Date object', async () => {
      mockFindTaskById.mockResolvedValue(makeTask());
      mockUpdateTask.mockResolvedValue(makeTask());

      await executor.execute('update_task', {
        taskId: 'task-1',
        dueDate: '2026-04-01',
      }, ctx);

      const updateArg = mockUpdateTask.mock.calls[0][1];
      expect(updateArg.dueDate).toBeInstanceOf(Date);
      expect(updateArg.dueDate.toISOString()).toContain('2026-04-01');
    });
  });

  // =========================================================================
  // 3. delete_task
  // =========================================================================
  describe('delete_task', () => {
    it('deletes a task when it exists', async () => {
      const existing = makeTask({ name: 'Doomed Task' });
      mockFindTaskById.mockResolvedValue(existing);
      mockDeleteTask.mockResolvedValue(true);

      const result = await executor.execute('delete_task', { taskId: 'task-1' }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('delete_task');
      expect(result.summary).toContain('Deleted task');
      expect(result.summary).toContain('Doomed Task');
      expect(result.data.taskId).toBe('task-1');
      expect(result.data.name).toBe('Doomed Task');
    });

    it('returns error when task is not found', async () => {
      mockFindTaskById.mockResolvedValue(null);

      const result = await executor.execute('delete_task', { taskId: 'task-missing' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
      expect(mockDeleteTask).not.toHaveBeenCalled();
    });

    it('returns success=false when deleteTask returns false', async () => {
      mockFindTaskById.mockResolvedValue(makeTask());
      mockDeleteTask.mockResolvedValue(false);

      const result = await executor.execute('delete_task', { taskId: 'task-1' }, ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('Failed to delete');
    });
  });

  // =========================================================================
  // 4. create_project
  // =========================================================================
  describe('create_project', () => {
    it('creates a project with all fields', async () => {
      const project = makeProject({ id: 'proj-new', name: 'Big Project' });
      mockProjectCreate.mockResolvedValue(project);

      const result = await executor.execute('create_project', {
        name: 'Big Project',
        description: 'A big project',
        projectType: 'construction',
        priority: 'high',
        budgetAllocated: 500000,
        location: 'NYC',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('create_project');
      expect(result.data.projectId).toBe('proj-new');
      expect(result.data.name).toBe('Big Project');
      expect(result.summary).toContain('Created project');
      expect(result.summary).toContain('$500,000');
      expect(mockProjectCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Big Project',
          priority: 'high',
          userId: '1',
        }),
      );
    });

    it('auto-creates a schedule when startDate and endDate are provided', async () => {
      const project = makeProject({ id: 'proj-auto', name: 'Auto Schedule Project' });
      const schedule = makeSchedule({ id: 'sch-auto' });
      mockProjectCreate.mockResolvedValue(project);
      mockScheduleCreate.mockResolvedValue(schedule);

      const result = await executor.execute('create_project', {
        name: 'Auto Schedule Project',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data.scheduleId).toBe('sch-auto');
      expect(result.summary).toContain('sch-auto');
      expect(mockScheduleCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-auto',
          name: 'Auto Schedule Project - Master Schedule',
          createdBy: '1',
        }),
      );
    });

    it('does not create a schedule when dates are missing', async () => {
      const project = makeProject({ id: 'proj-no-sch', name: 'No Dates' });
      mockProjectCreate.mockResolvedValue(project);

      const result = await executor.execute('create_project', {
        name: 'No Dates',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data.scheduleId).toBeUndefined();
      expect(mockScheduleCreate).not.toHaveBeenCalled();
    });

    it('defaults projectType to other and priority to medium', async () => {
      mockProjectCreate.mockResolvedValue(makeProject());

      await executor.execute('create_project', { name: 'Minimal' }, ctx);

      expect(mockProjectCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectType: 'other',
          priority: 'medium',
        }),
      );
    });
  });

  // =========================================================================
  // 5. update_project
  // =========================================================================
  describe('update_project', () => {
    it('updates a project when it exists', async () => {
      const existing = makeProject({ name: 'Old Project' });
      const updated = makeProject({ name: 'Updated Project', status: 'on_hold' });
      mockProjectFindById.mockResolvedValue(existing);
      mockProjectUpdate.mockResolvedValue(updated);

      const result = await executor.execute('update_project', {
        projectId: 'proj-1',
        name: 'Updated Project',
        status: 'on_hold',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('update_project');
      expect(result.summary).toContain('Updated project');
      expect(result.summary).toContain('Old Project');
      expect(result.summary).toContain('name: Updated Project');
      expect(result.summary).toContain('status: on_hold');
      expect(mockProjectUpdate).toHaveBeenCalledWith('proj-1', {
        name: 'Updated Project',
        status: 'on_hold',
      });
    });

    it('returns error when project is not found', async () => {
      mockProjectFindById.mockResolvedValue(null);

      const result = await executor.execute('update_project', {
        projectId: 'proj-missing',
        name: 'X',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. reschedule_task
  // =========================================================================
  describe('reschedule_task', () => {
    it('reschedules a task with new dates', async () => {
      const existing = makeTask({ name: 'Movable Task' });
      const updated = makeTask({ name: 'Movable Task' });
      mockFindTaskById.mockResolvedValue(existing);
      mockUpdateTask.mockResolvedValue(updated);

      const result = await executor.execute('reschedule_task', {
        taskId: 'task-1',
        startDate: '2026-02-01',
        endDate: '2026-03-01',
        dueDate: '2026-03-01',
        reason: 'Resource conflict',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('reschedule_task');
      expect(result.summary).toContain('Rescheduled task');
      expect(result.summary).toContain('Movable Task');
      expect(result.summary).toContain('start: 2026-02-01');
      expect(result.summary).toContain('end: 2026-03-01');
      expect(result.summary).toContain('Reason: Resource conflict');
      expect(result.data.startDate).toBe('2026-02-01');
      expect(result.data.endDate).toBe('2026-03-01');
      expect(result.data.dueDate).toBe('2026-03-01');

      const updateArg = mockUpdateTask.mock.calls[0][1];
      expect(updateArg.startDate).toBeInstanceOf(Date);
      expect(updateArg.endDate).toBeInstanceOf(Date);
      expect(updateArg.dueDate).toBeInstanceOf(Date);
    });

    it('returns error when task is not found', async () => {
      mockFindTaskById.mockResolvedValue(null);

      const result = await executor.execute('reschedule_task', {
        taskId: 'task-missing',
        startDate: '2026-02-01',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. list_projects
  // =========================================================================
  describe('list_projects', () => {
    it('returns all projects', async () => {
      const projects = [
        makeProject({ id: 'p1', name: 'Alpha' }),
        makeProject({ id: 'p2', name: 'Beta' }),
      ];
      mockProjectFindAll.mockResolvedValue(projects);

      const result = await executor.execute('list_projects', {}, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('list_projects');
      expect(result.summary).toBe('Found 2 projects');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('p1');
      expect(result.data[0].name).toBe('Alpha');
      expect(result.data[1].id).toBe('p2');
    });

    it('returns empty list when no projects exist', async () => {
      mockProjectFindAll.mockResolvedValue([]);

      const result = await executor.execute('list_projects', {}, ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toBe('Found 0 projects');
      expect(result.data).toEqual([]);
    });
  });

  // =========================================================================
  // 8. get_project_details
  // =========================================================================
  describe('get_project_details', () => {
    it('returns project with nested schedules and tasks', async () => {
      const project = makeProject({
        id: 'proj-1',
        name: 'Detail Project',
        description: 'Detailed',
        location: 'LA',
      });
      const schedule = makeSchedule({ id: 'sch-1', name: 'Main Schedule' });
      const tasks = [
        makeTask({ id: 't1', name: 'Task A', progressPercentage: 50, assignedTo: 'user-5' }),
        makeTask({ id: 't2', name: 'Task B', parentTaskId: 't1' }),
      ];

      mockProjectFindById.mockResolvedValue(project);
      mockScheduleFindByProjectId.mockResolvedValue([schedule]);
      mockFindTasksByScheduleId.mockResolvedValue(tasks);

      const result = await executor.execute('get_project_details', { projectId: 'proj-1' }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_project_details');
      expect(result.summary).toContain('Detail Project');
      expect(result.summary).toContain('1 schedule(s)');
      expect(result.data.id).toBe('proj-1');
      expect(result.data.schedules).toHaveLength(1);
      expect(result.data.schedules[0].name).toBe('Main Schedule');
      expect(result.data.schedules[0].tasks).toHaveLength(2);
      expect(result.data.schedules[0].tasks[0].id).toBe('t1');
      expect(result.data.schedules[0].tasks[0].progressPercentage).toBe(50);
      expect(result.data.schedules[0].tasks[1].parentTaskId).toBe('t1');
    });

    it('returns error when project is not found', async () => {
      mockProjectFindById.mockResolvedValue(null);

      const result = await executor.execute('get_project_details', { projectId: 'proj-missing' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  // =========================================================================
  // 9. list_tasks
  // =========================================================================
  describe('list_tasks', () => {
    it('returns tasks for a schedule', async () => {
      const schedule = makeSchedule({ name: 'Sprint 1' });
      const tasks = [
        makeTask({ id: 't1', name: 'Task A', dependency: 't0', dependencyType: 'FS' }),
        makeTask({ id: 't2', name: 'Task B' }),
      ];
      mockScheduleFindById.mockResolvedValue(schedule);
      mockFindTasksByScheduleId.mockResolvedValue(tasks);

      const result = await executor.execute('list_tasks', { scheduleId: 'sch-1' }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('list_tasks');
      expect(result.summary).toContain('2 tasks');
      expect(result.summary).toContain('Sprint 1');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].dependency).toBe('t0');
      expect(result.data[0].dependencyType).toBe('FS');
    });

    it('returns error when schedule is not found', async () => {
      mockScheduleFindById.mockResolvedValue(null);

      const result = await executor.execute('list_tasks', { scheduleId: 'sch-missing' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule not found');
    });
  });

  // =========================================================================
  // 10. cascade_reschedule
  // =========================================================================
  describe('cascade_reschedule', () => {
    it('shifts target and downstream tasks forward by delta', async () => {
      const target = makeTask({
        id: 'task-target',
        name: 'Target Task',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-20'),
      });
      const downstream1 = makeTask({
        id: 'task-d1',
        name: 'Downstream 1',
        startDate: new Date('2026-01-21'),
        endDate: new Date('2026-01-25'),
        dueDate: new Date('2026-01-25'),
      });
      const downstream2 = makeTask({
        id: 'task-d2',
        name: 'Downstream 2',
        startDate: new Date('2026-01-26'),
        endDate: new Date('2026-01-30'),
      });

      mockFindTaskById.mockResolvedValue(target);
      mockUpdateTask.mockResolvedValue(target);
      mockFindAllDownstreamTasks.mockResolvedValue([downstream1, downstream2]);

      const result = await executor.execute('cascade_reschedule', {
        taskId: 'task-target',
        newStartDate: '2026-01-17',  // +7 days
        reason: 'Permit delay',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('cascade_reschedule');
      expect(result.summary).toContain('Target Task');
      expect(result.summary).toContain('2 downstream tasks');
      expect(result.summary).toContain('7 days');
      expect(result.summary).toContain('forward');
      expect(result.summary).toContain('Reason: Permit delay');

      // Target was updated
      expect(mockUpdateTask).toHaveBeenCalledWith('task-target', expect.objectContaining({
        startDate: new Date('2026-01-17'),
      }));
      // Downstream tasks were shifted
      expect(mockUpdateTask).toHaveBeenCalledWith('task-d1', expect.objectContaining({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        dueDate: expect.any(Date),
      }));
      expect(mockUpdateTask).toHaveBeenCalledWith('task-d2', expect.objectContaining({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      }));

      expect(result.data.deltaDays).toBe(7);
      expect(result.data.affectedTasks).toHaveLength(2);
    });

    it('returns error when task is not found', async () => {
      mockFindTaskById.mockResolvedValue(null);

      const result = await executor.execute('cascade_reschedule', {
        taskId: 'task-missing',
        newStartDate: '2026-02-01',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });

    it('returns error when no dates are provided', async () => {
      const target = makeTask({
        id: 'task-target',
        name: 'Target',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-20'),
      });
      mockFindTaskById.mockResolvedValue(target);

      const result = await executor.execute('cascade_reschedule', {
        taskId: 'task-target',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Provide newStartDate or newEndDate');
    });

    it('shifts tasks backward when new date is earlier', async () => {
      const target = makeTask({
        id: 'task-target',
        name: 'Target',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-01-30'),
      });
      mockFindTaskById.mockResolvedValue(target);
      mockUpdateTask.mockResolvedValue(target);
      mockFindAllDownstreamTasks.mockResolvedValue([]);

      const result = await executor.execute('cascade_reschedule', {
        taskId: 'task-target',
        newStartDate: '2026-01-15',  // -5 days
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('back');
      expect(result.data.deltaDays).toBe(-5);
    });

    it('uses endDate delta when only newEndDate is provided', async () => {
      const target = makeTask({
        id: 'task-target',
        name: 'Target',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-20'),
      });
      mockFindTaskById.mockResolvedValue(target);
      mockUpdateTask.mockResolvedValue(target);
      mockFindAllDownstreamTasks.mockResolvedValue([]);

      const result = await executor.execute('cascade_reschedule', {
        taskId: 'task-target',
        newEndDate: '2026-01-23',  // +3 days
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data.deltaDays).toBe(3);
      // When only endDate changed, startDate should also shift
      expect(mockUpdateTask).toHaveBeenCalledWith('task-target', expect.objectContaining({
        endDate: new Date('2026-01-23'),
        startDate: expect.any(Date),
      }));
    });
  });

  // =========================================================================
  // 11. set_dependency
  // =========================================================================
  describe('set_dependency', () => {
    it('sets a dependency between two tasks', async () => {
      const task = makeTask({ id: 'task-B', name: 'Task B' });
      const predecessor = makeTask({ id: 'task-A', name: 'Task A' });

      mockFindTaskById
        .mockResolvedValueOnce(task)         // first call: find the dependent
        .mockResolvedValueOnce(predecessor); // second call: find the predecessor
      mockFindAllDownstreamTasks.mockResolvedValue([]);
      mockUpdateTask.mockResolvedValue(task);

      const result = await executor.execute('set_dependency', {
        taskId: 'task-B',
        predecessorId: 'task-A',
        dependencyType: 'FS',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('set_dependency');
      expect(result.summary).toContain('Task B');
      expect(result.summary).toContain('Task A');
      expect(result.summary).toContain('FS');
      expect(result.data.taskId).toBe('task-B');
      expect(result.data.predecessorId).toBe('task-A');
      expect(result.data.dependencyType).toBe('FS');
      expect(mockUpdateTask).toHaveBeenCalledWith('task-B', {
        dependency: 'task-A',
        dependencyType: 'FS',
      });
    });

    it('defaults dependencyType to FS when not specified', async () => {
      const task = makeTask({ id: 'task-B', name: 'Task B' });
      const predecessor = makeTask({ id: 'task-A', name: 'Task A' });

      mockFindTaskById
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(predecessor);
      mockFindAllDownstreamTasks.mockResolvedValue([]);
      mockUpdateTask.mockResolvedValue(task);

      const result = await executor.execute('set_dependency', {
        taskId: 'task-B',
        predecessorId: 'task-A',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data.dependencyType).toBe('FS');
    });

    it('detects circular dependency when predecessor is downstream', async () => {
      const task = makeTask({ id: 'task-B', name: 'Task B' });
      const predecessor = makeTask({ id: 'task-A', name: 'Task A' });

      mockFindTaskById
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(predecessor);
      // task-A is already downstream of task-B -> circular
      mockFindAllDownstreamTasks.mockResolvedValue([
        makeTask({ id: 'task-A', name: 'Task A' }),
      ]);

      const result = await executor.execute('set_dependency', {
        taskId: 'task-B',
        predecessorId: 'task-A',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Circular dependency detected');
      expect(result.summary).toContain('circular dependency');
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('returns error when task is not found', async () => {
      mockFindTaskById.mockResolvedValueOnce(null);

      const result = await executor.execute('set_dependency', {
        taskId: 'task-missing',
        predecessorId: 'task-A',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });

    it('returns error when predecessor is not found', async () => {
      const task = makeTask({ id: 'task-B', name: 'Task B' });
      mockFindTaskById
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(null);

      const result = await executor.execute('set_dependency', {
        taskId: 'task-B',
        predecessorId: 'task-missing',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Predecessor not found');
    });
  });

  // =========================================================================
  // 12. get_dependency_chain
  // =========================================================================
  describe('get_dependency_chain', () => {
    it('walks upstream and downstream dependency chain', async () => {
      const grandparent = makeTask({ id: 'gp', name: 'Grandparent' });
      const parent = makeTask({ id: 'p', name: 'Parent', dependency: 'gp', dependencyType: 'FS' });
      const task = makeTask({ id: 't', name: 'Current', dependency: 'p', dependencyType: 'SS' });
      const child = makeTask({
        id: 'c',
        name: 'Child',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-15'),
      });

      // First call: find the target task
      mockFindTaskById
        .mockResolvedValueOnce(task)       // initial lookup
        .mockResolvedValueOnce(parent)     // upstream walk: parent
        .mockResolvedValueOnce(grandparent); // upstream walk: grandparent (has no dependency, loop stops)

      mockFindAllDownstreamTasks.mockResolvedValue([child]);

      const result = await executor.execute('get_dependency_chain', { taskId: 't' }, ctx);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('get_dependency_chain');
      expect(result.summary).toContain('Current');
      expect(result.summary).toContain('2 predecessor(s)');
      expect(result.summary).toContain('1 downstream dependent(s)');

      // Upstream is reversed to oldest-first
      expect(result.data.upstream).toHaveLength(2);
      expect(result.data.upstream[0].id).toBe('gp');
      expect(result.data.upstream[0].name).toBe('Grandparent');
      expect(result.data.upstream[1].id).toBe('p');
      expect(result.data.upstream[1].name).toBe('Parent');
      expect(result.data.upstream[1].type).toBe('SS');

      // Downstream
      expect(result.data.downstream).toHaveLength(1);
      expect(result.data.downstream[0].id).toBe('c');
      expect(result.data.downstream[0].name).toBe('Child');
      expect(result.data.downstream[0].startDate).toBe('2026-03-01');
    });

    it('returns error when task is not found', async () => {
      mockFindTaskById.mockResolvedValue(null);

      const result = await executor.execute('get_dependency_chain', { taskId: 'missing' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });

    it('handles task with no upstream or downstream dependencies', async () => {
      const task = makeTask({ id: 't-alone', name: 'Lone Task' });
      mockFindTaskById.mockResolvedValue(task); // no dependency field
      mockFindAllDownstreamTasks.mockResolvedValue([]);

      const result = await executor.execute('get_dependency_chain', { taskId: 't-alone' }, ctx);

      expect(result.success).toBe(true);
      expect(result.data.upstream).toEqual([]);
      expect(result.data.downstream).toEqual([]);
      expect(result.summary).toContain('0 predecessor(s)');
      expect(result.summary).toContain('0 downstream dependent(s)');
    });
  });

  // =========================================================================
  // Unknown tool
  // =========================================================================
  describe('unknown tool', () => {
    it('returns error ActionResult for unrecognized tool name', async () => {
      const result = await executor.execute('nonexistent_tool', { foo: 'bar' }, ctx);

      expect(result.success).toBe(false);
      expect(result.toolName).toBe('nonexistent_tool');
      expect(result.summary).toContain('Unknown tool: nonexistent_tool');
      expect(result.error).toContain("Tool 'nonexistent_tool' is not recognized");
    });
  });

  // =========================================================================
  // Exception handling
  // =========================================================================
  describe('exception handling', () => {
    it('catches thrown Error and returns error ActionResult', async () => {
      mockProjectFindAll.mockRejectedValue(new Error('Database connection lost'));

      const result = await executor.execute('list_projects', {}, ctx);

      expect(result.success).toBe(false);
      expect(result.toolName).toBe('list_projects');
      expect(result.error).toBe('Database connection lost');
      expect(result.summary).toContain('Error executing list_projects');
      expect(result.summary).toContain('Database connection lost');
    });

    it('catches non-Error thrown values and converts to string', async () => {
      mockProjectFindAll.mockRejectedValue('unexpected string error');

      const result = await executor.execute('list_projects', {}, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('unexpected string error');
    });

    it('catches errors from createTask', async () => {
      mockScheduleFindById.mockResolvedValue(makeSchedule());
      mockCreateTask.mockRejectedValue(new Error('Validation failed'));

      const result = await executor.execute('create_task', {
        scheduleId: 'sch-1',
        name: 'Failing task',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
    });
  });
});
