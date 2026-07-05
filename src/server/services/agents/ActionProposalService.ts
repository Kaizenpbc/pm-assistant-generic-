import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../../database/connection';
import { autonomyService } from './AutonomyService';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executing' | 'executed' | 'rolled_back' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionType = 'update_task_dates' | 'reassign_resource' | 'update_dependency' | 'update_progress' | 'create_change_request' | 'update_budget' | 'send_notification';
export type ActionStatus = 'pending' | 'executed' | 'rolled_back' | 'failed' | 'skipped';

export interface ProposalAction {
  id: string;
  proposalId: string;
  executionOrder: number;
  actionType: ActionType;
  targetEntityType: string;
  targetEntityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  reasoning?: string;
  status: ActionStatus;
  executedAt?: string;
  errorMessage?: string;
}

export interface Proposal {
  id: string;
  projectId: string;
  scheduleId?: string;
  agentId: string;
  agentVersion: string;
  status: ProposalStatus;
  title: string;
  reasoning: string;
  summary: string;
  confidenceScore: number;
  confidenceFactors: Record<string, unknown> | null;
  riskLevel: RiskLevel;
  dataSnapshotVersion?: string;
  expiresAt?: string;
  createdBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  executedAt?: string;
  rolledBackAt?: string;
  createdAt: string;
  updatedAt: string;
  actions?: ProposalAction[];
}

export interface CreateProposalInput {
  projectId: string;
  scheduleId?: string;
  agentId: string;
  agentVersion: string;
  title: string;
  reasoning: string;
  summary: string;
  confidenceScore: number;
  confidenceFactors?: Record<string, unknown>;
  riskLevel: RiskLevel;
  dataSnapshotVersion?: string;
  createdBy: string;
  expiresInHours?: number; // default 48
  actions: Array<{
    executionOrder: number;
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue?: Record<string, unknown> | null;
    newValue: Record<string, unknown>;
    reasoning?: string;
  }>;
}

export interface ProposalReview {
  id: string;
  proposalId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected' | 'requested_changes';
  comment?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface ProposalRow {
  id: string;
  project_id: string;
  schedule_id: string | null;
  agent_id: string;
  agent_version: string;
  status: ProposalStatus;
  title: string;
  reasoning: string;
  summary: string;
  confidence_score: number;
  confidence_factors: string | null;
  risk_level: RiskLevel;
  data_snapshot_version: string | null;
  expires_at: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  executed_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    projectId: row.project_id,
    scheduleId: row.schedule_id ?? undefined,
    agentId: row.agent_id,
    agentVersion: row.agent_version,
    status: row.status,
    title: row.title,
    reasoning: row.reasoning,
    summary: row.summary,
    confidenceScore: Number(row.confidence_score),
    confidenceFactors: row.confidence_factors ? JSON.parse(row.confidence_factors) : null,
    riskLevel: row.risk_level,
    dataSnapshotVersion: row.data_snapshot_version ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    executedAt: row.executed_at ?? undefined,
    rolledBackAt: row.rolled_back_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ActionRow {
  id: string;
  proposal_id: string;
  execution_order: number;
  action_type: ActionType;
  target_entity_type: string;
  target_entity_id: string;
  old_value: string | null;
  new_value: string;
  reasoning: string | null;
  status: ActionStatus;
  executed_at: string | null;
  error_message: string | null;
}

function rowToAction(row: ActionRow): ProposalAction {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    executionOrder: row.execution_order,
    actionType: row.action_type,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    oldValue: row.old_value ? JSON.parse(row.old_value) : null,
    newValue: JSON.parse(row.new_value),
    reasoning: row.reasoning ?? undefined,
    status: row.status,
    executedAt: row.executed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ActionProposalService {
  async create(input: CreateProposalInput): Promise<Proposal> {
    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (input.expiresInHours ?? 48) * 60 * 60 * 1000);

    const connection = await databaseService.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `INSERT INTO agent_proposals (id, project_id, schedule_id, agent_id, agent_version, status, title, reasoning, summary, confidence_score, confidence_factors, risk_level, data_snapshot_version, expires_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          input.projectId,
          input.scheduleId ?? null,
          input.agentId,
          input.agentVersion,
          input.title,
          input.reasoning,
          input.summary,
          input.confidenceScore,
          input.confidenceFactors ? JSON.stringify(input.confidenceFactors) : null,
          input.riskLevel,
          input.dataSnapshotVersion ?? null,
          expiresAt.toISOString().replace('T', ' ').substring(0, 19),
          input.createdBy,
        ],
      );

      for (const action of input.actions) {
        await connection.query(
          `INSERT INTO agent_proposal_actions (id, proposal_id, execution_order, action_type, target_entity_type, target_entity_id, old_value, new_value, reasoning, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [
            uuidv4(),
            id,
            action.executionOrder,
            action.actionType,
            action.targetEntityType,
            action.targetEntityId,
            action.oldValue ? JSON.stringify(action.oldValue) : null,
            JSON.stringify(action.newValue),
            action.reasoning ?? null,
          ],
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const proposal = (await this.getById(id))!;

    // Tier 3 auto-execute: if agent is promoted, execute immediately
    this.tryAutoExecute(proposal).catch(err =>
      logger.error(`[ActionProposalService] Auto-execute check failed for ${id}:`, err)
    );

    return proposal;
  }

  private async tryAutoExecute(proposal: Proposal): Promise<void> {
    const canAuto = await autonomyService.canAutoExecute(
      proposal.agentId,
      proposal.projectId,
      proposal.confidenceScore,
      proposal.riskLevel,
    );

    if (!canAuto) return;

    // Lazy import to avoid circular dependency
    const { actionExecutor } = await import('./ActionExecutor');

    // Auto-approve
    await databaseService.query(
      `UPDATE agent_proposals SET status = 'approved', reviewed_by = 'autonomy-tier-3', reviewed_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [proposal.id],
    );

    // Execute
    try {
      await actionExecutor.execute(proposal.id);
      logger.info(`[Autonomy] Auto-executed proposal ${proposal.id} (agent: ${proposal.agentId}, confidence: ${proposal.confidenceScore}%)`);
    } catch (err) {
      logger.error(`[Autonomy] Auto-execution failed for proposal ${proposal.id}:`, err);
    }
  }

  async getById(id: string): Promise<Proposal | null> {
    const rows = await databaseService.query<ProposalRow>(
      'SELECT * FROM agent_proposals WHERE id = ?',
      [id],
    );
    if (rows.length === 0) return null;

    const proposal = rowToProposal(rows[0]);
    proposal.actions = await this.getActions(id);
    return proposal;
  }

  async getActions(proposalId: string): Promise<ProposalAction[]> {
    const rows = await databaseService.query<ActionRow>(
      'SELECT * FROM agent_proposal_actions WHERE proposal_id = ? ORDER BY execution_order',
      [proposalId],
    );
    return rows.map(rowToAction);
  }

  async list(filters: {
    projectId?: string;
    status?: ProposalStatus;
    agentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ proposals: Proposal[]; total: number }> {
    let where = '1=1';
    const params: unknown[] = [];

    if (filters.projectId) { where += ' AND project_id = ?'; params.push(filters.projectId); }
    if (filters.status) { where += ' AND status = ?'; params.push(filters.status); }
    if (filters.agentId) { where += ' AND agent_id = ?'; params.push(filters.agentId); }

    const countRows = await databaseService.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM agent_proposals WHERE ${where}`,
      params,
    );
    const total = Number(countRows[0]?.cnt ?? 0);

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    const rows = await databaseService.query<ProposalRow>(
      `SELECT * FROM agent_proposals WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { proposals: rows.map(rowToProposal), total };
  }

  async updateStatus(id: string, status: ProposalStatus, extra?: Record<string, unknown>): Promise<void> {
    const sets = ['status = ?', 'updated_at = NOW()'];
    const params: unknown[] = [status];

    if (status === 'approved' || status === 'rejected') {
      if (extra?.reviewedBy) { sets.push('reviewed_by = ?'); params.push(extra.reviewedBy); }
      sets.push('reviewed_at = NOW()');
    }
    if (status === 'executed') {
      sets.push('executed_at = NOW()');
    }
    if (status === 'rolled_back') {
      sets.push('rolled_back_at = NOW()');
    }

    params.push(id);
    await databaseService.query(
      `UPDATE agent_proposals SET ${sets.join(', ')} WHERE id = ?`,
      params,
    );
  }

  async updateActionStatus(actionId: string, status: ActionStatus, errorMessage?: string): Promise<void> {
    if (status === 'executed') {
      await databaseService.query(
        'UPDATE agent_proposal_actions SET status = ?, executed_at = NOW() WHERE id = ?',
        [status, actionId],
      );
    } else if (status === 'failed') {
      await databaseService.query(
        'UPDATE agent_proposal_actions SET status = ?, error_message = ? WHERE id = ?',
        [status, errorMessage ?? null, actionId],
      );
    } else {
      await databaseService.query(
        'UPDATE agent_proposal_actions SET status = ? WHERE id = ?',
        [status, actionId],
      );
    }
  }

  async addReview(proposalId: string, reviewerId: string, decision: 'approved' | 'rejected' | 'requested_changes', comment?: string): Promise<ProposalReview> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO agent_proposal_reviews (id, proposal_id, reviewer_id, decision, comment, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, proposalId, reviewerId, decision, comment ?? null],
    );

    // Update proposal status
    if (decision === 'approved') {
      await this.updateStatus(proposalId, 'approved', { reviewedBy: reviewerId });
    } else if (decision === 'rejected') {
      await this.updateStatus(proposalId, 'rejected', { reviewedBy: reviewerId });
    }

    return {
      id,
      proposalId,
      reviewerId,
      decision,
      comment,
      createdAt: new Date().toISOString(),
    };
  }

  async expireStaleProposals(): Promise<number> {
    const result = await databaseService.query<{ affectedRows?: number }>(
      `UPDATE agent_proposals SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()`,
    );
    // mysql2 returns ResultSetHeader with affectedRows for UPDATE
    return (result as any).affectedRows ?? 0;
  }

  async getPendingCountByProject(projectId: string): Promise<number> {
    const rows = await databaseService.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM agent_proposals WHERE project_id = ? AND status = 'pending'`,
      [projectId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async submitFeedback(proposalId: string, submittedBy: string, outcome: string, comment?: string, metricsBefore?: Record<string, unknown>, metricsAfter?: Record<string, unknown>): Promise<void> {
    await databaseService.query(
      `INSERT INTO agent_feedback (id, proposal_id, submitted_by, outcome, comment, metrics_before, metrics_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE outcome = VALUES(outcome), comment = VALUES(comment), metrics_after = VALUES(metrics_after)`,
      [
        uuidv4(),
        proposalId,
        submittedBy,
        outcome,
        comment ?? null,
        metricsBefore ? JSON.stringify(metricsBefore) : null,
        metricsAfter ? JSON.stringify(metricsAfter) : null,
      ],
    );
  }
}

export const actionProposalService = new ActionProposalService();
