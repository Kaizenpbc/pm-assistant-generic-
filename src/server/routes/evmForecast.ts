import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EVMForecastService } from '../services/EVMForecastService';

export async function evmForecastRoutes(fastify: FastifyInstance) {
  const service = new EVMForecastService();

  // GET /:projectId
  fastify.get('/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params;
      const userId = (request as any).userId || undefined;
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
