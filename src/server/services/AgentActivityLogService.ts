import { v4 as uuidv4 } from 'uuid';
import { agentActivityLogRepository, AgentActivityLogRow } from '../database/AgentActivityLogRepository';

export type AgentName = string;
export type AgentResult = 'alert_created' | 'skipped' | 'error';

export interface LogEntryInput {
  projectId: string;
  agentName: AgentName;
  result: AgentResult;
  summary: string;
  details?: Record<string, unknown>;
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

    await agentActivityLogRepository.insert(
      id, entry.projectId, entry.agentName, entry.result,
      entry.summary, entry.details ? JSON.stringify(entry.details) : null, now,
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

    const total = await agentActivityLogRepository.count(whereClause, params);
    const rows = await agentActivityLogRepository.findPaginated(whereClause, params, limit, offset);

    return { entries: rows.map(rowToDTO), total };
  }
}
