import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EVMForecastService } from '../services/EVMForecastService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function evmForecastRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const service = new EVMForecastService();

  // GET /:projectId
  fastify.get('/:projectId', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = (request as any).user.userId;
      const result = await service.generateForecast(projectId, userId);
      return reply.send({
        result,
        aiPowered: !!result.aiPredictions,
      });
    } catch (err: any) {
      if (err.message?.includes('Project not found')) {
        return reply.status(404).send({ error: 'Project not found' });
      }
      fastify.log.error({ err }, 'EVM forecast generation failed');
      return reply.status(500).send({ error: 'Failed to generate EVM forecast' });
    }
  });
}
