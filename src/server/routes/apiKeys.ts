import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { apiKeyService } from '../services/ApiKeyService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function apiKeyRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // POST / — Create a new API key
  fastify.post('/', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const body = request.body as {
        name: string;
        scopes?: string[];
        rateLimit?: number;
        expiresAt?: string;
      };

      if (!body.name) {
        return reply.status(400).send({ error: 'name is required' });
      }

      const apiKey = await apiKeyService.createKey(
        user.userId,
        body.name,
        body.scopes || ['read', 'write'],
        body.rateLimit,
        body.expiresAt,
      );

      return { apiKey };
    } catch (error) {
      console.error('Create API key error:', error);
      return reply.status(500).send({ error: 'Failed to create API key' });
    }
  });

  // GET / — List all API keys for the current user
  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const apiKeys = await apiKeyService.listKeys(user.userId);
      return { apiKeys };
    } catch (error) {
      console.error('List API keys error:', error);
      return reply.status(500).send({ error: 'Failed to list API keys' });
    }
  });

  // DELETE /:id — Revoke an API key
  fastify.delete('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      await apiKeyService.revokeKey(user.userId, id);
      return { message: 'API key revoked' };
    } catch (error) {
      console.error('Revoke API key error:', error);
      return reply.status(500).send({ error: 'Failed to revoke API key' });
    }
  });

  // GET /:id/usage — Get usage stats for an API key
  fastify.get('/:id/usage', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const { since } = request.query as { since?: string };
      const usage = await apiKeyService.getUsageStats(id, since);
      return { usage };
    } catch (error) {
      console.error('Get API key usage error:', error);
      return reply.status(500).send({ error: 'Failed to fetch API key usage' });
    }
  });
}
