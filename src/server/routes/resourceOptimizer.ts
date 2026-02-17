import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ResourceOptimizerService } from '../services/ResourceOptimizerService';
import { authMiddleware } from '../middleware/auth';

const forecastQuerySchema = z.object({
  weeksAhead: z.coerce.number().min(1).max(52).default(8),
});

const skillMatchBodySchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  scheduleId: z.string().min(1, 'scheduleId is required'),
});

export async function resourceOptimizerRoutes(fastify: FastifyInstance) {
  const optimizerService = new ResourceOptimizerService();

  // GET /:projectId/forecast
  fastify.get('/:projectId/forecast', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Predict resource bottlenecks and generate capacity forecast for a project',
      tags: ['resource-optimizer'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const query = forecastQuerySchema.parse(request.query);
      const user = (request as any).user;
      const userId = user?.userId;

      const forecast = await optimizerService.predictBottlenecks(
        projectId,
        query.weeksAhead,
        userId,
      );

      return { result: forecast };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }
      request.log.error({ err: error }, 'Resource forecast error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate resource forecast',
      });
    }
  });

  // POST /skill-match
  fastify.post('/skill-match', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Find the best-matched resources for a given task based on skills and availability',
      tags: ['resource-optimizer'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = skillMatchBodySchema.parse(request.body);

      const matches = await optimizerService.findBestResourceForTask(
        body.taskId,
        body.scheduleId,
      );

      return { matches };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }
      if (error instanceof Error && error.message.startsWith('Task not found')) {
        return reply.status(404).send({
          error: 'Not found',
          message: error.message,
        });
      }
      request.log.error({ err: error }, 'Skill match error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to find resource matches',
      });
    }
  });
}
