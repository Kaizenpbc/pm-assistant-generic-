import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { dailyBriefingService } from '../../services/DailyBriefingService';

export async function briefingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/daily', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { scope } = request.query as { scope?: string };
    const briefing = await dailyBriefingService.getDailyBriefing(user.userId, user.role, scope);
    return briefing;
  });
}
