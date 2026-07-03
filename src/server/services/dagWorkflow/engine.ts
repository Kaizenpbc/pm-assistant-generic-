import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../../database/connection';
import { Task, ScheduleService } from '../ScheduleService';
import { WorkflowNode, WorkflowEdge, DefinitionWithGraph } from './types';
import { parseJson } from './rowMappers';
import { resolveTemplates } from './templateResolver';

// ── Trigger matching ──────────────────────────────────────────────────────

export function matchesTrigger(config: Record<string, any>, task: Task, oldTask: Task | null): boolean {
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
      const oldDeps = JSON.stringify((oldTask.dependencies || []).map(d => d.dependencyId).sort());
      const newDeps = JSON.stringify((task.dependencies || []).map(d => d.dependencyId).sort());
      return oldDeps !== newDeps;
    case 'priority_change': {
      if (!oldTask) return false;
      if (oldTask.priority === task.priority) return false;
      if (config.toPriority && task.priority !== config.toPriority) return false;
      return true;
    }
    case 'budget_threshold':
    case 'project_status_change':
      return false;
    case 'manual':
      return true;
    default:
      return false;
  }
}

// ── Condition evaluation ──────────────────────────────────────────────────

export function evaluateCondition(config: Record<string, any>, task: Task | null): boolean {
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

// ── Graph helpers ─────────────────────────────────────────────────────────

export function buildAdjacencyList(def: DefinitionWithGraph): Map<string, WorkflowEdge[]> {
  const adj = new Map<string, WorkflowEdge[]>();
  for (const edge of def.edges) {
    const list = adj.get(edge.sourceNodeId) || [];
    list.push(edge);
    adj.set(edge.sourceNodeId, list);
  }
  for (const [, list] of adj) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return adj;
}

// ── Action execution ──────────────────────────────────────────────────────

export async function executeAction(
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
        const { notificationService } = await import('../NotificationService');
        const schedule = task ? await scheduleService.findById(task.scheduleId) : null;
        const projectId = schedule?.projectId ?? config.projectId;
        if (projectId) {
          const { projectService: projSvc } = await import('../ProjectService');
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
      const { agentRegistry } = await import('../AgentRegistryService');
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

// ── Workflow execution engine ─────────────────────────────────────────────

export async function executeWorkflowEngine(
  def: DefinitionWithGraph,
  triggerNode: WorkflowNode,
  task: Task | null,
  scheduleService: ScheduleService,
): Promise<string> {
  const execId = uuidv4();
  const context = task ? { taskId: task.id, taskName: task.name, status: task.status, progress: task.progressPercentage } : {};

  await databaseService.query(
    `INSERT INTO workflow_executions (id, workflow_id, trigger_node_id, entity_type, entity_id, status, context)
     VALUES (?, ?, ?, ?, ?, 'running', ?)`,
    [execId, def.id, triggerNode.id, task ? 'task' : 'unknown', task?.id ?? '', JSON.stringify(context)],
  );

  const triggerExecId = uuidv4();
  await databaseService.query(
    `INSERT INTO workflow_node_executions (id, execution_id, node_id, status, started_at, completed_at)
     VALUES (?, ?, ?, 'completed', NOW(), NOW())`,
    [triggerExecId, execId, triggerNode.id],
  );

  const adjacency = buildAdjacencyList(def);
  const visited = new Set<string>([triggerNode.id]);
  const nodeOutputs: Record<string, any> = {};

  await advanceExecution(execId, triggerNode.id, def, adjacency, visited, task, scheduleService, nodeOutputs);

  return execId;
}

export async function advanceExecution(
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
    await checkCompletion(execId);
    return;
  }

  for (const edge of outEdges) {
    if (visited.has(edge.targetNodeId)) {
      console.error(`[DagWorkflow] Cycle detected: ${edge.targetNodeId}`);
      await databaseService.query(
        `UPDATE workflow_executions SET status = 'failed', error_message = 'Cycle detected', completed_at = NOW() WHERE id = ?`,
        [execId],
      );
      return;
    }

    if (edge.conditionExpr) {
      const condResult = evaluateCondition(edge.conditionExpr, task);
      if (!condResult) continue;
    }

    const targetNode = def.nodes.find(n => n.id === edge.targetNodeId);
    if (!targetNode) continue;

    visited.add(edge.targetNodeId);
    await executeNode(execId, targetNode, def, adjacency, visited, task, scheduleService, nodeOutputs);
  }
}

async function executeNode(
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
        const condResult = evaluateCondition(node.config, task);
        const condOutput = { result: condResult };
        nodeOutputs[node.id] = condOutput;
        await databaseService.query(
          `UPDATE workflow_node_executions SET status = 'completed', output_data = ?, completed_at = NOW() WHERE id = ?`,
          [JSON.stringify(condOutput), nodeExecId],
        );
        await persistNodeOutputs(execId, nodeOutputs);
        const outEdges = adjacency.get(node.id) || [];
        for (const edge of outEdges) {
          const matchLabel = condResult ? 'yes' : 'no';
          if (edge.label && edge.label !== matchLabel) continue;
          if (visited.has(edge.targetNodeId)) continue;

          const targetNode = def.nodes.find(n => n.id === edge.targetNodeId);
          if (!targetNode) continue;
          visited.add(edge.targetNodeId);
          await executeNode(execId, targetNode, def, adjacency, visited, task, scheduleService, nodeOutputs);
        }
        return;
      }

      case 'action': {
        const resolvedConfig = resolveTemplates(node.config, nodeOutputs, task);
        const output = await executeAction(resolvedConfig, task, scheduleService);
        nodeOutputs[node.id] = output;
        await databaseService.query(
          `UPDATE workflow_node_executions SET status = 'completed', output_data = ?, completed_at = NOW() WHERE id = ?`,
          [JSON.stringify(output), nodeExecId],
        );
        break;
      }

      case 'agent': {
        const { agentRegistry } = await import('../AgentRegistryService');
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
        return;
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
        return;
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

  await persistNodeOutputs(execId, nodeOutputs);
  await advanceExecution(execId, node.id, def, adjacency, visited, task, scheduleService, nodeOutputs);
}

async function persistNodeOutputs(execId: string, nodeOutputs: Record<string, any>): Promise<void> {
  const rows = await databaseService.query('SELECT context FROM workflow_executions WHERE id = ?', [execId]);
  const existing = rows.length > 0 ? parseJson(rows[0].context) : {};
  await databaseService.query(
    `UPDATE workflow_executions SET context = ? WHERE id = ?`,
    [JSON.stringify({ ...existing, nodeOutputs }), execId],
  );
}

async function checkCompletion(execId: string): Promise<void> {
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
