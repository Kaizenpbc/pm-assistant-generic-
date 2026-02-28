import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { networkDiagramService } from '../services/NetworkDiagramService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function networkDiagramRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /:scheduleId — returns layout JSON
  fastify.get('/:scheduleId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const diagram = await networkDiagramService.getNetworkDiagram(scheduleId);
      return diagram;
    } catch (error) {
      console.error('Get network diagram error:', error);
      return reply.status(500).send({ error: 'Failed to generate network diagram' });
    }
  });
}
