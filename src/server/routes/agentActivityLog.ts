import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentActivityLogService } from '../services/AgentActivityLogService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

const logService = new AgentActivityLogService();

export async function agentActivityLogRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /:projectId — paginated log entries for a project
  fastify.get('/:projectId', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get agent activity log for a project', tags: ['agent-log'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { limit = '50', offset = '0', agent } = request.query as {
        limit?: string;
        offset?: string;
        agent?: string;
      };

      const result = await logService.getByProject(
        projectId,
        parseInt(limit, 10),
        parseInt(offset, 10),
        agent || undefined,
      );

      return result;
    } catch (error) {
      console.error('Get agent activity log error:', error);
      return reply.status(500).send({ error: 'Failed to fetch agent activity log' });
    }
  });
}
