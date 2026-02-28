import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { integrationService } from '../services/IntegrationService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function integrationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST / — create integration
  fastify.post('/', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { provider, config, projectId } = request.body as {
        provider: string; config: any; projectId?: string;
      };
      const integration = await integrationService.create(user.userId, provider, config, projectId);
      return { integration };
    } catch (error) {
      console.error('Create integration error:', error);
      return reply.status(500).send({ error: 'Failed to create integration' });
    }
  });

  // GET / — list integrations for user
  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const integrations = await integrationService.getByUser(user.userId);
      return { integrations };
    } catch (error) {
      console.error('Get integrations error:', error);
      return reply.status(500).send({ error: 'Failed to fetch integrations' });
    }
  });

  // GET /:id — get integration by id
  fastify.get('/:id', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const integration = await integrationService.getById(id);
      return { integration };
    } catch (error) {
      console.error('Get integration error:', error);
      return reply.status(500).send({ error: 'Failed to fetch integration' });
    }
  });

  // PUT /:id — update integration
  fastify.put('/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const integration = await integrationService.update(id, body);
      return { integration };
    } catch (error) {
      console.error('Update integration error:', error);
      return reply.status(500).send({ error: 'Failed to update integration' });
    }
  });

  // DELETE /:id — delete integration
  fastify.delete('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await integrationService.delete(id);
      return { message: 'Integration deleted' };
    } catch (error) {
      console.error('Delete integration error:', error);
      return reply.status(500).send({ error: 'Failed to delete integration' });
    }
  });

  // POST /:id/test — test connection
  fastify.post('/:id/test', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await integrationService.testConnection(id);
      return { result };
    } catch (error) {
      console.error('Test connection error:', error);
      return reply.status(500).send({ error: 'Failed to test connection' });
    }
  });

  // POST /:id/sync — sync integration
  fastify.post('/:id/sync', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { direction } = request.body as { direction: 'push' | 'pull' };
      const result = await integrationService.sync(id, direction);
      return { result };
    } catch (error) {
      console.error('Sync integration error:', error);
      return reply.status(500).send({ error: 'Failed to sync integration' });
    }
  });

  // GET /:id/log — get sync log
  fastify.get('/:id/log', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const log = await integrationService.getSyncLog(id);
      return { log };
    } catch (error) {
      console.error('Get sync log error:', error);
      return reply.status(500).send({ error: 'Failed to fetch sync log' });
    }
  });
}
