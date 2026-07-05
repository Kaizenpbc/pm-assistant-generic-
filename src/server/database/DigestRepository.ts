import { databaseService } from './connection';

export interface DigestUserRow {
  id: string;
  username: string;
  email: string;
  full_name: string;
  digest_frequency: string;
  digest_last_sent_at: string | null;
}

class DigestRepository {
  async findEligibleUsers(): Promise<DigestUserRow[]> {
    return databaseService.query<DigestUserRow>(
      `SELECT id, username, email, full_name, digest_frequency, digest_last_sent_at
       FROM users
       WHERE digest_frequency != 'none'
         AND email_verified = TRUE
         AND email_notifications_enabled = TRUE
         AND is_active = TRUE`,
    );
  }

  async findOverdueTasks(assignedTo: string, now: string, limit = 20): Promise<Array<{ name: string; end_date: string }>> {
    return databaseService.query<{ name: string; end_date: string }>(
      `SELECT name, end_date FROM tasks
       WHERE assigned_to = ? AND end_date < ? AND status NOT IN ('completed', 'cancelled')
       ORDER BY end_date ASC LIMIT ?`,
      [assignedTo, now, limit],
    );
  }

  async findUpcomingDeadlines(assignedTo: string, now: string, until: string, limit = 20): Promise<Array<{ name: string; end_date: string }>> {
    return databaseService.query<{ name: string; end_date: string }>(
      `SELECT name, end_date FROM tasks
       WHERE assigned_to = ? AND end_date >= ? AND end_date <= ? AND status NOT IN ('completed', 'cancelled')
       ORDER BY end_date ASC LIMIT ?`,
      [assignedTo, now, until, limit],
    );
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const rows = await databaseService.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [userId],
    );
    return rows[0]?.cnt ?? 0;
  }

  updateLastSent(userId: string, now: string): Promise<any> {
    return databaseService.query(
      `UPDATE users SET digest_last_sent_at = ? WHERE id = ?`,
      [now, userId],
    );
  }
}

export const digestRepository = new DigestRepository();
