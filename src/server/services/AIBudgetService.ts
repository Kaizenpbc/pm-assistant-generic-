import { databaseService } from '../database/connection';
import { config } from '../config';
import { notificationService } from './NotificationService';

export class AIBudgetExceededError extends Error {
  constructor(public used: number, public budget: number) {
    super(`AI token budget exceeded: used ${used} of ${budget} tokens this month`);
    this.name = 'AIBudgetExceededError';
  }
}

export interface MonthlyUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  budget: number;
  remaining: number;
  percentUsed: number;
}

class AIBudgetService {
  async getMonthlyUsage(userId: string): Promise<MonthlyUsage> {
    const rows = await databaseService.query(
      `SELECT
         COALESCE(SUM(input_tokens), 0) AS total_input,
         COALESCE(SUM(output_tokens), 0) AS total_output,
         COALESCE(SUM(cost_estimate), 0) AS total_cost,
         COUNT(*) AS request_count
       FROM ai_usage_log
       WHERE user_id = ?
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [userId],
    );

    const row = rows[0];
    const totalInput = Number(row.total_input);
    const totalOutput = Number(row.total_output);
    const totalTokens = totalInput + totalOutput;
    const budget = await this.getBudget(userId);
    const remaining = Math.max(0, budget - totalTokens);

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalTokens,
      totalCost: Number(row.total_cost),
      requestCount: Number(row.request_count),
      budget,
      remaining,
      percentUsed: budget > 0 ? Math.round((totalTokens / budget) * 100) : 0,
    };
  }

  async checkBudget(userId: string): Promise<void> {
    const usage = await this.getMonthlyUsage(userId);
    if (usage.totalTokens >= usage.budget) {
      throw new AIBudgetExceededError(usage.totalTokens, usage.budget);
    }

    // Fire a one-time daily warning at 80% usage
    if (usage.percentUsed >= 80 && usage.percentUsed < 100) {
      this.sendBudgetWarning(userId, usage).catch(() => {});
    }
  }

  private async sendBudgetWarning(userId: string, usage: MonthlyUsage): Promise<void> {
    const today = new Date().toISOString().substring(0, 10);
    const existing = await databaseService.query(
      `SELECT id FROM notifications
       WHERE user_id = ? AND type = 'ai_budget_warning' AND DATE(created_at) = ?
       LIMIT 1`,
      [userId, today],
    );
    if (existing.length > 0) return;

    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
    await notificationService.create({
      userId,
      type: 'ai_budget_warning',
      severity: 'high',
      title: `AI Budget Warning: ${usage.percentUsed}% Used`,
      message: `You have used ${usage.totalTokens.toLocaleString()} of ${usage.budget.toLocaleString()} tokens this month. ${usage.remaining.toLocaleString()} tokens remaining with ${daysLeft} days left.`,
    });
  }

  private async getBudget(userId: string): Promise<number> {
    const rows = await databaseService.query(
      'SELECT ai_monthly_token_budget FROM users WHERE id = ?',
      [userId],
    );
    if (rows.length > 0 && rows[0].ai_monthly_token_budget != null) {
      return Number(rows[0].ai_monthly_token_budget);
    }
    return config.AI_MONTHLY_TOKEN_BUDGET;
  }
}

export const aiBudgetService = new AIBudgetService();
