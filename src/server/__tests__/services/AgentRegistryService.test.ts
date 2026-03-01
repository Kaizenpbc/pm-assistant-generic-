import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Mock dependencies before importing the registry
vi.mock('../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
    testConnection: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../services/AuditLedgerService', () => ({
  auditLedgerService: {
    append: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/PolicyEngineService', () => ({
  policyEngineService: {
    evaluate: vi.fn().mockResolvedValue({ allowed: true, enforcement: 'allowed', matchedPolicies: [] }),
  },
}));

import { agentRegistry, type AgentCapability, type InvocationContext } from '../../services/AgentRegistryService';
import { auditLedgerService } from '../../services/AuditLedgerService';
import { policyEngineService } from '../../services/PolicyEngineService';

function makeCapability(overrides: Partial<AgentCapability> = {}): AgentCapability {
  return {
    id: 'test-agent-v1',
    capability: 'test.action',
    version: '1.0.0',
    description: 'Test agent',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    permissions: [],
    timeoutMs: 5000,
    handler: vi.fn().mockResolvedValue({ result: 'ok' }),
    ...overrides,
  };
}

const ctx: InvocationContext = {
  actorId: 'system',
  actorType: 'system',
  source: 'system',
  projectId: 'proj-1',
};

describe('AgentRegistry', () => {
  beforeEach(() => {
    agentRegistry.clear();
    vi.clearAllMocks();
  });

  // --- register ---
  describe('register', () => {
    it('registers a capability', () => {
      const cap = makeCapability();
      agentRegistry.register(cap);
      expect(agentRegistry.get('test-agent-v1')).toBe(cap);
    });

    it('throws on duplicate id', () => {
      agentRegistry.register(makeCapability());
      expect(() => agentRegistry.register(makeCapability())).toThrow('already registered');
    });
  });

  // --- get / findByCapability ---
  describe('get / findByCapability', () => {
    it('returns undefined for unknown id', () => {
      expect(agentRegistry.get('nonexistent')).toBeUndefined();
    });

    it('finds by exact capability name', () => {
      const cap = makeCapability({ id: 'a1', capability: 'schedule.optimize' });
      agentRegistry.register(cap);
      const found = agentRegistry.findByCapability('schedule.optimize');
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('a1');
    });

    it('returns empty for no match', () => {
      agentRegistry.register(makeCapability());
      expect(agentRegistry.findByCapability('nonexistent')).toHaveLength(0);
    });
  });

  // --- listAll ---
  describe('listAll', () => {
    it('returns all registered capabilities', () => {
      agentRegistry.register(makeCapability({ id: 'a1' }));
      agentRegistry.register(makeCapability({ id: 'a2', capability: 'other' }));
      expect(agentRegistry.listAll()).toHaveLength(2);
    });
  });

  // --- invoke: validation ---
  describe('invoke — validation', () => {
    it('rejects invalid input', async () => {
      agentRegistry.register(makeCapability());
      const result = await agentRegistry.invoke('test-agent-v1', { value: 123 }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('rejects invalid output', async () => {
      const cap = makeCapability({
        handler: vi.fn().mockResolvedValue({ bad: 'schema' }),
        outputSchema: z.object({ result: z.string() }),
      });
      agentRegistry.register(cap);
      const result = await agentRegistry.invoke('test-agent-v1', { value: 'hello' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Output validation failed');
    });
  });

  // --- invoke: policy ---
  describe('invoke — policy', () => {
    it('blocks when policy denies', async () => {
      vi.mocked(policyEngineService.evaluate).mockResolvedValueOnce({
        allowed: false,
        enforcement: 'blocked',
        matchedPolicies: [{ policyId: 'p1', policyName: 'Block agents', enforcement: 'block' }],
      });
      agentRegistry.register(makeCapability());
      const result = await agentRegistry.invoke('test-agent-v1', { value: 'hello' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Policy blocked');
    });
  });

  // --- invoke: execution ---
  describe('invoke — execution', () => {
    it('calls handler and returns output with duration', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'done' });
      agentRegistry.register(makeCapability({ handler }));
      const result = await agentRegistry.invoke('test-agent-v1', { value: 'hello' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 'done' });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(handler).toHaveBeenCalledWith({ value: 'hello' });
    });
  });

  // --- invoke: timeout ---
  describe('invoke — timeout', () => {
    it('rejects handlers exceeding timeout', async () => {
      const handler = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ result: 'late' }), 10000)),
      );
      agentRegistry.register(makeCapability({ handler, timeoutMs: 50 }));
      const result = await agentRegistry.invoke('test-agent-v1', { value: 'hello' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  // --- invoke: audit ---
  describe('invoke — audit', () => {
    it('appends to audit ledger on success', async () => {
      agentRegistry.register(makeCapability());
      await agentRegistry.invoke('test-agent-v1', { value: 'hello' }, ctx);
      expect(auditLedgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'agent.invoke.success',
          entityType: 'agent',
          entityId: 'test-agent-v1',
        }),
      );
    });

    it('appends to audit ledger on error', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      agentRegistry.register(makeCapability({ handler }));
      await agentRegistry.invoke('test-agent-v1', { value: 'hello' }, ctx);
      expect(auditLedgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'agent.invoke.failure',
          entityType: 'agent',
          entityId: 'test-agent-v1',
        }),
      );
    });
  });

  // --- invoke: unknown capability ---
  describe('invoke — unknown', () => {
    it('returns error for unregistered capability', async () => {
      const result = await agentRegistry.invoke('nonexistent', {}, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown capability');
    });
  });
});
