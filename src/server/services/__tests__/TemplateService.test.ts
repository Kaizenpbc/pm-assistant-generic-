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

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
  },
}));

let mockProjectCreateResult: any = null;
let mockProjectFindByIdResult: any = null;

vi.mock('../ProjectService', () => ({
  ProjectService: class {
    async create(data: any) {
      return mockProjectCreateResult ?? {
        id: 'proj-1',
        name: data.name,
        description: data.description,
        projectType: data.projectType,
        category: data.category,
        status: data.status,
        priority: data.priority,
        startDate: data.startDate,
        endDate: data.endDate,
        createdBy: data.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    async findById(id: string) {
      return mockProjectFindByIdResult ?? null;
    }
  },
}));

let createTaskCalls: any[] = [];
let taskIdCounter = 0;
let mockScheduleCreateResult: any = null;
let mockSchedulesByProject: any[] = [];
let mockTasksBySchedule: any[] = [];

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async create(data: any) {
      return mockScheduleCreateResult ?? {
        id: 'sch-1',
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'pending',
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    async createTask(data: any) {
      taskIdCounter++;
      const task = {
        id: `task-${taskIdCounter}`,
        scheduleId: data.scheduleId,
        name: data.name,
        description: data.description,
        status: data.status,
        priority: data.priority,
        estimatedDays: data.estimatedDays,
        startDate: data.startDate,
        endDate: data.endDate,
        parentTaskId: data.parentTaskId,
        dependency: data.dependency,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      createTaskCalls.push({ input: data, result: task });
      return task;
    }
    async findByProjectId(_projectId: string) {
      return mockSchedulesByProject;
    }
    async findTasksByScheduleId(_scheduleId: string) {
      return mockTasksBySchedule;
    }
  },
}));

import { TemplateService } from '../TemplateService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  createTaskCalls = [];
  taskIdCounter = 0;
  mockProjectCreateResult = null;
  mockProjectFindByIdResult = null;
  mockScheduleCreateResult = null;
  mockSchedulesByProject = [];
  mockTasksBySchedule = [];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    resetMocks();
    service = new TemplateService();
  });

  // =========================================================================
  // findAll
  // =========================================================================

  describe('findAll', () => {
    it('returns all 10 built-in templates when no filters applied', async () => {
      const templates = await service.findAll();
      expect(templates).toHaveLength(10);
    });

    it('filters by projectType "it" returning 3 IT templates', async () => {
      const templates = await service.findAll('it');
      expect(templates).toHaveLength(3);
      templates.forEach(t => expect(t.projectType).toBe('it'));
    });

    it('filters by projectType "construction" returning 2 templates', async () => {
      const templates = await service.findAll('construction');
      expect(templates).toHaveLength(2);
      templates.forEach(t => expect(t.projectType).toBe('construction'));
    });

    it('filters by category', async () => {
      const templates = await service.findAll(undefined, 'bridge');
      expect(templates).toHaveLength(1);
      expect(templates[0].category).toBe('bridge');
    });

    it('applies combined projectType and category filters', async () => {
      const templates = await service.findAll('it', 'web_development');
      expect(templates).toHaveLength(1);
      expect(templates[0].projectType).toBe('it');
      expect(templates[0].category).toBe('web_development');
    });

    it('returns empty array when no templates match filter', async () => {
      const templates = await service.findAll('nonexistent');
      expect(templates).toHaveLength(0);
    });
  });

  // =========================================================================
  // findById
  // =========================================================================

  describe('findById', () => {
    it('returns a template for a known built-in ID', async () => {
      const template = await service.findById('tpl-it-webapp');
      expect(template).not.toBeNull();
      expect(template!.id).toBe('tpl-it-webapp');
      expect(template!.name).toBe('Web Application Development');
    });

    it('returns null for an unknown ID', async () => {
      const template = await service.findById('tpl-nonexistent');
      expect(template).toBeNull();
    });
  });

  // =========================================================================
  // create
  // =========================================================================

  describe('create', () => {
    it('creates a custom template with generated tpl- prefixed ID', async () => {
      const created = await service.create({
        name: 'My Custom Template',
        description: 'Test template',
        projectType: 'other',
        category: 'custom',
        isBuiltIn: false,
        createdBy: 'user-1',
        estimatedDurationDays: 30,
        tasks: [],
        tags: ['test'],
      });

      expect(created.id).toMatch(/^tpl-/);
      expect(created.name).toBe('My Custom Template');
      expect(created.usageCount).toBe(0);
    });

    it('sets usageCount to 0 for new templates', async () => {
      const created = await service.create({
        name: 'Zero Usage',
        description: 'Unused',
        projectType: 'it',
        category: 'test',
        isBuiltIn: false,
        createdBy: 'user-1',
        estimatedDurationDays: 10,
        tasks: [],
        tags: [],
      });

      expect(created.usageCount).toBe(0);
    });
  });

  // =========================================================================
  // update
  // =========================================================================

  describe('update', () => {
    it('returns null when trying to update a built-in template', async () => {
      const result = await service.update('tpl-it-webapp', { name: 'Hacked Name' });
      expect(result).toBeNull();
    });

    it('updates a custom template successfully', async () => {
      const custom = await service.create({
        name: 'Original Name',
        description: 'Desc',
        projectType: 'other',
        category: 'custom',
        isBuiltIn: false,
        createdBy: 'user-1',
        estimatedDurationDays: 10,
        tasks: [],
        tags: [],
      });

      const updated = await service.update(custom.id, { name: 'Updated Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
    });

    it('returns null when updating a non-existent template', async () => {
      const result = await service.update('tpl-does-not-exist', { name: 'Nope' });
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // delete
  // =========================================================================

  describe('delete', () => {
    it('returns false when trying to delete a built-in template', async () => {
      const result = await service.delete('tpl-it-webapp');
      expect(result).toBe(false);
    });

    it('deletes a custom template successfully', async () => {
      const custom = await service.create({
        name: 'To Delete',
        description: 'Will be deleted',
        projectType: 'other',
        category: 'custom',
        isBuiltIn: false,
        createdBy: 'user-1',
        estimatedDurationDays: 5,
        tasks: [],
        tags: [],
      });

      const deleted = await service.delete(custom.id);
      expect(deleted).toBe(true);

      // Verify it no longer exists
      const found = await service.findById(custom.id);
      expect(found).toBeNull();
    });

    it('returns false for a non-existent template', async () => {
      const result = await service.delete('tpl-nonexistent-id');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // applyTemplate
  // =========================================================================

  describe('applyTemplate', () => {
    it('throws error when template is not found', async () => {
      await expect(
        service.applyTemplate({
          templateId: 'tpl-nonexistent',
          projectName: 'Test Project',
          startDate: '2026-03-01',
          priority: 'medium',
          userId: 'user-1',
        }),
      ).rejects.toThrow('Template not found');
    });

    it('creates project, schedule, and tasks from template', async () => {
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'My PMI Project',
        startDate: '2026-03-01',
        priority: 'high',
        userId: 'user-1',
      });

      expect(result.project).toBeDefined();
      expect(result.project.id).toBe('proj-1');
      expect(result.schedule).toBeDefined();
      expect(result.schedule.id).toBe('sch-1');
      expect(result.tasks.length).toBeGreaterThan(0);
    });

    it('creates the correct number of tasks for the generic PMI template', async () => {
      const template = await service.findById('tpl-generic-pmi');
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'PMI Test',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
      });

      expect(result.tasks).toHaveLength(template!.tasks.length);
      expect(createTaskCalls).toHaveLength(template!.tasks.length);
    });

    it('calculates FS dependency dates (task starts 1 day after dependency ends)', async () => {
      // Use the generic PMI template which has clear FS chains:
      // init (offset 0, 5d) -> plan (FS dep on init) -> exec (FS dep on plan) -> close (FS dep on exec)
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'FS Test',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
      });

      // Find the 'init' (summary) and 'plan' (summary, depends FS on init) tasks
      // init: offset 0, estimatedDays 5, starts 2026-03-01, ends 2026-03-06
      // plan-scope depends FS on init → should start day after init ends (2026-03-07)
      const initTask = result.tasks.find(t => t.name === 'Initiation');
      const planScope = result.tasks.find(t => t.name === 'Scope & WBS');

      expect(initTask).toBeDefined();
      expect(planScope).toBeDefined();

      // plan-scope depends on init (FS), so it should start after init ends + 1 day
      const initEnd = new Date(initTask!.endDate);
      const planScopeStart = new Date(planScope!.startDate);
      const diffMs = planScopeStart.getTime() - initEnd.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(1);
    });

    it('calculates SS dependency dates (task starts same day as dependency start)', async () => {
      // In the generic PMI template: plan-risk depends SS on plan-scope with offsetDays=2
      // plan-risk: dependencyRefId: 'plan-scope', dependencyType: 'SS', offsetDays: 2
      // SS means task starts same day as dependency starts
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'SS Test',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
      });

      const planScope = result.tasks.find(t => t.name === 'Scope & WBS');
      const planRisk = result.tasks.find(t => t.name === 'Risk Planning');

      expect(planScope).toBeDefined();
      expect(planRisk).toBeDefined();

      // SS: planRisk starts on same day as planScope starts
      const planScopeStart = new Date(planScope!.startDate);
      const planRiskStart = new Date(planRisk!.startDate);

      expect(planRiskStart.getTime()).toBe(planScopeStart.getTime());
    });

    it('enforces parent constraint (task cannot start before parent)', async () => {
      // All child tasks should start >= their parent's start date
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'Parent Constraint Test',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
      });

      // Build a map of task IDs to tasks
      const taskById = new Map<string, any>();
      for (const task of result.tasks) {
        taskById.set(task.id, task);
      }

      // For each task that has a parentTaskId, verify start >= parent start
      for (const call of createTaskCalls) {
        if (call.input.parentTaskId) {
          const parent = taskById.get(call.input.parentTaskId);
          if (parent) {
            const childStart = new Date(call.input.startDate).getTime();
            const parentStart = new Date(parent.startDate).getTime();
            expect(childStart).toBeGreaterThanOrEqual(parentStart);
          }
        }
      }
    });

    it('increments usage count after applying template', async () => {
      const templateBefore = await service.findById('tpl-generic-pmi');
      const usageBefore = templateBefore!.usageCount;

      await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'Usage Test',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
      });

      const templateAfter = await service.findById('tpl-generic-pmi');
      expect(templateAfter!.usageCount).toBe(usageBefore + 1);
    });

    it('filters tasks by selectedTaskRefIds', async () => {
      // Select only a subset of tasks from generic PMI template
      // Must include mandatory: init, init-charter, close, close-deliver
      // Also add plan-scope
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'Filtered Tasks',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
        selectedTaskRefIds: ['init', 'init-charter', 'plan-scope', 'close', 'close-deliver'],
      });

      // plan-scope has parentRefId: 'plan', and plan should be auto-included
      const taskNames = result.tasks.map(t => t.name);
      expect(taskNames).toContain('Planning'); // auto-included parent of plan-scope
      expect(taskNames).toContain('Scope & WBS');
      expect(taskNames).toContain('Initiation');
      expect(taskNames).toContain('Project Charter');
    });

    it('auto-includes parent summary tasks when child is selected', async () => {
      // Select plan-scope which has parentRefId 'plan'
      // Must include mandatory tasks too
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'Auto Parent',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
        selectedTaskRefIds: ['init', 'init-charter', 'plan-scope', 'close', 'close-deliver'],
      });

      const taskNames = result.tasks.map(t => t.name);
      // 'plan' is the parent of 'plan-scope' and should be auto-included
      expect(taskNames).toContain('Planning');
    });

    it('throws error when mandatory task is excluded from selectedTaskRefIds', async () => {
      // Try to exclude 'init-charter' which is mandatory in generic PMI
      await expect(
        service.applyTemplate({
          templateId: 'tpl-generic-pmi',
          projectName: 'Missing Mandatory',
          startDate: '2026-03-01',
          priority: 'medium',
          userId: 'user-1',
          selectedTaskRefIds: ['init', 'close', 'close-deliver'],
          // Missing init-charter which is mandatory
        }),
      ).rejects.toThrow('Mandatory tasks cannot be excluded');
    });

    it('maps dependency refIds to actual task IDs correctly', async () => {
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'Dep Mapping',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
      });

      // Find a task that has a dependency and verify its dependency is a valid task ID
      const taskWithDep = createTaskCalls.find(c => c.input.dependency);
      expect(taskWithDep).toBeDefined();
      const depTaskId = taskWithDep!.input.dependency;
      const depTask = result.tasks.find(t => t.id === depTaskId);
      expect(depTask).toBeDefined();
    });

    it('maps parent refIds to actual task IDs correctly', async () => {
      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'Parent Mapping',
        startDate: '2026-03-01',
        priority: 'medium',
        userId: 'user-1',
      });

      // Find a task that has a parentTaskId and verify it maps to a valid task
      const taskWithParent = createTaskCalls.find(c => c.input.parentTaskId);
      expect(taskWithParent).toBeDefined();
      const parentTaskId = taskWithParent!.input.parentTaskId;
      const parentTask = result.tasks.find(t => t.id === parentTaskId);
      expect(parentTask).toBeDefined();
    });

    it('passes correct project parameters to ProjectService.create', async () => {
      mockProjectCreateResult = {
        id: 'proj-custom',
        name: 'Named Project',
        projectType: 'other',
        category: 'generic',
        status: 'planning',
        priority: 'urgent',
        createdBy: 'user-42',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.applyTemplate({
        templateId: 'tpl-generic-pmi',
        projectName: 'Named Project',
        startDate: '2026-03-01',
        priority: 'urgent',
        budget: 50000,
        location: 'NYC',
        userId: 'user-42',
      });

      expect(result.project.id).toBe('proj-custom');
      expect(result.project.priority).toBe('urgent');
    });
  });

  // =========================================================================
  // saveFromProject
  // =========================================================================

  describe('saveFromProject', () => {
    it('creates template from an existing project with tasks', async () => {
      const scheduleStart = new Date('2026-01-01');
      const scheduleEnd = new Date('2026-03-01');

      mockProjectFindByIdResult = {
        id: 'proj-existing',
        name: 'Existing Project',
        projectType: 'it',
        category: 'web_development',
        status: 'active',
        priority: 'high',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSchedulesByProject = [
        {
          id: 'sch-existing',
          projectId: 'proj-existing',
          name: 'Main Schedule',
          startDate: scheduleStart,
          endDate: scheduleEnd,
          status: 'active',
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTasksBySchedule = [
        {
          id: 'task-a',
          scheduleId: 'sch-existing',
          name: 'Task A',
          description: 'First task',
          status: 'completed',
          priority: 'high',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-11'),
          estimatedDays: 10,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-b',
          scheduleId: 'sch-existing',
          name: 'Task B',
          description: 'Child task',
          status: 'in_progress',
          priority: 'medium',
          parentTaskId: 'task-a',
          dependency: 'task-a',
          dependencyType: 'FS',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-25'),
          estimatedDays: 10,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const template = await service.saveFromProject({
        projectId: 'proj-existing',
        templateName: 'Saved Template',
        description: 'From existing project',
        tags: ['saved', 'test'],
        userId: 'user-1',
      });

      expect(template.name).toBe('Saved Template');
      expect(template.id).toMatch(/^tpl-/);
      expect(template.isBuiltIn).toBe(false);
      expect(template.projectType).toBe('it');
      expect(template.tags).toEqual(['saved', 'test']);
      expect(template.tasks).toHaveLength(2);
    });

    it('calculates offsetDays from schedule start date', async () => {
      mockProjectFindByIdResult = {
        id: 'proj-offset',
        name: 'Offset Test',
        projectType: 'other',
        category: 'custom',
        status: 'active',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSchedulesByProject = [
        {
          id: 'sch-offset',
          projectId: 'proj-offset',
          name: 'Schedule',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-02-01'),
          status: 'active',
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTasksBySchedule = [
        {
          id: 'task-1',
          scheduleId: 'sch-offset',
          name: 'Offset Task',
          description: 'Starts 10 days after schedule',
          status: 'pending',
          priority: 'medium',
          startDate: new Date('2026-01-11'), // 10 days after schedule start
          endDate: new Date('2026-01-21'),
          estimatedDays: 10,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const template = await service.saveFromProject({
        projectId: 'proj-offset',
        templateName: 'Offset Template',
        description: 'Test offsets',
        tags: [],
        userId: 'user-1',
      });

      expect(template.tasks[0].offsetDays).toBe(10);
    });

    it('maps task IDs to refIds in saved-N format', async () => {
      mockProjectFindByIdResult = {
        id: 'proj-map',
        name: 'Map Test',
        projectType: 'other',
        category: 'custom',
        status: 'active',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSchedulesByProject = [
        {
          id: 'sch-map',
          projectId: 'proj-map',
          name: 'Schedule',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-02-01'),
          status: 'active',
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTasksBySchedule = [
        {
          id: 'task-alpha',
          scheduleId: 'sch-map',
          name: 'Alpha',
          status: 'pending',
          priority: 'medium',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-06'),
          estimatedDays: 5,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-beta',
          scheduleId: 'sch-map',
          name: 'Beta',
          status: 'pending',
          priority: 'medium',
          dependency: 'task-alpha',
          dependencyType: 'FS',
          startDate: new Date('2026-01-07'),
          endDate: new Date('2026-01-14'),
          estimatedDays: 7,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const template = await service.saveFromProject({
        projectId: 'proj-map',
        templateName: 'RefId Template',
        description: '',
        tags: [],
        userId: 'user-1',
      });

      expect(template.tasks[0].refId).toBe('saved-0');
      expect(template.tasks[1].refId).toBe('saved-1');
      // Beta depends on Alpha: dependency should be mapped to saved-0
      expect(template.tasks[1].dependencyRefId).toBe('saved-0');
    });

    it('sets isSummary for parent tasks that have children', async () => {
      mockProjectFindByIdResult = {
        id: 'proj-summary',
        name: 'Summary Test',
        projectType: 'other',
        category: 'custom',
        status: 'active',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSchedulesByProject = [
        {
          id: 'sch-summary',
          projectId: 'proj-summary',
          name: 'Schedule',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-02-01'),
          status: 'active',
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTasksBySchedule = [
        {
          id: 'task-parent',
          scheduleId: 'sch-summary',
          name: 'Parent',
          status: 'pending',
          priority: 'high',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          estimatedDays: 30,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-child',
          scheduleId: 'sch-summary',
          name: 'Child',
          status: 'pending',
          priority: 'medium',
          parentTaskId: 'task-parent',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-11'),
          estimatedDays: 10,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const template = await service.saveFromProject({
        projectId: 'proj-summary',
        templateName: 'Summary Template',
        description: '',
        tags: [],
        userId: 'user-1',
      });

      const parent = template.tasks.find(t => t.name === 'Parent');
      const child = template.tasks.find(t => t.name === 'Child');

      expect(parent!.isSummary).toBe(true);
      expect(child!.isSummary).toBe(false);
    });

    it('throws error when project is not found', async () => {
      mockProjectFindByIdResult = null;

      await expect(
        service.saveFromProject({
          projectId: 'proj-missing',
          templateName: 'Fail Template',
          description: '',
          tags: [],
          userId: 'user-1',
        }),
      ).rejects.toThrow('Project not found');
    });
  });

  // =========================================================================
  // Built-in template protection
  // =========================================================================

  describe('built-in template protection', () => {
    it('cannot update any built-in template', async () => {
      const all = await service.findAll();
      const builtInIds = all.filter(t => t.isBuiltIn).map(t => t.id);
      expect(builtInIds.length).toBe(10);

      for (const id of builtInIds) {
        const result = await service.update(id, { name: 'Tampered' });
        expect(result).toBeNull();
      }
    });

    it('cannot delete any built-in template', async () => {
      const all = await service.findAll();
      const builtInIds = all.filter(t => t.isBuiltIn).map(t => t.id);

      for (const id of builtInIds) {
        const result = await service.delete(id);
        expect(result).toBe(false);
      }
    });
  });
});
