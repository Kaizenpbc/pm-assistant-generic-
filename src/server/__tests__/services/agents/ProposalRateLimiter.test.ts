import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([{ cnt: 0 }]),
  },
}));

vi.mock('../../../services/AgentActivityLogService', () => ({
  AgentActivityLogService: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { ProposalRateLimiter } from '../../../services/agents/ProposalRateLimiter';
import { databaseService } from '../../../database/connection';

describe('ProposalRateLimiter', () => {
  let limiter: ProposalRateLimiter;

  beforeEach(() => {
    limiter = new ProposalRateLimiter();
    vi.clearAllMocks();
  });

  it('allows when all limits are within bounds', async () => {
    vi.mocked(databaseService.query).mockResolvedValue([{ cnt: 0 }] as any);
    const result = await limiter.check('agent-a', 'proj-1');
    expect(result.allowed).toBe(true);
  });

  it('blocks when agent exceeds 3 proposals per project per 24h', async () => {
    // First call is agent-scoped 24h check
    vi.mocked(databaseService.query).mockResolvedValueOnce([{ cnt: 3 }] as any);

    const result = await limiter.check('agent-a', 'proj-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('agent-a');
    expect(result.currentCount).toBe(3);
    expect(result.limit).toBe(3);
  });

  it('blocks when all agents exceed 10 proposals per project per 24h', async () => {
    // First call: agent-scoped 24h = 2 (under limit)
    vi.mocked(databaseService.query).mockResolvedValueOnce([{ cnt: 2 }] as any);
    // Second call: all-agents 24h = 10 (at limit)
    vi.mocked(databaseService.query).mockResolvedValueOnce([{ cnt: 10 }] as any);

    const result = await limiter.check('agent-a', 'proj-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('all agents');
  });

  it('blocks when agent exceeds 10 proposals per project per 7d', async () => {
    // 24h agent: 2, 24h all: 5, 7d agent: 10
    vi.mocked(databaseService.query)
      .mockResolvedValueOnce([{ cnt: 2 }] as any)
      .mockResolvedValueOnce([{ cnt: 5 }] as any)
      .mockResolvedValueOnce([{ cnt: 10 }] as any);

    const result = await limiter.check('agent-a', 'proj-1');
    expect(result.allowed).toBe(false);
    expect(result.window).toContain('7d');
  });

  it('blocks when all agents exceed 30 proposals per project per 7d', async () => {
    vi.mocked(databaseService.query)
      .mockResolvedValueOnce([{ cnt: 1 }] as any)  // agent 24h
      .mockResolvedValueOnce([{ cnt: 5 }] as any)  // all 24h
      .mockResolvedValueOnce([{ cnt: 5 }] as any)  // agent 7d
      .mockResolvedValueOnce([{ cnt: 30 }] as any); // all 7d

    const result = await limiter.check('agent-a', 'proj-1');
    expect(result.allowed).toBe(false);
    expect(result.window).toContain('7d');
  });
});
