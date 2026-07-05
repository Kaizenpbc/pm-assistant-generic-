import { digestRepository, DigestUserRow } from '../database/DigestRepository';
import { emailService } from './EmailService';
import logger, { maskPii } from '../utils/logger';

export class DigestService {
  async sendPendingDigests(): Promise<number> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday

    // Find users with digests enabled and due
    const users = await digestRepository.findEligibleUsers();

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
        logger.error(`[DigestService] Failed to send digest to ${maskPii(user.email)}:`, err instanceof Error ? err.message : err);
      }
    }

    if (sentCount > 0) {
      logger.info(`[DigestService] Sent ${sentCount} digest email(s)`);
    }

    return sentCount;
  }

  private isDue(user: DigestUserRow, now: Date, dayOfWeek: number): boolean {
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

  private async buildDigest(user: DigestUserRow) {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').substring(0, 19);

    // Overdue tasks assigned to user
    const overdueTasks = await digestRepository.findOverdueTasks(user.username, nowStr);

    // Upcoming deadlines (next 3 days)
    const upcomingDeadlines = await digestRepository.findUpcomingDeadlines(user.username, nowStr, threeDaysFromNow);

    // Unread notification count
    const unreadCount = await digestRepository.countUnreadNotifications(user.id);

    return {
      overdueTasks: overdueTasks.map(t => ({ name: t.name, dueDate: t.end_date?.substring(0, 10) || '' })),
      upcomingDeadlines: upcomingDeadlines.map(t => ({ name: t.name, dueDate: t.end_date?.substring(0, 10) || '' })),
      unreadCount,
      recentChanges: 0,
    };
  }

  private async updateLastSent(userId: string, now: Date): Promise<void> {
    const nowStr = now.toISOString().replace('T', ' ').substring(0, 19);
    await digestRepository.updateLastSent(userId, nowStr);
  }
}

export const digestService = new DigestService();
