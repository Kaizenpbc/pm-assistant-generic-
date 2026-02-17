import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { EVMForecastService } from '../services/EVMForecastService';
import { projectIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';

export async function evmForecastRoutes(fastify: FastifyInstance) {
  const service = new EVMForecastService();

  // GET /:projectId
  fastify.get('/:projectId', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const userId = request.user.userId || undefined;
      const result = await service.generateForecast(projectId, userId);
      return reply.send({
        result,
        aiPowered: !!result.aiPredictions,
      });
    } catch (err: any) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      if (err.message?.includes('Project not found')) {
        return reply.status(404).send({ error: 'Project not found' });
      }
      fastify.log.error({ err }, 'EVM forecast generation failed');
      return reply.status(500).send({ error: 'Failed to generate EVM forecast' });
    }
  });
}
