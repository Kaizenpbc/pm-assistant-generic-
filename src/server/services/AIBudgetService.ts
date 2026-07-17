import { aiBudgetRepository } from '../database/AIBudgetRepository';
import { tokenTopUpRepository } from '../database/TokenTopUpRepository';
import { config, getTierBudget } from '../config';
import { notificationService } from './NotificationService';
import { deadLetterService } from './DeadLetterService';

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
    const row = await aiBudgetRepository.getMonthlyUsage(userId);
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
      this.sendBudgetWarning(userId, usage).catch(err => deadLetterService.capture('ai.budget.warning', { userId }, err));
    }
  }

  private async sendBudgetWarning(userId: string, usage: MonthlyUsage): Promise<void> {
    const today = new Date().toISOString().substring(0, 10);
    const alreadySent = await aiBudgetRepository.findBudgetWarningToday(userId, today);
    if (alreadySent) return;

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
    // Priority: per-user override → tier default → global fallback
    const userBudget = await aiBudgetRepository.getUserBudget(userId);
    const baseBudget = userBudget ?? getTierBudget(await aiBudgetRepository.getUserTier(userId));

    // Add any purchased top-up tokens
    const topUpTokens = await tokenTopUpRepository.getRemainingTokens(userId);
    return baseBudget + topUpTokens;
  }
}

export const aiBudgetService = new AIBudgetService();
