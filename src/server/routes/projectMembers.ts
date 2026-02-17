import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { ProjectMemberService } from '../services/ProjectMemberService';
import { projectIdParam, projectAndMemberIdParam } from '../schemas/commonSchemas';
import { verifyProjectAccess } from '../middleware/authorize';
import { authMiddleware } from '../middleware/auth';

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
  const memberService = new ProjectMemberService();

  // GET /api/v1/projects/:projectId/members
  fastify.get('/:projectId/members', {
    preHandler: [authMiddleware],
    schema: { description: 'Get project members', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const userId = request.user.userId;

      // Ownership check: only project owner can view members
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

      const members = memberService.findByProjectId(projectId);
      return { members };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Get members error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/projects/:projectId/members
  fastify.post('/:projectId/members', {
    preHandler: [authMiddleware],
    schema: { description: 'Add a project member', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const userId = request.user.userId;

      // Ownership check: only project owner can add members
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

      const data = addMemberSchema.parse(request.body);
      const member = memberService.addMember(projectId, data);
      return reply.status(201).send({ member });
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Add member error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/v1/projects/:projectId/members/:memberId
  fastify.put('/:projectId/members/:memberId', {
    preHandler: [authMiddleware],
    schema: { description: 'Update member role', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId, memberId } = projectAndMemberIdParam.parse(request.params);
      const userId = request.user.userId;

      // Ownership check: only project owner can update member roles
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

      const data = updateRoleSchema.parse(request.body);
      const member = memberService.updateRole(memberId, data.role, projectId);
      if (!member) return reply.status(404).send({ error: 'Member not found' });
      return { member };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Update member error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/projects/:projectId/members/:memberId
  fastify.delete('/:projectId/members/:memberId', {
    preHandler: [authMiddleware],
    schema: { description: 'Remove a project member', tags: ['members'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId, memberId } = projectAndMemberIdParam.parse(request.params);
      const userId = request.user.userId;

      // Ownership check: only project owner can remove members
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

      const removed = memberService.removeMember(memberId, projectId);
      if (!removed) return reply.status(400).send({ error: 'Cannot remove member (may be last owner)' });
      return { message: 'Member removed' };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Remove member error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
