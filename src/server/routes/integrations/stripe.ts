import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { userService } from '../../services/UserService';
import { stripeService } from '../../services/StripeService';
import { tokenTopUpRepository } from '../../database/TokenTopUpRepository';
import logger from '../../utils/logger';

function resolvePriceId(tier: string, billing: string): string | undefined {
  // Try new tier-specific price IDs first, then fall back to legacy
  if (tier === 'pro') {
    if (billing === 'annual' && config.STRIPE_PRO_ANNUAL_PRICE_ID) return config.STRIPE_PRO_ANNUAL_PRICE_ID;
    if (config.STRIPE_PRO_MONTHLY_PRICE_ID) return config.STRIPE_PRO_MONTHLY_PRICE_ID;
  }
  if (tier === 'business') {
    if (billing === 'annual' && config.STRIPE_BUSINESS_ANNUAL_PRICE_ID) return config.STRIPE_BUSINESS_ANNUAL_PRICE_ID;
    if (config.STRIPE_BUSINESS_MONTHLY_PRICE_ID) return config.STRIPE_BUSINESS_MONTHLY_PRICE_ID;
  }
  if (tier === 'consultant') {
    if (billing === 'annual' && config.STRIPE_CONSULTANT_ANNUAL_PRICE_ID) return config.STRIPE_CONSULTANT_ANNUAL_PRICE_ID;
    if (config.STRIPE_CONSULTANT_MONTHLY_PRICE_ID) return config.STRIPE_CONSULTANT_MONTHLY_PRICE_ID;
  }

  // Legacy fallback (single-plan era)
  if (billing === 'annual' && config.STRIPE_ANNUAL_PRICE_ID) return config.STRIPE_ANNUAL_PRICE_ID;
  if (config.STRIPE_MONTHLY_PRICE_ID) return config.STRIPE_MONTHLY_PRICE_ID;
  return config.STRIPE_PRO_PRICE_ID || undefined;
}

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
    preHandler: [authMiddleware, requireScope('read')],
    schema: { description: 'Create Stripe checkout session', tags: ['stripe'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const { plan, tier } = (request.body as { plan?: string; tier?: string }) || {};
      const user = await userService.findById(userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        return reply.status(400).send({ error: 'No Stripe customer', message: 'Please contact support' });
      }

      const billing = plan || 'monthly';
      const selectedTier = tier || 'consultant'; // default to consultant for legacy clients
      const priceId = resolvePriceId(selectedTier, billing);

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

  // Token top-up purchase
  fastify.post('/create-topup-session', {
    preHandler: [authMiddleware, requireScope('read')],
    schema: { description: 'Create Stripe checkout for token top-up', tags: ['stripe'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const { quantity } = (request.body as { quantity?: number }) || {};
      const qty = Math.max(1, Math.min(quantity || 1, 20)); // 1-20 packs

      const user = await userService.findById(userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        return reply.status(400).send({ error: 'No Stripe customer', message: 'Please contact support' });
      }

      const url = await stripeService.createTopUpSession(
        user.stripeCustomerId,
        userId,
        qty,
      );

      return { url };
    } catch (error) {
      logger.error('Create top-up session error', { error });
      return reply.status(500).send({ error: 'Failed to create top-up session' });
    }
  });

  // Get token top-up balance and history
  fastify.get('/topup-balance', {
    preHandler: [authMiddleware, requireScope('read')],
    schema: { description: 'Get token top-up balance', tags: ['stripe'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;
      const remaining = await tokenTopUpRepository.getRemainingTokens(userId);
      const history = await tokenTopUpRepository.getPurchaseHistory(userId);
      return {
        remainingTopUpTokens: remaining,
        topUpConfig: {
          tokensPerPack: config.AI_TOPUP_TOKENS,
          pricePerPack: config.AI_TOPUP_PRICE_CENTS,
        },
        history,
      };
    } catch (error) {
      logger.error('Get top-up balance error', { error });
      return reply.status(500).send({ error: 'Failed to get balance' });
    }
  });

  fastify.post('/create-portal-session', {
    preHandler: [authMiddleware, requireScope('read')],
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
