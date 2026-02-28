import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { portalService } from '../services/PortalService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function portalRoutes(fastify: FastifyInstance) {
  // ── Public routes (token-based access) ──────────────────────────────

  // GET /view/:token — public portal view (no auth)
  fastify.get('/view/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const link = await portalService.validateToken(token);
      if (!link) return reply.status(404).send({ error: 'Invalid or expired portal link' });

      const view = await portalService.getPortalView(token);
      return { view };
    } catch (error) {
      console.error('Get portal view error:', error);
      return reply.status(500).send({ error: 'Failed to fetch portal view' });
    }
  });

  // GET /view/:token/gantt — public gantt view (no auth)
  fastify.get('/view/:token/gantt', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const link = await portalService.validateToken(token);
      if (!link) return reply.status(404).send({ error: 'Invalid or expired portal link' });

      const view = await portalService.getPortalView(token);
      return { gantt: view ? (view as any).gantt || null : null };
    } catch (error) {
      console.error('Get portal gantt error:', error);
      return reply.status(500).send({ error: 'Failed to fetch portal gantt' });
    }
  });

  // POST /view/:token/comment — public comment submission (no auth)
  fastify.post('/view/:token/comment', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const link = await portalService.validateToken(token);
      if (!link) return reply.status(404).send({ error: 'Invalid or expired portal link' });

      const { entityType, entityId, authorName, content } = request.body as {
        entityType: string; entityId: string; authorName: string; content: string;
      };
      const comment = await portalService.addComment(link.id, link.projectId, entityType, entityId, authorName, content);
      return { comment };
    } catch (error) {
      console.error('Add portal comment error:', error);
      return reply.status(500).send({ error: 'Failed to add comment' });
    }
  });

  // ── Authenticated management routes ─────────────────────────────────

  // POST /links/:projectId — create portal link
  fastify.post('/links/:projectId', {
    preHandler: [authMiddleware, requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { projectId } = request.params as { projectId: string };
      const { permissions, label, expiresAt } = request.body as {
        permissions: any; label?: string; expiresAt?: string;
      };
      const link = await portalService.createLink(projectId, permissions, user.userId, label, expiresAt);
      return { link };
    } catch (error) {
      console.error('Create portal link error:', error);
      return reply.status(500).send({ error: 'Failed to create portal link' });
    }
  });

  // GET /links/:projectId — list portal links
  fastify.get('/links/:projectId', {
    preHandler: [authMiddleware, requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const links = await portalService.getLinks(projectId);
      return { links };
    } catch (error) {
      console.error('Get portal links error:', error);
      return reply.status(500).send({ error: 'Failed to fetch portal links' });
    }
  });

  // PUT /links/:id — update portal link
  fastify.put('/links/:id', {
    preHandler: [authMiddleware, requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const link = await portalService.updateLink(id, body);
      return { link };
    } catch (error) {
      console.error('Update portal link error:', error);
      return reply.status(500).send({ error: 'Failed to update portal link' });
    }
  });

  // DELETE /links/:id — delete portal link
  fastify.delete('/links/:id', {
    preHandler: [authMiddleware, requireScope('admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await portalService.deleteLink(id);
      return { message: 'Portal link deleted' };
    } catch (error) {
      console.error('Delete portal link error:', error);
      return reply.status(500).send({ error: 'Failed to delete portal link' });
    }
  });

  // GET /comments/:projectId — get portal comments
  fastify.get('/comments/:projectId', {
    preHandler: [authMiddleware, requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const comments = await portalService.getComments(projectId);
      return { comments };
    } catch (error) {
      console.error('Get portal comments error:', error);
      return reply.status(500).send({ error: 'Failed to fetch portal comments' });
    }
  });
}
