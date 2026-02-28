import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { timeEntryService } from '../services/TimeEntryService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function timeEntryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST / — log entry
  fastify.post('/', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const body = request.body as {
        taskId: string; scheduleId: string; projectId: string;
        date: string; hours: number; description?: string; billable?: boolean;
      };
      const entry = await timeEntryService.create({ ...body, userId: user.userId });
      return { entry };
    } catch (error) {
      console.error('Create time entry error:', error);
      return reply.status(500).send({ error: 'Failed to create time entry' });
    }
  });

  // GET /task/:taskId — entries for a task
  fastify.get('/task/:taskId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const entries = await timeEntryService.getByTask(taskId);
      return { entries };
    } catch (error) {
      console.error('Get task time entries error:', error);
      return reply.status(500).send({ error: 'Failed to fetch time entries' });
    }
  });

  // GET /project/:projectId — entries for a project
  fastify.get('/project/:projectId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };
      const entries = await timeEntryService.getByProject(projectId, startDate, endDate);
      return { entries };
    } catch (error) {
      console.error('Get project time entries error:', error);
      return reply.status(500).send({ error: 'Failed to fetch time entries' });
    }
  });

  // GET /timesheet — weekly timesheet for current user
  fastify.get('/timesheet', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { weekStart } = request.query as { weekStart: string };
      if (!weekStart) return reply.status(400).send({ error: 'weekStart is required' });

      const timesheet = await timeEntryService.getWeeklyTimesheet(user.userId, weekStart);
      return timesheet;
    } catch (error) {
      console.error('Get timesheet error:', error);
      return reply.status(500).send({ error: 'Failed to fetch timesheet' });
    }
  });

  // GET /actual-vs-estimated/:scheduleId
  fastify.get('/actual-vs-estimated/:scheduleId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const data = await timeEntryService.getActualVsEstimated(scheduleId);
      return data;
    } catch (error) {
      console.error('Get actual vs estimated error:', error);
      return reply.status(500).send({ error: 'Failed to fetch comparison data' });
    }
  });

  // PUT /:id — update
  fastify.put('/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { date?: string; hours?: number; description?: string; billable?: boolean };
      const entry = await timeEntryService.update(id, body);
      return { entry };
    } catch (error) {
      console.error('Update time entry error:', error);
      return reply.status(500).send({ error: 'Failed to update time entry' });
    }
  });

  // DELETE /:id
  fastify.delete('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await timeEntryService.delete(id);
      return { message: 'Time entry deleted' };
    } catch (error) {
      console.error('Delete time entry error:', error);
      return reply.status(500).send({ error: 'Failed to delete time entry' });
    }
  });
}
