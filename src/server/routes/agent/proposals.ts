import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { actionProposalService } from '../../services/agents/ActionProposalService';
import { actionExecutor } from '../../services/agents/ActionExecutor';

export async function proposalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // List proposals
  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: { description: 'List agent proposals', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { projectId?: string; status?: string; agentId?: string; limit?: string; offset?: string };
    const result = await actionProposalService.list({
      projectId: query.projectId,
      status: query.status as any,
      agentId: query.agentId,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
    return result;
  });

  // Get proposal by ID
  fastify.get('/:id', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get agent proposal by ID', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const proposal = await actionProposalService.getById(id);
    if (!proposal) {
      return reply.status(404).send({ error: 'Not found', message: 'Proposal not found' });
    }
    return { proposal };
  });

  // Approve proposal
  fastify.post('/:id/approve', {
    preHandler: [requireScope('write')],
    schema: { description: 'Approve an agent proposal', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { comment?: string } | undefined;
    const userId = request.user!.userId;

    const proposal = await actionProposalService.getById(id);
    if (!proposal) {
      return reply.status(404).send({ error: 'Not found', message: 'Proposal not found' });
    }
    if (proposal.status !== 'pending') {
      return reply.status(400).send({ error: 'Bad request', message: `Proposal is '${proposal.status}', cannot approve` });
    }

    const review = await actionProposalService.addReview(id, userId, 'approved', body?.comment);
    return { review, message: 'Proposal approved' };
  });

  // Reject proposal
  fastify.post('/:id/reject', {
    preHandler: [requireScope('write')],
    schema: { description: 'Reject an agent proposal', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string } | undefined;
    const userId = request.user!.userId;

    const proposal = await actionProposalService.getById(id);
    if (!proposal) {
      return reply.status(404).send({ error: 'Not found', message: 'Proposal not found' });
    }
    if (proposal.status !== 'pending') {
      return reply.status(400).send({ error: 'Bad request', message: `Proposal is '${proposal.status}', cannot reject` });
    }

    const review = await actionProposalService.addReview(id, userId, 'rejected', body?.reason);
    return { review, message: 'Proposal rejected' };
  });

  // Execute approved proposal
  fastify.post('/:id/execute', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Execute an approved agent proposal', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const proposal = await actionProposalService.getById(id);
    if (!proposal) {
      return reply.status(404).send({ error: 'Not found', message: 'Proposal not found' });
    }
    if (proposal.status !== 'approved') {
      return reply.status(400).send({ error: 'Bad request', message: `Proposal is '${proposal.status}', must be approved to execute` });
    }

    const result = await actionExecutor.execute(id);
    return { result };
  });

  // Rollback executed proposal
  fastify.post('/:id/rollback', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Rollback an executed agent proposal', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const result = await actionExecutor.rollbackProposal(id);
    return { result };
  });

  // Get proposal actions
  fastify.get('/:id/actions', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get actions for an agent proposal', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const actions = await actionProposalService.getActions(id);
    return { actions };
  });

  // Submit feedback on executed proposal
  fastify.post('/:id/feedback', {
    preHandler: [requireScope('write')],
    schema: { description: 'Submit feedback on an executed agent proposal', tags: ['agent'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { outcome: string; comment?: string };
    const userId = request.user!.userId;

    const validOutcomes = ['effective', 'partially_effective', 'ineffective', 'made_worse', 'rolled_back'];
    if (!validOutcomes.includes(body.outcome)) {
      return reply.status(400).send({ error: 'Bad request', message: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` });
    }

    await actionProposalService.submitFeedback(id, userId, body.outcome, body.comment);
    return { message: 'Feedback submitted' };
  });
}
