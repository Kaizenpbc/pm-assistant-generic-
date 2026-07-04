import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../database/connection', () => ({
  databaseService: { query: (...args: any[]) => mockQuery(...args) },
}));

vi.mock('uuid', () => ({ v4: () => 'dlq-uuid-1234' }));

import { deadLetterService, fireAndForget } from '../../services/DeadLetterService';

describe('DeadLetterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('capture', () => {
    it('inserts a failed operation into the DLQ', () => {
      mockQuery.mockResolvedValue({ affectedRows: 1 });
      deadLetterService.capture('email.send', { to: 'user@example.com' }, new Error('SMTP timeout'));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dead_letter_queue'),
        expect.arrayContaining([
          'dlq-uuid-1234',
          'email.send',
          JSON.stringify({ to: 'user@example.com' }),
          'SMTP timeout',
          expect.any(String), // nextRetryAt
        ]),
      );
    });

    it('handles non-Error objects as error message', () => {
      mockQuery.mockResolvedValue({ affectedRows: 1 });
      deadLetterService.capture('webhook.fire', {}, 'string error');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['string error']),
      );
    });

    it('does not throw if DB insert fails', () => {
      mockQuery.mockRejectedValue(new Error('DB down'));
      // Should not throw — last-resort console.error
      expect(() => deadLetterService.capture('test.op', {}, new Error('fail'))).not.toThrow();
    });
  });

  describe('processRetries', () => {
    it('executes pending entries and marks resolved on success', async () => {
      const entries = [{
        id: 'e1', operation: 'email.send', payload: JSON.stringify({ to: 'a@b.com' }),
        attempts: 0, max_attempts: 3, status: 'pending',
      }];
      mockQuery.mockResolvedValueOnce(entries); // SELECT
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // UPDATE resolved

      const executor = vi.fn().mockResolvedValue(undefined);
      const count = await deadLetterService.processRetries(executor);

      expect(count).toBe(1);
      expect(executor).toHaveBeenCalledWith('email.send', { to: 'a@b.com' });
      expect(mockQuery.mock.calls[1][0]).toContain("status = 'resolved'");
    });

    it('marks entry as failed when max attempts exceeded', async () => {
      const entries = [{
        id: 'e1', operation: 'webhook.fire', payload: JSON.stringify({}),
        attempts: 2, max_attempts: 3, status: 'retrying',
      }];
      mockQuery.mockResolvedValueOnce(entries); // SELECT
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // UPDATE failed

      const executor = vi.fn().mockRejectedValue(new Error('still failing'));
      const count = await deadLetterService.processRetries(executor);

      expect(count).toBe(1);
      expect(mockQuery.mock.calls[1][0]).toContain("status = 'failed'");
    });

    it('sets exponential backoff retry when attempts remain', async () => {
      const entries = [{
        id: 'e1', operation: 'test', payload: JSON.stringify({}),
        attempts: 1, max_attempts: 5, status: 'retrying',
      }];
      mockQuery.mockResolvedValueOnce(entries); // SELECT
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // UPDATE retrying

      const executor = vi.fn().mockRejectedValue(new Error('retry'));
      await deadLetterService.processRetries(executor);

      expect(mockQuery.mock.calls[1][0]).toContain("status = 'retrying'");
      expect(mockQuery.mock.calls[1][1]).toContain(2); // attempts incremented
    });

    it('returns 0 when no pending entries', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const executor = vi.fn();
      const count = await deadLetterService.processRetries(executor);
      expect(count).toBe(0);
      expect(executor).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('returns aggregated stats', async () => {
      mockQuery.mockResolvedValue([{
        pending: 3, retrying: 1, failed: 2, resolved24h: 10,
      }]);
      const stats = await deadLetterService.getStats();
      expect(stats).toEqual({ pending: 3, retrying: 1, failed: 2, resolved24h: 10 });
    });

    it('defaults to 0 for null values', async () => {
      mockQuery.mockResolvedValue([{
        pending: null, retrying: null, failed: null, resolved24h: null,
      }]);
      const stats = await deadLetterService.getStats();
      expect(stats).toEqual({ pending: 0, retrying: 0, failed: 0, resolved24h: 0 });
    });
  });

  describe('fireAndForget', () => {
    it('captures rejection to DLQ', async () => {
      mockQuery.mockResolvedValue({ affectedRows: 1 });
      const failingPromise = Promise.reject(new Error('async failure'));
      fireAndForget(failingPromise, 'bg.task', { key: 'val' });
      // Wait for microtask queue
      await new Promise(r => setTimeout(r, 10));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dead_letter_queue'),
        expect.arrayContaining(['bg.task']),
      );
    });
  });
});
