import { databaseService } from './connection';

export interface AutonomyConfigRow {
  id: string;
  agent_id: string;
  project_id: string | null;
  autonomy_tier: number;
  min_confidence_threshold: number;
  max_risk_level: string;
  enabled_by: string;
  enabled_at: string;
  disabled_at: string | null;
}

class AutonomyRepository {
  async findTierByAgentAndProject(agentId: string, projectId: string): Promise<number | null> {
    const rows = await databaseService.query<{ autonomy_tier: number }>(
      `SELECT autonomy_tier FROM agent_autonomy_config
       WHERE agent_id = ? AND project_id = ? AND disabled_at IS NULL LIMIT 1`,
      [agentId, projectId],
    );
    return rows.length > 0 ? Number(rows[0].autonomy_tier) : null;
  }

  async findTierByAgentGlobal(agentId: string): Promise<number | null> {
    const rows = await databaseService.query<{ autonomy_tier: number }>(
      `SELECT autonomy_tier FROM agent_autonomy_config
       WHERE agent_id = ? AND project_id IS NULL AND disabled_at IS NULL LIMIT 1`,
      [agentId],
    );
    return rows.length > 0 ? Number(rows[0].autonomy_tier) : null;
  }

  async findConfigByAgentAndProject(agentId: string, projectId: string): Promise<AutonomyConfigRow | null> {
    const rows = await databaseService.query<AutonomyConfigRow>(
      `SELECT * FROM agent_autonomy_config
       WHERE agent_id = ? AND project_id = ? AND disabled_at IS NULL LIMIT 1`,
      [agentId, projectId],
    );
    return rows[0] ?? null;
  }

  async findConfigByAgentGlobal(agentId: string): Promise<AutonomyConfigRow | null> {
    const rows = await databaseService.query<AutonomyConfigRow>(
      `SELECT * FROM agent_autonomy_config
       WHERE agent_id = ? AND project_id IS NULL AND disabled_at IS NULL LIMIT 1`,
      [agentId],
    );
    return rows[0] ?? null;
  }

  async findStatusCounts(agentId: string, projectFilter: string, params: unknown[]): Promise<Array<{ status: string; cnt: number }>> {
    return databaseService.query<{ status: string; cnt: number }>(
      `SELECT status, COUNT(*) AS cnt FROM agent_proposals
       WHERE agent_id = ? ${projectFilter} GROUP BY status`,
      params,
    );
  }

  async findFirstProposalDate(agentId: string, projectFilter: string, params: unknown[]): Promise<string | null> {
    const rows = await databaseService.query<{ first_date: string }>(
      `SELECT MIN(created_at) AS first_date FROM agent_proposals
       WHERE agent_id = ? ${projectFilter}`,
      params,
    );
    return rows[0]?.first_date ?? null;
  }

  async disableExisting(agentId: string, projectId: string | null): Promise<void> {
    await databaseService.query(
      `UPDATE agent_autonomy_config SET disabled_at = NOW()
       WHERE agent_id = ? AND ${projectId ? 'project_id = ?' : 'project_id IS NULL'} AND disabled_at IS NULL`,
      projectId ? [agentId, projectId] : [agentId],
    );
  }

  async insert(id: string, agentId: string, projectId: string | null, minConfidence: number, maxRisk: string, enabledBy: string): Promise<void> {
    await databaseService.query(
      `INSERT INTO agent_autonomy_config (id, agent_id, project_id, autonomy_tier, min_confidence_threshold, max_risk_level, enabled_by)
       VALUES (?, ?, ?, 3, ?, ?, ?)`,
      [id, agentId, projectId, minConfidence, maxRisk, enabledBy],
    );
  }

  async findActiveConfigs(): Promise<AutonomyConfigRow[]> {
    return databaseService.query<AutonomyConfigRow>(
      `SELECT * FROM agent_autonomy_config WHERE disabled_at IS NULL ORDER BY enabled_at DESC`,
    );
  }
}

export const autonomyRepository = new AutonomyRepository();
