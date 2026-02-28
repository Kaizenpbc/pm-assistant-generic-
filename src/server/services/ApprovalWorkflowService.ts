import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { auditLedgerService } from './AuditLedgerService';

export interface ApprovalWorkflow {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  entityType: string;
  steps: WorkflowStep[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  name: string;
  approverRole: string;
  order: number;
}

export interface ChangeRequest {
  id: string;
  projectId: string;
  workflowId: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  impactSummary: string | null;
  status: string;
  currentStep: number | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalAction {
  id: string;
  changeRequestId: string;
  stepOrder: number;
  action: string;
  comment: string | null;
  actedBy: string;
  actedAt: string;
}

interface ApprovalWorkflowRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  entity_type: string;
  steps: string;
  is_active: boolean | number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ChangeRequestRow {
  id: string;
  project_id: string;
  workflow_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  impact_summary: string | null;
  status: string;
  current_step: number | null;
  requested_by: string;
  created_at: string;
  updated_at: string;
}

interface ApprovalActionRow {
  id: string;
  change_request_id: string;
  step_order: number;
  action: string;
  comment: string | null;
  acted_by: string;
  acted_at: string;
}

function workflowRowToDTO(row: ApprovalWorkflowRow): ApprovalWorkflow {
  let steps: WorkflowStep[] = [];
  if (row.steps) {
    try { steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps; } catch { steps = []; }
  }
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    steps,
    isActive: !!row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function changeRequestRowToDTO(row: ChangeRequestRow): ChangeRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    workflowId: row.workflow_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    impactSummary: row.impact_summary,
    status: row.status,
    currentStep: row.current_step != null ? Number(row.current_step) : null,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function approvalActionRowToDTO(row: ApprovalActionRow): ApprovalAction {
  return {
    id: row.id,
    changeRequestId: row.change_request_id,
    stepOrder: Number(row.step_order),
    action: row.action,
    comment: row.comment,
    actedBy: row.acted_by,
    actedAt: row.acted_at,
  };
}

class ApprovalWorkflowService {
  async createWorkflow(projectId: string, data: {
    name: string;
    description?: string;
    entityType: string;
    steps: WorkflowStep[];
    isActive?: boolean;
    createdBy: string;
  }): Promise<ApprovalWorkflow> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO approval_workflows (id, project_id, name, description, entity_type, steps, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, data.name, data.description || null, data.entityType,
       JSON.stringify(data.steps), data.isActive !== false, data.createdBy],
    );
    const rows = await databaseService.query<ApprovalWorkflowRow>('SELECT * FROM approval_workflows WHERE id = ?', [id]);
    return workflowRowToDTO(rows[0]);
  }

  async getWorkflows(projectId: string): Promise<ApprovalWorkflow[]> {
    const rows = await databaseService.query<ApprovalWorkflowRow>(
      'SELECT * FROM approval_workflows WHERE project_id = ? ORDER BY created_at',
      [projectId],
    );
    return rows.map(workflowRowToDTO);
  }

  async updateWorkflow(id: string, data: {
    name?: string;
    description?: string;
    entityType?: string;
    steps?: WorkflowStep[];
    isActive?: boolean;
  }): Promise<ApprovalWorkflow> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.entityType !== undefined) { sets.push('entity_type = ?'); params.push(data.entityType); }
    if (data.steps !== undefined) { sets.push('steps = ?'); params.push(JSON.stringify(data.steps)); }
    if (data.isActive !== undefined) { sets.push('is_active = ?'); params.push(data.isActive); }
    if (sets.length > 0) {
      params.push(id);
      await databaseService.query(`UPDATE approval_workflows SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<ApprovalWorkflowRow>('SELECT * FROM approval_workflows WHERE id = ?', [id]);
    return workflowRowToDTO(rows[0]);
  }

  async deleteWorkflow(id: string): Promise<void> {
    await databaseService.query('DELETE FROM approval_workflows WHERE id = ?', [id]);
  }

  async createChangeRequest(projectId: string, data: {
    title: string;
    description?: string;
    category: string;
    priority: string;
    impactSummary?: string;
    requestedBy: string;
  }): Promise<ChangeRequest> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO change_requests (id, project_id, title, description, category, priority, impact_summary, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [id, projectId, data.title, data.description || null, data.category, data.priority,
       data.impactSummary || null, data.requestedBy],
    );
    const rows = await databaseService.query<ChangeRequestRow>('SELECT * FROM change_requests WHERE id = ?', [id]);
    return changeRequestRowToDTO(rows[0]);
  }

  async getChangeRequests(projectId: string, status?: string): Promise<ChangeRequest[]> {
    let sql = 'SELECT * FROM change_requests WHERE project_id = ?';
    const params: any[] = [projectId];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const rows = await databaseService.query<ChangeRequestRow>(sql, params);
    return rows.map(changeRequestRowToDTO);
  }

  async getChangeRequestDetail(id: string): Promise<{ changeRequest: ChangeRequest; approvalHistory: ApprovalAction[] }> {
    const crRows = await databaseService.query<ChangeRequestRow>('SELECT * FROM change_requests WHERE id = ?', [id]);
    if (crRows.length === 0) throw new Error('Change request not found');
    const changeRequest = changeRequestRowToDTO(crRows[0]);
    const approvalHistory = await this.getApprovalHistory(id);
    return { changeRequest, approvalHistory };
  }

  async submitForApproval(crId: string, workflowId: string, userId?: string): Promise<ChangeRequest> {
    const before = await this.getChangeRequestDetail(crId).catch(() => null);
    await databaseService.query(
      `UPDATE change_requests SET status = 'pending', current_step = 0, workflow_id = ? WHERE id = ?`,
      [workflowId, crId],
    );
    const rows = await databaseService.query<ChangeRequestRow>('SELECT * FROM change_requests WHERE id = ?', [crId]);
    const cr = changeRequestRowToDTO(rows[0]);

    auditLedgerService.append({
      actorId: userId || cr.requestedBy,
      actorType: 'user',
      action: 'approval.submit',
      entityType: 'change_request',
      entityId: crId,
      projectId: cr.projectId,
      payload: { before: before?.changeRequest, after: cr, workflowId },
      source: 'web',
    }).catch(() => {});

    return cr;
  }

  async actOnStep(crId: string, userId: string, action: string, comment?: string, userRole?: string): Promise<ChangeRequest> {
    // Get the CR and its workflow
    const crRows = await databaseService.query<ChangeRequestRow>('SELECT * FROM change_requests WHERE id = ?', [crId]);
    if (crRows.length === 0) throw new Error('Change request not found');
    const cr = crRows[0];

    if (!cr.workflow_id) throw new Error('Change request has no associated workflow');

    const wfRows = await databaseService.query<ApprovalWorkflowRow>('SELECT * FROM approval_workflows WHERE id = ?', [cr.workflow_id]);
    if (wfRows.length === 0) throw new Error('Workflow not found');

    // Parse workflow steps JSON
    let steps: WorkflowStep[] = [];
    try { steps = typeof wfRows[0].steps === 'string' ? JSON.parse(wfRows[0].steps) : wfRows[0].steps; } catch { steps = []; }

    const currentStep = cr.current_step ?? 0;

    // Verify the actor has the required role for this step
    if (steps[currentStep] && userRole) {
      const requiredRole = steps[currentStep].approverRole;
      if (requiredRole && requiredRole !== userRole && userRole !== 'admin') {
        throw new Error(`Step "${steps[currentStep].name}" requires role "${requiredRole}", but user has role "${userRole}"`);
      }
    }

    // Insert approval_action record
    const actionId = uuidv4();
    await databaseService.query(
      `INSERT INTO approval_actions (id, change_request_id, step_order, action, comment, acted_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [actionId, crId, currentStep, action, comment || null, userId],
    );

    // Update CR based on action
    if (action === 'approved') {
      if (currentStep < steps.length - 1) {
        await databaseService.query(
          `UPDATE change_requests SET current_step = ? WHERE id = ?`,
          [currentStep + 1, crId],
        );
      } else {
        await databaseService.query(
          `UPDATE change_requests SET status = 'approved', current_step = ? WHERE id = ?`,
          [currentStep, crId],
        );
      }
    } else if (action === 'rejected') {
      await databaseService.query(
        `UPDATE change_requests SET status = 'rejected' WHERE id = ?`,
        [crId],
      );
    } else if (action === 'returned') {
      await databaseService.query(
        `UPDATE change_requests SET status = 'draft', current_step = 0 WHERE id = ?`,
        [crId],
      );
    }

    const rows = await databaseService.query<ChangeRequestRow>('SELECT * FROM change_requests WHERE id = ?', [crId]);
    const result = changeRequestRowToDTO(rows[0]);

    // Audit log
    const auditAction = action === 'approved' ? 'approval.approve' : action === 'rejected' ? 'approval.reject' : 'approval.return';
    auditLedgerService.append({
      actorId: userId,
      actorType: 'user',
      action: auditAction,
      entityType: 'change_request',
      entityId: crId,
      projectId: result.projectId,
      payload: {
        step: currentStep,
        stepName: steps[currentStep]?.name,
        action,
        comment,
        resultStatus: result.status,
      },
      source: 'web',
    }).catch(() => {});

    return result;
  }

  async withdrawChangeRequest(crId: string): Promise<ChangeRequest> {
    await databaseService.query(
      `UPDATE change_requests SET status = 'withdrawn' WHERE id = ?`,
      [crId],
    );
    const rows = await databaseService.query<ChangeRequestRow>('SELECT * FROM change_requests WHERE id = ?', [crId]);
    return changeRequestRowToDTO(rows[0]);
  }

  async getApprovalHistory(crId: string): Promise<ApprovalAction[]> {
    const rows = await databaseService.query<ApprovalActionRow>(
      'SELECT * FROM approval_actions WHERE change_request_id = ? ORDER BY acted_at',
      [crId],
    );
    return rows.map(approvalActionRowToDTO);
  }
}

export const approvalWorkflowService = new ApprovalWorkflowService();
