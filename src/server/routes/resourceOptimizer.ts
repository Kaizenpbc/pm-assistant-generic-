import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ResourceOptimizerService } from '../services/ResourceOptimizerService';
import { projectIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess, verifyScheduleAccess } from '../middleware/authorize';

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
      const { projectId } = projectIdParam.parse(request.params);
      const query = forecastQuerySchema.parse(request.query);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });

      const forecast = await optimizerService.predictBottlenecks(
        projectId,
        query.weeksAhead,
        userId,
      );

      return { result: forecast };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
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
      const schedule = await verifyScheduleAccess(body.scheduleId, request.user.userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });

      const matches = await optimizerService.findBestResourceForTask(
        body.taskId,
        body.scheduleId,
      );

      return { matches };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
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
