/**
 * Test Factories — reusable entity builders for common test data.
 *
 * Usage:
 *   import { createProject, createTask, createSchedule } from '../test-utils/factories';
 *   const project = createProject({ name: 'My Override' });
 */

let _idCounter = 0;
function nextId(prefix = 'id'): string {
  return `${prefix}-${++_idCounter}-${Date.now()}`;
}

/** Reset the internal ID counter (call in beforeEach if needed). */
export function resetFactoryIds(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface FactoryProject {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  budgetAllocated: number;
  budgetSpent: number;
  startDate: string;
  endDate: string;
  location: string;
  progressPercentage: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function createProject(overrides: Partial<FactoryProject> = {}): FactoryProject {
  return {
    id: nextId('proj'),
    name: 'Test Project',
    description: 'A test project for unit tests',
    status: 'active',
    priority: 'medium',
    budgetAllocated: 500000,
    budgetSpent: 125000,
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    location: 'New York',
    progressPercentage: 25,
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export interface FactorySchedule {
  id: string;
  projectId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export function createSchedule(overrides: Partial<FactorySchedule> = {}): FactorySchedule {
  return {
    id: nextId('sched'),
    projectId: nextId('proj'),
    name: 'Main Schedule',
    description: 'Primary project schedule',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export interface FactoryTask {
  id: string;
  scheduleId: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  startDate: string;
  endDate: string;
  estimatedDays: number;
  progressPercentage: number;
  dependency: string | null;
  dependencyType: string;
  parentTaskId: string | null;
}

export function createTask(overrides: Partial<FactoryTask> = {}): FactoryTask {
  return {
    id: nextId('task'),
    scheduleId: nextId('sched'),
    name: 'Test Task',
    description: 'A test task',
    status: 'pending',
    priority: 'medium',
    assignedTo: 'John Doe',
    startDate: '2025-02-01',
    endDate: '2025-02-15',
    estimatedDays: 10,
    progressPercentage: 0,
    dependency: null,
    dependencyType: 'FS',
    parentTaskId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export interface FactoryResource {
  id: string;
  name: string;
  role: string;
  email: string;
  capacityHoursPerWeek: number;
  skills: string[];
}

export function createResource(overrides: Partial<FactoryResource> = {}): FactoryResource {
  return {
    id: nextId('res'),
    name: 'Jane Smith',
    role: 'Developer',
    email: 'jane@example.com',
    capacityHoursPerWeek: 40,
    skills: ['javascript', 'react', 'node'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// User (for auth tests)
// ---------------------------------------------------------------------------

export interface FactoryUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: 'admin' | 'executive' | 'manager' | 'member';
}

export function createUser(overrides: Partial<FactoryUser> = {}): FactoryUser {
  return {
    id: nextId('user'),
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: '$2b$12$fake.hash.for.testing',
    role: 'manager',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

export interface FactoryBaseline {
  id: string;
  scheduleId: string;
  name: string;
  createdAt: string;
  tasks: Array<{
    taskId: string;
    taskName: string;
    startDate: string;
    endDate: string;
    progressPercentage: number;
    status: string;
  }>;
}

export function createBaseline(overrides: Partial<FactoryBaseline> = {}): FactoryBaseline {
  return {
    id: nextId('bl'),
    scheduleId: nextId('sched'),
    name: 'Baseline v1',
    createdAt: new Date().toISOString(),
    tasks: [
      {
        taskId: 'task-1',
        taskName: 'Task One',
        startDate: '2025-01-01',
        endDate: '2025-01-15',
        progressPercentage: 50,
        status: 'in_progress',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface FactoryTemplate {
  id: string;
  name: string;
  description: string;
  projectType: string;
  category: string;
  isBuiltIn: boolean;
  createdBy: string | null;
  estimatedDurationDays: number;
  tasks: Array<{
    refId: string;
    name: string;
    description: string;
    estimatedDays: number;
    priority: string;
    parentRefId: string | null;
    dependencyRefId: string | null;
    dependencyType: string;
    offsetDays: number;
    skills: string[];
    isSummary: boolean;
  }>;
  tags: string[];
  usageCount: number;
}

export function createTemplate(overrides: Partial<FactoryTemplate> = {}): FactoryTemplate {
  return {
    id: nextId('tmpl'),
    name: 'Test Template',
    description: 'A test template',
    projectType: 'it',
    category: 'development',
    isBuiltIn: false,
    createdBy: 'user-1',
    estimatedDurationDays: 90,
    tasks: [
      {
        refId: 'T1',
        name: 'Planning',
        description: 'Planning phase',
        estimatedDays: 10,
        priority: 'high',
        parentRefId: null,
        dependencyRefId: null,
        dependencyType: 'FS',
        offsetDays: 0,
        skills: ['management'],
        isSummary: false,
      },
    ],
    tags: ['test'],
    usageCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/** Create N tasks for the same schedule. */
export function createTaskBatch(
  scheduleId: string,
  count: number,
  overrides: Partial<FactoryTask> = {},
): FactoryTask[] {
  return Array.from({ length: count }, (_, i) =>
    createTask({
      scheduleId,
      name: `Task ${i + 1}`,
      startDate: `2025-0${Math.min(i + 1, 9)}-01`,
      endDate: `2025-0${Math.min(i + 1, 9)}-15`,
      ...overrides,
    }),
  );
}

/** Create a project with a schedule and tasks — a common test scenario. */
export function createProjectWithTasks(taskCount = 3) {
  const project = createProject();
  const schedule = createSchedule({ projectId: project.id });
  const tasks = createTaskBatch(schedule.id, taskCount);
  return { project, schedule, tasks };
}
