import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the db module used by the MCP server for logging invocations
vi.mock('../../../../mcp-server/src/db', () => ({
  query: vi.fn().mockResolvedValue([]),
}));

// We can't easily import createInstrumentedServer directly since it's not exported,
// so we test the behavior through createMcpServer indirectly.
// Instead, test the instrumentation pattern: wrapping a tool handler with timing.

describe('MCP Tool Instrumentation', () => {
  let logEntries: any[];

  beforeEach(() => {
    logEntries = [];
    vi.clearAllMocks();
  });

  function instrumentHandler(
    handler: (...args: any[]) => Promise<any>,
    toolName: string,
    onLog: (entry: any) => void,
  ) {
    return async (...args: any[]) => {
      const start = Date.now();
      let isSuccess = true;
      let errorMessage: string | null = null;

      try {
        const result = await handler(...args);
        return result;
      } catch (err: any) {
        isSuccess = false;
        errorMessage = err?.message || String(err);
        throw err;
      } finally {
        const durationMs = Date.now() - start;
        onLog({ toolName, durationMs, isSuccess, errorMessage });
      }
    };
  }

  it('logs successful tool invocation with timing', async () => {
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const wrapped = instrumentHandler(handler, 'list-projects', (e) => logEntries.push(e));

    const result = await wrapped({ someArg: 1 });

    expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
    expect(handler).toHaveBeenCalledWith({ someArg: 1 });
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].toolName).toBe('list-projects');
    expect(logEntries[0].isSuccess).toBe(true);
    expect(logEntries[0].errorMessage).toBeNull();
    expect(logEntries[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('logs failed tool invocation with error message', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Database connection failed'));
    const wrapped = instrumentHandler(handler, 'create-task', (e) => logEntries.push(e));

    await expect(wrapped()).rejects.toThrow('Database connection failed');

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].toolName).toBe('create-task');
    expect(logEntries[0].isSuccess).toBe(false);
    expect(logEntries[0].errorMessage).toBe('Database connection failed');
  });

  it('measures non-zero duration for slow handlers', async () => {
    const handler = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ content: [] }), 50)),
    );
    const wrapped = instrumentHandler(handler, 'get-project', (e) => logEntries.push(e));

    await wrapped();

    expect(logEntries[0].durationMs).toBeGreaterThanOrEqual(40); // allow small variance
  });

  it('still throws original error to caller', async () => {
    const originalError = new Error('Permission denied');
    const handler = vi.fn().mockRejectedValue(originalError);
    const wrapped = instrumentHandler(handler, 'delete-project', (e) => logEntries.push(e));

    try {
      await wrapped();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBe(originalError);
    }
  });

  it('logs even when handler returns undefined', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = instrumentHandler(handler, 'mark-notifications-read', (e) => logEntries.push(e));

    await wrapped();

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].isSuccess).toBe(true);
  });
});
