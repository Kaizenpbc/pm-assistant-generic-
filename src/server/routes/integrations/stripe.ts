import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { userService } from '../../services/UserService';
import { stripeService } from '../../services/StripeService';
import logger from '../../utils/logger';

export async function stripeRoutes(fastify: FastifyInstance) {
  // Stripe webhook — must receive raw body, no auth
  fastify.post('/webhook', {
    config: { rawBody: true },
    schema: { description: 'Stripe webhook endpoint', tags: ['stripe'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['stripe-signature'] as string;
      if (!signature) {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      const rawBody = request.rawBody;
      if (!rawBody) {
        return reply.status(400).send({ error: 'Missing raw body' });
      }

      await stripeService.handleWebhookEvent(rawBody as Buffer, signature);
      return { received: true };
    } catch (error) {
      logger.error('Stripe webhook error', { error });
      return reply.status(400).send({ error: 'Webhook processing failed' });
    }
  });

  // Authenticated routes
  fastify.post('/create-checkout-session', {
    preHandler: [authMiddleware, requireScope('write')],
    schema: { description: 'Create Stripe checkout session', tags: ['stripe'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const { plan } = (request.body as { plan?: string }) || {};
      const user = await userService.findById(userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        return reply.status(400).send({ error: 'No Stripe customer', message: 'Please contact support' });
      }

      // Resolve price ID from plan parameter
      let priceId: string | undefined;
      if (plan === 'annual' && config.STRIPE_ANNUAL_PRICE_ID) {
        priceId = config.STRIPE_ANNUAL_PRICE_ID;
      } else if (config.STRIPE_MONTHLY_PRICE_ID) {
        priceId = config.STRIPE_MONTHLY_PRICE_ID;
      } else {
        priceId = config.STRIPE_PRO_PRICE_ID; // legacy fallback
      }

      if (!priceId) {
        return reply.status(500).send({ error: 'Stripe not configured', message: 'Pricing is not configured' });
      }

      const url = await stripeService.createCheckoutSession(
        user.stripeCustomerId,
        priceId,
        userId
      );

      return { url };
    } catch (error) {
      logger.error('Create checkout session error', { error });
      return reply.status(500).send({ error: 'Failed to create checkout session' });
    }
  });

  fastify.post('/create-portal-session', {
    preHandler: [authMiddleware, requireScope('write')],
    schema: { description: 'Create Stripe billing portal session', tags: ['stripe'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const user = await userService.findById(userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        return reply.status(400).send({ error: 'No Stripe customer', message: 'No billing account found' });
      }

      const url = await stripeService.createBillingPortalSession(user.stripeCustomerId);
      return { url };
    } catch (error) {
      logger.error('Create portal session error', { error });
      return reply.status(500).send({ error: 'Failed to create portal session' });
    }
  });

  fastify.get('/subscription-status', {
    preHandler: [authMiddleware, requireScope('read')],
    schema: { description: 'Get subscription status', tags: ['stripe'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const status = await stripeService.getSubscriptionStatus(userId);
      return status;
    } catch (error) {
      logger.error('Get subscription status error', { error });
      return reply.status(500).send({ error: 'Failed to get subscription status' });
    }
  });

  // Public endpoint to get the publishable key
  fastify.get('/config', {
    schema: { description: 'Get Stripe publishable key', tags: ['stripe'] },
  }, async () => {
    return { publishableKey: config.STRIPE_PUBLISHABLE_KEY };
  });
}
