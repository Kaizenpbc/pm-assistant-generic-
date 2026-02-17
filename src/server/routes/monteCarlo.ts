import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { MonteCarloService } from '../services/MonteCarloService';
import { MonteCarloConfigSchema } from '../schemas/monteCarloSchemas';
import { scheduleIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyScheduleAccess } from '../middleware/authorize';

export async function monteCarloRoutes(fastify: FastifyInstance) {
  const service = new MonteCarloService();

  // POST /:scheduleId/simulate — Run Monte Carlo simulation for a schedule
  fastify.post('/:scheduleId/simulate', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const schedule = await verifyScheduleAccess(scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });

      // Parse optional config from body, applying defaults
      const rawBody = (request.body as Record<string, unknown>) || {};
      const config = MonteCarloConfigSchema.parse(rawBody);

      const result = await service.runSimulation(scheduleId, config);
      return reply.send({ result });
    } catch (err: any) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Monte Carlo simulation failed');
      return reply.status(500).send({ error: 'Failed to run Monte Carlo simulation' });
    }
  });
}
