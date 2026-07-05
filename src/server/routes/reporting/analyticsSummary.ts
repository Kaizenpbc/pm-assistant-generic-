import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { analyticsSummaryService } from '../../services/AnalyticsSummaryService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';

export async function analyticsSummaryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  // GET /summary — Full portfolio analytics summary (auth required)
  fastify.get('/summary', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { scope } = request.query as { scope?: string };
      const globalRoles = ['admin', 'executive', 'pmo'];
      const isGlobal = globalRoles.includes(user.role) || scope === 'portfolio';

      const summary = isGlobal
        ? await analyticsSummaryService.getSummaryAll()
        : await analyticsSummaryService.getSummary(user.userId);
      return { summary };
    } catch (error) {
      console.error('Get analytics summary error:', error);
      return reply.status(500).send({ error: 'Failed to generate analytics summary' });
    }
  });

  // GET /summary/project/:id — Single project analytics summary (auth required)
  fastify.get('/summary/project/:id', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const summary = await analyticsSummaryService.getProjectSummary(id);
      return { summary };
    } catch (error) {
      console.error('Get project analytics summary error:', error);
      return reply.status(500).send({ error: 'Failed to generate project analytics summary' });
    }
  });
}
