import { databaseService } from './connection';

class SubscriptionRepository {
  async findLatestByUser(userId: string): Promise<any | null> {
    const rows = await databaseService.queryControlPlane(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    return rows[0] ?? null;
  }

  async findByStripeId(stripeSubscriptionId: string): Promise<any | null> {
    const rows = await databaseService.queryControlPlane(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?',
      [stripeSubscriptionId],
    );
    return rows[0] ?? null;
  }

  insert(
    id: string, userId: string, stripeSubscriptionId: string, stripePriceId: string,
    status: string, periodStart: Date, periodEnd: Date, cancelAtPeriodEnd: boolean,
    canceledAt: Date | null, trialStart: Date | null, trialEnd: Date | null,
  ): Promise<any> {
    return databaseService.queryControlPlane(
      `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status,
        current_period_start, current_period_end, cancel_at_period_end, canceled_at, trial_start, trial_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, stripeSubscriptionId, stripePriceId, status, periodStart, periodEnd,
       cancelAtPeriodEnd, canceledAt, trialStart, trialEnd],
    );
  }

  update(
    stripeSubscriptionId: string, status: string, periodStart: Date, periodEnd: Date,
    cancelAtPeriodEnd: boolean, canceledAt: Date | null, trialStart: Date | null, trialEnd: Date | null,
  ): Promise<any> {
    return databaseService.queryControlPlane(
      `UPDATE subscriptions SET
        status = ?, current_period_start = ?, current_period_end = ?,
        cancel_at_period_end = ?, canceled_at = ?, trial_start = ?, trial_end = ?
       WHERE stripe_subscription_id = ?`,
      [status, periodStart, periodEnd, cancelAtPeriodEnd, canceledAt, trialStart, trialEnd, stripeSubscriptionId],
    );
  }

  markCanceled(stripeSubscriptionId: string): Promise<any> {
    return databaseService.queryControlPlane(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE stripe_subscription_id = ?`,
      [stripeSubscriptionId],
    );
  }

  async updateRevenueColumns(
    stripeSubscriptionId: string,
    amountCents: number,
    currency: string,
    billingInterval: 'month' | 'year',
  ): Promise<void> {
    await databaseService.queryControlPlane(
      `UPDATE subscriptions SET amount_cents = ?, currency = ?, billing_interval = ?
       WHERE stripe_subscription_id = ?`,
      [amountCents, currency, billingInterval, stripeSubscriptionId],
    );
  }

  async findAllActiveWithRevenue(): Promise<Array<{ amount_cents: number; billing_interval: string }>> {
    return databaseService.queryControlPlane(
      `SELECT amount_cents, billing_interval
       FROM subscriptions
       WHERE status IN ('active', 'trialing') AND amount_cents IS NOT NULL`,
    );
  }

  async getSubscriberCountsByTier(): Promise<Array<{ tier: string; count: number }>> {
    return databaseService.queryControlPlane(
      `SELECT u.subscription_tier AS tier, COUNT(*) AS count
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.status IN ('active', 'trialing')
       GROUP BY u.subscription_tier
       ORDER BY count DESC`,
    );
  }
}

export const subscriptionRepository = new SubscriptionRepository();
