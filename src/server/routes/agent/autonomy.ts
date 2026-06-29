import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { autonomyService } from '../../services/agents/AutonomyService';
import type { RiskLevel } from '../../services/agents/ActionProposalService';

export async function autonomyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // List autonomy configs
  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: { description: 'List active autonomy configurations', tags: ['agent'] },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    const configs = await autonomyService.listConfigs();
    return { configs };
  });

  // Get eligibility stats for an agent
  fastify.get('/:agentId/eligibility', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get autonomy promotion eligibility for an agent', tags: ['agent'] },
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const { agentId } = request.params as { agentId: string };
    const query = request.query as { projectId?: string };
    const stats = await autonomyService.getEligibilityStats(agentId, query.projectId);
    return { eligibility: stats };
  });

  // Promote agent to Tier 3 (admin only)
  fastify.put('/:agentId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Promote or demote agent autonomy tier', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as {
      action: 'promote' | 'demote';
      projectId?: string;
      minConfidenceThreshold?: number;
      maxRiskLevel?: RiskLevel;
    };
    const userId = (request as any).userId;

    if (body.action === 'promote') {
      const config = await autonomyService.promote(agentId, body.projectId ?? null, userId, {
        minConfidenceThreshold: body.minConfidenceThreshold,
        maxRiskLevel: body.maxRiskLevel,
      });
      return { config, message: `Agent ${agentId} promoted to Tier 3` };
    } else if (body.action === 'demote') {
      await autonomyService.demote(agentId, body.projectId ?? null, userId);
      return { message: `Agent ${agentId} demoted to Tier 2` };
    }

    return reply.status(400).send({ error: 'Invalid action', message: 'Use "promote" or "demote"' });
  });
}
