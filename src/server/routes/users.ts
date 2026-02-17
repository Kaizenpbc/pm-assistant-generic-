import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/me', {
    preHandler: [authMiddleware],
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
      request.log.error({ err: error }, 'Get user profile error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch user profile' });
    }
  });
}
