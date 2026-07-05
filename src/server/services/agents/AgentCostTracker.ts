import { v4 as uuidv4 } from 'uuid';
import { agentCostRepository } from '../../database/AgentCostRepository';
import { config } from '../../config';
import logger from '../../utils/logger';

export interface CostEntry {
  agentId: string;
  projectId?: string;
  scanId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  model?: string;
  latencyMs?: number;
}

export interface CostSummary {
  totalTokens: number;
  estimatedCostUsd: number;
  entries: number;
}

// Pricing per million tokens (matches claudeService)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-4-20250414': { input: 0.80, output: 4.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
};
const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

export class AgentCostTracker {
  estimateCost(model: string | undefined, inputTokens: number, outputTokens: number): number {
    const pricing = (model && PRICING[model]) || DEFAULT_PRICING;
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }

  async record(entry: CostEntry): Promise<void> {
    try {
      await agentCostRepository.insert(
        uuidv4(), entry.agentId, entry.projectId ?? null, entry.scanId ?? null,
        entry.inputTokens, entry.outputTokens, entry.totalTokens,
        entry.estimatedCostUsd, entry.model ?? null, entry.latencyMs ?? null,
      );
    } catch (err) {
      logger.error('[AgentCostTracker] Failed to record cost entry:', err);
    }
  }

  async getDailyCost(date?: string): Promise<CostSummary> {
    const d = date ?? new Date().toISOString().split('T')[0];
    const row = await agentCostRepository.getDailySummary(d);
    return {
      totalTokens: Number(row?.total_tokens ?? 0),
      estimatedCostUsd: Number(row?.total_cost ?? 0),
      entries: Number(row?.cnt ?? 0),
    };
  }

  async getProjectDailyCost(projectId: string, date?: string): Promise<CostSummary> {
    const d = date ?? new Date().toISOString().split('T')[0];
    const row = await agentCostRepository.getProjectDailySummary(projectId, d);
    return {
      totalTokens: Number(row?.total_tokens ?? 0),
      estimatedCostUsd: Number(row?.total_cost ?? 0),
      entries: Number(row?.cnt ?? 0),
    };
  }

  /**
   * Check if budget allows another invocation.
   * Returns { allowed, reason } — reason is set if blocked.
   */
  async checkBudget(agentId: string, projectId?: string): Promise<{ allowed: boolean; reason?: string }> {
    const daily = await this.getDailyCost();

    // Global daily limit: $10 default (configurable via policy)
    if (daily.estimatedCostUsd >= 10) {
      return { allowed: false, reason: `Global daily cost limit reached ($${daily.estimatedCostUsd.toFixed(2)})` };
    }

    // Per-project daily limit: 50,000 tokens
    if (projectId) {
      const projectDaily = await this.getProjectDailyCost(projectId);
      if (projectDaily.totalTokens >= 50_000) {
        return { allowed: false, reason: `Project daily token limit reached (${projectDaily.totalTokens} tokens)` };
      }
    }

    return { allowed: true };
  }

  async getCostsByAgent(since?: string, until?: string): Promise<Array<{ agentId: string; totalTokens: number; estimatedCostUsd: number; invocations: number }>> {
    const rows = await agentCostRepository.getCostsByAgent(since, until);
    return rows.map(r => ({
      agentId: r.agent_id,
      totalTokens: Number(r.total_tokens),
      estimatedCostUsd: Number(r.total_cost),
      invocations: Number(r.invocations),
    }));
  }
}

export const agentCostTracker = new AgentCostTracker();
