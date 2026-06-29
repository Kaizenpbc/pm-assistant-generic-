import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/agents/ActionProposalService', () => ({
  actionProposalService: {
    getById: vi.fn(),
    getActions: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue({ proposals: [], total: 0 }),
    updateStatus: vi.fn(),
  },
}));

import { ConflictResolver } from '../../../services/agents/ConflictResolver';
import { actionProposalService } from '../../../services/agents/ActionProposalService';
import { databaseService } from '../../../database/connection';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
    vi.clearAllMocks();
  });

  describe('checkStaleness', () => {
    it('returns stale if proposal not found', async () => {
      vi.mocked(actionProposalService.getById).mockResolvedValue(null);
      const result = await resolver.checkStaleness('missing-id');
      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('not found');
    });

    it('returns not stale for non-pending proposals', async () => {
      vi.mocked(actionProposalService.getById).mockResolvedValue({
        id: 'p1', status: 'approved', dataSnapshotVersion: 'v1',
      } as any);
      const result = await resolver.checkStaleness('p1');
      expect(result.isStale).toBe(false);
    });

    it('returns not stale if no snapshot version', async () => {
      vi.mocked(actionProposalService.getById).mockResolvedValue({
        id: 'p1', status: 'pending', dataSnapshotVersion: undefined, actions: [],
      } as any);
      const result = await resolver.checkStaleness('p1');
      expect(result.isStale).toBe(false);
    });

    it('returns stale if target entities were updated after proposal creation', async () => {
      vi.mocked(actionProposalService.getById).mockResolvedValue({
        id: 'p1', status: 'pending', dataSnapshotVersion: 'v1', createdAt: '2026-01-01 00:00:00',
        actions: [{ targetEntityType: 'task', targetEntityId: 't1' }],
      } as any);

      vi.mocked(databaseService.query).mockResolvedValue([
        { id: 't1', updated_at: '2026-01-02 00:00:00' },
      ] as any);

      const result = await resolver.checkStaleness('p1');
      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('t1');
    });

    it('returns not stale if no entities updated', async () => {
      vi.mocked(actionProposalService.getById).mockResolvedValue({
        id: 'p1', status: 'pending', dataSnapshotVersion: 'v1', createdAt: '2026-01-01 00:00:00',
        actions: [{ targetEntityType: 'task', targetEntityId: 't1' }],
      } as any);

      vi.mocked(databaseService.query).mockResolvedValue([] as any);

      const result = await resolver.checkStaleness('p1');
      expect(result.isStale).toBe(false);
    });
  });

  describe('invalidateConflictingProposals', () => {
    it('expires pending proposals targeting the entity', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([
        { proposal_id: 'p1' },
        { proposal_id: 'p2' },
      ] as any);

      const count = await resolver.invalidateConflictingProposals('task', 't1');
      expect(count).toBe(2);
      expect(actionProposalService.updateStatus).toHaveBeenCalledTimes(2);
      expect(actionProposalService.updateStatus).toHaveBeenCalledWith('p1', 'expired');
      expect(actionProposalService.updateStatus).toHaveBeenCalledWith('p2', 'expired');
    });

    it('returns 0 when no conflicting proposals', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([] as any);
      const count = await resolver.invalidateConflictingProposals('task', 't1');
      expect(count).toBe(0);
    });
  });

  describe('checkEntityConflict', () => {
    it('returns no conflict when no other agent has pending proposals', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([] as any);
      const result = await resolver.checkEntityConflict('agent-a', 't1');
      expect(result.hasConflict).toBe(false);
    });

    it('returns conflict when another agent has a pending proposal', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([
        { id: 'p99', agent_id: 'agent-b' },
      ] as any);
      const result = await resolver.checkEntityConflict('agent-a', 't1');
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingProposalId).toBe('p99');
    });
  });

  describe('sweepStaleProposals', () => {
    it('expires stale proposals from the pending list', async () => {
      vi.mocked(actionProposalService.list).mockResolvedValue({
        proposals: [
          { id: 'p1', status: 'pending', dataSnapshotVersion: 'v1', createdAt: '2026-01-01', actions: [{ targetEntityType: 'task', targetEntityId: 't1' }] },
        ],
        total: 1,
      } as any);

      // checkStaleness will call getById
      vi.mocked(actionProposalService.getById).mockResolvedValue({
        id: 'p1', status: 'pending', dataSnapshotVersion: 'v1', createdAt: '2026-01-01',
        actions: [{ targetEntityType: 'task', targetEntityId: 't1' }],
      } as any);

      // Tasks were updated
      vi.mocked(databaseService.query).mockResolvedValue([
        { id: 't1', updated_at: '2026-01-05' },
      ] as any);

      const count = await resolver.sweepStaleProposals();
      expect(count).toBe(1);
      expect(actionProposalService.updateStatus).toHaveBeenCalledWith('p1', 'expired');
    });
  });
});
