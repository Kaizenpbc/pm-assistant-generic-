import { z } from 'zod';

// ── AI Output Schema ────────────────────────────────────────────────────────

const generatedNodeSchema = z.object({
  nodeType: z.enum(['trigger', 'condition', 'action', 'approval', 'delay']),
  name: z.string().min(1).max(100),
  config: z.record(z.string(), z.any()),
});

const generatedEdgeSchema = z.object({
  sourceIndex: z.number().int().min(0),
  targetIndex: z.number().int().min(0),
  label: z.string().optional(),
});

export const workflowGenerationOutputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  nodes: z.array(generatedNodeSchema).min(1),
  edges: z.array(generatedEdgeSchema).min(0),
});

export type WorkflowGenerationOutput = z.infer<typeof workflowGenerationOutputSchema>;

// ── Request Schema ──────────────────────────────────────────────────────────

export const workflowGenerateRequestSchema = z.object({
  description: z.string().min(10).max(500),
  projectId: z.string().optional(),
});

// ── System Prompt ───────────────────────────────────────────────────────────

export const WORKFLOW_GENERATION_SYSTEM_PROMPT = `You are a workflow automation designer. Given a natural language description, generate a structured DAG workflow definition.

## Available Node Types

### Trigger (must be the FIRST node, index 0)
Config fields:
- triggerType: one of "status_change", "progress_threshold", "date_passed", "task_created", "assignment_change", "dependency_change", "priority_change", "manual"
- For status_change: optional fromStatus, toStatus (e.g. "in_progress", "completed", "blocked")
- For progress_threshold: threshold (number 0-100), direction ("above" or "below")
- For task_created: optional statusFilter
- For priority_change: optional toPriority ("low", "medium", "high", "critical")
- For assignment_change: optional toAssignee (user ID)

### Condition
Config fields:
- field: the task field to check (e.g. "status", "progress", "priority", "assignedTo")
- operator: one of "equals", "not_equals", "greater_than", "less_than", "contains", "not_contains"
- value: the value to compare against

### Action
Config fields:
- actionType: one of "update_field", "log_activity", "send_notification", "invoke_agent"
- For update_field: field (task field name), value (new value)
- For log_activity: message (string describing the activity)
- For send_notification: message, title, severity ("info", "warning", "error"), notificationType (default "workflow")
- For invoke_agent: capabilityId (agent capability), input (object with parameters)

### Approval
Config fields:
- approverRole: role required to approve (e.g. "project_manager", "admin")
- timeout: optional timeout in hours

### Delay
Config fields:
- delayMinutes: number of minutes to delay

## Rules
1. The first node (index 0) MUST be a trigger node.
2. Edges connect nodes by their array index (sourceIndex -> targetIndex).
3. Every non-trigger node must be reachable from the trigger via edges.
4. Keep workflows simple and focused — prefer fewer nodes.
5. Generate a clear, concise name and description.

## Output Format
Return a JSON object with: name, description, nodes[], edges[]
Each node: { nodeType, name, config }
Each edge: { sourceIndex, targetIndex, label? }`;
