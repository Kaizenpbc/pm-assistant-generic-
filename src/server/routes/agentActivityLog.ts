import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentActivityLogService } from '../services/AgentActivityLogService';

const logService = new AgentActivityLogService();

export async function agentActivityLogRoutes(fastify: FastifyInstance) {
  // GET /:projectId — paginated log entries for a project
  fastify.get('/:projectId', {
    schema: { description: 'Get agent activity log for a project', tags: ['agent-log'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

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
