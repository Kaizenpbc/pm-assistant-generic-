import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

interface DeadLetterEntry {
  id: string;
  operation: string;
  payload: any;
  errorMessage: string;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'retrying' | 'failed' | 'resolved';
  nextRetryAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

class DeadLetterService {
  /**
   * Capture a failed fire-and-forget side effect for later retry.
   */
  capture(operation: string, payload: any, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const id = uuidv4();
    const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    databaseService.query(
      `INSERT INTO dead_letter_queue (id, operation, payload, error_message, next_retry_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, operation, JSON.stringify(payload), errorMessage, nextRetryAt],
    ).catch((dbErr) => {
      // Last resort: log to console if we can't even write to DLQ
      console.error('[DeadLetter] Failed to capture:', operation, errorMessage, dbErr);
    });
  }

  /**
   * Process pending entries that are due for retry.
   * Called by a periodic job (e.g., every 5 minutes).
   * Returns number of entries processed.
   */
  async processRetries(executor: (operation: string, payload: any) => Promise<void>): Promise<number> {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const entries = await databaseService.query<any>(
      `SELECT * FROM dead_letter_queue
       WHERE status IN ('pending', 'retrying') AND next_retry_at <= ?
       ORDER BY created_at ASC LIMIT 50`,
      [now],
    );

    let processed = 0;
    for (const entry of entries) {
      try {
        await executor(entry.operation, JSON.parse(entry.payload));
        // Success — mark resolved
        await databaseService.query(
          `UPDATE dead_letter_queue SET status = 'resolved', resolved_at = NOW() WHERE id = ?`,
          [entry.id],
        );
        processed++;
      } catch (retryErr) {
        const attempts = entry.attempts + 1;
        if (attempts >= entry.max_attempts) {
          await databaseService.query(
            `UPDATE dead_letter_queue SET status = 'failed', attempts = ? WHERE id = ?`,
            [attempts, entry.id],
          );
        } else {
          // Exponential backoff: 5min, 25min, 125min...
          const delayMs = Math.pow(5, attempts) * 60 * 1000;
          const nextRetry = new Date(Date.now() + delayMs).toISOString().replace('T', ' ').substring(0, 19);
          await databaseService.query(
            `UPDATE dead_letter_queue SET status = 'retrying', attempts = ?, next_retry_at = ?,
             error_message = ? WHERE id = ?`,
            [attempts, nextRetry, retryErr instanceof Error ? retryErr.message : String(retryErr), entry.id],
          );
        }
        processed++;
      }
    }

    return processed;
  }

  /**
   * Get DLQ stats for monitoring.
   */
  async getStats(): Promise<{ pending: number; retrying: number; failed: number; resolved24h: number }> {
    const rows = await databaseService.query<any>(
      `SELECT
         SUM(status = 'pending') AS pending,
         SUM(status = 'retrying') AS retrying,
         SUM(status = 'failed') AS failed,
         SUM(status = 'resolved' AND resolved_at >= NOW() - INTERVAL 24 HOUR) AS resolved24h
       FROM dead_letter_queue`,
    );
    const row = rows[0] || {};
    return {
      pending: Number(row.pending || 0),
      retrying: Number(row.retrying || 0),
      failed: Number(row.failed || 0),
      resolved24h: Number(row.resolved24h || 0),
    };
  }

  /**
   * List failed entries for admin review.
   */
  async listFailed(limit = 50): Promise<DeadLetterEntry[]> {
    const rows = await databaseService.query<any>(
      `SELECT * FROM dead_letter_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map((r: any) => ({
      id: r.id,
      operation: r.operation,
      payload: JSON.parse(r.payload),
      errorMessage: r.error_message,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      status: r.status,
      nextRetryAt: r.next_retry_at,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    }));
  }
}

export const deadLetterService = new DeadLetterService();

/**
 * Fire-and-forget helper that captures failures to the dead-letter queue.
 * Use instead of `.catch(() => {})` for important side effects.
 */
export function fireAndForget(promise: Promise<any>, operation: string, payload?: any): void {
  promise.catch((err) => deadLetterService.capture(operation, payload ?? {}, err));
}
