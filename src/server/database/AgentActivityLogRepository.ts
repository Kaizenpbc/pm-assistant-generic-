import { databaseService } from './connection';

export interface AgentActivityLogRow {
  id: string;
  project_id: string;
  agent_name: string;
  result: string;
  summary: string;
  details: string | null;
  created_at: string;
}

class AgentActivityLogRepository {
  async insert(
    id: string, projectId: string, agentName: string, result: string,
    summary: string, details: string | null, createdAt: string,
  ): Promise<void> {
    await databaseService.query(
      `INSERT INTO agent_activity_log (id, project_id, agent_name, result, summary, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, agentName, result, summary, details, createdAt],
    );
  }

  async count(whereClause: string, params: unknown[]): Promise<number> {
    const rows = await databaseService.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM agent_activity_log ${whereClause}`,
      params,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async findPaginated(whereClause: string, params: unknown[], limit: number, offset: number): Promise<AgentActivityLogRow[]> {
    return databaseService.query<AgentActivityLogRow>(
      `SELECT * FROM agent_activity_log ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
  }
}

export const agentActivityLogRepository = new AgentActivityLogRepository();
