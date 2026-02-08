import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ScheduleService } from '../services/ScheduleService';

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

  fastify.get('/project/:projectId', {
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
    schema: { description: 'Create a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const data = createScheduleSchema.parse(request.body);
      const schedule = await scheduleService.create({
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        createdBy: user?.userId || '1',
      });
      return reply.status(201).send({ schedule });
    } catch (error) {
      console.error('Create schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create schedule' });
    }
  });

  fastify.put('/:scheduleId', {
    schema: { description: 'Update a schedule', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const data = createScheduleSchema.partial().parse(request.body);
      const schedule = await scheduleService.update(scheduleId, {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      });
      if (!schedule) return reply.status(404).send({ error: 'Not found', message: 'Schedule not found' });
      return { schedule };
    } catch (error) {
      console.error('Update schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update schedule' });
    }
  });

  fastify.delete('/:scheduleId', {
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
    schema: { description: 'Create a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { scheduleId } = request.params as { scheduleId: string };
      const data = createTaskSchema.omit({ scheduleId: true }).parse(request.body);
      const task = await scheduleService.createTask({
        scheduleId,
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        createdBy: user?.userId || '1',
      });
      return reply.status(201).send({ task });
    } catch (error) {
      console.error('Create task error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create task' });
    }
  });

  fastify.put('/:scheduleId/tasks/:taskId', {
    schema: { description: 'Update a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const data = updateTaskSchema.parse(request.body);
      const task = await scheduleService.updateTask(taskId, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      });
      if (!task) return reply.status(404).send({ error: 'Not found', message: 'Task not found' });
      return { task };
    } catch (error) {
      console.error('Update task error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update task' });
    }
  });

  fastify.delete('/:scheduleId/tasks/:taskId', {
    schema: { description: 'Delete a task', tags: ['schedules'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const deleted = await scheduleService.deleteTask(taskId);
      if (!deleted) return reply.status(404).send({ error: 'Not found', message: 'Task not found' });
      return { message: 'Task deleted successfully' };
    } catch (error) {
      console.error('Delete task error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete task' });
    }
  });
}
