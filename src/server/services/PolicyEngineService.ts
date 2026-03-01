import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

export interface Policy {
  id: string;
  projectId: string | null;
  name: string;
  description: string | null;
  actionPattern: string;
  conditionExpr: ConditionExpr;
  enforcement: 'log_only' | 'require_approval' | 'block';
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ConditionExpr {
  field: string;
  op: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'in' | 'not_in' | 'contains';
  value: any;
}

export interface PolicyEvaluation {
  id?: number;
  policyId: string;
  action: string;
  actorId: string;
  entityType?: string;
  entityId?: string;
  matched: boolean;
  enforcementResult: 'allowed' | 'blocked' | 'pending_approval';
  contextSnapshot?: Record<string, any>;
  createdAt?: string;
}

export interface EvaluationResult {
  allowed: boolean;
  enforcement: 'allowed' | 'blocked' | 'pending_approval';
  matchedPolicies: Array<{ policyId: string; policyName: string; enforcement: string }>;
}

export interface EvaluationContext {
  actorId: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  /** Arbitrary data for condition evaluation (e.g. budget_impact, days_to_end) */
  data?: Record<string, any>;
}

interface PolicyRow {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  action_pattern: string;
  condition_expr: string;
  enforcement: string;
  is_active: number | boolean;
  created_by: string;
  created_at: string;
}

function rowToPolicy(row: PolicyRow): Policy {
  let conditionExpr: ConditionExpr = { field: '', op: '==', value: '' };
  if (row.condition_expr) {
    try {
      conditionExpr = typeof row.condition_expr === 'string'
        ? JSON.parse(row.condition_expr)
        : row.condition_expr;
    } catch { /* keep default */ }
  }
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    actionPattern: row.action_pattern,
    conditionExpr,
    enforcement: row.enforcement as Policy['enforcement'],
    isActive: !!row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Simple glob matching for action patterns.
 * Supports: 'task.*', 'ai.action.*', '*', exact match
 */
function matchesPattern(pattern: string, action: string): boolean {
  if (pattern === '*') return true;
  if (pattern === action) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return action.startsWith(prefix + '.') || action === prefix;
  }
  return false;
}

/**
 * Evaluate a condition expression against context data.
 */
function evaluateCondition(expr: ConditionExpr, data: Record<string, any>): boolean {
  if (!expr.field) return true; // empty condition = always matches

  const fieldValue = data[expr.field];
  if (fieldValue === undefined) return false;

  switch (expr.op) {
    case '>': return Number(fieldValue) > Number(expr.value);
    case '<': return Number(fieldValue) < Number(expr.value);
    case '>=': return Number(fieldValue) >= Number(expr.value);
    case '<=': return Number(fieldValue) <= Number(expr.value);
    case '==': return String(fieldValue) === String(expr.value);
    case '!=': return String(fieldValue) !== String(expr.value);
    case 'in': return Array.isArray(expr.value) && expr.value.includes(fieldValue);
    case 'not_in': return Array.isArray(expr.value) && !expr.value.includes(fieldValue);
    case 'contains': return String(fieldValue).includes(String(expr.value));
    default: return true;
  }
}

class PolicyEngineService {
  /**
   * Evaluate all matching policies for an action.
   * Returns the strictest enforcement result.
   */
  async evaluate(action: string, context: EvaluationContext): Promise<EvaluationResult> {
    const policies = await this.getActivePolicies(context.projectId);
    const matchedPolicies: EvaluationResult['matchedPolicies'] = [];
    let strictestEnforcement: 'allowed' | 'blocked' | 'pending_approval' = 'allowed';

    const enforcementOrder = { allowed: 0, pending_approval: 1, blocked: 2 };

    for (const policy of policies) {
      if (!matchesPattern(policy.actionPattern, action)) continue;

      const conditionData = {
        ...context.data,
        actor_role: context.actorRole,
        actor_id: context.actorId,
        entity_type: context.entityType,
        entity_id: context.entityId,
      };

      const conditionMatched = evaluateCondition(policy.conditionExpr, conditionData);
      let enforcementResult: PolicyEvaluation['enforcementResult'] = 'allowed';

      if (conditionMatched) {
        switch (policy.enforcement) {
          case 'block':
            enforcementResult = 'blocked';
            break;
          case 'require_approval':
            enforcementResult = 'pending_approval';
            break;
          case 'log_only':
          default:
            enforcementResult = 'allowed';
            break;
        }

        matchedPolicies.push({
          policyId: policy.id,
          policyName: policy.name,
          enforcement: policy.enforcement,
        });

        if (enforcementOrder[enforcementResult] > enforcementOrder[strictestEnforcement]) {
          strictestEnforcement = enforcementResult;
        }
      }

      // Log the evaluation
      try {
        await databaseService.query(
          `INSERT INTO policy_evaluations
            (policy_id, action, actor_id, entity_type, entity_id, matched, enforcement_result, context_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            policy.id,
            action,
            context.actorId,
            context.entityType || null,
            context.entityId || null,
            conditionMatched ? 1 : 0,
            conditionMatched ? enforcementResult : 'allowed',
            JSON.stringify(conditionData),
          ],
        );
      } catch {
        // Non-critical — don't fail the action
      }
    }

    return {
      allowed: strictestEnforcement !== 'blocked',
      enforcement: strictestEnforcement,
      matchedPolicies,
    };
  }

  /**
   * Get active policies for a project (includes global policies).
   */
  private async getActivePolicies(projectId?: string): Promise<Policy[]> {
    try {
      let sql: string;
      let params: any[];
      if (projectId) {
        sql = 'SELECT * FROM policies WHERE is_active = 1 AND (project_id = ? OR project_id IS NULL) ORDER BY created_at';
        params = [projectId];
      } else {
        sql = 'SELECT * FROM policies WHERE is_active = 1 AND project_id IS NULL ORDER BY created_at';
        params = [];
      }
      const rows = await databaseService.query<PolicyRow>(sql, params);
      return rows.map(rowToPolicy);
    } catch {
      return [];
    }
  }

  async getProjectPolicies(projectId: string): Promise<Policy[]> {
    try {
      const rows = await databaseService.query<PolicyRow>(
        'SELECT * FROM policies WHERE project_id = ? OR project_id IS NULL ORDER BY created_at',
        [projectId],
      );
      return rows.map(rowToPolicy);
    } catch {
      return [];
    }
  }

  async getAllPolicies(): Promise<Policy[]> {
    try {
      const rows = await databaseService.query<PolicyRow>(
        'SELECT * FROM policies ORDER BY created_at LIMIT 1000',
      );
      return rows.map(rowToPolicy);
    } catch {
      return [];
    }
  }

  async getPolicyById(id: string): Promise<Policy | null> {
    try {
      const rows = await databaseService.query<PolicyRow>(
        'SELECT * FROM policies WHERE id = ?',
        [id],
      );
      return rows.length > 0 ? rowToPolicy(rows[0]) : null;
    } catch {
      return null;
    }
  }

  async createPolicy(data: {
    projectId?: string | null;
    name: string;
    description?: string;
    actionPattern: string;
    conditionExpr: ConditionExpr;
    enforcement: Policy['enforcement'];
    createdBy: string;
  }): Promise<Policy> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO policies (id, project_id, name, description, action_pattern, condition_expr, enforcement, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id,
        data.projectId ?? null,
        data.name,
        data.description || null,
        data.actionPattern,
        JSON.stringify(data.conditionExpr),
        data.enforcement,
        data.createdBy,
      ],
    );
    const rows = await databaseService.query<PolicyRow>('SELECT * FROM policies WHERE id = ?', [id]);
    return rowToPolicy(rows[0]);
  }

  async updatePolicy(id: string, data: {
    name?: string;
    description?: string;
    actionPattern?: string;
    conditionExpr?: ConditionExpr;
    enforcement?: Policy['enforcement'];
    isActive?: boolean;
  }): Promise<Policy | null> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.actionPattern !== undefined) { sets.push('action_pattern = ?'); params.push(data.actionPattern); }
    if (data.conditionExpr !== undefined) { sets.push('condition_expr = ?'); params.push(JSON.stringify(data.conditionExpr)); }
    if (data.enforcement !== undefined) { sets.push('enforcement = ?'); params.push(data.enforcement); }
    if (data.isActive !== undefined) { sets.push('is_active = ?'); params.push(data.isActive ? 1 : 0); }

    if (sets.length === 0) return this.getPolicyById(id);

    params.push(id);
    await databaseService.query(`UPDATE policies SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.getPolicyById(id);
  }

  async deletePolicy(id: string): Promise<boolean> {
    const result: any = await databaseService.query('DELETE FROM policies WHERE id = ?', [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  /**
   * Get evaluation stats for a project (for compliance dashboard).
   */
  async getEvaluationStats(projectId?: string, since?: string): Promise<{
    total: number;
    allowed: number;
    blocked: number;
    pendingApproval: number;
  }> {
    try {
      let sql = `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN enforcement_result = 'allowed' THEN 1 ELSE 0 END) as allowed,
        SUM(CASE WHEN enforcement_result = 'blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN enforcement_result = 'pending_approval' THEN 1 ELSE 0 END) as pending_approval
      FROM policy_evaluations pe`;

      const conditions: string[] = [];
      const params: any[] = [];

      if (projectId) {
        conditions.push('pe.policy_id IN (SELECT id FROM policies WHERE project_id = ? OR project_id IS NULL)');
        params.push(projectId);
      }
      if (since) {
        conditions.push('pe.created_at >= ?');
        params.push(since);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      const rows = await databaseService.query<any>(sql, params);
      return {
        total: Number(rows[0].total) || 0,
        allowed: Number(rows[0].allowed) || 0,
        blocked: Number(rows[0].blocked) || 0,
        pendingApproval: Number(rows[0].pending_approval) || 0,
      };
    } catch {
      return { total: 0, allowed: 0, blocked: 0, pendingApproval: 0 };
    }
  }
}

export const policyEngineService = new PolicyEngineService();
