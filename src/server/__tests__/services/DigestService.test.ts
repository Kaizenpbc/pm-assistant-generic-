import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/EmailService', () => ({
  emailService: { sendDigestEmail: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  maskPii: vi.fn((v: string) => '***masked***'),
}));

import { DigestService } from '../../services/DigestService';
import { databaseService } from '../../database/connection';
import { emailService } from '../../services/EmailService';
import logger from '../../utils/logger';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;
const mockSendDigestEmail = emailService.sendDigestEmail as ReturnType<typeof vi.fn>;

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    full_name: 'Alice Smith',
    digest_frequency: 'daily',
    digest_last_sent_at: null, // never sent => always due
    ...overrides,
  };
}

describe('DigestService', () => {
  let service: DigestService;

  beforeEach(() => {
    service = new DigestService();
    vi.clearAllMocks();
  });

  describe('sendPendingDigests', () => {
    it('sends digest to users with notifications enabled and overdue tasks', async () => {
      const user = makeUser();

      // 1st query: find users
      mockQuery.mockResolvedValueOnce([user]);
      // 2nd query: overdue tasks
      mockQuery.mockResolvedValueOnce([{ name: 'Fix bug', end_date: '2026-06-30 00:00:00' }]);
      // 3rd query: upcoming deadlines
      mockQuery.mockResolvedValueOnce([]);
      // 4th query: unread notification count
      mockQuery.mockResolvedValueOnce([{ cnt: 2 }]);
      // 5th query: project_members for recent changes
      mockQuery.mockResolvedValueOnce([]);
      // 6th query: updateLastSent
      mockQuery.mockResolvedValueOnce(undefined);

      const count = await service.sendPendingDigests();

      expect(count).toBe(1);
      expect(mockSendDigestEmail).toHaveBeenCalledTimes(1);
      expect(mockSendDigestEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice Smith',
        expect.objectContaining({
          overdueTasks: [{ name: 'Fix bug', dueDate: '2026-06-30' }],
          upcomingDeadlines: [],
          unreadCount: 2,
        }),
      );
    });

    it('returns 0 and sends no email when no users are found', async () => {
      mockQuery.mockResolvedValueOnce([]); // no users

      const count = await service.sendPendingDigests();

      expect(count).toBe(0);
      expect(mockSendDigestEmail).not.toHaveBeenCalled();
    });

    it('skips users whose digest is not yet due', async () => {
      const recentlySent = makeUser({
        digest_frequency: 'daily',
        digest_last_sent_at: new Date().toISOString(), // sent just now
      });

      mockQuery.mockResolvedValueOnce([recentlySent]);

      const count = await service.sendPendingDigests();

      expect(count).toBe(0);
      expect(mockSendDigestEmail).not.toHaveBeenCalled();
    });

    it('skips sending email but updates timestamp when digest content is empty', async () => {
      const user = makeUser();

      mockQuery.mockResolvedValueOnce([user]);
      // overdue tasks: empty
      mockQuery.mockResolvedValueOnce([]);
      // upcoming deadlines: empty
      mockQuery.mockResolvedValueOnce([]);
      // unread count: 0
      mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
      // project_members for recent changes
      mockQuery.mockResolvedValueOnce([]);
      // updateLastSent
      mockQuery.mockResolvedValueOnce(undefined);

      const count = await service.sendPendingDigests();

      expect(count).toBe(0);
      expect(mockSendDigestEmail).not.toHaveBeenCalled();
      // updateLastSent should have been called (6th query)
      expect(mockQuery).toHaveBeenCalledTimes(6);
      expect(mockQuery.mock.calls[5][0]).toContain('UPDATE users SET digest_last_sent_at');
    });

    it('continues processing other users when one email send fails', async () => {
      const user1 = makeUser({ id: 'u1', email: 'alice@example.com' });
      const user2 = makeUser({ id: 'u2', username: 'bob', email: 'bob@example.com', full_name: 'Bob Jones' });

      mockQuery.mockResolvedValueOnce([user1, user2]);

      // User 1: has overdue tasks
      mockQuery.mockResolvedValueOnce([{ name: 'Task A', end_date: '2026-06-28 00:00:00' }]);
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([{ cnt: 1 }]);
      mockQuery.mockResolvedValueOnce([]); // project_members

      // User 2: has upcoming deadlines
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([{ name: 'Task B', end_date: '2026-07-05 00:00:00' }]);
      mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
      mockQuery.mockResolvedValueOnce([]); // project_members
      // User 2: updateLastSent
      mockQuery.mockResolvedValueOnce(undefined);

      // First email fails, second succeeds
      mockSendDigestEmail
        .mockRejectedValueOnce(new Error('SMTP connection refused'))
        .mockResolvedValueOnce(undefined);

      const count = await service.sendPendingDigests();

      expect(count).toBe(1);
      expect(mockSendDigestEmail).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[DigestService] Failed to send digest'),
        'SMTP connection refused',
      );
    });

    it('sends digest when user has only unread notifications', async () => {
      const user = makeUser();

      mockQuery.mockResolvedValueOnce([user]);
      mockQuery.mockResolvedValueOnce([]); // no overdue
      mockQuery.mockResolvedValueOnce([]); // no upcoming
      mockQuery.mockResolvedValueOnce([{ cnt: 5 }]); // 5 unread notifications
      mockQuery.mockResolvedValueOnce([]); // project_members
      mockQuery.mockResolvedValueOnce(undefined); // updateLastSent

      const count = await service.sendPendingDigests();

      expect(count).toBe(1);
      expect(mockSendDigestEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice Smith',
        expect.objectContaining({ unreadCount: 5 }),
      );
    });

    it('uses username as fallback when full_name is empty', async () => {
      const user = makeUser({ full_name: '' });

      mockQuery.mockResolvedValueOnce([user]);
      mockQuery.mockResolvedValueOnce([{ name: 'Overdue task', end_date: '2026-06-25 12:00:00' }]);
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
      mockQuery.mockResolvedValueOnce([]); // project_members
      mockQuery.mockResolvedValueOnce(undefined);

      await service.sendPendingDigests();

      // full_name is empty string which is falsy, so || falls back to username
      expect(mockSendDigestEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'alice',
        expect.any(Object),
      );
    });

    it('handles weekly digest frequency - due on Monday after 167+ hours', async () => {
      // Create a date that is a Monday
      const monday = new Date('2026-07-06T10:00:00Z'); // July 6, 2026 is a Monday
      vi.useFakeTimers();
      vi.setSystemTime(monday);

      const user = makeUser({
        digest_frequency: 'weekly',
        digest_last_sent_at: null, // never sent
      });

      mockQuery.mockResolvedValueOnce([user]);
      mockQuery.mockResolvedValueOnce([{ name: 'Weekly task', end_date: '2026-07-01 00:00:00' }]);
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
      mockQuery.mockResolvedValueOnce([]); // project_members
      mockQuery.mockResolvedValueOnce(undefined);

      const count = await service.sendPendingDigests();

      expect(count).toBe(1);

      vi.useRealTimers();
    });

    it('skips weekly digest when day is not Monday', async () => {
      // Set to a Wednesday
      const wednesday = new Date('2026-07-08T10:00:00Z'); // Wednesday
      vi.useFakeTimers();
      vi.setSystemTime(wednesday);

      const user = makeUser({
        digest_frequency: 'weekly',
        digest_last_sent_at: null,
      });

      mockQuery.mockResolvedValueOnce([user]);

      const count = await service.sendPendingDigests();

      expect(count).toBe(0);
      expect(mockSendDigestEmail).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('skips weekly digest on Monday when sent less than 167 hours ago', async () => {
      const monday = new Date('2026-07-06T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(monday);

      // Last sent 100 hours ago (< 167)
      const lastSent = new Date(monday.getTime() - 100 * 60 * 60 * 1000).toISOString();
      const user = makeUser({
        digest_frequency: 'weekly',
        digest_last_sent_at: lastSent,
      });

      mockQuery.mockResolvedValueOnce([user]);

      const count = await service.sendPendingDigests();

      expect(count).toBe(0);

      vi.useRealTimers();
    });

    it('processes multiple users and counts only successfully sent digests', async () => {
      const users = [
        makeUser({ id: 'u1', email: 'a@test.com', full_name: 'A' }),
        makeUser({ id: 'u2', username: 'b', email: 'b@test.com', full_name: 'B' }),
        makeUser({ id: 'u3', username: 'c', email: 'c@test.com', full_name: 'C' }),
      ];

      mockQuery.mockResolvedValueOnce(users);

      // User 1: has content
      mockQuery.mockResolvedValueOnce([{ name: 'T1', end_date: '2026-06-30 00:00:00' }]);
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
      mockQuery.mockResolvedValueOnce([]); // project_members
      mockQuery.mockResolvedValueOnce(undefined); // updateLastSent

      // User 2: empty digest (no content)
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
      mockQuery.mockResolvedValueOnce([]); // project_members
      mockQuery.mockResolvedValueOnce(undefined); // updateLastSent (still called for empty)

      // User 3: has content
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([{ name: 'T3', end_date: '2026-07-06 00:00:00' }]);
      mockQuery.mockResolvedValueOnce([{ cnt: 3 }]);
      mockQuery.mockResolvedValueOnce([]); // project_members
      mockQuery.mockResolvedValueOnce(undefined); // updateLastSent

      mockSendDigestEmail.mockResolvedValue(undefined);

      const count = await service.sendPendingDigests();

      // User 1 and 3 get emails, user 2 has empty digest
      expect(count).toBe(2);
      expect(mockSendDigestEmail).toHaveBeenCalledTimes(2);
    });

    it('handles unread count query returning empty array gracefully', async () => {
      const user = makeUser();

      mockQuery.mockResolvedValueOnce([user]);
      mockQuery.mockResolvedValueOnce([{ name: 'Task', end_date: '2026-06-30 00:00:00' }]);
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([]); // empty array instead of [{cnt: 0}]
      mockQuery.mockResolvedValueOnce([]); // project_members
      mockQuery.mockResolvedValueOnce(undefined); // updateLastSent

      const count = await service.sendPendingDigests();

      expect(count).toBe(1);
      expect(mockSendDigestEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice Smith',
        expect.objectContaining({ unreadCount: 0 }),
      );
    });
  });
});
