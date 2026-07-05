import { databaseService } from './connection';

export interface DeadLetterRow {
  id: string;
  operation: string;
  payload: string;
  error_message: string;
  attempts: number;
  max_attempts: number;
  status: string;
  next_retry_at: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DeadLetterStatsRow {
  pending: number;
  retrying: number;
  failed: number;
  resolved24h: number;
}

class DeadLetterRepository {
  insert(id: string, operation: string, payload: string, errorMessage: string, nextRetryAt: string): Promise<any> {
    return databaseService.query(
      `INSERT INTO dead_letter_queue (id, operation, payload, error_message, next_retry_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, operation, payload, errorMessage, nextRetryAt],
    );
  }

  async findDueForRetry(now: string, limit = 50): Promise<DeadLetterRow[]> {
    return databaseService.query<DeadLetterRow>(
      `SELECT * FROM dead_letter_queue
       WHERE status IN ('pending', 'retrying') AND next_retry_at <= ?
       ORDER BY created_at ASC LIMIT ?`,
      [now, limit],
    );
  }

  markResolved(id: string): Promise<any> {
    return databaseService.query(
      `UPDATE dead_letter_queue SET status = 'resolved', resolved_at = NOW() WHERE id = ?`,
      [id],
    );
  }

  markFailed(id: string, attempts: number): Promise<any> {
    return databaseService.query(
      `UPDATE dead_letter_queue SET status = 'failed', attempts = ? WHERE id = ?`,
      [attempts, id],
    );
  }

  markRetrying(id: string, attempts: number, nextRetryAt: string, errorMessage: string): Promise<any> {
    return databaseService.query(
      `UPDATE dead_letter_queue SET status = 'retrying', attempts = ?, next_retry_at = ?,
       error_message = ? WHERE id = ?`,
      [attempts, nextRetryAt, errorMessage, id],
    );
  }

  async getStats(): Promise<DeadLetterStatsRow> {
    const rows = await databaseService.query<any>(
      `SELECT
         SUM(status = 'pending') AS pending,
         SUM(status = 'retrying') AS retrying,
         SUM(status = 'failed') AS failed,
         SUM(status = 'resolved' AND resolved_at >= NOW() - INTERVAL 24 HOUR) AS resolved24h
       FROM dead_letter_queue`,
    );
    return rows[0] || { pending: 0, retrying: 0, failed: 0, resolved24h: 0 };
  }

  async findFailed(limit = 50): Promise<DeadLetterRow[]> {
    return databaseService.query<DeadLetterRow>(
      `SELECT * FROM dead_letter_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
  }
}

export const deadLetterRepository = new DeadLetterRepository();
