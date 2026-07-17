import Stripe from 'stripe';
import { config } from '../config';
import { UserService } from './UserService';
import { subscriptionRepository } from '../database/SubscriptionRepository';
import { tokenTopUpRepository } from '../database/TokenTopUpRepository';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class StripeService {
  private stripe: Stripe | null = null;
  private userService = new UserService();

  private getClient(): Stripe {
    if (!this.stripe) {
      if (!config.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
      }
      this.stripe = new Stripe(config.STRIPE_SECRET_KEY);
    }
    return this.stripe;
  }

  get isConfigured(): boolean {
    return !!config.STRIPE_SECRET_KEY;
  }

  async createCustomer(email: string, name: string, userId: string): Promise<string | null> {
    if (!this.isConfigured) {
      logger.info(`[StripeService] Would create customer for [email_redacted]`);
      return null;
    }

    const customer = await this.getClient().customers.create({
      email,
      name,
      metadata: { userId },
    });
    return customer.id;
  }

  async createCheckoutSession(customerId: string, priceId: string, userId: string): Promise<string> {
    const session = await this.getClient().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        metadata: { userId },
      },
      success_url: `${config.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.APP_URL}/pricing`,
      metadata: { userId },
    });
    return session.url!;
  }

  async createTopUpSession(customerId: string, userId: string, quantity: number): Promise<string> {
    const priceId = config.STRIPE_TOPUP_PRICE_ID;
    if (!priceId) {
      throw new Error('STRIPE_TOPUP_PRICE_ID is not configured');
    }

    const session = await this.getClient().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity }],
      mode: 'payment',
      metadata: { userId, type: 'token_topup', quantity: String(quantity) },
      success_url: `${config.APP_URL}/settings?topup=success`,
      cancel_url: `${config.APP_URL}/settings?topup=canceled`,
    });
    return session.url!;
  }

  async createBillingPortalSession(customerId: string): Promise<string> {
    const session = await this.getClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.APP_URL}/dashboard`,
    });
    return session.url;
  }

  async handleWebhookEvent(payload: Buffer, signature: string): Promise<void> {
    const stripe = this.getClient();
    const event = stripe.webhooks.constructEvent(payload, signature, config.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.upsertSubscription(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await this.upsertSubscription(subscription);
        } else if (session.mode === 'payment' && session.metadata?.type === 'token_topup') {
          await this.handleTopUpCompleted(session);
        }
        break;
      }
      case 'invoice.payment_failed':
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subId = invoice.subscription as string | undefined;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await this.upsertSubscription(subscription);
        }
        break;
      }
      default:
        logger.info(`[StripeService] Unhandled event type: ${event.type}`);
    }
  }

  async getSubscriptionStatus(userId: string): Promise<{
    tier: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  }> {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');

    const sub = await subscriptionRepository.findLatestByUser(userId);
    const isAdmin = user.role === 'admin';
    return {
      tier: isAdmin ? 'consultant' : user.subscriptionTier,
      status: isAdmin ? 'active' : user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      currentPeriodEnd: sub ? sub.current_period_end : null,
      cancelAtPeriodEnd: sub ? Boolean(sub.cancel_at_period_end) : false,
    };
  }

  private async handleTopUpCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const quantity = parseInt(session.metadata?.quantity || '1', 10);
    if (!userId) {
      logger.error('[StripeService] Top-up session missing userId metadata');
      return;
    }

    // Prevent double-processing
    const existing = await tokenTopUpRepository.findByStripeSession(session.id);
    if (existing) return;

    const tokensPerPack = config.AI_TOPUP_TOKENS;
    const totalTokens = tokensPerPack * quantity;
    const totalCents = config.AI_TOPUP_PRICE_CENTS * quantity;

    await tokenTopUpRepository.create(userId, totalTokens, totalCents, session.id);
    logger.info(`[StripeService] Top-up credited: ${totalTokens} tokens for user ${userId}`);
  }

  private resolveTierFromPriceId(priceId: string | undefined): 'free' | 'pro' | 'business' | 'consultant' {
    if (!priceId) return 'free';

    const proPriceIds = [
      config.STRIPE_PRO_MONTHLY_PRICE_ID,
      config.STRIPE_PRO_ANNUAL_PRICE_ID,
    ].filter(Boolean);
    if (proPriceIds.includes(priceId)) return 'pro';

    const businessPriceIds = [
      config.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
      config.STRIPE_BUSINESS_ANNUAL_PRICE_ID,
    ].filter(Boolean);
    if (businessPriceIds.includes(priceId)) return 'business';

    const consultantPriceIds = [
      config.STRIPE_CONSULTANT_MONTHLY_PRICE_ID,
      config.STRIPE_CONSULTANT_ANNUAL_PRICE_ID,
      // Legacy single-plan price IDs map to consultant
      config.STRIPE_MONTHLY_PRICE_ID,
      config.STRIPE_ANNUAL_PRICE_ID,
      config.STRIPE_PRO_PRICE_ID,
    ].filter(Boolean);
    if (consultantPriceIds.includes(priceId)) return 'consultant';

    return 'free';
  }

  private async upsertSubscription(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.userService.findByStripeCustomerId(customerId);
    if (!user) {
      logger.error(`[StripeService] No user found for Stripe customer ${customerId}`);
      return;
    }

    // Determine tier from price ID
    const item = subscription.items.data[0];
    const priceId = item?.price?.id;
    const tier = this.resolveTierFromPriceId(priceId);

    // Map Stripe status
    const statusMap: Record<string, 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none'> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      incomplete: 'incomplete',
      incomplete_expired: 'none',
      unpaid: 'past_due',
    };
    const status = statusMap[subscription.status] || 'none';

    // In Stripe SDK v20+, period dates are on subscription items
    const sub = subscription as any;
    const periodStart = item?.current_period_start ?? sub.current_period_start;
    const periodEnd = item?.current_period_end ?? sub.current_period_end;

    // Update user
    await this.userService.update(user.id, {
      subscriptionTier: tier,
      subscriptionStatus: status,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    });

    // Upsert subscription record
    const existing = await subscriptionRepository.findByStripeId(subscription.id);

    if (existing) {
      await subscriptionRepository.update(
        subscription.id,
        subscription.status,
        new Date(periodStart * 1000),
        new Date(periodEnd * 1000),
        subscription.cancel_at_period_end,
        subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      );
    } else {
      await subscriptionRepository.insert(
        uuidv4(),
        user.id,
        subscription.id,
        priceId || '',
        subscription.status,
        new Date(periodStart * 1000),
        new Date(periodEnd * 1000),
        subscription.cancel_at_period_end,
        subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      );
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.userService.findByStripeCustomerId(customerId);
    if (!user) return;

    await this.userService.update(user.id, {
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
    });

    await subscriptionRepository.markCanceled(subscription.id);
  }
  async cancelAllSubscriptions(stripeCustomerId: string): Promise<void> {
    if (!this.stripe) return;
    const subscriptions = await this.stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active' });
    for (const sub of subscriptions.data) {
      await this.stripe.subscriptions.cancel(sub.id);
    }
    const trialing = await this.stripe.subscriptions.list({ customer: stripeCustomerId, status: 'trialing' });
    for (const sub of trialing.data) {
      await this.stripe.subscriptions.cancel(sub.id);
    }
  }
}

export const stripeService = new StripeService();
