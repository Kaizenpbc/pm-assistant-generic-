import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ProjectMemberService } from '../services/ProjectMemberService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

const addMemberSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['owner', 'manager', 'editor', 'viewer']),
});

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'manager', 'editor', 'viewer']),
});

export async function projectMemberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const memberService = new ProjectMemberService();

  // GET /api/v1/projects/:projectId/members
  fastify.get('/:projectId/members', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get project members', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const members = memberService.findByProjectId(projectId);
      return { members };
    } catch (error) {
      console.error('Get members error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/projects/:projectId/members
  fastify.post('/:projectId/members', {
    preHandler: [requireScope('write')],
    schema: { description: 'Add a project member', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const data = addMemberSchema.parse(request.body);
      const member = memberService.addMember(projectId, data);
      return reply.status(201).send({ member });
    } catch (error) {
      console.error('Add member error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/v1/projects/:projectId/members/:memberId
  fastify.put('/:projectId/members/:memberId', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update member role', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { memberId } = request.params as { memberId: string };
      const data = updateRoleSchema.parse(request.body);
      const member = memberService.updateRole(memberId, data.role);
      if (!member) return reply.status(404).send({ error: 'Member not found' });
      return { member };
    } catch (error) {
      console.error('Update member error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/projects/:projectId/members/:memberId
  fastify.delete('/:projectId/members/:memberId', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Remove a project member', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { memberId } = request.params as { memberId: string };
      const removed = memberService.removeMember(memberId);
      if (!removed) return reply.status(400).send({ error: 'Cannot remove member (may be last owner)' });
      return { message: 'Member removed' };
    } catch (error) {
      console.error('Remove member error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
