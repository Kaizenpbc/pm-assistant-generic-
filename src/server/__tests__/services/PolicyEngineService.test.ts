import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

vi.mock('uuid', () => ({ v4: () => 'test-policy-id' }));

import { PolicyEngineService } from '../../services/PolicyEngineService';
import { databaseService } from '../../database/connection';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;

const makePolicyRow = (overrides: Record<string, any> = {}) => ({
  id: 'pol1',
  project_id: null,
  name: 'Budget Limit',
  description: 'Block large budgets',
  action_pattern: 'project.create',
  condition_expr: JSON.stringify({ field: 'budget_impact', op: '>', value: 100000 }),
  enforcement: 'block',
  is_active: 1,
  created_by: 'admin',
  created_at: '2026-01-01',
  ...overrides,
});

describe('PolicyEngineService', () => {
  let service: PolicyEngineService;

  beforeEach(() => {
    service = new PolicyEngineService();
    vi.clearAllMocks();
  });

  describe('evaluate', () => {
    it('returns allowed when no policies match', async () => {
      mockQuery
        .mockResolvedValueOnce([]); // no active policies

      const result = await service.evaluate('project.create', {
        actorId: 'u1',
        data: { budget_impact: 5000 },
      });

      expect(result.allowed).toBe(true);
      expect(result.enforcement).toBe('allowed');
      expect(result.matchedPolicies).toEqual([]);
    });

    it('blocks action when policy condition matches with block enforcement', async () => {
      mockQuery
        .mockResolvedValueOnce([makePolicyRow()]) // getActivePolicies
        .mockResolvedValueOnce([]); // INSERT evaluation log

      const result = await service.evaluate('project.create', {
        actorId: 'u1',
        data: { budget_impact: 200000 },
      });

      expect(result.allowed).toBe(false);
      expect(result.enforcement).toBe('blocked');
      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.matchedPolicies[0].policyName).toBe('Budget Limit');
    });

    it('allows action when condition does not match', async () => {
      mockQuery
        .mockResolvedValueOnce([makePolicyRow()]) // getActivePolicies
        .mockResolvedValueOnce([]); // INSERT evaluation log

      const result = await service.evaluate('project.create', {
        actorId: 'u1',
        data: { budget_impact: 5000 }, // below 100000 threshold
      });

      expect(result.allowed).toBe(true);
      expect(result.enforcement).toBe('allowed');
      expect(result.matchedPolicies).toEqual([]);
    });

    it('returns pending_approval for require_approval enforcement', async () => {
      mockQuery
        .mockResolvedValueOnce([makePolicyRow({
          enforcement: 'require_approval',
          condition_expr: JSON.stringify({ field: 'budget_impact', op: '>', value: 50000 }),
        })])
        .mockResolvedValueOnce([]); // INSERT evaluation log

      const result = await service.evaluate('project.create', {
        actorId: 'u1',
        data: { budget_impact: 75000 },
      });

      expect(result.allowed).toBe(true); // pending_approval is still "allowed"
      expect(result.enforcement).toBe('pending_approval');
    });

    it('returns allowed for log_only enforcement', async () => {
      mockQuery
        .mockResolvedValueOnce([makePolicyRow({
          enforcement: 'log_only',
          condition_expr: JSON.stringify({ field: 'budget_impact', op: '>', value: 1000 }),
        })])
        .mockResolvedValueOnce([]); // INSERT evaluation log

      const result = await service.evaluate('project.create', {
        actorId: 'u1',
        data: { budget_impact: 5000 },
      });

      expect(result.allowed).toBe(true);
      expect(result.enforcement).toBe('allowed');
    });

    it('uses strictest enforcement when multiple policies match', async () => {
      mockQuery
        .mockResolvedValueOnce([
          makePolicyRow({ id: 'pol1', enforcement: 'log_only', condition_expr: JSON.stringify({ field: 'budget_impact', op: '>', value: 1000 }) }),
          makePolicyRow({ id: 'pol2', enforcement: 'block', condition_expr: JSON.stringify({ field: 'budget_impact', op: '>', value: 50000 }) }),
        ])
        .mockResolvedValueOnce([]) // log pol1
        .mockResolvedValueOnce([]); // log pol2

      const result = await service.evaluate('project.create', {
        actorId: 'u1',
        data: { budget_impact: 75000 },
      });

      expect(result.allowed).toBe(false);
      expect(result.enforcement).toBe('blocked');
      expect(result.matchedPolicies).toHaveLength(2);
    });

    it('matches wildcard action patterns', async () => {
      mockQuery
        .mockResolvedValueOnce([makePolicyRow({
          action_pattern: 'project.*',
          condition_expr: JSON.stringify({ field: '', op: '==', value: '' }), // always matches
        })])
        .mockResolvedValueOnce([]); // log

      const result = await service.evaluate('project.update', {
        actorId: 'u1',
      });

      expect(result.matchedPolicies).toHaveLength(1);
    });
  });

  describe('getEvaluationStats', () => {
    it('returns stats with counts', async () => {
      mockQuery.mockResolvedValueOnce([{
        total: 100, allowed: 85, blocked: 10, pending_approval: 5,
      }]);

      const stats = await service.getEvaluationStats('p1');
      expect(stats.total).toBe(100);
      expect(stats.allowed).toBe(85);
      expect(stats.blocked).toBe(10);
      expect(stats.pendingApproval).toBe(5);
    });

    it('returns zeros on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const stats = await service.getEvaluationStats();
      expect(stats).toEqual({ total: 0, allowed: 0, blocked: 0, pendingApproval: 0 });
    });
  });

  describe('CRUD operations', () => {
    it('createPolicy inserts and returns policy', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([makePolicyRow({ id: 'test-policy-id' })]); // SELECT

      const policy = await service.createPolicy({
        name: 'Budget Limit',
        actionPattern: 'project.create',
        conditionExpr: { field: 'budget_impact', op: '>', value: 100000 },
        enforcement: 'block',
        createdBy: 'admin',
      });

      expect(policy.name).toBe('Budget Limit');
      expect(policy.enforcement).toBe('block');
    });

    it('getPolicyById returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const policy = await service.getPolicyById('nonexistent');
      expect(policy).toBeNull();
    });

    it('deletePolicy returns true on success', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
      const deleted = await service.deletePolicy('pol1');
      expect(deleted).toBe(true);
    });

    it('deletePolicy returns false when not found', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 0 });
      const deleted = await service.deletePolicy('nonexistent');
      expect(deleted).toBe(false);
    });

    it('getAllPolicies returns empty on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const policies = await service.getAllPolicies();
      expect(policies).toEqual([]);
    });
  });
});
