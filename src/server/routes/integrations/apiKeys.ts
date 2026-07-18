import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiKeyService } from '../../services/ApiKeyService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { requirePaidTier } from '../../middleware/requireTier';
import logger from '../../utils/logger';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).default(['read', 'write']),
  rateLimit: z.number().int().positive().optional(),
  expiresAt: z.string().optional(),
});

export async function apiKeyRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // POST / — Create a new API key
  fastify.post('/', { preHandler: [requireScope('write'), requirePaidTier] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const body = createApiKeySchema.parse(request.body);

      // Enforce: requested scopes cannot exceed user's own role scopes
      const ROLE_SCOPES: Record<string, string[]> = {
        admin: ['read', 'write', 'admin'],
        executive: ['read'],
        project_manager: ['read', 'write'],
        scrum_master: ['read', 'write'],
        team_member: ['read'],
        finance_officer: ['read'],
        risk_manager: ['read', 'write'],
        pmo: ['read', 'write'],
        ba: ['read', 'write'],
        qa: ['read', 'write'],
        tester: ['read'],
        devops: ['read', 'write'],
        claude_sme: ['read'],
        viewer: ['read'],
      };
      const userScopes = ROLE_SCOPES[user.role ?? ''] ?? ['read'];
      const disallowed = body.scopes.filter(s => !userScopes.includes(s));
      if (disallowed.length > 0) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Your role (${user.role}) cannot create API keys with scopes: ${disallowed.join(', ')}`,
        });
      }

      const apiKey = await apiKeyService.createKey(
        user.userId,
        body.name,
        body.scopes,
        body.rateLimit,
        body.expiresAt,
      );

      return reply.status(201).send({ apiKey });
    } catch (error) {
      logger.error('Create API key error', { error });
      return reply.status(500).send({ error: 'Failed to create API key' });
    }
  });

  // GET / — List all API keys for the current user
  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const apiKeys = await apiKeyService.listKeys(user.userId);
      return { apiKeys };
    } catch (error) {
      logger.error('List API keys error', { error });
      return reply.status(500).send({ error: 'Failed to list API keys' });
    }
  });

  // DELETE /:id — Revoke an API key
  fastify.delete('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      await apiKeyService.revokeKey(user.userId, id);
      return { message: 'API key revoked' };
    } catch (error) {
      logger.error('Revoke API key error', { error });
      return reply.status(500).send({ error: 'Failed to revoke API key' });
    }
  });

  // GET /:id/usage — Get usage stats for an API key
  fastify.get('/:id/usage', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const { since } = request.query as { since?: string };
      const usage = await apiKeyService.getUsageStats(id, since);
      return { usage };
    } catch (error) {
      logger.error('Get API key usage error', { error });
      return reply.status(500).send({ error: 'Failed to fetch API key usage' });
    }
  });
}
