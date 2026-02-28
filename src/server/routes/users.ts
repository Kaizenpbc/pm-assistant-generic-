import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/me', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get current user profile', tags: ['users'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      return {
        user: {
          id: user.userId,
          username: user.username,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch user profile' });
    }
  });
}
