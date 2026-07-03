import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

vi.mock('uuid', () => ({ v4: () => 'test-goal-id' }));

import { GoalService } from '../../services/GoalService';
import { databaseService } from '../../database/connection';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;

const sampleRow = {
  id: 'g1', name: 'Increase Revenue', description: 'Q1 target',
  owner_id: 'u1', parent_id: null, goal_type: 'objective',
  status: 'on_track', progress: 45, target_value: 100000,
  current_value: 45000, unit: 'USD', start_date: '2026-01-01',
  due_date: '2026-03-31', project_id: 'p1',
  created_at: '2026-01-01', updated_at: '2026-01-01',
};

describe('GoalService', () => {
  let service: GoalService;

  beforeEach(() => {
    service = new GoalService();
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('returns goal when found', async () => {
      mockQuery.mockResolvedValueOnce([sampleRow]);
      const goal = await service.findById('g1');
      expect(goal).not.toBeNull();
      expect(goal!.name).toBe('Increase Revenue');
      expect(goal!.progress).toBe(45);
      expect(goal!.targetValue).toBe(100000);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const goal = await service.findById('nonexistent');
      expect(goal).toBeNull();
    });
  });

  describe('listByOwner', () => {
    it('returns goals for owner', async () => {
      mockQuery.mockResolvedValueOnce([sampleRow]);
      const goals = await service.listByOwner('u1');
      expect(goals).toHaveLength(1);
      expect(goals[0].ownerId).toBe('u1');
    });
  });

  describe('listByProject', () => {
    it('returns goals for project', async () => {
      mockQuery.mockResolvedValueOnce([sampleRow]);
      const goals = await service.listByProject('p1');
      expect(goals).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('filters by multiple criteria', async () => {
      mockQuery.mockResolvedValueOnce([sampleRow]);
      await service.list({ ownerId: 'u1', goalType: 'objective', status: 'on_track' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('owner_id = ?'),
        ['u1', 'objective', 'on_track'],
      );
    });

    it('returns all when no filters', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.list();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [],
      );
    });
  });

  describe('create', () => {
    it('creates goal and returns it', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{ ...sampleRow, id: 'test-goal-id' }]); // findById

      const goal = await service.create({
        name: 'Increase Revenue',
        ownerId: 'u1',
        goalType: 'objective',
      });

      expect(goal.name).toBe('Increase Revenue');
      expect(goal.ownerId).toBe('u1');
    });

    it('uses defaults for optional fields', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{ ...sampleRow, id: 'test-goal-id', status: 'on_track', progress: 0 }]);

      await service.create({
        name: 'Test',
        ownerId: 'u1',
        goalType: 'key_result',
      });

      // Check the INSERT params include defaults
      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[1]).toContain('on_track'); // default status
      expect(insertCall[1]).toContain(0); // default progress
    });
  });

  describe('update', () => {
    it('updates specified fields', async () => {
      mockQuery
        .mockResolvedValueOnce([sampleRow]) // findById (existing)
        .mockResolvedValueOnce([]) // UPDATE
        .mockResolvedValueOnce([{ ...sampleRow, progress: 80 }]); // findById (updated)

      const updated = await service.update('g1', { progress: 80 });
      expect(updated).not.toBeNull();
      expect(updated!.progress).toBe(80);
    });

    it('returns null when goal not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const updated = await service.update('nonexistent', { progress: 50 });
      expect(updated).toBeNull();
    });

    it('returns existing when no fields to update', async () => {
      mockQuery.mockResolvedValueOnce([sampleRow]);
      const updated = await service.update('g1', {});
      expect(updated!.name).toBe('Increase Revenue');
    });
  });

  describe('delete', () => {
    it('returns true on successful delete', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      const deleted = await service.delete('g1');
      expect(deleted).toBe(true);
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      const deleted = await service.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('recalculateObjectiveProgress', () => {
    it('averages key result progress', async () => {
      mockQuery
        .mockResolvedValueOnce([sampleRow]) // findById
        .mockResolvedValueOnce([{ progress: 60 }, { progress: 80 }]) // children
        .mockResolvedValueOnce([]) // UPDATE
        .mockResolvedValueOnce([{ ...sampleRow, progress: 70 }]); // findById

      const result = await service.recalculateObjectiveProgress('g1');
      expect(result!.progress).toBe(70);
    });

    it('returns objective unchanged when no children', async () => {
      mockQuery
        .mockResolvedValueOnce([sampleRow]) // findById
        .mockResolvedValueOnce([]); // no children

      const result = await service.recalculateObjectiveProgress('g1');
      expect(result!.progress).toBe(45); // unchanged
    });
  });
});
