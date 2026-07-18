import { FastifyRequest, FastifyReply } from 'fastify';
import { userService } from '../services/UserService';

export function requireTier(...allowedTiers: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role === 'admin') return;
    if (request.user?.role === 'viewer') return;

    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const user = await userService.findById(userId);
    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    const tier = user.subscriptionTier;
    if (!allowedTiers.includes(tier)) {
      return reply.status(403).send({
        error: 'Upgrade required',
        message: 'This feature requires a paid subscription.',
        upgradeUrl: '/pricing',
        currentTier: tier,
      });
    }
  };
}

export const requirePaidTier = requireTier('consultant', 'sme', 'enterprise');
