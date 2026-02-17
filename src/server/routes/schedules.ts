import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { projectIdParam, scheduleIdParam, scheduleAndTaskIdParam, scheduleAndBaselineIdParam, scheduleTaskCommentIdParam } from '../schemas/commonSchemas';
import { ScheduleService } from '../services/ScheduleService';
import { CriticalPathService } from '../services/CriticalPathService';
import { BaselineService } from '../services/BaselineService';
import { WorkflowService } from '../services/WorkflowService';
import { WebSocketService } from '../services/WebSocketService';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess, verifyScheduleAccess } from '../middleware/authorize';

const createScheduleSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

const createTaskSchema = z.object({
  scheduleId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignedTo: z.string().optional(),
  dueDate: z.string().date().optional(),
  estimatedDays: z.number().positive().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
  dependency: z.string().optional(),
  risks: z.string().optional(),
  issues: z.string().optional(),
  comments: z.string().optional(),
  parentTaskId: z.string().optional(),
});

const updateTaskSchema = createTaskSchema.partial().omit({ scheduleId: true });

export async function scheduleRoutes(fastify: FastifyInstance) {
  const scheduleService = new ScheduleService();
  const workflowService = new WorkflowService();

  fastify.get('/project/:projectId', {
    preHandler: [authMiddleware],
    schema: { description: 'Get schedules for a project', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const project = await verifyProjectAccess(projectId, request.user.userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
      const schedules = await scheduleService.findByProjectId(projectId);
      return { schedules };
    } catch (error) {
      request.log.error({ err: error }, 'Get schedules error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch schedules' });
    }
  });

  fastify.post('/', {
    preHandler: [authMiddleware],
    schema: { description: 'Create a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createScheduleSchema.parse(request.body);
      const project = await verifyProjectAccess(data.projectId, request.user.userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
      const schedule = await scheduleService.create({
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        createdBy: request.user.userId,
      });
      return reply.status(201).send({ schedule });
    } catch (error) {
      request.log.error({ err: error }, 'Create schedule error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create schedule' });
    }
  });

  fastify.put('/:scheduleId', {
    preHandler: [authMiddleware],
    schema: { description: 'Update a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const existing = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!existing) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const data = createScheduleSchema.partial().parse(request.body);
      const schedule = await scheduleService.update(scheduleId, {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      });
      if (!schedule) return reply.status(404).send({ error: 'Not found', message: 'Schedule not found' });
      return { schedule };
    } catch (error) {
      request.log.error({ err: error }, 'Update schedule error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update schedule' });
    }
  });

  fastify.delete('/:scheduleId', {
    preHandler: [authMiddleware],
    schema: { description: 'Delete a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const existing = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!existing) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const deleted = await scheduleService.delete(scheduleId);
      if (!deleted) return reply.status(404).send({ error: 'Not found', message: 'Schedule not found' });
      return { message: 'Schedule deleted successfully' };
    } catch (error) {
      request.log.error({ err: error }, 'Delete schedule error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete schedule' });
    }
  });

  fastify.get('/:scheduleId/tasks', {
    preHandler: [authMiddleware],
    schema: { description: 'Get tasks for a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const tasks = await scheduleService.findTasksByScheduleId(scheduleId);
      return { tasks };
    } catch (error) {
      request.log.error({ err: error }, 'Get tasks error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch tasks' });
    }
  });

  fastify.post('/:scheduleId/tasks', {
    preHandler: [authMiddleware],
    schema: { description: 'Create a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const data = createTaskSchema.omit({ scheduleId: true }).parse(request.body);
      const task = await scheduleService.createTask({
        scheduleId,
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        createdBy: request.user.userId,
      });
      WebSocketService.broadcast({ type: 'task_created', payload: { task } });
      return reply.status(201).send({ task });
    } catch (error) {
      request.log.error({ err: error }, 'Create task error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create task' });
    }
  });

  fastify.put('/:scheduleId/tasks/:taskId', {
    preHandler: [authMiddleware],
    schema: { description: 'Update a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, taskId } = scheduleAndTaskIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const data = updateTaskSchema.parse(request.body);

      // Capture old end date before update for cascade detection
      const oldTask = await scheduleService.findTaskById(taskId);
      if (!oldTask) return reply.status(404).send({ error: 'Not found', message: 'Task not found' });

      const oldEndDate = oldTask.endDate ? new Date(oldTask.endDate) : null;

      const task = await scheduleService.updateTask(taskId, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      });
      if (!task) return reply.status(404).send({ error: 'Not found', message: 'Task not found' });

      // Auto-scheduling: cascade date changes to downstream tasks
      let cascadedChanges = null;
      const newEndDate = data.endDate ? new Date(data.endDate) : null;
      if (oldEndDate && newEndDate && oldEndDate.getTime() !== newEndDate.getTime()) {
        const result = await scheduleService.cascadeReschedule(taskId, oldEndDate, newEndDate);
        if (result.affectedTasks.length > 0) {
          cascadedChanges = result;
        }
      }

      // Workflow automation: evaluate rules
      workflowService.evaluateTaskChange(task, oldTask, scheduleService);

      // WebSocket broadcast
      WebSocketService.broadcast({ type: 'task_updated', payload: { task, cascadedChanges } });

      return { task, cascadedChanges };
    } catch (error) {
      request.log.error({ err: error }, 'Update task error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update task' });
    }
  });

  fastify.delete('/:scheduleId/tasks/:taskId', {
    preHandler: [authMiddleware],
    schema: { description: 'Delete a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, taskId } = scheduleAndTaskIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const deleted = await scheduleService.deleteTask(taskId);
      if (!deleted) return reply.status(404).send({ error: 'Not found', message: 'Task not found' });
      WebSocketService.broadcast({ type: 'task_deleted', payload: { taskId } });
      return { message: 'Task deleted successfully' };
    } catch (error) {
      request.log.error({ err: error }, 'Delete task error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete task' });
    }
  });

  // -------------------------------------------------------------------------
  // Critical Path
  // -------------------------------------------------------------------------

  const cpmService = new CriticalPathService();

  fastify.get('/:scheduleId/critical-path', {
    preHandler: [authMiddleware],
    schema: { description: 'Get critical path analysis', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const result = await cpmService.calculateCriticalPath(scheduleId);
      return result;
    } catch (error) {
      request.log.error({ err: error }, 'Critical path error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to compute critical path' });
    }
  });

  // -------------------------------------------------------------------------
  // Baselines
  // -------------------------------------------------------------------------

  const baselineService = new BaselineService();

  fastify.get('/:scheduleId/baselines', {
    preHandler: [authMiddleware],
    schema: { description: 'Get baselines for a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const baselines = await baselineService.findByScheduleId(scheduleId);
      return { baselines };
    } catch (error) {
      request.log.error({ err: error }, 'Get baselines error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch baselines' });
    }
  });

  fastify.get('/:scheduleId/baselines/:baselineId/compare', {
    preHandler: [authMiddleware],
    schema: { description: 'Compare baseline vs current schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, baselineId } = scheduleAndBaselineIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const comparison = await baselineService.compareBaseline(baselineId);
      if (!comparison) return reply.status(404).send({ error: 'Baseline not found' });
      return { comparison };
    } catch (error) {
      request.log.error({ err: error }, 'Baseline comparison error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to compare baseline' });
    }
  });

  fastify.delete('/:scheduleId/baselines/:baselineId', {
    preHandler: [authMiddleware],
    schema: { description: 'Delete a baseline', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, baselineId } = scheduleAndBaselineIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const deleted = await baselineService.delete(baselineId);
      if (!deleted) return reply.status(404).send({ error: 'Baseline not found' });
      return { message: 'Baseline deleted successfully' };
    } catch (error) {
      request.log.error({ err: error }, 'Delete baseline error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete baseline' });
    }
  });

  fastify.post('/:scheduleId/baselines', {
    preHandler: [authMiddleware],
    schema: { description: 'Create a baseline snapshot', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const { name } = z.object({ name: z.string().min(1).max(255).optional() }).parse(request.body);
      const baseline = await baselineService.create(
        scheduleId,
        name || `Baseline ${new Date().toLocaleDateString()}`,
        request.user.userId,
      );
      return reply.status(201).send({ baseline });
    } catch (error) {
      request.log.error({ err: error }, 'Create baseline error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create baseline' });
    }
  });

  // -------------------------------------------------------------------------
  // Comments & Activity
  // -------------------------------------------------------------------------

  fastify.get('/:scheduleId/tasks/:taskId/comments', {
    preHandler: [authMiddleware],
    schema: { description: 'Get comments for a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, taskId } = scheduleAndTaskIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const comments = scheduleService.getComments(taskId);
      return { comments };
    } catch (error) {
      request.log.error({ err: error }, 'Get comments error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch comments' });
    }
  });

  fastify.post('/:scheduleId/tasks/:taskId/comments', {
    preHandler: [authMiddleware],
    schema: { description: 'Add a comment to a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, taskId } = scheduleAndTaskIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const { text } = z.object({ text: z.string().min(1).max(10000) }).parse(request.body);
      const comment = scheduleService.addComment(taskId, text.trim(), request.user.userId, request.user.username || 'Project Manager');
      return reply.status(201).send({ comment });
    } catch (error) {
      request.log.error({ err: error }, 'Add comment error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to add comment' });
    }
  });

  fastify.delete('/:scheduleId/tasks/:taskId/comments/:commentId', {
    preHandler: [authMiddleware],
    schema: { description: 'Delete a comment', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, commentId } = scheduleTaskCommentIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const deleted = scheduleService.deleteComment(commentId);
      if (!deleted) return reply.status(404).send({ error: 'Comment not found' });
      return { message: 'Comment deleted' };
    } catch (error) {
      request.log.error({ err: error }, 'Delete comment error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete comment' });
    }
  });

  fastify.get('/:scheduleId/tasks/:taskId/activity', {
    preHandler: [authMiddleware],
    schema: { description: 'Get activity feed for a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId, taskId } = scheduleAndTaskIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });
      const activities = scheduleService.getActivities(taskId);
      return { activities };
    } catch (error) {
      request.log.error({ err: error }, 'Get activity error');
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch activity' });
    }
  });
}
