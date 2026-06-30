import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../../database/connection';
import { config } from '../../config';

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
      await databaseService.query(
        `INSERT INTO agent_cost_ledger (id, agent_id, project_id, scan_id, input_tokens, output_tokens, total_tokens, estimated_cost_usd, model, latency_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(),
          entry.agentId,
          entry.projectId ?? null,
          entry.scanId ?? null,
          entry.inputTokens,
          entry.outputTokens,
          entry.totalTokens,
          entry.estimatedCostUsd,
          entry.model ?? null,
          entry.latencyMs ?? null,
        ],
      );
    } catch (err) {
      console.error('[AgentCostTracker] Failed to record cost entry:', err);
    }
  }

  async getDailyCost(date?: string): Promise<CostSummary> {
    const d = date ?? new Date().toISOString().split('T')[0];
    const rows = await databaseService.query<{ total_tokens: number; total_cost: number; cnt: number }>(
      `SELECT COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS total_cost,
              COUNT(*) AS cnt
       FROM agent_cost_ledger
       WHERE DATE(created_at) = ?`,
      [d],
    );
    const row = rows[0];
    return {
      totalTokens: Number(row?.total_tokens ?? 0),
      estimatedCostUsd: Number(row?.total_cost ?? 0),
      entries: Number(row?.cnt ?? 0),
    };
  }

  async getProjectDailyCost(projectId: string, date?: string): Promise<CostSummary> {
    const d = date ?? new Date().toISOString().split('T')[0];
    const rows = await databaseService.query<{ total_tokens: number; total_cost: number; cnt: number }>(
      `SELECT COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS total_cost,
              COUNT(*) AS cnt
       FROM agent_cost_ledger
       WHERE project_id = ? AND DATE(created_at) = ?`,
      [projectId, d],
    );
    const row = rows[0];
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
    let sql = `SELECT agent_id, SUM(total_tokens) AS total_tokens, SUM(estimated_cost_usd) AS total_cost, COUNT(*) AS invocations
               FROM agent_cost_ledger WHERE 1=1`;
    const params: unknown[] = [];
    if (since) { sql += ' AND created_at >= ?'; params.push(since); }
    if (until) { sql += ' AND created_at <= ?'; params.push(until); }
    sql += ' GROUP BY agent_id ORDER BY total_cost DESC';

    const rows = await databaseService.query<{ agent_id: string; total_tokens: number; total_cost: number; invocations: number }>(sql, params);
    return rows.map(r => ({
      agentId: r.agent_id,
      totalTokens: Number(r.total_tokens),
      estimatedCostUsd: Number(r.total_cost),
      invocations: Number(r.invocations),
    }));
  }
}

export const agentCostTracker = new AgentCostTracker();
