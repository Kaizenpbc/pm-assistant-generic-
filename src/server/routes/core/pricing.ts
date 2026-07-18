import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pricingConfigService } from '../../services/PricingConfigService';

export async function pricingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/pricing — public, no auth required
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tiers = await pricingConfigService.getAllTiers();
      return { tiers };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
