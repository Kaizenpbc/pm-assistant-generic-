import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { userService } from '../../services/UserService';
import logger from '../../utils/logger';

const notificationPrefsSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  digestFrequency: z.enum(['none', 'daily', 'weekly']).optional(),
});

const accessibilityPrefsSchema = z.object({
  highContrast: z.boolean().optional(),
  fontSize: z.number().min(12).max(32).optional(),
  reducedMotion: z.boolean().optional(),
  simplificationLevel: z.enum(['off', 'mild', 'strong']).optional(),
  narrationEnabled: z.boolean().optional(),
});

const userPrefsSchema = z.object({
  timezone: z.string().max(100).optional(),
  locale: z.string().max(10).optional(),
});

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
          timezone: dbUser?.timezone ?? 'UTC',
          locale: dbUser?.locale ?? 'en',
        },
      };
    } catch (error) {
      logger.error('Get user profile error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch user profile' });
    }
  });

  fastify.put('/me/notification-preferences', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update notification preferences', tags: ['users'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const parsed = notificationPrefsSchema.parse(request.body);

      const updateData: Record<string, any> = {};
      if (parsed.emailNotificationsEnabled !== undefined) {
        updateData.emailNotificationsEnabled = parsed.emailNotificationsEnabled;
      }
      if (parsed.digestFrequency !== undefined) {
        updateData.digestFrequency = parsed.digestFrequency;
      }

      const updated = await userService.update(userId, updateData);
      return {
        emailNotificationsEnabled: updated?.emailNotificationsEnabled ?? true,
        digestFrequency: updated?.digestFrequency ?? 'none',
      };
    } catch (error) {
      logger.error('Update notification preferences error', { error });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/me/preferences', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update user preferences (timezone, locale)', tags: ['users'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const parsed = userPrefsSchema.parse(request.body);
      const updateData: Record<string, any> = {};

      if (parsed.timezone !== undefined) {
        updateData.timezone = parsed.timezone;
      }
      if (parsed.locale !== undefined) {
        updateData.locale = parsed.locale;
      }

      const updated = await userService.update(userId, updateData);
      return {
        timezone: updated?.timezone ?? 'UTC',
        locale: updated?.locale ?? 'en',
      };
    } catch (error) {
      logger.error('Update user preferences error', { error });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Accessibility preferences
  fastify.get('/me/accessibility', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get accessibility preferences', tags: ['users'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const prefs = await userService.getAccessibilityPrefs(userId);
      return { preferences: prefs };
    } catch (error) {
      logger.error('Get accessibility preferences error', { error });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/me/accessibility', {
    preHandler: [requireScope('read')],
    schema: { description: 'Update accessibility preferences', tags: ['users'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const parsed = accessibilityPrefsSchema.parse(request.body);
      await userService.updateAccessibilityPrefs(userId, parsed);
      return { preferences: parsed };
    } catch (error) {
      logger.error('Update accessibility preferences error', { error });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
