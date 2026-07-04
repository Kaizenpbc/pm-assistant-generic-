import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { agentScheduler } from '../../services/AgentSchedulerService';
import { agentRepository } from '../../database/AgentRepository';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';

const updateAgentSchema = z.object({
  isEnabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function agentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /registry — list all registered agents
  fastify.get('/registry', {
    preHandler: [requireScope('read')],
    schema: { description: 'List all registered agents', tags: ['agent'] },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    const agents = await agentRepository.findAll();
    return { agents };
  });

  // GET /registry/:id — get a single agent
  fastify.get('/registry/:id', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get agent details by ID', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const agent = await agentRepository.findById(id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return { agent };
  });

  // PATCH /registry/:id — update agent (enable/disable, config)
  fastify.patch('/registry/:id', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Update agent configuration', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateAgentSchema.parse(request.body);

    const agent = await agentRepository.findById(id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });

    if (body.isEnabled !== undefined) {
      await agentRepository.setEnabled(id, body.isEnabled);
    }
    if (body.config !== undefined) {
      await agentRepository.updateConfig(id, body.config);
    }

    const updated = await agentRepository.findById(id);
    return { agent: updated };
  });

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
