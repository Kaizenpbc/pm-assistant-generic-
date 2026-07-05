import { databaseService } from '../../database/connection';
import { AgentActivityLogService } from '../AgentActivityLogService';
import { deadLetterService } from '../DeadLetterService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number;
  window: string;
}

interface LimitRule {
  scope: 'agent' | 'all_agents';
  windowHours: number;
  limit: number;
  windowLabel: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIMIT_RULES: LimitRule[] = [
  { scope: 'agent', windowHours: 24, limit: 3, windowLabel: '24h' },
  { scope: 'all_agents', windowHours: 24, limit: 10, windowLabel: '24h' },
  { scope: 'agent', windowHours: 168, limit: 10, windowLabel: '7d' },
  { scope: 'all_agents', windowHours: 168, limit: 30, windowLabel: '7d' },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const activityLog = new AgentActivityLogService();

export class ProposalRateLimiter {
  /**
   * Check if the agent is allowed to create a new proposal for this project.
   */
  async check(agentId: string, projectId: string): Promise<RateLimitCheck> {
    for (const rule of LIMIT_RULES) {
      const since = new Date(Date.now() - rule.windowHours * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19);

      let count: number;
      if (rule.scope === 'agent') {
        const rows = await databaseService.query<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM agent_proposals
           WHERE agent_id = ? AND project_id = ? AND created_at >= ?`,
          [agentId, projectId, since],
        );
        count = Number(rows[0]?.cnt ?? 0);
      } else {
        const rows = await databaseService.query<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM agent_proposals
           WHERE project_id = ? AND created_at >= ?`,
          [projectId, since],
        );
        count = Number(rows[0]?.cnt ?? 0);
      }

      if (count >= rule.limit) {
        const reason = `Rate limited: ${rule.scope === 'agent' ? agentId : 'all agents'} created ${count}/${rule.limit} proposals for project in ${rule.windowLabel}`;

        activityLog.log({
          projectId,
          agentName: agentId,
          result: 'skipped',
          summary: `Rate limited: ${reason}`,
          details: { rule: rule.windowLabel, scope: rule.scope, count, limit: rule.limit },
        }).catch(err => deadLetterService.capture('agent.activity_log', { agentId }, err));

        return {
          allowed: false,
          reason,
          currentCount: count,
          limit: rule.limit,
          window: `${rule.scope}/${rule.windowLabel}`,
        };
      }
    }

    return { allowed: true, currentCount: 0, limit: LIMIT_RULES[0].limit, window: 'none' };
  }
}

export const proposalRateLimiter = new ProposalRateLimiter();
