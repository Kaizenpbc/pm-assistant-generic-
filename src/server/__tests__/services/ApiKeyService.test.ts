import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

vi.mock('uuid', () => ({ v4: () => 'test-key-id' }));

import { ApiKeyService } from '../../services/ApiKeyService';
import { databaseService } from '../../database/connection';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    service = new ApiKeyService();
    vi.clearAllMocks();
  });

  describe('createKey', () => {
    it('creates key and returns raw key once', async () => {
      mockQuery.mockResolvedValueOnce([]); // INSERT
      const result = await service.createKey('u1', 'My Key', ['read', 'write']);
      expect(result.id).toBe('test-key-id');
      expect(result.key).toMatch(/^kpm_[0-9a-f]{40}$/);
      expect(result.name).toBe('My Key');
      expect(result.prefix).toHaveLength(8);
      expect(result.scopes).toEqual(['read', 'write']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining(['test-key-id', 'u1', 'My Key']),
      );
    });

    it('uses default rate limit of 100', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.createKey('u1', 'Test', ['read']);
      const insertParams = mockQuery.mock.calls[0][1];
      expect(insertParams).toContain(100); // default rate limit
    });

    it('accepts custom rate limit and expiry', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.createKey('u1', 'Test', ['read'], 500, '2027-01-01');
      const insertParams = mockQuery.mock.calls[0][1];
      expect(insertParams).toContain(500);
      expect(insertParams).toContain('2027-01-01');
    });
  });

  describe('validateKey', () => {
    it('returns user info for valid key', async () => {
      const rawKey = 'kpm_abc123def456';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockQuery.mockResolvedValueOnce([{
        id: 'k1', user_id: 'u1', scopes: '["read","write"]',
        rate_limit: 100, user_role: 'admin',
      }]);
      mockQuery.mockResolvedValueOnce([]); // last_used_at update

      const result = await service.validateKey(rawKey);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('u1');
      expect(result!.scopes).toEqual(['read', 'write']);
      expect(result!.userRole).toBe('admin');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('key_hash = ?'),
        [keyHash],
      );
    });

    it('returns null for invalid key', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.validateKey('kpm_invalid');
      expect(result).toBeNull();
    });

    it('defaults userRole to team_member when missing', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'k1', user_id: 'u1', scopes: '["read"]',
        rate_limit: null, user_role: null,
      }]);
      mockQuery.mockResolvedValueOnce([]);

      const result = await service.validateKey('kpm_test');
      expect(result!.userRole).toBe('team_member');
    });
  });

  describe('listKeys', () => {
    it('returns formatted key list without hashes', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'k1', name: 'Dev Key', key_prefix: 'kpm_abcd',
          scopes: '["read"]', rate_limit: 100, is_active: 1,
          last_used_at: '2026-01-01', expires_at: null, created_at: '2026-01-01',
        },
      ]);
      const keys = await service.listKeys('u1');
      expect(keys).toHaveLength(1);
      expect(keys[0].name).toBe('Dev Key');
      expect(keys[0].isActive).toBe(true);
      expect(keys[0].scopes).toEqual(['read']);
      expect((keys[0] as any).key_hash).toBeUndefined();
    });
  });

  describe('revokeKey', () => {
    it('deactivates key for correct user', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.revokeKey('u1', 'k1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = 0'),
        ['k1', 'u1'],
      );
    });
  });

  describe('deleteKey', () => {
    it('deletes key for correct user', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.deleteKey('u1', 'k1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM api_keys'),
        ['k1', 'u1'],
      );
    });
  });

  describe('getUsageStats', () => {
    it('returns aggregated usage statistics', async () => {
      mockQuery
        .mockResolvedValueOnce([{ cnt: 150, avg_rt: 45.5 }]) // total
        .mockResolvedValueOnce([{ method: 'GET', cnt: 100 }, { method: 'POST', cnt: 50 }]) // by method
        .mockResolvedValueOnce([{ status_code: 200, cnt: 140 }, { status_code: 500, cnt: 10 }]); // by status

      const stats = await service.getUsageStats('k1');
      expect(stats.totalRequests).toBe(150);
      expect(stats.avgResponseTime).toBe(45.5);
      expect(stats.requestsByMethod.GET).toBe(100);
      expect(stats.requestsByStatus['500']).toBe(10);
    });

    it('accepts since filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ cnt: 0, avg_rt: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getUsageStats('k1', '2026-01-01');
      expect(mockQuery.mock.calls[0][1]).toContain('2026-01-01');
    });
  });
});
