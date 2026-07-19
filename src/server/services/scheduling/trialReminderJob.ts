import { databaseService } from '../../database/connection';
import { emailService } from '../EmailService';
import logger from '../../utils/logger';

/**
 * Sends trial reminder emails to users whose trial is ending soon (3 days, 1 day)
 * and a trial-expired email on the day the trial ends.
 *
 * Uses `digest_last_sent_at` pattern: tracks sent reminders via a simple
 * `trial_reminders_sent` JSON column to avoid duplicate emails.
 * For simplicity, we use a Redis key per user to track which reminders were sent.
 */
export async function runTrialReminders(): Promise<void> {
  try {
    // --- Step 1: Downgrade expired trials ---
    // Set subscription_status = 'none' for users whose trial has passed
    const downgraded = await databaseService.queryControlPlane(
      `UPDATE users
       SET subscription_status = 'none'
       WHERE subscription_status = 'trialing'
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at < NOW()`,
    );
    const downgradedCount = (downgraded as any)?.affectedRows ?? 0;
    if (downgradedCount > 0) {
      logger.info(`[trial-reminder] Downgraded ${downgradedCount} expired trial users to 'none'`);
    }

    // Also downgrade organizations with expired trials
    const orgDowngraded = await databaseService.queryControlPlane(
      `UPDATE organizations
       SET subscription_status = 'none'
       WHERE subscription_status = 'trialing'
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at < NOW()`,
    );
    const orgCount = (orgDowngraded as any)?.affectedRows ?? 0;
    if (orgCount > 0) {
      logger.info(`[trial-reminder] Downgraded ${orgCount} expired trial orgs to 'none'`);
    }

    // --- Step 2: Send reminder/expired emails ---
    // Find trialing users with trial ending in the next 3 days or already expired
    const rows = await databaseService.queryControlPlane(
      `SELECT id, email, full_name, trial_ends_at, subscription_status
       FROM users
       WHERE subscription_status IN ('trialing', 'none')
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
         AND trial_ends_at <= DATE_ADD(NOW(), INTERVAL 4 DAY)
       LIMIT 500`,
    );

    if (rows.length === 0) return;

    const { redisService } = await import('../RedisService');

    for (const row of rows) {
      const trialEnd = new Date(row.trial_ends_at);
      const now = new Date();
      const msLeft = trialEnd.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

      let reminderKey: string;
      if (daysLeft <= 0) {
        reminderKey = `trial-reminder:${row.id}:expired`;
      } else if (daysLeft <= 1) {
        reminderKey = `trial-reminder:${row.id}:1day`;
      } else if (daysLeft <= 3) {
        reminderKey = `trial-reminder:${row.id}:3day`;
      } else {
        continue;
      }

      // Check if this reminder was already sent (Redis key with 30-day TTL)
      const alreadySent = await redisService.get(reminderKey);
      if (alreadySent) continue;

      try {
        const name = row.full_name || 'there';
        if (daysLeft <= 0) {
          await emailService.sendTrialExpiredEmail(row.email, name);
          logger.info(`[trial-reminder] Sent expired email to ${row.id}`);
        } else {
          await emailService.sendTrialReminderEmail(row.email, name, daysLeft);
          logger.info(`[trial-reminder] Sent ${daysLeft}-day reminder to ${row.id}`);
        }

        // Mark as sent (30-day TTL to auto-cleanup)
        await redisService.set(reminderKey, '1', 30 * 24 * 60 * 60);
      } catch (err) {
        logger.error(`[trial-reminder] Failed to send email to ${row.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.error('[trial-reminder] Job failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
