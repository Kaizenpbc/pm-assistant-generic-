import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/WebSocketService', () => ({
  WebSocketService: { broadcast: vi.fn() },
}));

vi.mock('../../services/EmailService', () => ({
  emailService: { sendNotificationEmail: vi.fn() },
}));

vi.mock('../../services/UserService', () => ({
  userService: { findById: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../config', () => ({
  config: { APP_URL: 'https://pm.kpbc.ca' },
}));

vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

import { NotificationService } from '../../services/NotificationService';
import { databaseService } from '../../database/connection';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('inserts notification and returns DTO', async () => {
      mockQuery.mockResolvedValueOnce([]); // INSERT

      const dto = await service.create({
        userId: 'user-1',
        title: 'Test Notification',
        message: 'Something happened',
        severity: 'medium',
      });

      expect(dto.id).toBe('test-uuid-1234');
      expect(dto.userId).toBe('user-1');
      expect(dto.title).toBe('Test Notification');
      expect(dto.isRead).toBe(false);
      expect(dto.type).toBe('info');
      expect(dto.severity).toBe('medium');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('defaults type to info and severity to medium', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const dto = await service.create({
        userId: 'user-1',
        title: 'Default Test',
        message: 'Defaults',
      });

      expect(dto.type).toBe('info');
      expect(dto.severity).toBe('medium');
    });
  });

  describe('getByUserId', () => {
    it('returns DTOs with pagination', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'n1', user_id: 'u1', type: 'info', severity: 'low',
          title: 'Hello', message: 'World', project_id: null,
          schedule_id: null, link_type: null, link_id: null,
          is_read: 0, created_at: '2026-01-01',
        },
      ]);

      const results = await service.getByUserId('u1', 10, 0);
      expect(results).toHaveLength(1);
      expect(results[0].isRead).toBe(false);
      expect(results[0].userId).toBe('u1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        ['u1', 10, 0],
      );
    });

    it('defaults limit to 50', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getByUserId('u1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['u1', 50, 0],
      );
    });
  });

  describe('markRead', () => {
    it('updates is_read for given id', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.markRead('n1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET is_read = TRUE WHERE id = ?'),
        ['n1'],
      );
    });
  });

  describe('markAllRead', () => {
    it('updates all unread for user', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.markAllRead('u1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND is_read = FALSE'),
        ['u1'],
      );
    });
  });

  describe('countByUserId', () => {
    it('returns count as number', async () => {
      mockQuery.mockResolvedValueOnce([{ cnt: 42 }]);
      const count = await service.countByUserId('u1');
      expect(count).toBe(42);
    });

    it('returns 0 when no rows', async () => {
      mockQuery.mockResolvedValueOnce([{}]);
      const count = await service.countByUserId('u1');
      expect(count).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      mockQuery.mockResolvedValueOnce([{ cnt: 5 }]);
      const count = await service.getUnreadCount('u1');
      expect(count).toBe(5);
    });
  });
});
