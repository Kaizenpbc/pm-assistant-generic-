import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { AILearningServiceV2 } from '../services/aiLearningService';
import { AIFeedbackRecordSchema, AIAccuracyRecordSchema } from '../schemas/phase5Schemas';
import { authMiddleware } from '../middleware/auth';

export async function learningRoutes(fastify: FastifyInstance) {
  const service = new AILearningServiceV2(fastify);

  fastify.post('/feedback', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AIFeedbackRecordSchema.parse(request.body);
      const userId = request.user.userId;
      service.recordFeedback(parsed, userId);
      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to record feedback');
      return reply.status(400).send({ error: 'Invalid feedback data' });
    }
  });

  fastify.post('/accuracy', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AIAccuracyRecordSchema.parse(request.body);
      service.recordAccuracy(parsed);
      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to record accuracy');
      return reply.status(400).send({ error: 'Invalid accuracy data' });
    }
  });

  fastify.get('/accuracy-report', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const querySchema = z.object({ projectType: z.string().optional() });
      const { projectType } = querySchema.parse(request.query);
      const report = await service.getAccuracyReport({ projectType });
      return reply.send({ data: report });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to get accuracy report');
      return reply.status(500).send({ error: 'Failed to generate accuracy report' });
    }
  });

  fastify.get('/feedback-stats', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const querySchema = z.object({ feature: z.string().optional() });
      const { feature } = querySchema.parse(request.query);
      const stats = await service.getFeedbackStats(feature);
      return reply.send({ data: stats });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to get feedback stats');
      return reply.status(500).send({ error: 'Failed to get feedback statistics' });
    }
  });

  fastify.get('/insights', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId || undefined;
      const { insights, aiPowered } = await service.getAIAccuracyInsights(userId);
      return reply.send({ data: insights, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI insights');
      return reply.status(500).send({ error: 'Failed to generate AI insights' });
    }
  });
}
