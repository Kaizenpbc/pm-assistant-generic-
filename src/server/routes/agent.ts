import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { agentScheduler } from '../services/AgentSchedulerService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function agentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /trigger — manually trigger an agent scan
  fastify.post('/trigger', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Manually trigger an agent auto-reschedule scan', tags: ['agent'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await agentScheduler.runScan();
      return { message: 'Agent scan completed', stats };
    } catch (error) {
      console.error('Agent trigger error:', error);
      return reply.status(500).send({ error: 'Agent scan failed' });
    }
  });
}
