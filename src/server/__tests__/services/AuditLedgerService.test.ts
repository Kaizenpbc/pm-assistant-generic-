import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

vi.mock('uuid', () => ({ v4: () => 'test-audit-uuid' }));

import { AuditLedgerService } from '../../services/AuditLedgerService';
import { databaseService } from '../../database/connection';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;

const sampleInput = {
  actorId: 'u1',
  actorType: 'user' as const,
  action: 'task.create',
  entityType: 'task',
  entityId: 't1',
  projectId: 'p1',
  payload: { name: 'Test Task' },
  source: 'web' as const,
};

describe('AuditLedgerService', () => {
  let service: AuditLedgerService;

  beforeEach(() => {
    service = new AuditLedgerService();
    vi.clearAllMocks();
  });

  describe('append', () => {
    it('computes hash chain from genesis when ledger is empty', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // no previous entries
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{  // SELECT back
          id: 1, entry_uuid: 'test-audit-uuid', prev_hash: '0'.repeat(64),
          entry_hash: 'somehash', actor_id: 'u1', actor_type: 'user',
          action: 'task.create', entity_type: 'task', entity_id: 't1',
          project_id: 'p1', payload: '{"name":"Test Task"}', source: 'web',
          ip_address: null, session_id: null, created_at: '2026-01-01',
        }]);

      const entry = await service.append(sampleInput);
      expect(entry.entryUuid).toBe('test-audit-uuid');
      expect(entry.prevHash).toBe('0'.repeat(64));
      expect(entry.actorId).toBe('u1');
    });

    it('chains hash from previous entry', async () => {
      const prevHash = 'abc123'.repeat(10) + 'abcd';
      mockQuery
        .mockResolvedValueOnce([{ entry_hash: prevHash }]) // previous entry
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{
          id: 2, entry_uuid: 'test-audit-uuid', prev_hash: prevHash,
          entry_hash: 'newhash', actor_id: 'u1', actor_type: 'user',
          action: 'task.create', entity_type: 'task', entity_id: 't1',
          project_id: 'p1', payload: '{"name":"Test Task"}', source: 'web',
          ip_address: null, session_id: null, created_at: '2026-01-01',
        }]);

      const entry = await service.append(sampleInput);
      expect(entry.prevHash).toBe(prevHash);
    });

    it('gracefully degrades when INSERT fails', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // no previous
        .mockRejectedValueOnce(new Error('DB down')); // INSERT fails

      const entry = await service.append(sampleInput);
      expect(entry.entryUuid).toBe('test-audit-uuid');
      expect(entry.action).toBe('task.create');
    });
  });

  describe('verifyChain', () => {
    it('returns valid for empty ledger', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.checkedCount).toBe(0);
    });

    it('detects broken prev_hash link', async () => {
      // Second entry has wrong prev_hash (doesn't match first entry's entry_hash)
      mockQuery.mockResolvedValueOnce([
        {
          id: 1, entry_uuid: 'e1', prev_hash: '0'.repeat(64),
          entry_hash: 'hash1', actor_id: 'u1', actor_type: 'user',
          action: 'create', entity_type: 'task', entity_id: 't1',
          project_id: null, payload: '{}', source: 'web',
        },
      ]);

      // The computed hash won't match 'hash1', so chain breaks at entry 1
      const result = await service.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.brokenAtId).toBe(1);
    });
  });

  describe('getEntries', () => {
    it('returns paginated entries with filters', async () => {
      mockQuery
        .mockResolvedValueOnce([{ cnt: 1 }])
        .mockResolvedValueOnce([{
          id: 1, entry_uuid: 'e1', prev_hash: '0'.repeat(64),
          entry_hash: 'hash1', actor_id: 'u1', actor_type: 'user',
          action: 'task.create', entity_type: 'task', entity_id: 't1',
          project_id: 'p1', payload: '{"name":"Test"}', source: 'web',
          ip_address: null, session_id: null, created_at: '2026-01-01',
        }]);

      const result = await service.getEntries({
        projectId: 'p1',
        entityType: 'task',
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].action).toBe('task.create');
    });

    it('applies all filter types', async () => {
      mockQuery
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([]);

      await service.getEntries({
        projectId: 'p1',
        entityType: 'task',
        entityId: 't1',
        actorId: 'u1',
        action: 'task.create',
        since: '2026-01-01',
        until: '2026-12-31',
      });

      const countSql = mockQuery.mock.calls[0][0];
      expect(countSql).toContain('project_id = ?');
      expect(countSql).toContain('entity_type = ?');
      expect(countSql).toContain('entity_id = ?');
      expect(countSql).toContain('actor_id = ?');
      expect(countSql).toContain('action = ?');
      expect(countSql).toContain('created_at >= ?');
      expect(countSql).toContain('created_at <= ?');
    });

    it('returns empty when no entries match', async () => {
      mockQuery
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([]);

      const result = await service.getEntries({});
      expect(result.total).toBe(0);
      expect(result.entries).toHaveLength(0);
    });
  });
});
