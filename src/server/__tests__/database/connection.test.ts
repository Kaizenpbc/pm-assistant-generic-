import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
const mockConnection = { execute: mockExecute };

vi.mock('mysql2/promise', () => ({
  default: { createPool: vi.fn(() => ({ execute: vi.fn(), getConnection: vi.fn(), end: vi.fn() })) },
}));

vi.mock('../../config', () => ({
  config: {
    DB_HOST: 'localhost',
    DB_PORT: 3306,
    DB_USER: 'root',
    DB_PASSWORD: 'pass',
    DB_NAME: 'test',
    DB_CONNECT_TIMEOUT: 5000,
    DB_IDLE_TIMEOUT: 30000,
    DB_QUEUE_LIMIT: 50,
  },
}));

import { databaseService } from '../../database/connection';

describe('DatabaseService.queryOn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes SQL on the provided connection and returns rows', async () => {
    const rows = [{ id: '1', name: 'test' }];
    mockExecute.mockResolvedValueOnce([rows, []]);

    const result = await databaseService.queryOn(mockConnection as any, 'SELECT * FROM t WHERE id = ?', ['1']);

    expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM t WHERE id = ?', ['1']);
    expect(result).toEqual(rows);
  });

  it('defaults params to empty array', async () => {
    mockExecute.mockResolvedValueOnce([[], []]);

    await databaseService.queryOn(mockConnection as any, 'SELECT 1');

    expect(mockExecute).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('propagates errors from the connection', async () => {
    mockExecute.mockRejectedValueOnce(new Error('deadlock'));

    await expect(
      databaseService.queryOn(mockConnection as any, 'UPDATE t SET x = 1')
    ).rejects.toThrow('deadlock');
  });
});
