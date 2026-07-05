import { BaseRepository } from './BaseRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentRecord {
  id: string;
  displayName: string;
  description: string | null;
  agentRole: string;
  capability: string;
  version: string;
  isEnabled: boolean;
  permissions: string[];
  config: Record<string, unknown> | null;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapAgentRow(row: any): AgentRecord {
  let permissions = row.permissions;
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = []; }
  }
  let config = row.config;
  if (typeof config === 'string') {
    try { config = JSON.parse(config); } catch { config = null; }
  }
  return {
    id: row.id,
    displayName: row.display_name,
    description: row.description,
    agentRole: row.agent_role,
    capability: row.capability,
    version: row.version,
    isEnabled: !!row.is_enabled,
    permissions: permissions || [],
    config: config || null,
    timeoutMs: row.timeout_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AgentRepository extends BaseRepository<AgentRecord> {
  constructor() {
    super('agents', mapAgentRow);
  }

  async findEnabled(): Promise<AgentRecord[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM agents WHERE is_enabled = 1 ORDER BY display_name',
    );
    return rows.map(mapAgentRow);
  }

  async findByCapability(capability: string): Promise<AgentRecord[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM agents WHERE capability = ? AND is_enabled = 1',
      [capability],
    );
    return rows.map(mapAgentRow);
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const result: any = await this.queryRaw(
      'UPDATE agents SET is_enabled = ? WHERE id = ?',
      [enabled ? 1 : 0, id],
    );
    return (result.affectedRows ?? 0) > 0;
  }

  async updateConfig(id: string, config: Record<string, unknown>): Promise<boolean> {
    const result: any = await this.queryRaw(
      'UPDATE agents SET config = ? WHERE id = ?',
      [JSON.stringify(config), id],
    );
    return (result.affectedRows ?? 0) > 0;
  }

  async upsert(agent: Omit<AgentRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.queryRaw(
      `INSERT INTO agents (id, display_name, description, agent_role, capability, version, is_enabled, permissions, config, timeout_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         description = VALUES(description),
         agent_role = VALUES(agent_role),
         capability = VALUES(capability),
         version = VALUES(version),
         permissions = VALUES(permissions),
         config = VALUES(config),
         timeout_ms = VALUES(timeout_ms)`,
      [
        agent.id, agent.displayName, agent.description, agent.agentRole,
        agent.capability, agent.version, agent.isEnabled ? 1 : 0,
        JSON.stringify(agent.permissions), agent.config ? JSON.stringify(agent.config) : null,
        agent.timeoutMs,
      ],
    );
  }
}

export const agentRepository = new AgentRepository();
