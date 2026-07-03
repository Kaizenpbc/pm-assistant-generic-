import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../config', () => ({
  config: {
    AI_MONTHLY_TOKEN_BUDGET: 500000,
  },
}));

vi.mock('../../services/NotificationService', () => ({
  notificationService: { create: vi.fn().mockResolvedValue({}) },
}));

import { aiBudgetService, AIBudgetExceededError } from '../../services/AIBudgetService';
import { databaseService } from '../../database/connection';
import { notificationService } from '../../services/NotificationService';

const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;
const mockCreate = notificationService.create as ReturnType<typeof vi.fn>;

describe('AIBudgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMonthlyUsage', () => {
    it('returns zero usage when no records exist', async () => {
      // usage query
      mockQuery.mockResolvedValueOnce([{
        total_input: 0,
        total_output: 0,
        total_cost: 0,
        request_count: 0,
      }]);
      // budget query (user has no custom budget)
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      const usage = await aiBudgetService.getMonthlyUsage('user-1');

      expect(usage.totalInputTokens).toBe(0);
      expect(usage.totalOutputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
      expect(usage.totalCost).toBe(0);
      expect(usage.requestCount).toBe(0);
      expect(usage.budget).toBe(500000);
      expect(usage.remaining).toBe(500000);
      expect(usage.percentUsed).toBe(0);
    });

    it('calculates usage correctly with existing records', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 100000,
        total_output: 50000,
        total_cost: 0.75,
        request_count: 25,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      const usage = await aiBudgetService.getMonthlyUsage('user-1');

      expect(usage.totalInputTokens).toBe(100000);
      expect(usage.totalOutputTokens).toBe(50000);
      expect(usage.totalTokens).toBe(150000);
      expect(usage.totalCost).toBe(0.75);
      expect(usage.requestCount).toBe(25);
      expect(usage.budget).toBe(500000);
      expect(usage.remaining).toBe(350000);
      expect(usage.percentUsed).toBe(30);
    });

    it('uses custom user budget when set', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 50000,
        total_output: 50000,
        total_cost: 0.50,
        request_count: 10,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: 200000 }]);

      const usage = await aiBudgetService.getMonthlyUsage('user-1');

      expect(usage.budget).toBe(200000);
      expect(usage.remaining).toBe(100000);
      expect(usage.percentUsed).toBe(50);
    });

    it('clamps remaining to zero when over budget', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 400000,
        total_output: 200000,
        total_cost: 3.0,
        request_count: 100,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      const usage = await aiBudgetService.getMonthlyUsage('user-1');

      expect(usage.totalTokens).toBe(600000);
      expect(usage.remaining).toBe(0);
      expect(usage.percentUsed).toBe(120);
    });

    it('queries current month usage with correct SQL', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 0, total_output: 0, total_cost: 0, request_count: 0,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      await aiBudgetService.getMonthlyUsage('user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DATE_FORMAT(NOW()'),
        ['user-1'],
      );
    });
  });

  describe('checkBudget', () => {
    it('does not throw when under budget', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 100000, total_output: 50000, total_cost: 0.5, request_count: 10,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      await expect(aiBudgetService.checkBudget('user-1')).resolves.toBeUndefined();
    });

    it('throws AIBudgetExceededError when at budget', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 300000, total_output: 200000, total_cost: 2.0, request_count: 50,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      await expect(aiBudgetService.checkBudget('user-1')).rejects.toThrow(AIBudgetExceededError);
    });

    it('throws AIBudgetExceededError when over budget', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 400000, total_output: 200000, total_cost: 3.0, request_count: 100,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      await expect(aiBudgetService.checkBudget('user-1')).rejects.toThrow(AIBudgetExceededError);
    });

    it('AIBudgetExceededError contains usage details', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 400000, total_output: 200000, total_cost: 3.0, request_count: 100,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      try {
        await aiBudgetService.checkBudget('user-1');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AIBudgetExceededError);
        const budgetErr = err as AIBudgetExceededError;
        expect(budgetErr.used).toBe(600000);
        expect(budgetErr.budget).toBe(500000);
      }
    });

    it('respects custom user budget for enforcement', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 50000, total_output: 50000, total_cost: 0.5, request_count: 10,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: 100000 }]);

      await expect(aiBudgetService.checkBudget('user-1')).rejects.toThrow(AIBudgetExceededError);
    });

    it('passes with custom budget when under limit', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 30000, total_output: 20000, total_cost: 0.25, request_count: 5,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: 100000 }]);

      await expect(aiBudgetService.checkBudget('user-1')).resolves.toBeUndefined();
    });

    it('sends budget warning at 80% usage if no notification today', async () => {
      // usage query: 80% of 500k = 400k
      mockQuery.mockResolvedValueOnce([{
        total_input: 250000, total_output: 150000, total_cost: 2.0, request_count: 50,
      }]);
      // budget query
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);
      // notification dedup query: no existing notification
      mockQuery.mockResolvedValueOnce([]);

      await aiBudgetService.checkBudget('user-1');

      // Allow fire-and-forget to settle
      await new Promise(r => setTimeout(r, 10));

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        type: 'ai_budget_warning',
        severity: 'high',
      }));
    });

    it('does not send duplicate budget warning if one exists today', async () => {
      // usage query: 90% of 500k = 450k
      mockQuery.mockResolvedValueOnce([{
        total_input: 300000, total_output: 150000, total_cost: 2.5, request_count: 60,
      }]);
      // budget query
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);
      // notification dedup query: already exists
      mockQuery.mockResolvedValueOnce([{ id: 'existing-notif' }]);

      await aiBudgetService.checkBudget('user-1');

      await new Promise(r => setTimeout(r, 10));

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('does not send warning below 80%', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_input: 100000, total_output: 50000, total_cost: 0.5, request_count: 10,
      }]);
      mockQuery.mockResolvedValueOnce([{ ai_monthly_token_budget: null }]);

      await aiBudgetService.checkBudget('user-1');

      await new Promise(r => setTimeout(r, 10));

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
