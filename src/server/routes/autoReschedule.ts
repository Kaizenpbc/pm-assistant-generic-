import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AutoRescheduleService } from '../services/AutoRescheduleService';
import { ProposedChangeSchema } from '../schemas/autoRescheduleSchemas';
import { webhookService } from '../services/WebhookService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

const rejectBodySchema = z.object({
  feedback: z.string().optional(),
});

const modifyBodySchema = z.object({
  modifications: z.array(ProposedChangeSchema),
});

export async function autoRescheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const service = new AutoRescheduleService();

  // GET /:scheduleId/delays — detect delayed tasks
  fastify.get('/:scheduleId/delays', {
    preHandler: [requireScope('read')],
    schema: { description: 'Detect delayed tasks in a schedule', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const delayedTasks = await service.detectDelays(scheduleId);
      return { delayedTasks };
    } catch (error) {
      console.error('Detect delays error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to detect delays',
      });
    }
  });

  // POST /:scheduleId/propose — generate a reschedule proposal
  fastify.post('/:scheduleId/propose', {
    preHandler: [requireScope('write')],
    schema: { description: 'Generate an AI-powered reschedule proposal', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const user = (request as any).user;
      const userId = user.userId;
      const proposal = await service.generateProposal(scheduleId, userId);
      webhookService.dispatch('proposal.created', { proposal }, userId);
      return { proposal };
    } catch (error) {
      console.error('Generate proposal error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate reschedule proposal',
      });
    }
  });

  // GET /:scheduleId/proposals — list proposals for a schedule
  fastify.get('/:scheduleId/proposals', {
    preHandler: [requireScope('read')],
    schema: { description: 'List reschedule proposals for a schedule', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const proposals = await service.getProposals(scheduleId);
      return { proposals };
    } catch (error) {
      console.error('Get proposals error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch proposals',
      });
    }
  });

  // POST /proposals/:id/accept — accept a proposal and apply changes
  fastify.post('/proposals/:id/accept', {
    preHandler: [requireScope('write')],
    schema: { description: 'Accept a reschedule proposal and apply changes', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const accepted = await service.acceptProposal(id);
      if (!accepted) {
        return reply.status(404).send({
          error: 'Proposal not found',
          message: 'Proposal does not exist or is not in pending status',
        });
      }
      const user = (request as any).user;
      webhookService.dispatch('proposal.accepted', { proposalId: id }, user.userId);
      return { message: 'Proposal accepted and changes applied successfully' };
    } catch (error) {
      console.error('Accept proposal error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to accept proposal',
      });
    }
  });

  // POST /proposals/:id/reject — reject a proposal with optional feedback
  fastify.post('/proposals/:id/reject', {
    preHandler: [requireScope('write')],
    schema: { description: 'Reject a reschedule proposal', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = rejectBodySchema.parse(request.body ?? {});
      const rejected = await service.rejectProposal(id, body.feedback);
      if (!rejected) {
        return reply.status(404).send({
          error: 'Proposal not found',
          message: 'Proposal does not exist or is not in pending status',
        });
      }
      return { message: 'Proposal rejected successfully' };
    } catch (error) {
      console.error('Reject proposal error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to reject proposal',
      });
    }
  });

  // POST /proposals/:id/modify — modify a proposal with new changes
  fastify.post('/proposals/:id/modify', {
    preHandler: [requireScope('write')],
    schema: { description: 'Modify a reschedule proposal with updated changes', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = modifyBodySchema.parse(request.body);
      const modified = await service.modifyProposal(id, body.modifications);
      if (!modified) {
        return reply.status(404).send({
          error: 'Proposal not found',
          message: 'Proposal does not exist or is not in pending status',
        });
      }
      return { message: 'Proposal modified successfully' };
    } catch (error) {
      console.error('Modify proposal error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to modify proposal',
      });
    }
  });
}
