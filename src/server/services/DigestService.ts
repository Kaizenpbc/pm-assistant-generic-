import { databaseService } from '../database/connection';
import { emailService } from './EmailService';

interface DigestUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  digest_frequency: 'daily' | 'weekly';
  digest_last_sent_at: string | null;
}

export class DigestService {
  async sendPendingDigests(): Promise<number> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday

    // Find users with digests enabled and due
    const users = await databaseService.query<DigestUser>(
      `SELECT id, username, email, full_name, digest_frequency, digest_last_sent_at
       FROM users
       WHERE digest_frequency != 'none'
         AND email_verified = TRUE
         AND email_notifications_enabled = TRUE
         AND is_active = TRUE`,
    );

    let sentCount = 0;

    for (const user of users) {
      if (!this.isDue(user, now, dayOfWeek)) continue;

      try {
        const digest = await this.buildDigest(user);
        if (digest.overdueTasks.length === 0 && digest.upcomingDeadlines.length === 0 && digest.unreadCount === 0) {
          // Nothing to report — skip but update timestamp
          await this.updateLastSent(user.id, now);
          continue;
        }

        await emailService.sendDigestEmail(user.email, user.full_name || user.username, digest);
        await this.updateLastSent(user.id, now);
        sentCount++;
      } catch (err) {
        console.error(`[DigestService] Failed to send digest to ${user.email}:`, err);
      }
    }

    if (sentCount > 0) {
      console.log(`[DigestService] Sent ${sentCount} digest email(s)`);
    }

    return sentCount;
  }

  private isDue(user: DigestUser, now: Date, dayOfWeek: number): boolean {
    const lastSent = user.digest_last_sent_at ? new Date(user.digest_last_sent_at) : null;
    const hoursSinceLastSent = lastSent
      ? (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60)
      : Infinity;

    if (user.digest_frequency === 'daily') {
      return hoursSinceLastSent >= 23; // ~24h with some tolerance
    }

    if (user.digest_frequency === 'weekly') {
      return dayOfWeek === 1 && hoursSinceLastSent >= 167; // Monday, ~7 days
    }

    return false;
  }

  private async buildDigest(user: DigestUser) {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').substring(0, 19);

    // Overdue tasks assigned to user
    const overdueTasks = await databaseService.query<{ name: string; end_date: string }>(
      `SELECT name, end_date FROM tasks
       WHERE assigned_to = ? AND end_date < ? AND status NOT IN ('completed', 'cancelled')
       ORDER BY end_date ASC LIMIT 20`,
      [user.username, nowStr],
    );

    // Upcoming deadlines (next 3 days)
    const upcomingDeadlines = await databaseService.query<{ name: string; end_date: string }>(
      `SELECT name, end_date FROM tasks
       WHERE assigned_to = ? AND end_date >= ? AND end_date <= ? AND status NOT IN ('completed', 'cancelled')
       ORDER BY end_date ASC LIMIT 20`,
      [user.username, nowStr, threeDaysFromNow],
    );

    // Unread notification count
    const countRows = await databaseService.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [user.id],
    );

    return {
      overdueTasks: overdueTasks.map(t => ({ name: t.name, dueDate: t.end_date?.substring(0, 10) || '' })),
      upcomingDeadlines: upcomingDeadlines.map(t => ({ name: t.name, dueDate: t.end_date?.substring(0, 10) || '' })),
      unreadCount: countRows[0]?.cnt ?? 0,
      recentChanges: 0,
    };
  }

  private async updateLastSent(userId: string, now: Date): Promise<void> {
    const nowStr = now.toISOString().replace('T', ' ').substring(0, 19);
    await databaseService.query(
      `UPDATE users SET digest_last_sent_at = ? WHERE id = ?`,
      [nowStr, userId],
    );
  }
}

export const digestService = new DigestService();
