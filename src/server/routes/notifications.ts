import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { notificationService } from '../services/NotificationService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET / — list notifications for authenticated user
  fastify.get('/', {
    schema: { description: 'List notifications for the current user', tags: ['notifications'] },
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };
      const notifications = await notificationService.getByUserId(
        user.userId,
        parseInt(limit, 10),
        parseInt(offset, 10),
      );
      return { notifications };
    } catch (error) {
      console.error('Get notifications error:', error);
      return reply.status(500).send({ error: 'Failed to fetch notifications' });
    }
  });

  // GET /unread-count — unread count
  fastify.get('/unread-count', {
    schema: { description: 'Get unread notification count', tags: ['notifications'] },
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const count = await notificationService.getUnreadCount(user.userId);
      return { count };
    } catch (error) {
      console.error('Get unread count error:', error);
      return reply.status(500).send({ error: 'Failed to fetch unread count' });
    }
  });

  // POST /:id/read — mark one read
  fastify.post('/:id/read', {
    schema: { description: 'Mark a notification as read', tags: ['notifications'] },
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await notificationService.markRead(id);
      return { message: 'Notification marked as read' };
    } catch (error) {
      console.error('Mark read error:', error);
      return reply.status(500).send({ error: 'Failed to mark notification as read' });
    }
  });

  // POST /mark-all-read — mark all read for user
  fastify.post('/mark-all-read', {
    schema: { description: 'Mark all notifications as read', tags: ['notifications'] },
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      await notificationService.markAllRead(user.userId);
      return { message: 'All notifications marked as read' };
    } catch (error) {
      console.error('Mark all read error:', error);
      return reply.status(500).send({ error: 'Failed to mark all as read' });
    }
  });
}
