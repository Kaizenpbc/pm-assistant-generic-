/**
 * MCP Tool Permission Matrix
 *
 * Controls which user roles can access which MCP tools.
 * Uses a category-based approach for maintainability.
 */

export type Role = 'admin' | 'executive' | 'project_manager' | 'team_member' | 'scrum_master' | 'finance_officer';

const ALL_ROLES: readonly Role[] = ['admin', 'executive', 'project_manager', 'team_member', 'scrum_master', 'finance_officer'];

// Read-only tools: all roles can access
const READ_TOOLS = new Set([
  // projects
  'list-projects', 'get-project',
  // schedules
  'list-schedules', 'get-critical-path', 'list-baselines',
  // tasks
  'list-tasks', 'list-task-comments', 'get-task-activity',
  // sprints
  'list-sprints', 'get-sprint', 'get-sprint-board', 'get-sprint-burndown', 'get-velocity',
  // resources
  'list-resources', 'get-resource-workload', 'get-resource-histogram',
  // time tracking
  'get-time-entries', 'get-timesheet', 'get-actual-vs-estimated',
  // reports
  'get-burndown', 'get-network-diagram', 'export-project', 'list-report-templates', 'run-report',
  // ai insights (read)
  'get-project-health', 'get-project-risks', 'get-alerts', 'get-analytics-summary',
  'get-portfolio-overview', 'natural-language-query', 'get-predictions-dashboard',
  'run-monte-carlo', 'get-evm-forecast',
  // approvals (read)
  'list-change-requests',
  // auto-reschedule (read)
  'detect-delays', 'list-proposals',
  // custom fields (read)
  'list-custom-fields',
  // intake (read)
  'list-intake-forms', 'list-intake-submissions',
  // integrations (read)
  'list-integrations',
  // admin (read-safe)
  'search', 'get-audit-trail', 'list-notifications', 'mark-notifications-read',
  // templates (read)
  'list-templates', 'list-workflows',
]);

// Budget/financial insight tools: PM, finance, executive, admin
const FINANCE_TOOLS = new Set([
  'get-budget-forecast', 'get-evm-forecast',
]);

// Task write tools: team_member, scrum_master, project_manager, admin
const TASK_WRITE_TOOLS = new Set([
  'create-task', 'update-task', 'bulk-create-tasks', 'bulk-update-tasks', 'bulk-status-update',
  'add-task-comment',
]);

// Task delete: scrum_master, project_manager, admin
const TASK_DELETE_TOOLS = new Set([
  'delete-task',
]);

// Sprint management: scrum_master, project_manager, admin
const SPRINT_WRITE_TOOLS = new Set([
  'create-sprint', 'update-sprint', 'add-task-to-sprint', 'remove-task-from-sprint',
  'start-sprint', 'complete-sprint',
]);

// Schedule write: project_manager, admin
const SCHEDULE_WRITE_TOOLS = new Set([
  'create-schedule', 'update-schedule', 'delete-schedule',
]);

// Project write: project_manager, admin
const PROJECT_WRITE_TOOLS = new Set([
  'create-project', 'update-project', 'delete-project',
]);

// Resource management: project_manager, admin
const RESOURCE_WRITE_TOOLS = new Set([
  'create-resource', 'update-resource', 'delete-resource',
]);

// Approval actions: project_manager, executive, admin
const APPROVAL_WRITE_TOOLS = new Set([
  'create-change-request', 'submit-for-approval', 'act-on-approval',
  'propose-reschedule', 'accept-proposal', 'reject-proposal',
]);

// Time logging: team_member, scrum_master, project_manager, admin
const TIME_TOOLS = new Set([
  'log-time',
]);

// Intake submission: all roles; review: project_manager, admin
const INTAKE_SUBMIT_TOOLS = new Set(['submit-intake-form']);
const INTAKE_REVIEW_TOOLS = new Set(['review-submission']);

// Custom field write: project_manager, admin
const CUSTOM_FIELD_WRITE_TOOLS = new Set([
  'create-custom-field', 'set-custom-field-values',
]);

// Admin/integration tools: admin only
const ADMIN_ONLY_TOOLS = new Set([
  'create-integration', 'sync-integration', 'trigger-agent',
]);

// Template/workflow management: project_manager, admin
const TEMPLATE_WRITE_TOOLS = new Set([
  'apply-template', 'create-workflow',
]);

/** Role-to-tool permission mapping */
const ROLE_PERMISSIONS: Record<Role, (toolName: string) => boolean> = {
  admin: () => true, // admin can access everything

  executive: (tool) =>
    READ_TOOLS.has(tool) ||
    FINANCE_TOOLS.has(tool) ||
    APPROVAL_WRITE_TOOLS.has(tool),

  project_manager: (tool) =>
    READ_TOOLS.has(tool) ||
    FINANCE_TOOLS.has(tool) ||
    TASK_WRITE_TOOLS.has(tool) ||
    TASK_DELETE_TOOLS.has(tool) ||
    SPRINT_WRITE_TOOLS.has(tool) ||
    SCHEDULE_WRITE_TOOLS.has(tool) ||
    PROJECT_WRITE_TOOLS.has(tool) ||
    RESOURCE_WRITE_TOOLS.has(tool) ||
    APPROVAL_WRITE_TOOLS.has(tool) ||
    TIME_TOOLS.has(tool) ||
    INTAKE_SUBMIT_TOOLS.has(tool) ||
    INTAKE_REVIEW_TOOLS.has(tool) ||
    CUSTOM_FIELD_WRITE_TOOLS.has(tool) ||
    TEMPLATE_WRITE_TOOLS.has(tool),

  scrum_master: (tool) =>
    READ_TOOLS.has(tool) ||
    TASK_WRITE_TOOLS.has(tool) ||
    TASK_DELETE_TOOLS.has(tool) ||
    SPRINT_WRITE_TOOLS.has(tool) ||
    TIME_TOOLS.has(tool) ||
    INTAKE_SUBMIT_TOOLS.has(tool),

  team_member: (tool) =>
    READ_TOOLS.has(tool) ||
    TASK_WRITE_TOOLS.has(tool) ||
    TIME_TOOLS.has(tool) ||
    INTAKE_SUBMIT_TOOLS.has(tool),

  finance_officer: (tool) =>
    READ_TOOLS.has(tool) ||
    FINANCE_TOOLS.has(tool),
};

/**
 * Check if a tool is allowed for a given role.
 */
export function isToolAllowed(toolName: string, role: Role): boolean {
  const checker = ROLE_PERMISSIONS[role];
  if (!checker) return false;
  return checker(toolName);
}

/**
 * Get all roles that can access a given tool.
 */
export function getAllowedRoles(toolName: string): Role[] {
  return ALL_ROLES.filter(role => isToolAllowed(toolName, role));
}
