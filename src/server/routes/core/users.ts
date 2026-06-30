import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { userService } from '../../services/UserService';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/me', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get current user profile', tags: ['users'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const reqUser = request.user!;
      const dbUser = await userService.findById(reqUser.userId);

      return {
        user: {
          id: reqUser.userId,
          username: reqUser.username,
          role: reqUser.role,
          email: dbUser?.email,
          fullName: dbUser?.fullName,
          emailNotificationsEnabled: dbUser?.emailNotificationsEnabled ?? true,
          digestFrequency: dbUser?.digestFrequency ?? 'none',
        },
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch user profile' });
    }
  });

  fastify.put('/me/notification-preferences', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update notification preferences', tags: ['users'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const body = request.body as any || {};
      const { emailNotificationsEnabled, digestFrequency } = body;

      const updateData: Record<string, any> = {};
      if (emailNotificationsEnabled !== undefined) {
        updateData.emailNotificationsEnabled = emailNotificationsEnabled;
      }
      if (digestFrequency !== undefined) {
        if (!['none', 'daily', 'weekly'].includes(digestFrequency)) {
          return reply.status(400).send({ error: 'Invalid digestFrequency. Must be none, daily, or weekly.' });
        }
        updateData.digestFrequency = digestFrequency;
      }

      const updated = await userService.update(userId, updateData);
      return {
        emailNotificationsEnabled: updated?.emailNotificationsEnabled ?? true,
        digestFrequency: updated?.digestFrequency ?? 'none',
      };
    } catch (error) {
      console.error('Update notification preferences error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
