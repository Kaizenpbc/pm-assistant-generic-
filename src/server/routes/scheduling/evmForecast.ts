import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { evmForecastService } from '../../services/EVMForecastService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';

export async function evmForecastRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /:projectId — returns metrics immediately (AI included if cached)
  fastify.get('/:projectId', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const result = await evmForecastService.generateMetricsOnly(projectId);
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

  // GET /:projectId/ai — returns AI predictions (generates if not cached)
  fastify.get('/:projectId/ai', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = request.user!.userId;
      const aiPredictions = await evmForecastService.generateAIPredictions(projectId, userId);
      return reply.send({ aiPredictions });
    } catch (err: any) {
      if (err.message?.includes('Project not found')) {
        return reply.status(404).send({ error: 'Project not found' });
      }
      fastify.log.error({ err }, 'EVM AI prediction generation failed');
      return reply.status(500).send({ error: 'Failed to generate AI predictions' });
    }
  });
}
