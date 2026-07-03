import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

import { BaseRepository } from '../../database/BaseRepository';
import { databaseService } from '../../database/connection';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;

interface TestEntity {
  id: string;
  name: string;
}

const mapper = (row: any): TestEntity => ({ id: row.id, name: row.name });

describe('BaseRepository', () => {
  let repo: BaseRepository<TestEntity>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new BaseRepository('test_table', mapper);
  });

  describe('findById', () => {
    it('returns mapped entity when found', async () => {
      mockQuery.mockResolvedValueOnce([{ id: '1', name: 'Foo' }]);
      const result = await repo.findById('1');
      expect(result).toEqual({ id: '1', name: 'Foo' });
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = ?',
        ['1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await repo.findById('nope');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns mapped entities with default limit', async () => {
      mockQuery.mockResolvedValueOnce([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
      const results = await repo.findAll();
      expect(results).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [1000],
      );
    });

    it('respects custom limit', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await repo.findAll(50);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [50],
      );
    });
  });

  describe('deleteById', () => {
    it('returns true when row deleted', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      const result = await repo.deleteById('1');
      expect(result).toBe(true);
    });

    it('returns false when no row deleted', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      const result = await repo.deleteById('nope');
      expect(result).toBe(false);
    });

    it('supports extra where clauses', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      await repo.deleteById('1', { column: 'owner_id', value: 'u1' });
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM test_table WHERE id = ? AND owner_id = ?',
        ['1', 'u1'],
      );
    });
  });

  describe('countWhere', () => {
    it('returns count', async () => {
      mockQuery.mockResolvedValueOnce([{ cnt: 42 }]);
      const count = await repo.countWhere('status = ?', ['active']);
      expect(count).toBe(42);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) AS cnt FROM test_table WHERE status = ?',
        ['active'],
      );
    });
  });

  describe('queryPaginated', () => {
    it('returns rows and total', async () => {
      mockQuery
        .mockResolvedValueOnce([{ cnt: 5 }])
        .mockResolvedValueOnce([{ id: '1', name: 'A' }]);
      const result = await repo.queryPaginated('status = ?', ['active'], 'name ASC', 10, 0);
      expect(result.total).toBe(5);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('buildUpdate', () => {
    it('builds update SQL with matching fields', () => {
      const result = repo.buildUpdate(
        { name: 'NewName', extra: 'ignored' },
        { name: 'name_col' },
      );
      expect(result).not.toBeNull();
      expect(result!.sql).toContain('name_col = ?');
      expect(result!.values).toEqual(['NewName']);
    });

    it('returns null when no matching fields', () => {
      const result = repo.buildUpdate(
        { extra: 'ignored' },
        { name: 'name_col' },
      );
      expect(result).toBeNull();
    });

    it('supports value transform', () => {
      const result = repo.buildUpdate(
        { name: 'test' },
        { name: 'name_col' },
        (_key, val) => val.toUpperCase(),
      );
      expect(result!.values).toEqual(['TEST']);
    });
  });
});
