import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { EVMForecastService } from '../services/EVMForecastService';
import { projectIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

export async function evmForecastRoutes(fastify: FastifyInstance) {
  const service = new EVMForecastService();

  // GET /:projectId
  fastify.get('/:projectId', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });
      const result = await service.generateForecast(projectId, userId);
      return reply.send({
        result,
        aiPowered: !!result.aiPredictions,
      });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      if (err instanceof Error && err.message.includes('Project not found')) {
        return reply.status(404).send({ error: 'Project not found' });
      }
      fastify.log.error({ err }, 'EVM forecast generation failed');
      return reply.status(500).send({ error: 'Failed to generate EVM forecast' });
    }
  });
}
