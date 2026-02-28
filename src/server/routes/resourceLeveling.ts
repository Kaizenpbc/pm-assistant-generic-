import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { resourceLevelingService } from '../services/ResourceLevelingService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function resourceLevelingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /:scheduleId/histogram — resource histogram
  fastify.get('/:scheduleId/histogram', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const histogram = await resourceLevelingService.getResourceHistogram(scheduleId);
      return { histogram };
    } catch (error) {
      console.error('Get resource histogram error:', error);
      return reply.status(500).send({ error: 'Failed to fetch resource histogram' });
    }
  });

  // POST /:scheduleId/level — level resources
  fastify.post('/:scheduleId/level', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const result = await resourceLevelingService.levelResources(scheduleId);
      return { result };
    } catch (error) {
      console.error('Level resources error:', error);
      return reply.status(500).send({ error: 'Failed to level resources' });
    }
  });

  // POST /:scheduleId/apply — apply leveled dates
  fastify.post('/:scheduleId/apply', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const { adjustments } = request.body as { adjustments: any[] };
      const result = await resourceLevelingService.applyLeveledDates(scheduleId, adjustments);
      return { result };
    } catch (error) {
      console.error('Apply leveled dates error:', error);
      return reply.status(500).send({ error: 'Failed to apply leveled dates' });
    }
  });
}
