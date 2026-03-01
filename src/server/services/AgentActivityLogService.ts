import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

export type AgentName = string;
export type AgentResult = 'alert_created' | 'skipped' | 'error';

export interface LogEntryInput {
  projectId: string;
  agentName: AgentName;
  result: AgentResult;
  summary: string;
  details?: Record<string, unknown>;
}

interface AgentActivityLogRow {
  id: string;
  project_id: string;
  agent_name: string;
  result: string;
  summary: string;
  details: string | null;
  created_at: string;
}

export interface AgentActivityLogDTO {
  id: string;
  projectId: string;
  agentName: string;
  result: string;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

function rowToDTO(row: AgentActivityLogRow): AgentActivityLogDTO {
  let details: Record<string, unknown> | null = null;
  if (row.details) {
    try {
      details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
    } catch {
      details = null;
    }
  }
  return {
    id: row.id,
    projectId: row.project_id,
    agentName: row.agent_name,
    result: row.result,
    summary: row.summary,
    details,
    createdAt: row.created_at,
  };
}

export class AgentActivityLogService {
  async log(entry: LogEntryInput): Promise<void> {
    const id = uuidv4();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    await databaseService.query(
      `INSERT INTO agent_activity_log (id, project_id, agent_name, result, summary, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.projectId,
        entry.agentName,
        entry.result,
        entry.summary,
        entry.details ? JSON.stringify(entry.details) : null,
        now,
      ],
    );
  }

  async getByProject(
    projectId: string,
    limit = 50,
    offset = 0,
    agentName?: string,
  ): Promise<{ entries: AgentActivityLogDTO[]; total: number }> {
    const whereClause = agentName
      ? 'WHERE project_id = ? AND agent_name = ?'
      : 'WHERE project_id = ?';
    const params: unknown[] = agentName ? [projectId, agentName] : [projectId];

    const countRows = await databaseService.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM agent_activity_log ${whereClause}`,
      params,
    );
    const total = countRows[0]?.cnt ?? 0;

    const rows = await databaseService.query<AgentActivityLogRow>(
      `SELECT * FROM agent_activity_log ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { entries: rows.map(rowToDTO), total };
  }
}
