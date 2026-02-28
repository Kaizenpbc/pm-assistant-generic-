import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ScheduleService } from '../services/ScheduleService';
import { CriticalPathService } from '../services/CriticalPathService';
import { BaselineService } from '../services/BaselineService';
import { WorkflowService } from '../services/WorkflowService';
import { WebSocketService } from '../services/WebSocketService';
import { webhookService } from '../services/WebhookService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

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
  fastify.addHook('preHandler', authMiddleware);

  const scheduleService = new ScheduleService();
  const workflowService = new WorkflowService();

  fastify.get('/project/:projectId', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get schedules for a project', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const schedules = await scheduleService.findByProjectId(projectId);
      return { schedules };
    } catch (error) {
      console.error('Get schedules error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch schedules' });
    }
  });

  fastify.post('/', {
    preHandler: [requireScope('write')],
    schema: { description: 'Create a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const data = createScheduleSchema.parse(request.body);
      const schedule = await scheduleService.create({
        ...data,
        createdBy: user.userId,
      });
      return reply.status(201).send({ schedule });
    } catch (error) {
      console.error('Create schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create schedule' });
    }
  });

  fastify.put('/:scheduleId', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const data = createScheduleSchema.partial().parse(request.body);
      const schedule = await scheduleService.update(scheduleId, {
        ...data,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      });
      if (!schedule) return reply.status(404).send({ error: 'Not found', message: 'Schedule not found' });
      return { schedule };
    } catch (error) {
      console.error('Update schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update schedule' });
    }
  });

  fastify.delete('/:scheduleId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Delete a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const deleted = await scheduleService.delete(scheduleId);
      if (!deleted) return reply.status(404).send({ error: 'Not found', message: 'Schedule not found' });
      return { message: 'Schedule deleted successfully' };
    } catch (error) {
      console.error('Delete schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete schedule' });
    }
  });

  fastify.get('/:scheduleId/tasks', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get tasks for a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const tasks = await scheduleService.findTasksByScheduleId(scheduleId);
      return { tasks };
    } catch (error) {
      console.error('Get tasks error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch tasks' });
    }
  });

  fastify.post('/:scheduleId/tasks', {
    preHandler: [requireScope('write')],
    schema: { description: 'Create a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { scheduleId } = request.params as { scheduleId: string };
      const data = createTaskSchema.omit({ scheduleId: true }).parse(request.body);
      const task = await scheduleService.createTask({
        scheduleId,
        ...data,
        dueDate: data.dueDate || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        createdBy: user.userId,
      });
      WebSocketService.broadcast({ type: 'task_created', payload: { task } });
      webhookService.dispatch('task.created', { task }, user?.userId);
      return reply.status(201).send({ task });
    } catch (error) {
      console.error('Create task error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create task' });
    }
  });

  fastify.put('/:scheduleId/tasks/:taskId', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const data = updateTaskSchema.parse(request.body);

      // Capture old end date before update for cascade detection
      const oldTask = await scheduleService.findTaskById(taskId);
      if (!oldTask) return reply.status(404).send({ error: 'Not found', message: 'Task not found' });

      const oldEndDate = oldTask.endDate ? new Date(oldTask.endDate) : null;

      const task = await scheduleService.updateTask(taskId, {
        ...data,
        dueDate: data.dueDate || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
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
      await workflowService.evaluateTaskChange(task, oldTask, scheduleService);

      // WebSocket broadcast
      WebSocketService.broadcast({ type: 'task_updated', payload: { task, cascadedChanges } });
      const user = (request as any).user;
      webhookService.dispatch('task.updated', { task, cascadedChanges }, user?.userId);

      return { task, cascadedChanges };
    } catch (error) {
      console.error('Update task error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update task' });
    }
  });

  fastify.delete('/:scheduleId/tasks/:taskId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Delete a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const deleted = await scheduleService.deleteTask(taskId);
      if (!deleted) return reply.status(404).send({ error: 'Not found', message: 'Task not found' });
      WebSocketService.broadcast({ type: 'task_deleted', payload: { taskId } });
      const user = (request as any).user;
      webhookService.dispatch('task.deleted', { taskId }, user?.userId);
      return { message: 'Task deleted successfully' };
    } catch (error) {
      console.error('Delete task error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete task' });
    }
  });

  // -------------------------------------------------------------------------
  // Critical Path
  // -------------------------------------------------------------------------

  const cpmService = new CriticalPathService();

  fastify.get('/:scheduleId/critical-path', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get critical path analysis', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const result = await cpmService.calculateCriticalPath(scheduleId);
      return result;
    } catch (error) {
      console.error('Critical path error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to compute critical path' });
    }
  });

  // -------------------------------------------------------------------------
  // Baselines
  // -------------------------------------------------------------------------

  const baselineService = new BaselineService();

  fastify.get('/:scheduleId/baselines', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get baselines for a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const baselines = await baselineService.findByScheduleId(scheduleId);
      return { baselines };
    } catch (error) {
      console.error('Get baselines error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch baselines' });
    }
  });

  fastify.get('/:scheduleId/baselines/:baselineId/compare', {
    preHandler: [requireScope('read')],
    schema: { description: 'Compare baseline vs current schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { baselineId } = request.params as { baselineId: string };
      const comparison = await baselineService.compareBaseline(baselineId);
      if (!comparison) return reply.status(404).send({ error: 'Baseline not found' });
      return { comparison };
    } catch (error) {
      console.error('Baseline comparison error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to compare baseline' });
    }
  });

  fastify.delete('/:scheduleId/baselines/:baselineId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Delete a baseline', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { baselineId } = request.params as { baselineId: string };
      const deleted = await baselineService.delete(baselineId);
      if (!deleted) return reply.status(404).send({ error: 'Baseline not found' });
      return { message: 'Baseline deleted successfully' };
    } catch (error) {
      console.error('Delete baseline error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete baseline' });
    }
  });

  fastify.post('/:scheduleId/baselines', {
    preHandler: [requireScope('write')],
    schema: { description: 'Create a baseline snapshot', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { scheduleId } = request.params as { scheduleId: string };
      const { name } = (request.body as { name?: string }) || {};
      const baseline = await baselineService.create(
        scheduleId,
        name || `Baseline ${new Date().toLocaleDateString()}`,
        user.userId,
      );
      return reply.status(201).send({ baseline });
    } catch (error) {
      console.error('Create baseline error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create baseline' });
    }
  });

  // -------------------------------------------------------------------------
  // Comments & Activity
  // -------------------------------------------------------------------------

  fastify.get('/:scheduleId/tasks/:taskId/comments', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get comments for a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const comments = await scheduleService.getComments(taskId);
      return { comments };
    } catch (error) {
      console.error('Get comments error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch comments' });
    }
  });

  fastify.post('/:scheduleId/tasks/:taskId/comments', {
    preHandler: [requireScope('write')],
    schema: { description: 'Add a comment to a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { taskId } = request.params as { taskId: string };
      const { text } = (request.body as { text: string });
      if (!text || !text.trim()) {
        return reply.status(400).send({ error: 'Comment text is required' });
      }
      const comment = await scheduleService.addComment(taskId, text.trim(), user.userId, user.fullName || 'Project Manager');
      return reply.status(201).send({ comment });
    } catch (error) {
      console.error('Add comment error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to add comment' });
    }
  });

  fastify.delete('/:scheduleId/tasks/:taskId/comments/:commentId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Delete a comment', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commentId } = request.params as { commentId: string };
      const deleted = await scheduleService.deleteComment(commentId);
      if (!deleted) return reply.status(404).send({ error: 'Comment not found' });
      return { message: 'Comment deleted' };
    } catch (error) {
      console.error('Delete comment error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete comment' });
    }
  });

  fastify.get('/:scheduleId/tasks/:taskId/activity', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get activity feed for a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const activities = await scheduleService.getActivities(taskId);
      return { activities };
    } catch (error) {
      console.error('Get activity error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch activity' });
    }
  });
}
