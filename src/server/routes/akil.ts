// Akil — Conversational AI Layer for PM Assistant
//
// Endpoint: POST /api/v1/akil/message
// Requires auth. Write tools require manager or admin role.
// All tool arguments are validated server-side. Model is never trusted for permissions.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';
import { aiProviderService, type AkilToolDefinition } from '../services/aiProviderService';
import { projectService } from '../services/ProjectService';
import { scheduleService } from '../services/ScheduleService';
import { logAIUsage } from '../services/aiUsageLogger';

// ---------------------------------------------------------------------------
// In-memory conversation store (MVP — no DB needed)
// ---------------------------------------------------------------------------

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Map: userId → last N messages (keep last 20 to bound token usage)
const conversationStore = new Map<string, ConversationMessage[]>();
const MAX_HISTORY = 20;

function getHistory(userId: string): ConversationMessage[] {
  return conversationStore.get(userId) ?? [];
}

function appendHistory(userId: string, messages: ConversationMessage[]): void {
  const history = getHistory(userId);
  const updated = [...history, ...messages].slice(-MAX_HISTORY);
  conversationStore.set(userId, updated);
}

function clearHistory(userId: string): void {
  conversationStore.delete(userId);
}

// ---------------------------------------------------------------------------
// Akil MVP tool definitions
// ---------------------------------------------------------------------------

const AKIL_READ_TOOLS: AkilToolDefinition[] = [
  {
    name: 'get_projects_due_today',
    description: 'Get all projects whose end date is today. Use when the user asks "what is due today?" or "what projects end today?"',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_overdue_projects',
    description: 'Get all projects that are past their end date and not yet completed or cancelled.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_projects_by_status',
    description: 'Get projects filtered by their current status.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
          description: 'The project status to filter by',
        },
      },
      required: ['status'],
    },
  },
  {
    name: 'get_all_projects',
    description: 'Get all projects with their current status, priority, and budget. Use this for general queries about projects.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_overdue_tasks',
    description: 'Get all tasks that are past their due date and not yet completed.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_high_risk_projects',
    description: 'Get projects that are at high risk: over budget, significantly overdue, or on hold.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

const AKIL_WRITE_TOOLS: AkilToolDefinition[] = [
  {
    name: 'reschedule_project',
    description: 'Move a project\'s end date to a new date. Use when asked to push back or reschedule a project deadline.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The ID of the project to reschedule' },
        newEndDate: { type: 'string', description: 'New end date in YYYY-MM-DD format' },
        reason: { type: 'string', description: 'Reason for rescheduling' },
      },
      required: ['projectId', 'newEndDate'],
    },
  },
  {
    name: 'change_project_status',
    description: 'Change the status of a project (e.g., from active to on_hold, or planning to active).',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The ID of the project to update' },
        status: {
          type: 'string',
          enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
          description: 'New project status',
        },
        reason: { type: 'string', description: 'Reason for the status change' },
      },
      required: ['projectId', 'status'],
    },
  },
  {
    name: 'assign_task',
    description: 'Assign a task to a team member by their user ID.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to assign' },
        scheduleId: { type: 'string', description: 'The schedule ID that contains this task' },
        assignedTo: { type: 'string', description: 'The user ID to assign the task to' },
      },
      required: ['taskId', 'scheduleId', 'assignedTo'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor (RBAC enforced — model is advisory only)
// ---------------------------------------------------------------------------

const WRITE_TOOL_NAMES = new Set(['reschedule_project', 'change_project_status', 'assign_task']);
const WRITE_ROLES = new Set(['admin', 'manager']);

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userRole: string,
): Promise<string> {
  // RBAC: write tools require manager or admin
  if (WRITE_TOOL_NAMES.has(toolName) && !WRITE_ROLES.has(userRole)) {
    return JSON.stringify({
      error: 'Permission denied',
      message: `The tool "${toolName}" requires manager or admin role. Your role is "${userRole}".`,
    });
  }

  try {
    switch (toolName) {
      case 'get_projects_due_today': {
        const today = new Date().toISOString().slice(0, 10);
        const projects = await projectService.findAll();
        const due = projects.filter(
          (p) =>
            p.endDate &&
            String(p.endDate).slice(0, 10) === today &&
            p.status !== 'completed' &&
            p.status !== 'cancelled',
        );
        return JSON.stringify({
          count: due.length,
          projects: due.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            priority: p.priority,
            endDate: p.endDate,
          })),
        });
      }

      case 'get_overdue_projects': {
        const today = new Date().toISOString().slice(0, 10);
        const projects = await projectService.findAll();
        const overdue = projects.filter(
          (p) =>
            p.endDate &&
            String(p.endDate).slice(0, 10) < today &&
            p.status !== 'completed' &&
            p.status !== 'cancelled',
        );
        return JSON.stringify({
          count: overdue.length,
          projects: overdue.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            priority: p.priority,
            endDate: p.endDate,
            daysOverdue: Math.floor(
              (Date.now() - new Date(p.endDate!).getTime()) / (1000 * 60 * 60 * 24),
            ),
          })),
        });
      }

      case 'get_projects_by_status': {
        const { status } = toolInput as { status: string };
        const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
          return JSON.stringify({ error: `Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}` });
        }
        const projects = await projectService.findAll();
        const filtered = projects.filter((p) => p.status === status);
        return JSON.stringify({
          status,
          count: filtered.length,
          projects: filtered.map((p) => ({
            id: p.id,
            name: p.name,
            priority: p.priority,
            endDate: p.endDate,
            budgetAllocated: p.budgetAllocated,
          })),
        });
      }

      case 'get_all_projects': {
        const projects = await projectService.findAll();
        return JSON.stringify({
          count: projects.length,
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            priority: p.priority,
            endDate: p.endDate,
            startDate: p.startDate,
            budgetAllocated: p.budgetAllocated,
            budgetSpent: p.budgetSpent,
          })),
        });
      }

      case 'get_overdue_tasks': {
        const today = new Date().toISOString().slice(0, 10);
        // Get all schedules then all tasks — bounded scan
        const projects = await projectService.findAll();
        const overdueTaskList: Array<Record<string, unknown>> = [];

        for (const project of projects) {
          const schedules = await scheduleService.findByProjectId(project.id);
          for (const schedule of schedules) {
            const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
            for (const task of tasks) {
              if (
                task.dueDate &&
                String(task.dueDate).slice(0, 10) < today &&
                task.status !== 'completed' &&
                task.status !== 'cancelled'
              ) {
                overdueTaskList.push({
                  id: task.id,
                  name: task.name,
                  status: task.status,
                  dueDate: task.dueDate,
                  projectName: project.name,
                  scheduleName: schedule.name,
                  assignedTo: task.assignedTo,
                  daysOverdue: Math.floor(
                    (Date.now() - new Date(String(task.dueDate)).getTime()) / (1000 * 60 * 60 * 24),
                  ),
                });
              }
            }
          }
        }

        return JSON.stringify({ count: overdueTaskList.length, tasks: overdueTaskList });
      }

      case 'get_high_risk_projects': {
        const today = new Date().toISOString().slice(0, 10);
        const projects = await projectService.findAll();
        const highRisk = projects.filter((p) => {
          if (p.status === 'completed' || p.status === 'cancelled') return false;
          const isOverdue = p.endDate && String(p.endDate).slice(0, 10) < today;
          const isOnHold = p.status === 'on_hold';
          const isOverBudget =
            p.budgetAllocated && p.budgetSpent > p.budgetAllocated * 0.9;
          return isOverdue || isOnHold || isOverBudget;
        });

        return JSON.stringify({
          count: highRisk.length,
          projects: highRisk.map((p) => {
            const reasons: string[] = [];
            if (p.endDate && String(p.endDate).slice(0, 10) < today) reasons.push('overdue');
            if (p.status === 'on_hold') reasons.push('on_hold');
            if (p.budgetAllocated && p.budgetSpent > p.budgetAllocated * 0.9)
              reasons.push('near/over budget');
            return {
              id: p.id,
              name: p.name,
              status: p.status,
              priority: p.priority,
              endDate: p.endDate,
              riskReasons: reasons,
              budgetUtilization:
                p.budgetAllocated
                  ? `${Math.round((p.budgetSpent / p.budgetAllocated) * 100)}%`
                  : 'N/A',
            };
          }),
        });
      }

      case 'reschedule_project': {
        const { projectId, newEndDate, reason } = toolInput as {
          projectId: string;
          newEndDate: string;
          reason?: string;
        };

        if (!projectId || typeof projectId !== 'string') {
          return JSON.stringify({ error: 'projectId is required' });
        }
        if (!newEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(newEndDate)) {
          return JSON.stringify({ error: 'newEndDate must be in YYYY-MM-DD format' });
        }

        const project = await projectService.findById(projectId);
        if (!project) {
          return JSON.stringify({ error: `Project "${projectId}" not found` });
        }

        const updated = await projectService.update(projectId, { endDate: newEndDate });
        return JSON.stringify({
          success: true,
          projectId,
          projectName: project.name,
          oldEndDate: project.endDate,
          newEndDate,
          reason: reason ?? undefined,
          message: `Project "${project.name}" rescheduled to ${newEndDate}${reason ? `. Reason: ${reason}` : ''}.`,
        });
      }

      case 'change_project_status': {
        const { projectId, status, reason } = toolInput as {
          projectId: string;
          status: string;
          reason?: string;
        };

        if (!projectId || typeof projectId !== 'string') {
          return JSON.stringify({ error: 'projectId is required' });
        }

        const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
          return JSON.stringify({ error: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}` });
        }

        const project = await projectService.findById(projectId);
        if (!project) {
          return JSON.stringify({ error: `Project "${projectId}" not found` });
        }

        await projectService.update(projectId, { status: status as any });
        return JSON.stringify({
          success: true,
          projectId,
          projectName: project.name,
          oldStatus: project.status,
          newStatus: status,
          reason: reason ?? undefined,
          message: `Project "${project.name}" status changed from "${project.status}" to "${status}"${reason ? `. Reason: ${reason}` : ''}.`,
        });
      }

      case 'assign_task': {
        const { taskId, scheduleId, assignedTo } = toolInput as {
          taskId: string;
          scheduleId: string;
          assignedTo: string;
        };

        if (!taskId || !scheduleId || !assignedTo) {
          return JSON.stringify({ error: 'taskId, scheduleId, and assignedTo are all required' });
        }

        const task = await scheduleService.findTaskById(taskId);
        if (!task) {
          return JSON.stringify({ error: `Task "${taskId}" not found` });
        }

        await scheduleService.updateTask(taskId, { assignedTo });
        return JSON.stringify({
          success: true,
          taskId,
          taskName: task.name,
          assignedTo,
          message: `Task "${task.name}" assigned to user ${assignedTo}.`,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: "${toolName}"` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: `Tool execution failed: ${message}` });
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function akilRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /message — main Akil chat endpoint
  fastify.post('/message', {
    preHandler: [requireScope('write')],
    schema: {
      description: 'Send a natural language message to Akil AI assistant',
      tags: ['akil'],
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 2000 },
          conversationId: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { message: string; conversationId?: string };
      const user = (request as any).user as { userId: string; username: string; role: string };

      if (!aiProviderService.isAvailable()) {
        return reply.code(503).send({
          error: 'Akil is unavailable',
          message:
            'No AI provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable Akil.',
        });
      }

      const userRole = user.role;
      // Provide write tools only to managers/admins
      const tools = WRITE_ROLES.has(userRole)
        ? [...AKIL_READ_TOOLS, ...AKIL_WRITE_TOOLS]
        : AKIL_READ_TOOLS;

      const today = new Date().toISOString().slice(0, 10);
      const systemPrompt = `You are Akil, an intelligent AI assistant embedded in Kovarti PM Assistant.
You help project managers and team members interact with their project data using natural language.

Today's date: ${today}
User role: ${userRole}

Your capabilities:
- Answer questions about projects, tasks, and schedules
- Identify risks, overdue items, and items due today
- For managers and admins: reschedule projects, change project status, assign tasks

Guidelines:
- Be concise and direct. Lead with the answer, then add details.
- When listing items, use bullet points or numbered lists.
- If the user asks to perform an action and you need the project ID, first look up projects by name to find it.
- Always confirm write actions after executing them.
- If you cannot find data, say so clearly instead of guessing.
- For write actions that modify data, briefly confirm what was changed.
- Do not make up project names, IDs, or data you haven't retrieved from tools.`;

      const history = getHistory(user.userId);

      let result;
      const startMs = Date.now();
      try {
        result = await aiProviderService.completeToolLoop({
          systemPrompt,
          conversationHistory: history,
          userMessage: body.message,
          tools,
          executeToolFn: async (toolName: string, toolInput: Record<string, unknown>) =>
            executeTool(toolName, toolInput, userRole),
          maxIterations: 5,
        });
      } catch (err) {
        fastify.log.error(
          { err: err instanceof Error ? err : new Error(String(err)) },
          'Akil message failed',
        );
        return reply.code(500).send({
          error: 'Failed to process message',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      const latencyMs = Date.now() - startMs;

      // Persist to conversation history
      appendHistory(user.userId, [
        { role: 'user', content: body.message },
        { role: 'assistant', content: result.finalText },
      ]);

      // Log AI usage (fire-and-forget)
      logAIUsage(fastify, {
        userId: user.userId,
        feature: 'akil-chat',
        model: result.provider === 'openai' ? 'gpt-4o-mini' : 'claude',
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
        latencyMs,
        success: true,
        requestContext: { provider: result.provider, toolsUsed: result.toolResults.length },
      });

      return {
        response: result.finalText,
        toolsUsed: result.toolResults.map((t) => t.toolName),
        provider: result.provider,
      };
    },
  });

  // DELETE /conversation — clear conversation history for current user
  fastify.delete('/conversation', {
    preHandler: [requireScope('write')],
    schema: {
      description: 'Clear Akil conversation history for the current user',
      tags: ['akil'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { userId: string };
      clearHistory(user.userId);
      return { message: 'Conversation history cleared.' };
    },
  });

  // GET /status — check if Akil is available and which provider
  fastify.get('/status', {
    preHandler: [requireScope('read')],
    schema: {
      description: 'Check Akil availability and active AI provider',
      tags: ['akil'],
    },
    handler: async (_request: FastifyRequest, _reply: FastifyReply) => {
      const provider = aiProviderService.getProvider();
      return {
        available: provider !== 'none',
        provider,
        model: provider === 'openai' ? 'gpt-4o-mini' : provider === 'anthropic' ? 'claude' : null,
      };
    },
  });
}
