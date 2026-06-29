import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { killSwitchService } from '../../services/agents/KillSwitchService';

export async function killSwitchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // Get kill switch state
  fastify.get('/kill-switch', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get agent kill switch state', tags: ['agent'] },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    return killSwitchService.getStatus();
  });

  // Toggle global kill switch
  fastify.post('/kill-switch', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Toggle global agent kill switch (admin only)', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { action } = request.body as { action: 'enable' | 'disable' };
    if (action !== 'enable' && action !== 'disable') {
      return reply.status(400).send({ error: 'action must be "enable" or "disable"' });
    }

    const userId = (request as any).userId ?? 'unknown';
    await killSwitchService.setGlobalKillSwitch(action, userId);

    return { success: true, ...killSwitchService.getStatus() };
  });

  // Toggle per-agent kill switch
  fastify.put('/kill-switch/agent/:agentId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Toggle per-agent kill switch (admin only)', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { agentId } = request.params as { agentId: string };
    const { disabled } = request.body as { disabled: boolean };
    if (typeof disabled !== 'boolean') {
      return reply.status(400).send({ error: 'disabled must be a boolean' });
    }

    const userId = (request as any).userId ?? 'unknown';
    await killSwitchService.setAgentDisabled(agentId, disabled, userId);

    return { success: true, ...killSwitchService.getStatus() };
  });

  // Toggle per-project kill switch
  fastify.put('/kill-switch/project/:projectId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Toggle per-project kill switch (admin only)', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const { disabled } = request.body as { disabled: boolean };
    if (typeof disabled !== 'boolean') {
      return reply.status(400).send({ error: 'disabled must be a boolean' });
    }

    const userId = (request as any).userId ?? 'unknown';
    await killSwitchService.setProjectDisabled(projectId, disabled, userId);

    return { success: true, ...killSwitchService.getStatus() };
  });
}
