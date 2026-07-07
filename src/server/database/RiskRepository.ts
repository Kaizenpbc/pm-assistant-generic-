import { BaseRepository } from './BaseRepository';
import { databaseService } from './connection';
import { v4 as uuidv4 } from 'uuid';

export interface ProjectRisk {
  id: string;
  projectId: string;
  type: 'risk' | 'issue';
  title: string;
  description: string | null;
  category: string;
  severity: string;
  probability: number;
  impact: number;
  riskScore: number;
  status: string;
  triggerCondition: string | null;
  triggered: boolean;
  triggeredAt: string | null;
  mitigationPlan: string | null;
  responsePlan: string | null;
  ownerId: string | null;
  source: 'manual' | 'ai_detected' | 'agent';
  sourceAgentId: string | null;
  aiConfidence: number | null;
  linkedTaskIds: string[] | null;
  linkedProposalId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

function mapRow(row: any): ProjectRisk {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    probability: row.probability,
    impact: row.impact,
    riskScore: row.risk_score,
    status: row.status,
    triggerCondition: row.trigger_condition,
    triggered: !!row.triggered,
    triggeredAt: row.triggered_at,
    mitigationPlan: row.mitigation_plan,
    responsePlan: row.response_plan,
    ownerId: row.owner_id,
    source: row.source,
    sourceAgentId: row.source_agent_id,
    aiConfidence: row.ai_confidence != null ? Number(row.ai_confidence) : null,
    linkedTaskIds: row.linked_task_ids ? (typeof row.linked_task_ids === 'string' ? JSON.parse(row.linked_task_ids) : row.linked_task_ids) : null,
    linkedProposalId: row.linked_proposal_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

export interface RiskFilters {
  type?: 'risk' | 'issue';
  status?: string;
  severity?: string;
  source?: string;
  sort?: 'risk_score' | 'created_at' | 'severity' | 'status';
  sortDir?: 'asc' | 'desc';
}

export interface RiskStats {
  totalRisks: number;
  totalIssues: number;
  openRisks: number;
  openIssues: number;
  critical: number;
  triggered: number;
}

const COLUMN_MAP: Record<string, string> = {
  type: 'type',
  title: 'title',
  description: 'description',
  category: 'category',
  severity: 'severity',
  probability: 'probability',
  impact: 'impact',
  status: 'status',
  triggerCondition: 'trigger_condition',
  triggered: 'triggered',
  triggeredAt: 'triggered_at',
  mitigationPlan: 'mitigation_plan',
  responsePlan: 'response_plan',
  ownerId: 'owner_id',
  source: 'source',
  sourceAgentId: 'source_agent_id',
  aiConfidence: 'ai_confidence',
  linkedTaskIds: 'linked_task_ids',
  linkedProposalId: 'linked_proposal_id',
  resolvedAt: 'resolved_at',
};

class RiskRepository extends BaseRepository<ProjectRisk> {
  constructor() {
    super('project_risks', mapRow);
  }

  async findByProject(projectId: string, filters: RiskFilters = {}): Promise<ProjectRisk[]> {
    const conditions: string[] = ['project_id = ?'];
    const params: any[] = [projectId];

    if (filters.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }
    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    const sort = filters.sort || 'risk_score';
    const dir = filters.sortDir || 'desc';
    const orderBy = `${sort} ${dir}, created_at DESC`;

    const rows = await this.queryRaw(
      `SELECT * FROM project_risks WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`,
      params,
    );
    return this.mapRows(rows);
  }

  async create(data: {
    projectId: string;
    type: 'risk' | 'issue';
    title: string;
    description?: string;
    category?: string;
    severity?: string;
    probability?: number;
    impact?: number;
    status?: string;
    triggerCondition?: string;
    mitigationPlan?: string;
    responsePlan?: string;
    ownerId?: string;
    source?: 'manual' | 'ai_detected' | 'agent';
    sourceAgentId?: string;
    aiConfidence?: number;
    linkedTaskIds?: string[];
    linkedProposalId?: string;
    createdBy: string;
  }): Promise<ProjectRisk> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO project_risks (id, project_id, type, title, description, category, severity, probability, impact, status, trigger_condition, mitigation_plan, response_plan, owner_id, source, source_agent_id, ai_confidence, linked_task_ids, linked_proposal_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.projectId,
        data.type,
        data.title,
        data.description || null,
        data.category || 'other',
        data.severity || 'medium',
        data.probability ?? 3,
        data.impact ?? 3,
        data.status || 'open',
        data.triggerCondition || null,
        data.mitigationPlan || null,
        data.responsePlan || null,
        data.ownerId || null,
        data.source || 'manual',
        data.sourceAgentId || null,
        data.aiConfidence ?? null,
        data.linkedTaskIds ? JSON.stringify(data.linkedTaskIds) : null,
        data.linkedProposalId || null,
        data.createdBy,
      ],
    );
    return (await this.findById(id))!;
  }

  async update(id: string, data: Record<string, any>): Promise<ProjectRisk | null> {
    const upd = this.buildUpdate(data, COLUMN_MAP, (key, val) => {
      if (key === 'linkedTaskIds') return val ? JSON.stringify(val) : null;
      return val;
    });
    if (!upd) return this.findById(id);

    upd.values.push(id);
    await databaseService.query(upd.sql, upd.values);
    return this.findById(id);
  }

  async findByAgentSource(projectId: string, agentId: string): Promise<ProjectRisk[]> {
    const rows = await this.queryRaw(
      `SELECT * FROM project_risks WHERE project_id = ? AND source_agent_id = ? ORDER BY created_at DESC`,
      [projectId, agentId],
    );
    return this.mapRows(rows);
  }

  async findUntriggered(projectId: string): Promise<ProjectRisk[]> {
    const rows = await this.queryRaw(
      `SELECT * FROM project_risks WHERE project_id = ? AND trigger_condition IS NOT NULL AND triggered = FALSE AND status NOT IN ('closed', 'resolved')`,
      [projectId],
    );
    return this.mapRows(rows);
  }

  async getStats(projectId: string): Promise<RiskStats> {
    const rows = await this.queryRaw(
      `SELECT
         SUM(type = 'risk') AS totalRisks,
         SUM(type = 'issue') AS totalIssues,
         SUM(type = 'risk' AND status NOT IN ('closed','mitigated','resolved')) AS openRisks,
         SUM(type = 'issue' AND status NOT IN ('closed','resolved')) AS openIssues,
         SUM(severity = 'critical' AND status NOT IN ('closed','mitigated','resolved')) AS critical,
         SUM(triggered = TRUE) AS triggered
       FROM project_risks WHERE project_id = ?`,
      [projectId],
    );
    const r = rows[0] || {};
    return {
      totalRisks: Number(r.totalRisks) || 0,
      totalIssues: Number(r.totalIssues) || 0,
      openRisks: Number(r.openRisks) || 0,
      openIssues: Number(r.openIssues) || 0,
      critical: Number(r.critical) || 0,
      triggered: Number(r.triggered) || 0,
    };
  }
}

export const riskRepository = new RiskRepository();
