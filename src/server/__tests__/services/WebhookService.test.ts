import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/WebhookRepository', () => {
  const mockRepo = {
    insert: vi.fn(),
    findByUser: vi.fn().mockResolvedValue([]),
    findByUserAndId: vi.fn().mockResolvedValue(null),
    findActiveByUser: vi.fn().mockResolvedValue([]),
    updateFields: vi.fn(),
    deleteByUser: vi.fn().mockResolvedValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  };
  return { webhookRepository: mockRepo };
});

import { WebhookService } from '../../services/WebhookService';
import { webhookRepository } from '../../database/WebhookRepository';

const mockRepo = webhookRepository as any;

const sampleWebhook = {
  id: 'wh1', userId: 'u1', url: 'https://example.com/hook',
  secret: 'abcdefgh12345678', events: ['task.created', 'task.updated'],
  isActive: true, failureCount: 0, lastDeliveredAt: null,
  lastStatusCode: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('creates webhook with generated secret', async () => {
      mockRepo.insert.mockResolvedValueOnce(sampleWebhook);
      const wh = await service.register('u1', 'https://example.com/hook', ['task.created']);
      expect(mockRepo.insert).toHaveBeenCalledWith(
        'u1', 'https://example.com/hook',
        expect.any(String), // generated secret
        ['task.created'],
      );
    });

    it('uses provided secret when given', async () => {
      mockRepo.insert.mockResolvedValueOnce(sampleWebhook);
      await service.register('u1', 'https://example.com/hook', ['task.created'], 'my-secret');
      expect(mockRepo.insert).toHaveBeenCalledWith('u1', 'https://example.com/hook', 'my-secret', ['task.created']);
    });
  });

  describe('list', () => {
    it('masks secrets in returned webhooks', async () => {
      mockRepo.findByUser.mockResolvedValueOnce([sampleWebhook]);
      const hooks = await service.list('u1');
      expect(hooks).toHaveLength(1);
      expect(hooks[0].secret).toBe('abcdefgh...');
      expect(hooks[0].secret).not.toBe(sampleWebhook.secret);
    });
  });

  describe('getById', () => {
    it('returns masked webhook when found', async () => {
      mockRepo.findByUserAndId.mockResolvedValueOnce(sampleWebhook);
      const wh = await service.getById('u1', 'wh1');
      expect(wh).not.toBeNull();
      expect(wh!.secret).toContain('...');
    });

    it('returns null when not found', async () => {
      const wh = await service.getById('u1', 'nonexistent');
      expect(wh).toBeNull();
    });
  });

  describe('update', () => {
    it('updates URL and returns masked result', async () => {
      mockRepo.findByUserAndId.mockResolvedValueOnce({ ...sampleWebhook, url: 'https://new.com/hook' });
      const wh = await service.update('u1', 'wh1', { url: 'https://new.com/hook' });
      expect(mockRepo.updateFields).toHaveBeenCalledWith('wh1', 'u1', ['url = ?'], ['https://new.com/hook']);
    });

    it('resets failure count when reactivating', async () => {
      mockRepo.findByUserAndId.mockResolvedValueOnce(sampleWebhook);
      await service.update('u1', 'wh1', { isActive: true });
      const [, , sets, params] = mockRepo.updateFields.mock.calls[0];
      expect(sets).toContain('is_active = ?');
      expect(sets).toContain('failure_count = ?');
      expect(params).toContain(0);
    });
  });

  describe('delete', () => {
    it('delegates to repository', async () => {
      mockRepo.deleteByUser.mockResolvedValueOnce(true);
      const result = await service.delete('u1', 'wh1');
      expect(result).toBe(true);
    });
  });

  describe('dispatch', () => {
    it('skips when no userId', async () => {
      await service.dispatch('task.created', { id: 't1' });
      expect(mockRepo.findActiveByUser).not.toHaveBeenCalled();
    });

    it('filters webhooks by event type', async () => {
      mockRepo.findActiveByUser.mockResolvedValueOnce([
        { ...sampleWebhook, events: ['task.deleted'] },
      ]);
      await service.dispatch('task.created', { id: 't1' }, 'u1');
      // No matching webhook, so no delivery attempted
      expect(mockRepo.findActiveByUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('test', () => {
    it('returns true when webhook exists', async () => {
      mockRepo.findByUserAndId.mockResolvedValueOnce(sampleWebhook);
      const result = await service.test('u1', 'wh1');
      expect(result).toBe(true);
    });

    it('returns false when webhook not found', async () => {
      const result = await service.test('u1', 'nonexistent');
      expect(result).toBe(false);
    });
  });
});
