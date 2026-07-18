import { aiBudgetRepository } from '../database/AIBudgetRepository';
import { tokenTopUpRepository } from '../database/TokenTopUpRepository';
import { organizationRepository } from '../database/OrganizationRepository';
import { config, getTierBudget } from '../config';
import { notificationService } from './NotificationService';
import { deadLetterService } from './DeadLetterService';

export class AIBudgetExceededError extends Error {
  public statusCode = 429;
  public code = 'AI_BUDGET_EXCEEDED';
  public resetDate: string;

  constructor(public used: number, public budget: number) {
    super(`AI token budget exceeded: used ${used} of ${budget} tokens this month`);
    this.name = 'AIBudgetExceededError';
    // First day of next month
    const now = new Date();
    this.resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().substring(0, 10);
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
    // Check if user belongs to a per-seat org → pool usage across org
    const org = await organizationRepository.findByUserId(userId);
    let totalInput: number;
    let totalOutput: number;
    let totalCost: number;
    let requestCount: number;

    if (org && org.billingModel === 'per_seat') {
      const userIds = await organizationRepository.getUserIdsInOrg(org.id);
      const row = await aiBudgetRepository.getOrgMonthlyUsage(userIds);
      totalInput = Number(row.total_input);
      totalOutput = Number(row.total_output);
      totalCost = Number(row.total_cost);
      requestCount = Number(row.request_count);
    } else {
      const row = await aiBudgetRepository.getMonthlyUsage(userId);
      totalInput = Number(row.total_input);
      totalOutput = Number(row.total_output);
      totalCost = Number(row.total_cost);
      requestCount = Number(row.request_count);
    }

    const totalTokens = totalInput + totalOutput;
    const budget = await this.getBudget(userId);
    const remaining = Math.max(0, budget - totalTokens);

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalTokens,
      totalCost,
      requestCount,
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
    // Check if user belongs to a per-seat org → pooled budget
    const org = await organizationRepository.findByUserId(userId);
    if (org && org.billingModel === 'per_seat') {
      const perSeatBudget = config.AI_TIER_BUDGET_SME_PER_SEAT;
      return perSeatBudget * org.seatCount;
    }

    // Priority: per-user override → tier default → global fallback
    const userBudget = await aiBudgetRepository.getUserBudget(userId);
    const baseBudget = userBudget ?? getTierBudget(await aiBudgetRepository.getUserTier(userId));

    // Add any purchased top-up tokens
    const topUpTokens = await tokenTopUpRepository.getRemainingTokens(userId);
    return baseBudget + topUpTokens;
  }
}

export const aiBudgetService = new AIBudgetService();
