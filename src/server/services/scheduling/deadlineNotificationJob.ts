import { databaseService } from '../../database/connection';
import { notificationService } from '../NotificationService';
import { redisService } from '../RedisService';
import logger from '../../utils/logger';

/**
 * Scans for tasks with deadlines approaching within 2 days and notifies
 * the assignee (or creator if unassigned). Uses Redis to deduplicate
 * so the same task isn't re-notified on the same date.
 */
export async function runDeadlineNotifications(): Promise<number> {
  let rows: any[];
  try {
    rows = await databaseService.query(
      `SELECT t.id, t.name, t.assigned_to, t.created_by, t.end_date, t.due_date, t.schedule_id,
              s.project_id
       FROM tasks t
       LEFT JOIN schedules s ON s.id = t.schedule_id
       WHERE t.status NOT IN ('completed', 'done', 'cancelled')
         AND (
           (t.end_date IS NOT NULL AND t.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY))
           OR
           (t.due_date IS NOT NULL AND t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY))
         )
       LIMIT 500`,
    );
  } catch {
    return 0;
  }

  const today = new Date().toISOString().slice(0, 10);
  let notified = 0;

  for (const row of rows) {
    const redisKey = `deadline-notified:${row.id}:${today}`;

    // Check Redis dedup (skip if already notified today)
    if (redisService.isConnected()) {
      const existing = await redisService.get(redisKey);
      if (existing) continue;
    }

    const recipientId = row.assigned_to || row.created_by;
    if (!recipientId) continue;

    const deadline = row.due_date || row.end_date;
    const deadlineStr = deadline instanceof Date
      ? deadline.toISOString().slice(0, 10)
      : String(deadline).slice(0, 10);

    try {
      await notificationService.create({
        userId: recipientId,
        type: 'deadline_approaching',
        severity: 'high',
        title: 'Deadline approaching',
        message: `"${row.name}" is due on ${deadlineStr}`,
        projectId: row.project_id || undefined,
        linkType: 'task',
        linkId: row.id,
      });

      // Mark as notified with 3-day TTL
      if (redisService.isConnected()) {
        redisService.set(redisKey, '1', 86400 * 3).catch(() => {});
      }

      notified++;
    } catch (err) {
      logger.error('[DeadlineNotification] Failed to notify', { taskId: row.id, error: err });
    }
  }

  if (notified > 0) {
    logger.info(`[DeadlineNotification] Sent ${notified} deadline notification(s)`);
  }

  return notified;
}
