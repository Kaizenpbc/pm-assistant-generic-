import { describe, it, expect, vi } from 'vitest';
import { getRequestId, getRequestContext, requestContextHook } from '../../middleware/requestContext';

describe('requestContext', () => {
  it('returns undefined when no context set', () => {
    expect(getRequestId()).toBeUndefined();
    expect(getRequestContext()).toBeUndefined();
  });

  it('sets and retrieves request context via hook', async () => {
    const mockRequest = {
      headers: { 'x-request-id': 'req-test-123' },
      user: { userId: 'u1', username: 'test', role: 'team_member' as const },
    } as any;
    const mockReply = {} as any;

    await requestContextHook(mockRequest, mockReply);

    const ctx = getRequestContext();
    expect(ctx).toBeDefined();
    expect(ctx!.requestId).toBe('req-test-123');
    expect(ctx!.userId).toBe('u1');
    expect(ctx!.startTime).toBeGreaterThan(0);

    expect(getRequestId()).toBe('req-test-123');
  });

  it('generates requestId when header not present', async () => {
    const mockRequest = {
      headers: {},
      user: undefined,
    } as any;
    const mockReply = {} as any;

    await requestContextHook(mockRequest, mockReply);

    const ctx = getRequestContext();
    expect(ctx).toBeDefined();
    expect(ctx!.requestId).toMatch(/^req-/);
    expect(ctx!.userId).toBeUndefined();
  });
});
