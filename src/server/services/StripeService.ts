import Stripe from 'stripe';
import { config } from '../config';
import { UserService } from './UserService';
import { databaseService } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

class StripeService {
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
      console.log(`[StripeService] Would create customer for ${email}`);
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
        trial_period_days: 14,
        metadata: { userId },
      },
      success_url: `${config.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.APP_URL}/pricing`,
      metadata: { userId },
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
        }
        break;
      }
      default:
        console.log(`[StripeService] Unhandled event type: ${event.type}`);
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

    const rows = await databaseService.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    const sub = rows[0];
    const isAdmin = user.role === 'admin';
    return {
      tier: isAdmin ? 'pro' : user.subscriptionTier,
      status: isAdmin ? 'active' : user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      currentPeriodEnd: sub ? sub.current_period_end : null,
      cancelAtPeriodEnd: sub ? Boolean(sub.cancel_at_period_end) : false,
    };
  }

  private async upsertSubscription(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.userService.findByStripeCustomerId(customerId);
    if (!user) {
      console.error(`[StripeService] No user found for Stripe customer ${customerId}`);
      return;
    }

    // Determine tier from price ID
    const item = subscription.items.data[0];
    const priceId = item?.price?.id;
    let tier: 'free' | 'pro' | 'business' = 'free';
    if (priceId === config.STRIPE_PRO_PRICE_ID) tier = 'pro';

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
    const existing = await databaseService.query(
      'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?',
      [subscription.id]
    );

    if (existing.length > 0) {
      await databaseService.query(
        `UPDATE subscriptions SET
          status = ?, current_period_start = ?, current_period_end = ?,
          cancel_at_period_end = ?, canceled_at = ?, trial_start = ?, trial_end = ?
         WHERE stripe_subscription_id = ?`,
        [
          subscription.status,
          new Date(periodStart * 1000),
          new Date(periodEnd * 1000),
          subscription.cancel_at_period_end,
          subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
          subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          subscription.id,
        ]
      );
    } else {
      await databaseService.query(
        `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status,
          current_period_start, current_period_end, cancel_at_period_end, canceled_at, trial_start, trial_end)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
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

    await databaseService.query(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE stripe_subscription_id = ?`,
      [subscription.id]
    );
  }
}

export const stripeService = new StripeService();
