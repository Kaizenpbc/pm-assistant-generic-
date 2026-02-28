import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { webhookService } from '../services/WebhookService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  // POST / — Register webhook
  fastify.post('/', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { url, events } = request.body as { url: string; events: string[] };
      if (!url || !events || !Array.isArray(events) || events.length === 0) {
        return reply.status(400).send({ error: 'url and events[] are required' });
      }

      const webhook = await webhookService.register(user.userId, url, events);
      return { webhook };
    } catch (error) {
      console.error('Register webhook error:', error);
      return reply.status(500).send({ error: 'Failed to register webhook' });
    }
  });

  // GET / — List webhooks
  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const webhooks = await webhookService.list(user.userId);
      return { webhooks };
    } catch (error) {
      console.error('List webhooks error:', error);
      return reply.status(500).send({ error: 'Failed to fetch webhooks' });
    }
  });

  // PUT /:id — Update webhook
  fastify.put('/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const body = request.body as { url?: string; events?: string[]; isActive?: boolean };

      const webhook = await webhookService.update(user.userId, id, body);
      if (!webhook) return reply.status(404).send({ error: 'Webhook not found' });

      return { webhook };
    } catch (error) {
      console.error('Update webhook error:', error);
      return reply.status(500).send({ error: 'Failed to update webhook' });
    }
  });

  // DELETE /:id — Delete webhook
  fastify.delete('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const deleted = await webhookService.delete(user.userId, id);
      if (!deleted) return reply.status(404).send({ error: 'Webhook not found' });

      return { message: 'Webhook deleted' };
    } catch (error) {
      console.error('Delete webhook error:', error);
      return reply.status(500).send({ error: 'Failed to delete webhook' });
    }
  });

  // POST /:id/test — Send test ping
  fastify.post('/:id/test', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = request.params as { id: string };
      const found = await webhookService.test(user.userId, id);
      if (!found) return reply.status(404).send({ error: 'Webhook not found' });

      return { message: 'Test webhook sent' };
    } catch (error) {
      console.error('Test webhook error:', error);
      return reply.status(500).send({ error: 'Failed to send test webhook' });
    }
  });
}
