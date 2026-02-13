import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config BEFORE any imports that depend on it
// ---------------------------------------------------------------------------
vi.mock('../../config', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars-long',
    COOKIE_SECRET: 'test-cookie-secret-that-is-at-least-32-chars-long',
    NODE_ENV: 'development',
    CORS_ORIGIN: 'http://localhost:5173',
    LOG_LEVEL: 'error',
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
    WEATHER_API_PROVIDER: 'mock',
    WEATHER_API_KEY: '',
    WEATHER_CACHE_MINUTES: 30,
  },
}));

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------
vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
    query: vi.fn(),
    getPool: vi.fn(),
    transaction: vi.fn(),
    setConnected: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock logger utilities (avoid file-system side effects)
// ---------------------------------------------------------------------------
vi.mock('../../utils/logger', () => ({
  requestLogger: (_req: any, _reply: any, done: any) => done(),
  errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock audit service
// ---------------------------------------------------------------------------
vi.mock('../../services/auditService', () => ({
  auditService: {
    logSystemEvent: vi.fn(),
    logUserEvent: vi.fn(),
    getEvents: vi.fn().mockReturnValue([]),
  },
}));

// ---------------------------------------------------------------------------
// Module-level mutable mock return values
// ---------------------------------------------------------------------------

// ProjectService
let mockProjectFindByUserIdResult: any[] = [];
let mockProjectFindByIdResult: any = null;
let mockProjectCreateResult: any = null;
let mockProjectUpdateResult: any = null;
let mockProjectDeleteResult: boolean = true;

vi.mock('../../services/ProjectService', () => ({
  ProjectService: class {
    async findByUserId(_userId: string) { return mockProjectFindByUserIdResult; }
    async findById(id: string, _userId?: string) { return mockProjectFindByIdResult; }
    async findAll() { return mockProjectFindByUserIdResult; }
    async create(data: any) {
      return mockProjectCreateResult ?? {
        id: 'proj-new',
        name: data.name,
        description: data.description,
        projectType: data.projectType || 'other',
        status: data.status || 'planning',
        priority: data.priority || 'medium',
        budgetSpent: 0,
        currency: data.currency || 'USD',
        createdBy: data.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    async update(id: string, data: any, _userId?: string) { return mockProjectUpdateResult; }
    async delete(id: string, _userId?: string) { return mockProjectDeleteResult; }
  },
}));

// ScheduleService
let mockScheduleFindByProjectIdResult: any[] = [];
let mockScheduleFindByIdResult: any = null;
let mockScheduleCreateResult: any = null;
let mockScheduleTasksResult: any[] = [];
let mockScheduleCreateTaskResult: any = null;
let mockScheduleFindTaskByIdResult: any = null;
let mockScheduleGetCommentsResult: any[] = [];
let mockScheduleAddCommentResult: any = null;

vi.mock('../../services/ScheduleService', () => ({
  ScheduleService: class {
    async findByProjectId(_projectId: string) { return mockScheduleFindByProjectIdResult; }
    async findById(_id: string) { return mockScheduleFindByIdResult; }
    async create(data: any) {
      return mockScheduleCreateResult ?? {
        id: 'sched-new',
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
    async update(_id: string, _data: any) { return null; }
    async delete(_id: string) { return false; }
    async findTasksByScheduleId(_scheduleId: string) { return mockScheduleTasksResult; }
    async createTask(data: any) {
      return mockScheduleCreateTaskResult ?? {
        id: 'task-new',
        scheduleId: data.scheduleId,
        name: data.name,
        status: data.status || 'pending',
        priority: data.priority || 'medium',
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    async updateTask(_id: string, _data: any) { return null; }
    async deleteTask(_id: string) { return false; }
    async findTaskById(_id: string) { return mockScheduleFindTaskByIdResult; }
    async cascadeReschedule() { return { affectedTasks: [] }; }
    getComments(_taskId: string) { return mockScheduleGetCommentsResult; }
    addComment(taskId: string, text: string, userId: string, userName: string) {
      return mockScheduleAddCommentResult ?? {
        id: 'comment-new',
        taskId,
        text,
        userId,
        userName,
        createdAt: new Date().toISOString(),
      };
    }
    deleteComment(_id: string) { return false; }
    getActivities(_taskId: string) { return []; }
  },
}));

// ResourceService
let mockResourceFindAllResult: any[] = [];
let mockResourceCreateResult: any = null;

vi.mock('../../services/ResourceService', () => ({
  ResourceService: class {
    async findAllResources() { return mockResourceFindAllResult; }
    async createResource(data: any) {
      return mockResourceCreateResult ?? {
        id: 'res-new',
        name: data.name,
        role: data.role,
        email: data.email,
        capacityHoursPerWeek: data.capacityHoursPerWeek ?? 40,
        skills: data.skills ?? [],
        isActive: data.isActive ?? true,
      };
    }
    async updateResource(_id: string, _data: any) { return null; }
    async deleteResource(_id: string) { return false; }
    async findAssignmentsBySchedule(_scheduleId: string) { return []; }
    async createAssignment(_data: any) { return {}; }
    async deleteAssignment(_id: string) { return false; }
    async computeWorkload(_projectId: string) { return []; }
  },
}));

// TemplateService
let mockTemplateFindAllResult: any[] = [];
let mockTemplateFindByIdResult: any = null;

vi.mock('../../services/TemplateService', () => ({
  TemplateService: class {
    async findAll(_projectType?: string, _category?: string) { return mockTemplateFindAllResult; }
    async findById(id: string) { return mockTemplateFindByIdResult; }
    async create(data: any) { return { id: 'tpl-new', ...data }; }
    async update(_id: string, _data: any) { return null; }
    async delete(_id: string) { return false; }
    async applyTemplate(_data: any) { return { project: {}, schedule: {}, tasks: [] }; }
    async saveFromProject(_data: any) { return {}; }
  },
}));

// WorkflowService
let mockWorkflowFindAllResult: any[] = [];

vi.mock('../../services/WorkflowService', () => ({
  WorkflowService: class {
    findAll() { return mockWorkflowFindAllResult; }
    create(data: any) { return { id: 'wf-new', ...data }; }
    update(_id: string, _data: any) { return null; }
    delete(_id: string) { return false; }
    evaluateTaskChange() { /* no-op */ }
    getExecutions() { return []; }
  },
}));

// WebSocketService
vi.mock('../../services/WebSocketService', () => ({
  WebSocketService: {
    broadcast: vi.fn(),
    addClient: vi.fn(),
  },
}));

// CriticalPathService
vi.mock('../../services/CriticalPathService', () => ({
  CriticalPathService: class {
    async calculateCriticalPath(_scheduleId: string) { return { criticalPath: [], totalDuration: 0 }; }
  },
}));

// BaselineService
vi.mock('../../services/BaselineService', () => ({
  BaselineService: class {
    async findByScheduleId(_scheduleId: string) { return []; }
    async create(_scheduleId: string, _name: string, _userId: string) { return { id: 'bl-1' }; }
    async compareBaseline(_id: string) { return null; }
    async delete(_id: string) { return false; }
  },
}));

// Template schemas (imported by template routes)
vi.mock('../../schemas/templateSchemas', () => ({
  createFromTemplateSchema: {
    parse: (data: any) => data,
  },
  saveAsTemplateSchema: {
    parse: (data: any) => data,
  },
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks are defined)
// ---------------------------------------------------------------------------
import Fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import jwt from 'jsonwebtoken';
import { projectRoutes } from '../projects';
import { scheduleRoutes } from '../schedules';
import { resourceRoutes } from '../resources';
import { templateRoutes } from '../templates';
import { workflowRoutes } from '../workflows';
import { authMiddleware } from '../../middleware/auth';

// ---------------------------------------------------------------------------
// JWT tokens
// ---------------------------------------------------------------------------
const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

const validToken = jwt.sign(
  { userId: '1', username: 'testuser', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '15m' },
);

const expiredToken = jwt.sign(
  { userId: '1', username: 'testuser', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '-1s' },
);

const authHeaders = { cookie: `access_token=${validToken}` };

// ---------------------------------------------------------------------------
// Fastify app setup
// ---------------------------------------------------------------------------
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  await app.register(fastifyCookie, {
    secret: 'test-cookie-secret-that-is-at-least-32-chars-long',
  });

  // Register a global preHandler that parses the user from the cookie when present
  // (mirrors what the real app does via authMiddleware on specific routes).
  // The route-level preHandler: [authMiddleware] will reject missing tokens
  // on protected routes; this hook simply decodes the token on all routes
  // so that non-protected routes can still access request.user when available.
  app.addHook('preHandler', async (request, _reply) => {
    try {
      const token = request.cookies?.access_token;
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        (request as any).user = {
          userId: decoded.userId,
          username: decoded.username,
          role: decoded.role,
        };
      }
    } catch {
      // silently ignore -- route-level authMiddleware will enforce where needed
    }
  });

  await app.register(projectRoutes, { prefix: '/api/v1/projects' });
  await app.register(scheduleRoutes, { prefix: '/api/v1/schedules' });
  await app.register(resourceRoutes, { prefix: '/api/v1/resources' });
  await app.register(templateRoutes, { prefix: '/api/v1/templates' });
  await app.register(workflowRoutes, { prefix: '/api/v1/workflows' });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// Reset mock return values before each test
beforeEach(() => {
  // Projects
  mockProjectFindByUserIdResult = [];
  mockProjectFindByIdResult = null;
  mockProjectCreateResult = null;
  mockProjectUpdateResult = null;
  mockProjectDeleteResult = true;

  // Schedules
  mockScheduleFindByProjectIdResult = [];
  mockScheduleFindByIdResult = null;
  mockScheduleCreateResult = null;
  mockScheduleTasksResult = [];
  mockScheduleCreateTaskResult = null;
  mockScheduleFindTaskByIdResult = null;
  mockScheduleGetCommentsResult = [];
  mockScheduleAddCommentResult = null;

  // Resources
  mockResourceFindAllResult = [];
  mockResourceCreateResult = null;

  // Templates
  mockTemplateFindAllResult = [];
  mockTemplateFindByIdResult = null;

  // Workflows
  mockWorkflowFindAllResult = [];
});

// ===========================================================================
// PROJECT ROUTES
// ===========================================================================
describe('Projects routes', () => {
  it('GET /api/v1/projects returns 200 with projects array', async () => {
    mockProjectFindByUserIdResult = [
      { id: '1', name: 'Project Alpha', status: 'active', projectType: 'it', priority: 'high', budgetSpent: 0, currency: 'USD', createdBy: '1', createdAt: new Date(), updatedAt: new Date() },
      { id: '2', name: 'Project Beta', status: 'planning', projectType: 'other', priority: 'medium', budgetSpent: 0, currency: 'USD', createdBy: '1', createdAt: new Date(), updatedAt: new Date() },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projects).toBeDefined();
    expect(Array.isArray(body.projects)).toBe(true);
    expect(body.projects).toHaveLength(2);
    expect(body.projects[0].name).toBe('Project Alpha');
  });

  it('GET /api/v1/projects/:id returns 200 with a project', async () => {
    mockProjectFindByIdResult = {
      id: '1',
      name: 'Project Alpha',
      status: 'active',
      projectType: 'it',
      priority: 'high',
      budgetSpent: 0,
      currency: 'USD',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/1',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.project).toBeDefined();
    expect(body.project.id).toBe('1');
    expect(body.project.name).toBe('Project Alpha');
  });

  it('GET /api/v1/projects/:id returns 404 when project not found', async () => {
    mockProjectFindByIdResult = null;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/nonexistent',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Project not found');
  });

  it('POST /api/v1/projects returns 201 and creates a project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: {
        name: 'New Project',
        description: 'A test project',
        projectType: 'it',
        status: 'planning',
        priority: 'medium',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.project).toBeDefined();
    expect(body.project.name).toBe('New Project');
  });

  it('PUT /api/v1/projects/:id returns 200 and updates a project', async () => {
    mockProjectUpdateResult = {
      id: '1',
      name: 'Updated Project',
      status: 'active',
      projectType: 'it',
      priority: 'high',
      budgetSpent: 0,
      currency: 'USD',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/projects/1',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Updated Project',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.project).toBeDefined();
    expect(body.project.name).toBe('Updated Project');
  });

  it('DELETE /api/v1/projects/:id returns 200 and deletes a project', async () => {
    mockProjectDeleteResult = true;

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/projects/1',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toBe('Project deleted successfully');
  });

  it('POST /api/v1/projects without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        name: 'Unauthorized Project',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('No access token');
  });
});

// ===========================================================================
// SCHEDULE ROUTES
// ===========================================================================
describe('Schedules routes', () => {
  it('GET /api/v1/schedules/project/:projectId returns 200 with schedules', async () => {
    mockScheduleFindByProjectIdResult = [
      { id: 'sched-1', projectId: 'proj-1', name: 'Main Schedule', status: 'active', startDate: new Date(), endDate: new Date(), createdBy: '1', createdAt: new Date(), updatedAt: new Date() },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/schedules/project/proj-1',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.schedules).toBeDefined();
    expect(Array.isArray(body.schedules)).toBe(true);
    expect(body.schedules).toHaveLength(1);
    expect(body.schedules[0].name).toBe('Main Schedule');
  });

  it('POST /api/v1/schedules returns 201 and creates a schedule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: {
        projectId: 'proj-1',
        name: 'New Schedule',
        startDate: '2026-03-01',
        endDate: '2026-06-30',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.schedule).toBeDefined();
    expect(body.schedule.name).toBe('New Schedule');
  });

  it('GET /api/v1/schedules/:id/tasks returns 200 with tasks', async () => {
    mockScheduleTasksResult = [
      { id: 'task-1', scheduleId: 'sched-1', name: 'Design Phase', status: 'pending', priority: 'high', createdBy: '1', createdAt: new Date(), updatedAt: new Date() },
      { id: 'task-2', scheduleId: 'sched-1', name: 'Development', status: 'in_progress', priority: 'medium', createdBy: '1', createdAt: new Date(), updatedAt: new Date() },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/schedules/sched-1/tasks',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tasks).toBeDefined();
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(body.tasks).toHaveLength(2);
  });

  it('POST /api/v1/schedules/:id/tasks returns 201 and creates a task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules/sched-1/tasks',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: {
        name: 'New Task',
        status: 'pending',
        priority: 'high',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.task).toBeDefined();
    expect(body.task.name).toBe('New Task');
  });
});

// ===========================================================================
// RESOURCE ROUTES
// ===========================================================================
describe('Resources routes', () => {
  it('GET /api/v1/resources returns 200 with resources array', async () => {
    mockResourceFindAllResult = [
      { id: 'res-1', name: 'Alice Chen', role: 'Project Manager', email: 'alice@example.com', capacityHoursPerWeek: 40, skills: ['Planning'], isActive: true },
      { id: 'res-2', name: 'Bob Martinez', role: 'Lead Engineer', email: 'bob@example.com', capacityHoursPerWeek: 40, skills: ['Engineering'], isActive: true },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resources',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resources).toBeDefined();
    expect(Array.isArray(body.resources)).toBe(true);
    expect(body.resources).toHaveLength(2);
    expect(body.resources[0].name).toBe('Alice Chen');
  });

  it('POST /api/v1/resources returns 201 and creates a resource', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resources',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: {
        name: 'New Resource',
        role: 'Developer',
        email: 'new@example.com',
        capacityHoursPerWeek: 40,
        skills: ['JavaScript'],
        isActive: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.resource).toBeDefined();
    expect(body.resource.name).toBe('New Resource');
    expect(body.resource.role).toBe('Developer');
  });

  it('GET /api/v1/resources without auth still returns 200 (no auth required on GET)', async () => {
    // Resource GET routes do not have authMiddleware, so they should work without auth
    mockResourceFindAllResult = [
      { id: 'res-1', name: 'Alice', role: 'PM', email: 'a@e.com', capacityHoursPerWeek: 40, skills: [], isActive: true },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resources',
      // No auth headers
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resources).toBeDefined();
  });
});

// ===========================================================================
// TEMPLATE ROUTES
// ===========================================================================
describe('Templates routes', () => {
  it('GET /api/v1/templates returns 200 with templates array', async () => {
    mockTemplateFindAllResult = [
      {
        id: 'tpl-1',
        name: 'Web App Template',
        description: 'Full-stack web app',
        projectType: 'it',
        category: 'web_development',
        isBuiltIn: true,
        estimatedDurationDays: 90,
        tasks: [
          { refId: 'plan', name: 'Planning', isSummary: true },
          { refId: 'dev', name: 'Development', isSummary: false },
        ],
        tags: ['web'],
        usageCount: 5,
      },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/templates',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.templates).toBeDefined();
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates).toHaveLength(1);
    // The route returns summaries without the full task array
    expect(body.templates[0].name).toBe('Web App Template');
    expect(body.templates[0].taskCount).toBe(2);
    expect(body.templates[0].phaseCount).toBe(1);
  });

  it('GET /api/v1/templates/:id returns 200 with a single template', async () => {
    mockTemplateFindByIdResult = {
      id: 'tpl-1',
      name: 'Web App Template',
      description: 'Full-stack web app',
      projectType: 'it',
      category: 'web_development',
      isBuiltIn: true,
      estimatedDurationDays: 90,
      tasks: [{ refId: 'plan', name: 'Planning', isSummary: true }],
      tags: ['web'],
      usageCount: 5,
    };

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/templates/tpl-1',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.template).toBeDefined();
    expect(body.template.id).toBe('tpl-1');
    expect(body.template.name).toBe('Web App Template');
  });

  it('GET /api/v1/templates/:id returns 404 when template not found', async () => {
    mockTemplateFindByIdResult = null;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/templates/nonexistent',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Template not found');
  });
});

// ===========================================================================
// WORKFLOW ROUTES
// ===========================================================================
describe('Workflows routes', () => {
  it('GET /api/v1/workflows returns 200 with rules array', async () => {
    mockWorkflowFindAllResult = [
      { id: 'wf-1', name: 'Auto-complete on 100%', enabled: true, trigger: { type: 'progress_threshold' }, action: { type: 'update_field' } },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/workflows',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rules).toBeDefined();
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].name).toBe('Auto-complete on 100%');
  });

  it('POST /api/v1/workflows returns 201 and creates a workflow rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: {
        name: 'New Rule',
        enabled: true,
        trigger: { type: 'status_change', fromStatus: 'pending', toStatus: 'in_progress' },
        action: { type: 'log_activity', message: 'Task started' },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.rule).toBeDefined();
    expect(body.rule.name).toBe('New Rule');
  });
});

// ===========================================================================
// AUTH ENFORCEMENT TESTS
// ===========================================================================
describe('Auth enforcement', () => {
  it('returns 401 when token is missing on protected project POST', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        'content-type': 'application/json',
      },
      payload: { name: 'Unauthorized' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('No access token');
    expect(body.message).toBe('Access token is required');
  });

  it('returns 401 when token is expired', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        cookie: `access_token=${expiredToken}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Expired Token Project' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('Invalid token');
    expect(body.message).toBe('Access token is invalid or expired');
  });

  it('returns 401 when token is signed with wrong secret', async () => {
    const invalidToken = jwt.sign(
      { userId: '1', username: 'testuser', role: 'admin' },
      'wrong-secret-key-that-is-at-least-32-chars-long!',
      { expiresIn: '15m' },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        cookie: `access_token=${invalidToken}`,
        'content-type': 'application/json',
      },
      payload: { name: 'Invalid Token Project' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('Invalid token');
  });

  it('returns 401 when token is missing on protected PUT', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/projects/1',
      headers: {
        'content-type': 'application/json',
      },
      payload: { name: 'Unauthorized Update' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('No access token');
  });

  it('returns 401 when token is missing on protected DELETE', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/projects/1',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('No access token');
  });

  it('returns 401 when token is missing on protected template POST', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/templates',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        name: 'Unauthorized Template',
        description: 'test',
        projectType: 'it',
        category: 'test',
        estimatedDurationDays: 30,
        tasks: [],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('No access token');
  });
});

// ===========================================================================
// EDGE CASES & ADDITIONAL COVERAGE
// ===========================================================================
describe('Edge cases', () => {
  it('DELETE /api/v1/projects/:id returns 404 when project does not exist', async () => {
    mockProjectDeleteResult = false;

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/projects/nonexistent',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Project not found');
  });

  it('PUT /api/v1/projects/:id returns 404 when project does not exist', async () => {
    mockProjectUpdateResult = null;

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/projects/nonexistent',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: { name: 'Ghost Project' },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Project not found');
  });

  it('GET /api/v1/projects returns empty array when no projects exist', async () => {
    mockProjectFindByUserIdResult = [];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projects).toEqual([]);
  });

  it('GET /api/v1/schedules/project/:projectId returns empty when no schedules', async () => {
    mockScheduleFindByProjectIdResult = [];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/schedules/project/nonexistent',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.schedules).toEqual([]);
  });
});
