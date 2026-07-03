import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../../database/connection';
import { Task, ScheduleService, scheduleService } from '../ScheduleService';
import { auditLedgerService } from '../AuditLedgerService';
import {
  WorkflowDefinition, WorkflowNode, WorkflowExecution,
  DefinitionWithGraph, ExecutionWithNodes, NodeType,
} from './types';
import { rowToDef, rowToNode, rowToEdge, rowToExecution, rowToNodeExec } from './rowMappers';
import { matchesTrigger, buildAdjacencyList, advanceExecution, executeWorkflowEngine } from './engine';

// Re-export types and templateResolver for external consumers
export * from './types';
export { resolveTemplates } from './templateResolver';

// ── Service ────────────────────────────────────────────────────────────────

class DagWorkflowService {
  private tablesVerified = false;

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

    const edges: import('./types').WorkflowEdge[] = [];
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
    _scheduleService: ScheduleService,
  ): Promise<void> {
    if (!(await this.ensureTablesExist())) return;

    try {
      const defs = await databaseService.query('SELECT * FROM workflow_definitions WHERE is_enabled = 1');

      for (const defRow of defs) {
        const def = rowToDef(defRow);
        const fullDef = await this.getDefinition(def.id);
        if (!fullDef) continue;

        const triggerNodes = fullDef.nodes.filter(n => n.nodeType === 'trigger');
        for (const triggerNode of triggerNodes) {
          if (matchesTrigger(triggerNode.config, task, oldTask)) {
            await this.executeWorkflow(fullDef, triggerNode, task);
          }
        }
      }
    } catch (err) {
      console.error('[DagWorkflow] evaluateTaskChange error:', err);
    }
  }

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
            await this.executeWorkflow(fullDef, triggerNode, null);
          }
        }
      }
    } catch (err) {
      console.error('[DagWorkflow] evaluateProjectChange error:', err);
    }
  }

  async triggerManual(
    workflowId: string,
    entityType: string,
    entityId: string,
    _scheduleService: ScheduleService,
  ): Promise<WorkflowExecution | null> {
    const def = await this.getDefinition(workflowId);
    if (!def) return null;

    const triggerNode = def.nodes.find(n => n.nodeType === 'trigger');
    if (!triggerNode) return null;

    let task: Task | null = null;
    if (entityType === 'task') {
      task = await scheduleService.findTaskById(entityId) ?? null;
    }

    await this.executeWorkflow(def, triggerNode, task);
    return null;
  }

  async resumeExecution(
    executionId: string,
    nodeId: string,
    result: Record<string, any>,
    _scheduleService: ScheduleService,
  ): Promise<ExecutionWithNodes | null> {
    const exec = await this.getExecution(executionId);
    if (!exec || exec.status !== 'waiting') return null;

    const def = await this.getDefinition(exec.workflowId);
    if (!def) return null;

    await databaseService.query(
      `UPDATE workflow_node_executions
       SET status = 'completed', output_data = ?, completed_at = NOW()
       WHERE execution_id = ? AND node_id = ? AND status = 'waiting'`,
      [JSON.stringify(result), executionId, nodeId],
    );

    await databaseService.query(
      `UPDATE workflow_executions SET status = 'running' WHERE id = ?`,
      [executionId],
    );

    let task: Task | null = null;
    if (exec.entityType === 'task') {
      task = await scheduleService.findTaskById(exec.entityId) ?? null;
    }

    const adjacency = buildAdjacencyList(def);
    const visited = new Set<string>();

    const nodeOutputs: Record<string, any> = {};
    for (const ne of exec.nodeExecutions) {
      if (ne.status === 'completed' && ne.outputData) {
        nodeOutputs[ne.nodeId] = ne.outputData;
      }
      if (ne.status === 'completed') visited.add(ne.nodeId);
    }
    nodeOutputs[nodeId] = result;
    visited.add(nodeId);

    await advanceExecution(executionId, nodeId, def, adjacency, visited, task, scheduleService, nodeOutputs);

    return this.getExecution(executionId);
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private async executeWorkflow(
    def: DefinitionWithGraph,
    triggerNode: WorkflowNode,
    task: Task | null,
  ): Promise<WorkflowExecution> {
    const execId = await executeWorkflowEngine(def, triggerNode, task, scheduleService);

    const exec = await this.getExecution(execId);

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
}

export const dagWorkflowService = new DagWorkflowService();
