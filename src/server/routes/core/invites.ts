import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { inviteService } from '../../services/InviteService';
import logger from '../../utils/logger';

const createInviteSchema = z.object({
  email: z.string().email(),
  projectId: z.string().uuid().optional(),
  role: z.enum(['viewer', 'team_member', 'project_manager']).default('viewer'),
});

export async function inviteRoutes(fastify: FastifyInstance) {
  // POST /api/v1/invites — create invite (auth required)
  fastify.post('/', {
    preHandler: [authMiddleware, requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createInviteSchema.parse(request.body);
      const invite = await inviteService.createInvite(
        request.user!.userId,
        data.email,
        data.projectId,
        data.role,
      );
      return reply.status(201).send({ invite });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create invite';
      if (msg.includes('limit reached')) {
        return reply.status(403).send({ error: 'Viewer limit reached', message: msg });
      }
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      }
      logger.error('Create invite error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: msg });
    }
  });

  // GET /api/v1/invites — list invites for user's org
  fastify.get('/', {
    preHandler: [authMiddleware, requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { organizationRepository } = await import('../../database/OrganizationRepository');
      const org = await organizationRepository.findByUserId(request.user!.userId);
      if (!org) {
        return reply.status(404).send({ error: 'No organization found' });
      }
      const invites = await inviteService.listInvites(org.id);
      return { invites };
    } catch (error) {
      logger.error('List invites error', { error });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/invites/:token/validate — public, for registration page
  fastify.get('/:token/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const result = await inviteService.validateToken(token);
      return result;
    } catch (error) {
      logger.error('Validate invite error', { error });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/invites/:id — revoke invite
  fastify.delete('/:id', {
    preHandler: [authMiddleware, requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await inviteService.revokeInvite(id, request.user!.userId);
      return { message: 'Invite revoked' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to revoke invite';
      logger.error('Revoke invite error', { error });
      return reply.status(400).send({ error: msg });
    }
  });
}
