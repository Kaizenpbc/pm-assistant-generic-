import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { reportScheduleService } from '../../services/ReportScheduleService';

export async function reportScheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // Create schedule
  fastify.post('/', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const body = request.body as any;
      const { templateId, frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients, isActive } = body;

      if (!templateId || !frequency || !recipients || recipients.length === 0) {
        return reply.status(400).send({ error: 'templateId, frequency, and recipients are required' });
      }

      const schedule = await reportScheduleService.create({
        templateId,
        createdBy: userId,
        frequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
        recipients,
        isActive,
      });

      return reply.status(201).send({ schedule });
    } catch (error: any) {
      console.error('Create report schedule error:', error);
      return reply.status(500).send({ error: error.message || 'Internal server error' });
    }
  });

  // List schedules for current user
  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const schedules = await reportScheduleService.listByUser(userId);
      return { schedules };
    } catch (error) {
      console.error('List report schedules error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get by id
  fastify.get('/:id', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const schedule = await reportScheduleService.getById(id);
      if (!schedule) return reply.status(404).send({ error: 'Schedule not found' });
      return { schedule };
    } catch (error) {
      console.error('Get report schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get schedules for a template
  fastify.get('/template/:templateId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { templateId } = request.params as { templateId: string };
      const schedules = await reportScheduleService.getByTemplateId(templateId);
      return { schedules };
    } catch (error) {
      console.error('Get template schedules error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update schedule
  fastify.put('/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const schedule = await reportScheduleService.update(id, body);
      if (!schedule) return reply.status(404).send({ error: 'Schedule not found' });
      return { schedule };
    } catch (error) {
      console.error('Update report schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete schedule
  fastify.delete('/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await reportScheduleService.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Delete report schedule error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
