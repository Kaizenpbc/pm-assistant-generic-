import { agentMemoryService, AgentMemory } from '../AgentMemoryService';

export interface AgentInsight {
  agentId: string;
  projectId: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

/**
 * Allows agents to query what other agents concluded during current or recent scans.
 * Uses the agent_memory table (type='project') — no new tables needed.
 */
export class InterAgentQueryService {
  /**
   * Get the latest insight from a specific agent for a specific project.
   */
  async getLatestInsight(agentId: string, projectId: string): Promise<AgentInsight | null> {
    const memories = await agentMemoryService.recall(agentId, 'project', projectId, 'latest_scan');
    if (memories.length === 0) return null;
    const m = memories[0];
    return {
      agentId: m.agentId,
      projectId: m.entityId || projectId,
      key: m.keyName,
      value: m.value,
      updatedAt: m.updatedAt,
    };
  }

  /**
   * Get all latest scan results for a specific project across all agents.
   */
  async getInsightsByProject(projectId: string): Promise<AgentInsight[]> {
    const { databaseService } = await import('../../database/connection');
    const rows = await databaseService.query<any>(
      `SELECT * FROM agent_memory
       WHERE memory_type = 'project' AND entity_id = ? AND key_name = 'latest_scan'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY updated_at DESC`,
      [projectId],
    );
    return rows.map((row: any) => ({
      agentId: row.agent_id,
      projectId: row.entity_id,
      key: row.key_name,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get insights from a specific agent across all projects.
   */
  async getInsightsByAgent(agentId: string): Promise<AgentInsight[]> {
    const memories = await agentMemoryService.recall(agentId, 'project');
    return memories
      .filter(m => m.keyName === 'latest_scan')
      .map(m => ({
        agentId: m.agentId,
        projectId: m.entityId || '',
        key: m.keyName,
        value: m.value,
        updatedAt: m.updatedAt,
      }));
  }
}

export const interAgentQueryService = new InterAgentQueryService();
