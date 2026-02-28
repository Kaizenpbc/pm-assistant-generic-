import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AILearningServiceV2 } from '../services/aiLearningService';
import { AIFeedbackRecordSchema, AIAccuracyRecordSchema } from '../schemas/phase5Schemas';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function learningRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const service = new AILearningServiceV2(fastify);

  fastify.post('/feedback', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AIFeedbackRecordSchema.parse(request.body);
      const userId = (request as any).user.userId;
      service.recordFeedback(parsed, userId);
      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to record feedback');
      return reply.status(400).send({ error: 'Invalid feedback data' });
    }
  });

  fastify.post('/accuracy', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AIAccuracyRecordSchema.parse(request.body);
      service.recordAccuracy(parsed);
      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to record accuracy');
      return reply.status(400).send({ error: 'Invalid accuracy data' });
    }
  });

  fastify.get('/accuracy-report', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectType } = request.query as { projectType?: string };
      const report = await service.getAccuracyReport({ projectType });
      return reply.send({ data: report });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get accuracy report');
      return reply.status(500).send({ error: 'Failed to generate accuracy report' });
    }
  });

  fastify.get('/feedback-stats', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { feature } = request.query as { feature?: string };
      const stats = await service.getFeedbackStats(feature);
      return reply.send({ data: stats });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get feedback stats');
      return reply.status(500).send({ error: 'Failed to get feedback statistics' });
    }
  });

  fastify.get('/insights', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.userId;
      const { insights, aiPowered } = await service.getAIAccuracyInsights(userId);
      return reply.send({ data: insights, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI insights');
      return reply.status(500).send({ error: 'Failed to generate AI insights' });
    }
  });
}
