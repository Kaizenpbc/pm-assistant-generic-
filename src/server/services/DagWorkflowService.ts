import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { Task, ScheduleService, scheduleService } from './ScheduleService';
import { auditLedgerService } from './AuditLedgerService';

// ── Types ──────────────────────────────────────────────────────────────────

export type NodeType = 'trigger' | 'condition' | 'action' | 'approval' | 'delay' | 'agent';

export interface WorkflowDefinition {
  id: string;
  projectId: string | null;
  name: string;
  description: string | null;
  isEnabled: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  workflowId: string;
  nodeType: NodeType;
  name: string;
  config: Record<string, any>;
  positionX: number;
  positionY: number;
  createdAt: string;
}

export interface WorkflowEdge {
  id: string;
  workflowId: string;
  sourceNodeId: string;
  targetNodeId: string;
  conditionExpr: Record<string, any> | null;
  label: string | null;
  sortOrder: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggerNodeId: string;
  entityType: string;
  entityId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';
  context: Record<string, any>;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface WorkflowNodeExecution {
  id: string;
  executionId: string;
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';
  inputData: Record<string, any> | null;
  outputData: Record<string, any> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface DefinitionWithGraph extends WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionWithNodes extends WorkflowExecution {
  nodeExecutions: WorkflowNodeExecution[];
}

// ── Row mappers ────────────────────────────────────────────────────────────

function parseJson(val: any): Record<string, any> {
  if (!val) return {};
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return {}; }
}

function rowToDef(r: any): WorkflowDefinition {
  return {
    id: r.id, projectId: r.project_id ?? null, name: r.name,
    description: r.description ?? null, isEnabled: !!r.is_enabled,
    version: r.version, createdBy: r.created_by,
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

function rowToNode(r: any): WorkflowNode {
  return {
    id: r.id, workflowId: r.workflow_id, nodeType: r.node_type,
    name: r.name, config: parseJson(r.config),
    positionX: r.position_x, positionY: r.position_y,
    createdAt: String(r.created_at),
  };
}

function rowToEdge(r: any): WorkflowEdge {
  return {
    id: r.id, workflowId: r.workflow_id,
    sourceNodeId: r.source_node_id, targetNodeId: r.target_node_id,
    conditionExpr: r.condition_expr ? parseJson(r.condition_expr) : null,
    label: r.label ?? null, sortOrder: r.sort_order,
  };
}

function rowToExecution(r: any): WorkflowExecution {
  return {
    id: r.id, workflowId: r.workflow_id, triggerNodeId: r.trigger_node_id,
    entityType: r.entity_type, entityId: r.entity_id,
    status: r.status, context: parseJson(r.context),
    startedAt: String(r.started_at),
    completedAt: r.completed_at ? String(r.completed_at) : null,
    errorMessage: r.error_message ?? null,
  };
}

function rowToNodeExec(r: any): WorkflowNodeExecution {
  return {
    id: r.id, executionId: r.execution_id, nodeId: r.node_id,
    status: r.status, inputData: r.input_data ? parseJson(r.input_data) : null,
    outputData: r.output_data ? parseJson(r.output_data) : null,
    errorMessage: r.error_message ?? null,
    startedAt: r.started_at ? String(r.started_at) : null,
    completedAt: r.completed_at ? String(r.completed_at) : null,
  };
}

// ── Template resolution ────────────────────────────────────────────────────

/**
 * Replace `{{source.path}}` patterns in an input object with runtime values.
 * - `{{task.field}}` → value from the triggering task
 * - `{{nodes.<nodeId>.path}}` → value from a previous node's output
 * If the entire string is a single template, the resolved type is preserved.
 * Mixed strings do string interpolation. Unresolved templates remain as-is.
 */
export function resolveTemplates(
  input: Record<string, any>,
  nodeOutputs: Record<string, any>,
  task: Task | null,
): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(input));

  function resolvePath(source: Record<string, any> | null, path: string[]): any {
    if (!source) return undefined;
    let current: any = source;
    for (const key of path) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current;
  }

  function resolveToken(token: string): any {
    if (token.startsWith('task.')) {
      return resolvePath(task as any, token.slice(5).split('.'));
    }
    if (token.startsWith('nodes.')) {
      const parts = token.slice(6).split('.');
      const nodeId = parts[0];
      return resolvePath(nodeOutputs[nodeId] ?? null, parts.slice(1));
    }
    return undefined;
  }

  function walk(obj: any): any {
    if (typeof obj === 'string') {
      // Check if the entire string is a single template
      const singleMatch = obj.match(/^\{\{(.+?)\}\}$/);
      if (singleMatch) {
        const resolved = resolveToken(singleMatch[1]);
        return resolved !== undefined ? resolved : obj;
      }
      // Mixed string interpolation
      return obj.replace(/\{\{(.+?)\}\}/g, (full, token) => {
        const resolved = resolveToken(token);
        return resolved !== undefined ? String(resolved) : full;
      });
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        obj[key] = walk(obj[key]);
      }
    }
    return obj;
  }

  return walk(clone);
}

// ── Service ────────────────────────────────────────────────────────────────

class DagWorkflowService {
  private tablesVerified = false;

  /** Silently no-op if tables don't exist yet */
  private async ensureTablesExist(): Promise<boolean> {
    if (this.tablesVerified) return true;
    try {
      await databaseService.query('SELECT 1 FROM workflow_definitions LIMIT 1');
      this.tablesVerified = true;
      return true;
    } catch {
      return false;
    }
  }

  // ── CRUD: Definitions ──────────────────────────────────────────────────

  async createDefinition(data: {
    projectId?: string | null;
    name: string;
    description?: string;
    createdBy: string;
    nodes: { nodeType: NodeType; name: string; config: Record<string, any>; positionX?: number; positionY?: number }[];
    edges: { sourceIndex: number; targetIndex: number; conditionExpr?: Record<string, any>; label?: string; sortOrder?: number }[];
  }): Promise<DefinitionWithGraph> {
    const defId = uuidv4();
    await databaseService.query(
      `INSERT INTO workflow_definitions (id, project_id, name, description, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [defId, data.projectId ?? null, data.name, data.description ?? null, data.createdBy],
    );

    // Insert nodes
    const nodes: WorkflowNode[] = [];
    for (const n of data.nodes) {
      const nodeId = uuidv4();
      await databaseService.query(
        `INSERT INTO workflow_nodes (id, workflow_id, node_type, name, config, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nodeId, defId, n.nodeType, n.name, JSON.stringify(n.config), n.positionX ?? 0, n.positionY ?? 0],
      );
      const rows = await databaseService.query('SELECT * FROM workflow_nodes WHERE id = ?', [nodeId]);
      nodes.push(rowToNode(rows[0]));
    }

    // Insert edges (sourceIndex/targetIndex refer to the nodes array)
    const edges: WorkflowEdge[] = [];
    for (const e of data.edges) {
      const edgeId = uuidv4();
      const srcId = nodes[e.sourceIndex]?.id;
      const tgtId = nodes[e.targetIndex]?.id;
      if (!srcId || !tgtId) continue;
      await databaseService.query(
        `INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, condition_expr, label, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [edgeId, defId, srcId, tgtId, e.conditionExpr ? JSON.stringify(e.conditionExpr) : null, e.label ?? null, e.sortOrder ?? 0],
      );
      const rows = await databaseService.query('SELECT * FROM workflow_edges WHERE id = ?', [edgeId]);
      edges.push(rowToEdge(rows[0]));
    }

    const defRows = await databaseService.query('SELECT * FROM workflow_definitions WHERE id = ?', [defId]);
    return { ...rowToDef(defRows[0]), nodes, edges };
  }

  async getDefinition(id: string): Promise<DefinitionWithGraph | null> {
    if (!(await this.ensureTablesExist())) return null;
    const defRows = await databaseService.query('SELECT * FROM workflow_definitions WHERE id = ?', [id]);
    if (defRows.length === 0) return null;
    const nodeRows = await databaseService.query('SELECT * FROM workflow_nodes WHERE workflow_id = ? ORDER BY position_y, position_x', [id]);
    const edgeRows = await databaseService.query('SELECT * FROM workflow_edges WHERE workflow_id = ? ORDER BY sort_order', [id]);
    return {
      ...rowToDef(defRows[0]),
      nodes: nodeRows.map(rowToNode),
      edges: edgeRows.map(rowToEdge),
    };
  }

  async listDefinitions(projectId?: string): Promise<WorkflowDefinition[]> {
    if (!(await this.ensureTablesExist())) return [];
    let sql = 'SELECT * FROM workflow_definitions';
    const params: any[] = [];
    if (projectId) {
      sql += ' WHERE (project_id = ? OR project_id IS NULL)';
      params.push(projectId);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await databaseService.query(sql, params);
    return rows.map(rowToDef);
  }

  async updateDefinition(id: string, data: {
    name?: string;
    description?: string;
    projectId?: string | null;
    nodes?: { nodeType: NodeType; name: string; config: Record<string, any>; positionX?: number; positionY?: number }[];
    edges?: { sourceIndex: number; targetIndex: number; conditionExpr?: Record<string, any>; label?: string; sortOrder?: number }[];
  }): Promise<DefinitionWithGraph | null> {
    const existing = await this.getDefinition(id);
    if (!existing) return null;

    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.projectId !== undefined) { sets.push('project_id = ?'); params.push(data.projectId); }

    if (sets.length > 0) {
      sets.push('version = version + 1');
      params.push(id);
      await databaseService.query(`UPDATE workflow_definitions SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    // Replace nodes & edges if provided
    if (data.nodes) {
      await databaseService.query('DELETE FROM workflow_edges WHERE workflow_id = ?', [id]);
      await databaseService.query('DELETE FROM workflow_nodes WHERE workflow_id = ?', [id]);

      const nodes: WorkflowNode[] = [];
      for (const n of data.nodes) {
        const nodeId = uuidv4();
        await databaseService.query(
          `INSERT INTO workflow_nodes (id, workflow_id, node_type, name, config, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [nodeId, id, n.nodeType, n.name, JSON.stringify(n.config), n.positionX ?? 0, n.positionY ?? 0],
        );
        const rows = await databaseService.query('SELECT * FROM workflow_nodes WHERE id = ?', [nodeId]);
        nodes.push(rowToNode(rows[0]));
      }

      if (data.edges) {
        for (const e of data.edges) {
          const edgeId = uuidv4();
          const srcId = nodes[e.sourceIndex]?.id;
          const tgtId = nodes[e.targetIndex]?.id;
          if (!srcId || !tgtId) continue;
          await databaseService.query(
            `INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, condition_expr, label, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [edgeId, id, srcId, tgtId, e.conditionExpr ? JSON.stringify(e.conditionExpr) : null, e.label ?? null, e.sortOrder ?? 0],
          );
        }
      }
    }

    return this.getDefinition(id);
  }

  async deleteDefinition(id: string): Promise<boolean> {
    const result = await databaseService.query('DELETE FROM workflow_definitions WHERE id = ?', [id]);
    return (result as any).affectedRows > 0;
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<WorkflowDefinition | null> {
    const rows = await databaseService.query('SELECT * FROM workflow_definitions WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    await databaseService.query('UPDATE workflow_definitions SET is_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
    const updated = await databaseService.query('SELECT * FROM workflow_definitions WHERE id = ?', [id]);
    return rowToDef(updated[0]);
  }

  // ── Execution queries ──────────────────────────────────────────────────

  async getExecution(id: string): Promise<ExecutionWithNodes | null> {
    if (!(await this.ensureTablesExist())) return null;
    const rows = await databaseService.query('SELECT * FROM workflow_executions WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const nodeExecRows = await databaseService.query(
      'SELECT * FROM workflow_node_executions WHERE execution_id = ? ORDER BY started_at',
      [id],
    );
    return { ...rowToExecution(rows[0]), nodeExecutions: nodeExecRows.map(rowToNodeExec) };
  }

  async listExecutions(filters?: {
    workflowId?: string;
    entityType?: string;
    entityId?: string;
    status?: string;
    limit?: number;
  }): Promise<WorkflowExecution[]> {
    if (!(await this.ensureTablesExist())) return [];
    let sql = 'SELECT * FROM workflow_executions WHERE 1=1';
    const params: any[] = [];
    if (filters?.workflowId) { sql += ' AND workflow_id = ?'; params.push(filters.workflowId); }
    if (filters?.entityType) { sql += ' AND entity_type = ?'; params.push(filters.entityType); }
    if (filters?.entityId) { sql += ' AND entity_id = ?'; params.push(filters.entityId); }
    if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
    sql += ' ORDER BY started_at DESC';
    sql += ` LIMIT ${filters?.limit ?? 50}`;
    const rows = await databaseService.query(sql, params);
    return rows.map(rowToExecution);
  }

  // ── Engine: evaluate task changes ──────────────────────────────────────

  async evaluateTaskChange(
    task: Task,
    oldTask: Task | null,
    scheduleService: ScheduleService,
  ): Promise<void> {
    if (!(await this.ensureTablesExist())) return;

    try {
      // Get enabled definitions (project-scoped + global)
      let sql = 'SELECT * FROM workflow_definitions WHERE is_enabled = 1';
      const params: any[] = [];
      // We don't have projectId on task directly, so fetch all enabled
      const defs = await databaseService.query(sql, params);

      for (const defRow of defs) {
        const def = rowToDef(defRow);
        const fullDef = await this.getDefinition(def.id);
        if (!fullDef) continue;

        // Find trigger nodes
        const triggerNodes = fullDef.nodes.filter(n => n.nodeType === 'trigger');
        for (const triggerNode of triggerNodes) {
          if (this.matchesTrigger(triggerNode.config, task, oldTask)) {
            await this.executeWorkflow(fullDef, triggerNode, task, scheduleService);
          }
        }
      }
    } catch (err) {
      console.error('[DagWorkflow] evaluateTaskChange error:', err);
    }
  }

  /** Evaluate project-level changes (budget, status) against workflows */
  async evaluateProjectChange(
    projectId: string,
    changeType: string,
    data: Record<string, any>,
  ): Promise<void> {
    if (!(await this.ensureTablesExist())) return;

    try {
      const defs = await databaseService.query(
        'SELECT * FROM workflow_definitions WHERE is_enabled = 1',
      );

      for (const defRow of defs) {
        const def = rowToDef(defRow);
        const fullDef = await this.getDefinition(def.id);
        if (!fullDef) continue;

        const triggerNodes = fullDef.nodes.filter(n => n.nodeType === 'trigger');
        for (const triggerNode of triggerNodes) {
          const config = triggerNode.config;
          let matched = false;

          if (changeType === 'budget_update' && config.triggerType === 'budget_threshold') {
            const utilization = data.utilization ?? 0;
            const threshold = config.thresholdPercent ?? 90;
            matched = utilization >= threshold;
          } else if (changeType === 'project_status_change' && config.triggerType === 'project_status_change') {
            if (config.toStatus && data.newStatus !== config.toStatus) continue;
            if (config.fromStatus && data.oldStatus !== config.fromStatus) continue;
            matched = true;
          }

          if (matched) {
            // Build a synthetic task-like context for the workflow engine
            await this.executeWorkflow(fullDef, triggerNode, null, scheduleService);
          }
        }
      }
    } catch (err) {
      console.error('[DagWorkflow] evaluateProjectChange error:', err);
    }
  }

  /** Manual trigger for a workflow */
  async triggerManual(
    workflowId: string,
    entityType: string,
    entityId: string,
    scheduleService: ScheduleService,
  ): Promise<WorkflowExecution | null> {
    const def = await this.getDefinition(workflowId);
    if (!def) return null;

    const triggerNode = def.nodes.find(n => n.nodeType === 'trigger');
    if (!triggerNode) return null;

    // Build a fake task context for manual triggers
    let task: Task | null = null;
    if (entityType === 'task') {
      task = await scheduleService.findTaskById(entityId) ?? null;
    }

    return this.executeWorkflow(def, triggerNode, task, scheduleService);
  }

  /** Resume a waiting execution (approval/delay) */
  async resumeExecution(
    executionId: string,
    nodeId: string,
    result: Record<string, any>,
    scheduleService: ScheduleService,
  ): Promise<ExecutionWithNodes | null> {
    const exec = await this.getExecution(executionId);
    if (!exec || exec.status !== 'waiting') return null;

    const def = await this.getDefinition(exec.workflowId);
    if (!def) return null;

    // Mark the waiting node as completed
    await databaseService.query(
      `UPDATE workflow_node_executions
       SET status = 'completed', output_data = ?, completed_at = NOW()
       WHERE execution_id = ? AND node_id = ? AND status = 'waiting'`,
      [JSON.stringify(result), executionId, nodeId],
    );

    // Update execution to running
    await databaseService.query(
      `UPDATE workflow_executions SET status = 'running' WHERE id = ?`,
      [executionId],
    );

    // Find the task for context
    let task: Task | null = null;
    if (exec.entityType === 'task') {
      task = await scheduleService.findTaskById(exec.entityId) ?? null;
    }

    // Advance from the resumed node
    const adjacency = this.buildAdjacencyList(def);
    const visited = new Set<string>();

    // Rebuild nodeOutputs from completed node executions
    const nodeOutputs: Record<string, any> = {};
    for (const ne of exec.nodeExecutions) {
      if (ne.status === 'completed' && ne.outputData) {
        nodeOutputs[ne.nodeId] = ne.outputData;
      }
      if (ne.status === 'completed') visited.add(ne.nodeId);
    }
    // Include the just-resumed node's result
    nodeOutputs[nodeId] = result;
    visited.add(nodeId);

    await this.advanceExecution(executionId, nodeId, def, adjacency, visited, task, scheduleService, nodeOutputs);

    return this.getExecution(executionId);
  }

  // ── Internal engine ────────────────────────────────────────────────────

  private matchesTrigger(config: Record<string, any>, task: Task, oldTask: Task | null): boolean {
    const triggerType = config.triggerType;
    switch (triggerType) {
      case 'status_change': {
        if (!oldTask) return false;
        if (oldTask.status === task.status) return false;
        if (config.fromStatus && oldTask.status !== config.fromStatus) return false;
        if (config.toStatus && task.status !== config.toStatus) return false;
        return true;
      }
      case 'progress_threshold': {
        const progress = task.progressPercentage ?? 0;
        const threshold = config.progressThreshold ?? 0;
        if (config.progressDirection === 'below') return progress <= threshold;
        return progress >= threshold;
      }
      case 'date_passed': {
        if (!task.endDate) return false;
        return new Date(task.endDate) < new Date();
      }
      case 'task_created':
        if (oldTask !== null) return false;
        if (config.statusFilter && task.status !== config.statusFilter) return false;
        return true;
      case 'assignment_change':
        if (!oldTask) return false;
        if ((oldTask.assignedTo ?? '') === (task.assignedTo ?? '')) return false;
        if (config.toAssignee && task.assignedTo !== config.toAssignee) return false;
        return true;
      case 'dependency_change':
        if (!oldTask) return false;
        return (oldTask.dependency ?? '') !== (task.dependency ?? '');
      case 'priority_change': {
        if (!oldTask) return false;
        if (oldTask.priority === task.priority) return false;
        if (config.toPriority && task.priority !== config.toPriority) return false;
        return true;
      }
      case 'budget_threshold':
        // Handled by evaluateProjectChange, not task triggers
        return false;
      case 'project_status_change':
        // Handled by evaluateProjectChange, not task triggers
        return false;
      case 'manual':
        return true;
      default:
        return false;
    }
  }

  private evaluateCondition(config: Record<string, any>, task: Task | null): boolean {
    if (!task) return false;
    const field = config.field as string;
    const operator = config.operator as string;
    const value = config.value;
    const taskValue = (task as any)[field];

    switch (operator) {
      case 'equals': return taskValue == value;
      case 'not_equals': return taskValue != value;
      case 'greater_than': return Number(taskValue) > Number(value);
      case 'less_than': return Number(taskValue) < Number(value);
      case 'contains': return String(taskValue).includes(String(value));
      case 'not_contains': return !String(taskValue).includes(String(value));
      default: return false;
    }
  }

  private buildAdjacencyList(def: DefinitionWithGraph): Map<string, WorkflowEdge[]> {
    const adj = new Map<string, WorkflowEdge[]>();
    for (const edge of def.edges) {
      const list = adj.get(edge.sourceNodeId) || [];
      list.push(edge);
      adj.set(edge.sourceNodeId, list);
    }
    // Sort each list by sortOrder
    for (const [, list] of adj) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return adj;
  }

  private async executeWorkflow(
    def: DefinitionWithGraph,
    triggerNode: WorkflowNode,
    task: Task | null,
    scheduleService: ScheduleService,
  ): Promise<WorkflowExecution> {
    const execId = uuidv4();
    const context = task ? { taskId: task.id, taskName: task.name, status: task.status, progress: task.progressPercentage } : {};

    await databaseService.query(
      `INSERT INTO workflow_executions (id, workflow_id, trigger_node_id, entity_type, entity_id, status, context)
       VALUES (?, ?, ?, ?, ?, 'running', ?)`,
      [execId, def.id, triggerNode.id, task ? 'task' : 'unknown', task?.id ?? '', JSON.stringify(context)],
    );

    // Mark trigger node as completed
    const triggerExecId = uuidv4();
    await databaseService.query(
      `INSERT INTO workflow_node_executions (id, execution_id, node_id, status, started_at, completed_at)
       VALUES (?, ?, ?, 'completed', NOW(), NOW())`,
      [triggerExecId, execId, triggerNode.id],
    );

    // Build adjacency & advance
    const adjacency = this.buildAdjacencyList(def);
    const visited = new Set<string>([triggerNode.id]);
    const nodeOutputs: Record<string, any> = {};

    await this.advanceExecution(execId, triggerNode.id, def, adjacency, visited, task, scheduleService, nodeOutputs);

    // Check final status
    const exec = await this.getExecution(execId);

    // Audit log
    auditLedgerService.append({
      actorId: 'system',
      actorType: 'system',
      action: 'workflow.execute',
      entityType: 'workflow',
      entityId: def.id,
      payload: {
        executionId: execId,
        workflowName: def.name,
        triggerNode: triggerNode.name,
        entityType: task ? 'task' : 'unknown',
        entityId: task?.id ?? '',
        status: exec?.status ?? 'unknown',
      },
      source: 'system',
    }).catch(() => {});

    return exec!;
  }

  private async advanceExecution(
    execId: string,
    fromNodeId: string,
    def: DefinitionWithGraph,
    adjacency: Map<string, WorkflowEdge[]>,
    visited: Set<string>,
    task: Task | null,
    scheduleService: ScheduleService,
    nodeOutputs: Record<string, any>,
  ): Promise<void> {
    const outEdges = adjacency.get(fromNodeId) || [];
    if (outEdges.length === 0) {
      // Leaf node — check if all paths done
      await this.checkCompletion(execId);
      return;
    }

    for (const edge of outEdges) {
      // Cycle protection
      if (visited.has(edge.targetNodeId)) {
        console.error(`[DagWorkflow] Cycle detected: ${edge.targetNodeId}`);
        await databaseService.query(
          `UPDATE workflow_executions SET status = 'failed', error_message = 'Cycle detected', completed_at = NOW() WHERE id = ?`,
          [execId],
        );
        return;
      }

      // Check edge condition
      if (edge.conditionExpr) {
        const condResult = this.evaluateCondition(edge.conditionExpr, task);
        if (!condResult) continue; // Skip this branch
      }

      const targetNode = def.nodes.find(n => n.id === edge.targetNodeId);
      if (!targetNode) continue;

      visited.add(edge.targetNodeId);
      await this.executeNode(execId, targetNode, def, adjacency, visited, task, scheduleService, nodeOutputs);
    }
  }

  private async executeNode(
    execId: string,
    node: WorkflowNode,
    def: DefinitionWithGraph,
    adjacency: Map<string, WorkflowEdge[]>,
    visited: Set<string>,
    task: Task | null,
    scheduleService: ScheduleService,
    nodeOutputs: Record<string, any>,
  ): Promise<void> {
    const nodeExecId = uuidv4();
    await databaseService.query(
      `INSERT INTO workflow_node_executions (id, execution_id, node_id, status, input_data, started_at)
       VALUES (?, ?, ?, 'running', ?, NOW())`,
      [nodeExecId, execId, node.id, task ? JSON.stringify({ taskId: task.id }) : null],
    );

    try {
      switch (node.nodeType) {
        case 'condition': {
          const condResult = this.evaluateCondition(node.config, task);
          const condOutput = { result: condResult };
          nodeOutputs[node.id] = condOutput;
          await databaseService.query(
            `UPDATE workflow_node_executions SET status = 'completed', output_data = ?, completed_at = NOW() WHERE id = ?`,
            [JSON.stringify(condOutput), nodeExecId],
          );
          // Persist nodeOutputs to execution context
          await this.persistNodeOutputs(execId, nodeOutputs);
          // Only follow edges matching the condition result
          const outEdges = adjacency.get(node.id) || [];
          for (const edge of outEdges) {
            const matchLabel = condResult ? 'yes' : 'no';
            // If edge has a label, only follow matching; if no label, follow all
            if (edge.label && edge.label !== matchLabel) continue;
            if (visited.has(edge.targetNodeId)) continue;

            const targetNode = def.nodes.find(n => n.id === edge.targetNodeId);
            if (!targetNode) continue;
            visited.add(edge.targetNodeId);
            await this.executeNode(execId, targetNode, def, adjacency, visited, task, scheduleService, nodeOutputs);
          }
          return; // Don't call advanceExecution (we handled branching)
        }

        case 'action': {
          const resolvedConfig = resolveTemplates(node.config, nodeOutputs, task);
          const output = await this.executeAction(resolvedConfig, task, scheduleService);
          nodeOutputs[node.id] = output;
          await databaseService.query(
            `UPDATE workflow_node_executions SET status = 'completed', output_data = ?, completed_at = NOW() WHERE id = ?`,
            [JSON.stringify(output), nodeExecId],
          );
          break;
        }

        case 'agent': {
          const { agentRegistry } = await import('./AgentRegistryService');
          const capabilityId = node.config.capabilityId as string;
          const maxRetries = (node.config.retries as number) ?? 0;
          const backoffMs = (node.config.backoffMs as number) ?? 1000;

          let lastError: string | undefined;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              await new Promise(r => setTimeout(r, backoffMs * attempt));
            }
            const resolvedInput = resolveTemplates(node.config.input ?? {}, nodeOutputs, task);
            const result = await agentRegistry.invoke(capabilityId, resolvedInput, {
              actorId: 'system', actorType: 'system', source: 'system',
              projectId: node.config.projectId as string | undefined,
            });
            if (result.success) {
              const agentOutput = { agentOutput: result.output, durationMs: result.durationMs };
              nodeOutputs[node.id] = agentOutput;
              await databaseService.query(
                `UPDATE workflow_node_executions SET status = 'completed', output_data = ?, completed_at = NOW() WHERE id = ?`,
                [JSON.stringify(agentOutput), nodeExecId],
              );
              lastError = undefined;
              break;
            }
            lastError = result.error || 'Agent invocation failed';
          }
          if (lastError) throw new Error(lastError);
          break;
        }

        case 'approval': {
          await databaseService.query(
            `UPDATE workflow_node_executions SET status = 'waiting' WHERE id = ?`,
            [nodeExecId],
          );
          await databaseService.query(
            `UPDATE workflow_executions SET status = 'waiting' WHERE id = ?`,
            [execId],
          );
          return; // Stop — must be resumed via API
        }

        case 'delay': {
          await databaseService.query(
            `UPDATE workflow_node_executions SET status = 'waiting' WHERE id = ?`,
            [nodeExecId],
          );
          await databaseService.query(
            `UPDATE workflow_executions SET status = 'waiting' WHERE id = ?`,
            [execId],
          );
          return; // Stop — manual resume for phase 1
        }

        default:
          await databaseService.query(
            `UPDATE workflow_node_executions SET status = 'skipped', completed_at = NOW() WHERE id = ?`,
            [nodeExecId],
          );
      }
    } catch (err: any) {
      await databaseService.query(
        `UPDATE workflow_node_executions SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
        [err.message || 'Unknown error', nodeExecId],
      );
      await databaseService.query(
        `UPDATE workflow_executions SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
        [err.message || 'Unknown error', execId],
      );
      return;
    }

    // Persist nodeOutputs to execution context after successful node completion
    await this.persistNodeOutputs(execId, nodeOutputs);

    // Continue advancing
    await this.advanceExecution(execId, node.id, def, adjacency, visited, task, scheduleService, nodeOutputs);
  }

  private async executeAction(
    config: Record<string, any>,
    task: Task | null,
    scheduleService: ScheduleService,
  ): Promise<Record<string, any>> {
    const actionType = config.actionType;
    switch (actionType) {
      case 'update_field': {
        if (task && config.field && config.value) {
          scheduleService.updateTask(task.id, { [config.field]: config.value } as any);
          return { action: 'update_field', field: config.field, value: config.value };
        }
        return { action: 'update_field', skipped: true };
      }
      case 'log_activity': {
        if (task) {
          await scheduleService.logActivity(
            task.id, '1', 'Workflow', 'workflow-action',
            undefined, undefined, config.message || 'Workflow action executed',
          );
        }
        return { action: 'log_activity', message: config.message };
      }
      case 'send_notification': {
        console.log(`[Workflow Notification] ${config.message || 'Notification'} - Task: ${task?.name || 'N/A'}`);
        try {
          const { notificationService } = await import('./NotificationService');
          const schedule = task ? await scheduleService.findById(task.scheduleId) : null;
          const projectId = schedule?.projectId ?? config.projectId;
          if (projectId) {
            const { projectService: projSvc } = await import('./ProjectService');
            const project = await projSvc.findById(projectId);
            const userId = project?.projectManagerId || project?.createdBy;
            if (userId) {
              await notificationService.create({
                userId,
                type: config.notificationType || 'workflow_action',
                severity: config.severity || 'medium',
                title: config.title || config.message || 'Workflow notification',
                message: config.message || 'A workflow action was triggered.',
                projectId,
                linkType: config.linkType,
                linkId: config.linkId,
              });
              return { action: 'send_notification', message: config.message, notified: true };
            }
          }
        } catch (err) {
          console.error('[Workflow] send_notification error:', err);
        }
        return { action: 'send_notification', message: config.message, notified: false };
      }
      case 'invoke_agent': {
        const { agentRegistry } = await import('./AgentRegistryService');
        const resolvedInput = resolveTemplates(config.input ?? {}, {}, task);
        const result = await agentRegistry.invoke(config.capabilityId, resolvedInput, {
          actorId: 'system', actorType: 'system', source: 'system',
          projectId: config.projectId,
        });
        return { action: 'invoke_agent', capabilityId: config.capabilityId, success: result.success, output: result.output };
      }
      default:
        return { action: actionType, skipped: true };
    }
  }

  private async persistNodeOutputs(execId: string, nodeOutputs: Record<string, any>): Promise<void> {
    const rows = await databaseService.query('SELECT context FROM workflow_executions WHERE id = ?', [execId]);
    const existing = rows.length > 0 ? parseJson(rows[0].context) : {};
    await databaseService.query(
      `UPDATE workflow_executions SET context = ? WHERE id = ?`,
      [JSON.stringify({ ...existing, nodeOutputs }), execId],
    );
  }

  private async checkCompletion(execId: string): Promise<void> {
    const nodeExecs = await databaseService.query(
      `SELECT status FROM workflow_node_executions WHERE execution_id = ?`,
      [execId],
    );
    const allDone = nodeExecs.every((ne: any) =>
      ne.status === 'completed' || ne.status === 'failed' || ne.status === 'skipped',
    );
    if (allDone) {
      const anyFailed = nodeExecs.some((ne: any) => ne.status === 'failed');
      await databaseService.query(
        `UPDATE workflow_executions SET status = ?, completed_at = NOW() WHERE id = ? AND status = 'running'`,
        [anyFailed ? 'failed' : 'completed', execId],
      );
    }
  }
}

export const dagWorkflowService = new DagWorkflowService();
