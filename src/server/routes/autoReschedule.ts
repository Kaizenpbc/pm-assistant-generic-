import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AutoRescheduleService } from '../services/AutoRescheduleService';
import { ProposedChangeSchema } from '../schemas/autoRescheduleSchemas';
import { idParam, scheduleIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';

const rejectBodySchema = z.object({
  feedback: z.string().optional(),
});

const modifyBodySchema = z.object({
  modifications: z.array(ProposedChangeSchema),
});

export async function autoRescheduleRoutes(fastify: FastifyInstance) {
  const service = new AutoRescheduleService();

  // GET /:scheduleId/delays — detect delayed tasks
  fastify.get('/:scheduleId/delays', {
    preHandler: [authMiddleware],
    schema: { description: 'Detect delayed tasks in a schedule', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const delayedTasks = await service.detectDelays(scheduleId);
      return { delayedTasks };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Detect delays error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to detect delays',
      });
    }
  });

  // POST /:scheduleId/propose — generate a reschedule proposal
  fastify.post('/:scheduleId/propose', {
    preHandler: [authMiddleware],
    schema: { description: 'Generate an AI-powered reschedule proposal', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const user = request.user;
      const userId = request.user.userId;
      const proposal = await service.generateProposal(scheduleId, userId);
      return { proposal };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Generate proposal error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate reschedule proposal',
      });
    }
  });

  // GET /:scheduleId/proposals — list proposals for a schedule
  fastify.get('/:scheduleId/proposals', {
    preHandler: [authMiddleware],
    schema: { description: 'List reschedule proposals for a schedule', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const proposals = service.getProposals(scheduleId);
      return { proposals };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Get proposals error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch proposals',
      });
    }
  });

  // POST /proposals/:id/accept — accept a proposal and apply changes
  fastify.post('/proposals/:id/accept', {
    preHandler: [authMiddleware],
    schema: { description: 'Accept a reschedule proposal and apply changes', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const accepted = await service.acceptProposal(id);
      if (!accepted) {
        return reply.status(404).send({
          error: 'Proposal not found',
          message: 'Proposal does not exist or is not in pending status',
        });
      }
      return { message: 'Proposal accepted and changes applied successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Accept proposal error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to accept proposal',
      });
    }
  });

  // POST /proposals/:id/reject — reject a proposal with optional feedback
  fastify.post('/proposals/:id/reject', {
    preHandler: [authMiddleware],
    schema: { description: 'Reject a reschedule proposal', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
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
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Reject proposal error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to reject proposal',
      });
    }
  });

  // POST /proposals/:id/modify — modify a proposal with new changes
  fastify.post('/proposals/:id/modify', {
    preHandler: [authMiddleware],
    schema: { description: 'Modify a reschedule proposal with updated changes', tags: ['auto-reschedule'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
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
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Modify proposal error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to modify proposal',
      });
    }
  });
}
