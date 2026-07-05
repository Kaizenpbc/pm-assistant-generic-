import { databaseService } from './connection';

class SubscriptionRepository {
  async findLatestByUser(userId: string): Promise<any | null> {
    const rows = await databaseService.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    return rows[0] ?? null;
  }

  async findByStripeId(stripeSubscriptionId: string): Promise<any | null> {
    const rows = await databaseService.query(
      'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?',
      [stripeSubscriptionId],
    );
    return rows[0] ?? null;
  }

  insert(
    id: string, userId: string, stripeSubscriptionId: string, stripePriceId: string,
    status: string, periodStart: Date, periodEnd: Date, cancelAtPeriodEnd: boolean,
    canceledAt: Date | null, trialStart: Date | null, trialEnd: Date | null,
  ): Promise<any> {
    return databaseService.query(
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
    return databaseService.query(
      `UPDATE subscriptions SET
        status = ?, current_period_start = ?, current_period_end = ?,
        cancel_at_period_end = ?, canceled_at = ?, trial_start = ?, trial_end = ?
       WHERE stripe_subscription_id = ?`,
      [status, periodStart, periodEnd, cancelAtPeriodEnd, canceledAt, trialStart, trialEnd, stripeSubscriptionId],
    );
  }

  markCanceled(stripeSubscriptionId: string): Promise<any> {
    return databaseService.query(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE stripe_subscription_id = ?`,
      [stripeSubscriptionId],
    );
  }
}

export const subscriptionRepository = new SubscriptionRepository();
