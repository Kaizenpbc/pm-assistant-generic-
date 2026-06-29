import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../../database/connection';
import type { RiskLevel } from './ActionProposalService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutonomyConfig {
  id: string;
  agentId: string;
  projectId: string | null;
  autonomyTier: number;
  minConfidenceThreshold: number;
  maxRiskLevel: RiskLevel;
  enabledBy: string;
  enabledAt: string;
  disabledAt: string | null;
}

export interface EligibilityStats {
  agentId: string;
  projectId: string | null;
  totalProposals: number;
  acceptedProposals: number;
  rejectedProposals: number;
  executedProposals: number;
  rolledBackProposals: number;
  acceptanceRate: number;
  effectivenessRate: number;
  daysSinceFirstProposal: number;
  isEligible: boolean;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const RISK_LEVEL_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export class AutonomyService {

  async getAutonomyTier(agentId: string, projectId?: string): Promise<number> {
    try {
      // Check project-specific config first
      if (projectId) {
        const rows = await databaseService.query<any>(
          `SELECT autonomy_tier FROM agent_autonomy_config
           WHERE agent_id = ? AND project_id = ? AND disabled_at IS NULL
           LIMIT 1`,
          [agentId, projectId],
        );
        if (rows.length > 0) return Number(rows[0].autonomy_tier);
      }

      // Check global config (project_id IS NULL)
      const globalRows = await databaseService.query<any>(
        `SELECT autonomy_tier FROM agent_autonomy_config
         WHERE agent_id = ? AND project_id IS NULL AND disabled_at IS NULL
         LIMIT 1`,
        [agentId],
      );
      if (globalRows.length > 0) return Number(globalRows[0].autonomy_tier);
    } catch {
      // Table may not exist yet
    }

    // Default: Tier 2 (propose only)
    return 2;
  }

  async canAutoExecute(
    agentId: string,
    projectId: string,
    confidenceScore: number,
    riskLevel: RiskLevel,
  ): Promise<boolean> {
    try {
      // Check project-specific, then global
      let config: any = null;

      const projectRows = await databaseService.query<any>(
        `SELECT * FROM agent_autonomy_config
         WHERE agent_id = ? AND project_id = ? AND disabled_at IS NULL
         LIMIT 1`,
        [agentId, projectId],
      );
      if (projectRows.length > 0) {
        config = projectRows[0];
      } else {
        const globalRows = await databaseService.query<any>(
          `SELECT * FROM agent_autonomy_config
           WHERE agent_id = ? AND project_id IS NULL AND disabled_at IS NULL
           LIMIT 1`,
          [agentId],
        );
        if (globalRows.length > 0) config = globalRows[0];
      }

      if (!config) return false;
      if (Number(config.autonomy_tier) < 3) return false;
      if (confidenceScore < Number(config.min_confidence_threshold)) return false;

      const maxRisk = RISK_LEVEL_ORDER[config.max_risk_level] || 1;
      const actualRisk = RISK_LEVEL_ORDER[riskLevel] || 4;
      if (actualRisk > maxRisk) return false;

      return true;
    } catch {
      return false;
    }
  }

  async getEligibilityStats(agentId: string, projectId?: string): Promise<EligibilityStats> {
    const projectFilter = projectId ? 'AND project_id = ?' : '';
    const params = projectId ? [agentId, projectId] : [agentId];

    let totalProposals = 0;
    let acceptedProposals = 0;
    let rejectedProposals = 0;
    let executedProposals = 0;
    let rolledBackProposals = 0;
    let daysSinceFirstProposal = 0;

    try {
      const statusRows = await databaseService.query<{ status: string; cnt: number }>(
        `SELECT status, COUNT(*) AS cnt FROM agent_proposals
         WHERE agent_id = ? ${projectFilter}
         GROUP BY status`,
        params,
      );

      for (const row of statusRows) {
        const cnt = Number(row.cnt);
        totalProposals += cnt;
        if (row.status === 'approved' || row.status === 'executed') acceptedProposals += cnt;
        if (row.status === 'rejected') rejectedProposals += cnt;
        if (row.status === 'executed') executedProposals += cnt;
        if (row.status === 'rolled_back') rolledBackProposals += cnt;
      }

      const dateRows = await databaseService.query<{ first_date: string }>(
        `SELECT MIN(created_at) AS first_date FROM agent_proposals
         WHERE agent_id = ? ${projectFilter}`,
        params,
      );
      if (dateRows.length > 0 && dateRows[0].first_date) {
        daysSinceFirstProposal = Math.floor(
          (Date.now() - new Date(dateRows[0].first_date).getTime()) / 86400000,
        );
      }
    } catch {
      // Table may not exist
    }

    const acceptanceRate = totalProposals > 0 ? Math.round((acceptedProposals / totalProposals) * 100) : 0;
    const effectivenessRate = acceptedProposals > 0 ? Math.round((executedProposals / acceptedProposals) * 100) : 0;

    const reasons: string[] = [];
    const isEligible = this.checkEligibility(
      totalProposals, acceptanceRate, effectivenessRate, rolledBackProposals, daysSinceFirstProposal, reasons,
    );

    return {
      agentId,
      projectId: projectId || null,
      totalProposals,
      acceptedProposals,
      rejectedProposals,
      executedProposals,
      rolledBackProposals,
      acceptanceRate,
      effectivenessRate,
      daysSinceFirstProposal,
      isEligible,
      reasons,
    };
  }

  private checkEligibility(
    totalProposals: number,
    acceptanceRate: number,
    effectivenessRate: number,
    rolledBackProposals: number,
    daysSinceFirstProposal: number,
    reasons: string[],
  ): boolean {
    let eligible = true;

    if (daysSinceFirstProposal < 30) {
      reasons.push(`Need 30+ days of history (currently ${daysSinceFirstProposal})`);
      eligible = false;
    }
    if (totalProposals < 20) {
      reasons.push(`Need 20+ proposals (currently ${totalProposals})`);
      eligible = false;
    }
    if (acceptanceRate < 80) {
      reasons.push(`Need 80%+ acceptance rate (currently ${acceptanceRate}%)`);
      eligible = false;
    }
    if (effectivenessRate < 70) {
      reasons.push(`Need 70%+ effectiveness rate (currently ${effectivenessRate}%)`);
      eligible = false;
    }
    if (rolledBackProposals > 0) {
      reasons.push(`Zero rollbacks required (currently ${rolledBackProposals})`);
      eligible = false;
    }

    if (eligible) {
      reasons.push('All criteria met — eligible for Tier 3 promotion');
    }

    return eligible;
  }

  async promote(agentId: string, projectId: string | null, adminUserId: string, options?: {
    minConfidenceThreshold?: number;
    maxRiskLevel?: RiskLevel;
  }): Promise<AutonomyConfig> {
    const id = uuidv4();
    const minConfidence = options?.minConfidenceThreshold ?? 80;
    const maxRisk = options?.maxRiskLevel ?? 'low';

    // Upsert: disable existing, then insert new
    await databaseService.query(
      `UPDATE agent_autonomy_config SET disabled_at = NOW()
       WHERE agent_id = ? AND ${projectId ? 'project_id = ?' : 'project_id IS NULL'} AND disabled_at IS NULL`,
      projectId ? [agentId, projectId] : [agentId],
    );

    await databaseService.query(
      `INSERT INTO agent_autonomy_config (id, agent_id, project_id, autonomy_tier, min_confidence_threshold, max_risk_level, enabled_by)
       VALUES (?, ?, ?, 3, ?, ?, ?)`,
      [id, agentId, projectId, minConfidence, maxRisk, adminUserId],
    );

    console.log(`[Autonomy] Agent ${agentId} promoted to Tier 3 by ${adminUserId} (project: ${projectId ?? 'global'}, minConfidence: ${minConfidence}, maxRisk: ${maxRisk})`);

    return {
      id,
      agentId,
      projectId,
      autonomyTier: 3,
      minConfidenceThreshold: minConfidence,
      maxRiskLevel: maxRisk as RiskLevel,
      enabledBy: adminUserId,
      enabledAt: new Date().toISOString(),
      disabledAt: null,
    };
  }

  async demote(agentId: string, projectId: string | null, adminUserId: string): Promise<void> {
    await databaseService.query(
      `UPDATE agent_autonomy_config SET disabled_at = NOW()
       WHERE agent_id = ? AND ${projectId ? 'project_id = ?' : 'project_id IS NULL'} AND disabled_at IS NULL`,
      projectId ? [agentId, projectId] : [agentId],
    );

    console.log(`[Autonomy] Agent ${agentId} demoted to Tier 2 by ${adminUserId} (project: ${projectId ?? 'global'})`);
  }

  async listConfigs(): Promise<AutonomyConfig[]> {
    try {
      const rows = await databaseService.query<any>(
        `SELECT * FROM agent_autonomy_config WHERE disabled_at IS NULL ORDER BY enabled_at DESC`,
      );
      return rows.map(this.mapRow);
    } catch {
      return [];
    }
  }

  private mapRow(row: any): AutonomyConfig {
    return {
      id: row.id,
      agentId: row.agent_id,
      projectId: row.project_id,
      autonomyTier: Number(row.autonomy_tier),
      minConfidenceThreshold: Number(row.min_confidence_threshold),
      maxRiskLevel: row.max_risk_level,
      enabledBy: row.enabled_by,
      enabledAt: row.enabled_at,
      disabledAt: row.disabled_at,
    };
  }
}

export const autonomyService = new AutonomyService();
