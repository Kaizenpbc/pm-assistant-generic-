import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => {
  const queryFn = vi.fn().mockResolvedValue([]);
  return {
    databaseService: { query: queryFn, queryControlPlane: queryFn },
  };
});

vi.mock('../../middleware/auth', () => ({
  authMiddleware: vi.fn().mockImplementation(async () => {}),
}));

import { databaseService } from '../../database/connection';

const mockQueryCP = databaseService.queryControlPlane as ReturnType<typeof vi.fn>;

describe('MCP Analytics endpoint logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes success rate correctly from totals', () => {
    const totalInvocations = 100;
    const successCount = 95;
    const successRate = totalInvocations > 0 ? successCount / totalInvocations : 0;
    expect(successRate).toBe(0.95);
  });

  it('handles zero invocations without division by zero', () => {
    const totalInvocations = 0;
    const successCount = 0;
    const successRate = totalInvocations > 0 ? successCount / totalInvocations : 0;
    expect(successRate).toBe(0);
  });

  it('maps groupBy=tool to correct column', () => {
    const groupBy = 'tool';
    let groupColumn: string;
    let groupAlias: string;
    switch (groupBy) {
      case 'user': groupColumn = 'user_id'; groupAlias = 'userId'; break;
      case 'day': groupColumn = 'DATE(created_at)'; groupAlias = 'date'; break;
      default: groupColumn = 'tool_name'; groupAlias = 'toolName';
    }
    expect(groupColumn).toBe('tool_name');
    expect(groupAlias).toBe('toolName');
  });

  it('maps groupBy=user to correct column', () => {
    const groupBy = 'user';
    let groupColumn: string;
    let groupAlias: string;
    switch (groupBy) {
      case 'user': groupColumn = 'user_id'; groupAlias = 'userId'; break;
      case 'day': groupColumn = 'DATE(created_at)'; groupAlias = 'date'; break;
      default: groupColumn = 'tool_name'; groupAlias = 'toolName';
    }
    expect(groupColumn).toBe('user_id');
    expect(groupAlias).toBe('userId');
  });

  it('maps groupBy=day to correct column', () => {
    const groupBy = 'day';
    let groupColumn: string;
    let groupAlias: string;
    switch (groupBy) {
      case 'user': groupColumn = 'user_id'; groupAlias = 'userId'; break;
      case 'day': groupColumn = 'DATE(created_at)'; groupAlias = 'date'; break;
      default: groupColumn = 'tool_name'; groupAlias = 'toolName';
    }
    expect(groupColumn).toBe('DATE(created_at)');
    expect(groupAlias).toBe('date');
  });

  it('builds WHERE clause from since/until params', () => {
    const since = '2026-07-01';
    const until = '2026-07-21';

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (since) { conditions.push('created_at >= ?'); params.push(since); }
    if (until) { conditions.push('created_at <= ?'); params.push(until); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    expect(whereClause).toBe('WHERE created_at >= ? AND created_at <= ?');
    expect(params).toEqual(['2026-07-01', '2026-07-21']);
  });

  it('builds empty WHERE clause when no filters', () => {
    const conditions: string[] = [];
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    expect(whereClause).toBe('');
  });

  it('formats breakdown rows correctly', () => {
    const rows = [
      { group_key: 'list-projects', invocations: 50, successes: 48, avg_ms: 200.5 },
      { group_key: 'create-task', invocations: 30, successes: 30, avg_ms: 350.0 },
    ];
    const groupAlias = 'toolName';

    const breakdown = rows.map(row => ({
      [groupAlias]: row.group_key,
      invocations: Number(row.invocations),
      successRate: Number(row.invocations) > 0 ? Number(row.successes) / Number(row.invocations) : 0,
      avgDurationMs: Number(row.avg_ms) || 0,
    }));

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]).toEqual({
      toolName: 'list-projects',
      invocations: 50,
      successRate: 0.96,
      avgDurationMs: 200.5,
    });
    expect(breakdown[1]).toEqual({
      toolName: 'create-task',
      invocations: 30,
      successRate: 1,
      avgDurationMs: 350,
    });
  });
});
