import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MonteCarloService } from '../services/MonteCarloService';
import { MonteCarloConfigSchema } from '../schemas/monteCarloSchemas';

export async function monteCarloRoutes(fastify: FastifyInstance) {
  const service = new MonteCarloService();

  // POST /:scheduleId/simulate — Run Monte Carlo simulation for a schedule
  fastify.post('/:scheduleId/simulate', async (
    request: FastifyRequest<{ Params: { scheduleId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { scheduleId } = request.params;

      // Parse optional config from body, applying defaults
      const rawBody = (request.body as Record<string, unknown>) || {};
      const config = MonteCarloConfigSchema.parse(rawBody);

      const result = await service.runSimulation(scheduleId, config);
      return reply.send({ result });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid configuration', details: err.issues });
      }
      fastify.log.error({ err }, 'Monte Carlo simulation failed');
      return reply.status(500).send({ error: err.message || 'Failed to run Monte Carlo simulation' });
    }
  });
}
