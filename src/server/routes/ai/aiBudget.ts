import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { aiBudgetService } from '../../services/AIBudgetService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import logger from '../../utils/logger';

export async function aiBudgetRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const usage = await aiBudgetService.getMonthlyUsage(userId);
      return usage;
    } catch (error) {
      logger.error('Get AI budget error', { error });
      return reply.status(500).send({ error: 'Failed to fetch AI budget' });
    }
  });
}
