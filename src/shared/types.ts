// =============================================================================
// Shared Domain Types — PM Assistant
// =============================================================================
//
// Single source of truth for domain models used by both the Fastify backend
// and the React frontend.  Keep this file free of runtime dependencies so
// that either side can import it without pulling in server-only packages.
//
// Convention:
//   - Use string-literal unions for enums (they serialize naturally as JSON).
//   - Dates are represented as ISO-8601 strings in API payloads.
//   - Fields that only exist server-side (e.g. passwordHash) are omitted.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums (string-literal unions)
// ---------------------------------------------------------------------------

export type ProjectType = 'it' | 'construction' | 'infrastructure' | 'roads' | 'other';
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ScheduleStatus = 'pending' | 'active' | 'completed' | 'on_hold' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type UserRole = 'admin' | 'executive' | 'manager' | 'member';
export type ProjectRole = 'owner' | 'manager' | 'editor' | 'viewer';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  | 'overdue_task'
  | 'budget_threshold'
  | 'stalled_task'
  | 'resource_overload'
  | 'approaching_deadline';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ReportType = 'weekly-status' | 'risk-assessment' | 'budget-forecast' | 'resource-utilization';

// ---------------------------------------------------------------------------
// Core Domain Entities
// ---------------------------------------------------------------------------

/** Public-facing user profile (never includes passwordHash). */
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  category?: string;
  projectType: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  budgetAllocated?: number;
  budgetSpent: number;
  currency: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  startDate?: string;
  endDate?: string;
  completionPercentage?: number;
  projectManagerId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  scheduleId: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignedTo?: string;
  dueDate?: string;
  estimatedDays?: number;
  estimatedDurationHours?: number;
  actualDurationHours?: number;
  startDate?: string;
  endDate?: string;
  progressPercentage?: number;
  dependency?: string;
  dependencyType?: DependencyType;
  risks?: string;
  issues?: string;
  comments?: string;
  parentTaskId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export interface Resource {
  id: string;
  name: string;
  role: string;
  email: string;
  capacityHoursPerWeek: number;
  skills: string[];
  isActive: boolean;
}

export interface ResourceAssignment {
  id: string;
  resourceId: string;
  taskId: string;
  scheduleId: string;
  hoursPerWeek: number;
  startDate: string;
  endDate: string;
}

export interface WeeklyUtilization {
  weekStart: string;
  allocated: number;
  capacity: number;
  utilization: number;
}

export interface ResourceWorkload {
  resourceId: string;
  resourceName: string;
  role: string;
  weeks: WeeklyUtilization[];
  averageUtilization: number;
  isOverAllocated: boolean;
}

// ---------------------------------------------------------------------------
// Project Members & RBAC
// ---------------------------------------------------------------------------

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  email: string;
  role: ProjectRole;
  addedAt: string;
}

// ---------------------------------------------------------------------------
// Baselines & Variance Tracking
// ---------------------------------------------------------------------------

export interface BaselineTask {
  taskId: string;
  name: string;
  startDate: string;
  endDate: string;
  estimatedDays?: number;
  progressPercentage: number;
  status: string;
}

export interface Baseline {
  id: string;
  scheduleId: string;
  name: string;
  createdAt: string;
  createdBy: string;
  tasks: BaselineTask[];
}

export interface TaskVariance {
  taskId: string;
  taskName: string;
  baselineStart: string;
  baselineEnd: string;
  actualStart: string;
  actualEnd: string;
  baselineProgress: number;
  actualProgress: number;
  startVarianceDays: number;
  endVarianceDays: number;
  baselineDurationDays: number;
  actualDurationDays: number;
  durationVarianceDays: number;
  progressVariancePct: number;
  statusChanged: boolean;
  baselineStatus: string;
  actualStatus: string;
}

export interface BaselineComparison {
  baselineId: string;
  baselineName: string;
  baselineDate: string;
  scheduleId: string;
  taskVariances: TaskVariance[];
  summary: {
    totalTasks: number;
    tasksSlipped: number;
    tasksAhead: number;
    tasksOnTrack: number;
    newTasks: number;
    removedTasks: number;
    avgStartVarianceDays: number;
    avgEndVarianceDays: number;
    avgProgressVariancePct: number;
    scheduleHealthPct: number;
  };
}

// ---------------------------------------------------------------------------
// Critical Path
// ---------------------------------------------------------------------------

export interface CPMTaskResult {
  taskId: string;
  name: string;
  duration: number;
  ES: number;
  EF: number;
  LS: number;
  LF: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  criticalPathTaskIds: string[];
  tasks: CPMTaskResult[];
  projectDuration: number;
}

// ---------------------------------------------------------------------------
// Proactive Alerts
// ---------------------------------------------------------------------------

export interface ProactiveAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskName?: string;
  suggestedAction: {
    toolName: string;
    params: Record<string, unknown>;
    label: string;
  };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditEvent {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  timestamp: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// AI Chat
// ---------------------------------------------------------------------------

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    toolName: string;
    input: Record<string, unknown>;
    result?: unknown;
  }>;
}

export interface AIConversation {
  id: string;
  userId: string;
  projectId?: string;
  contextType: 'project' | 'portfolio' | 'general' | 'report';
  title: string;
  messages: AIChatMessage[];
  tokenCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface GeneratedReport {
  id: string;
  reportType: ReportType;
  title: string;
  content: string;
  generatedAt: string;
  aiPowered: boolean;
  metadata: {
    projectId?: string;
    tokenCount?: number;
  };
}

// ---------------------------------------------------------------------------
// API Response Wrappers
// ---------------------------------------------------------------------------

/** Standard paginated list response. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Standard API error response. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path?: string;
}

/** Health check response. */
export interface HealthCheckResponse {
  status: 'OK' | 'DEGRADED';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  checks?: Record<
    string,
    {
      status: 'up' | 'down';
      latencyMs?: number;
      detail?: string;
    }
  >;
}

// ---------------------------------------------------------------------------
// Create/Update DTOs
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  description?: string;
  category?: string;
  projectType?: ProjectType;
  status?: ProjectStatus;
  priority?: Priority;
  budgetAllocated?: number;
  currency?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {}

export interface CreateTaskInput {
  scheduleId: string;
  name: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignedTo?: string;
  dueDate?: string;
  estimatedDays?: number;
  estimatedDurationHours?: number;
  startDate?: string;
  endDate?: string;
  dependency?: string;
  dependencyType?: DependencyType;
  parentTaskId?: string;
}

export interface UpdateTaskInput extends Partial<Omit<CreateTaskInput, 'scheduleId'>> {
  progressPercentage?: number;
}

export interface CreateScheduleInput {
  projectId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export interface UpdateScheduleInput extends Partial<Omit<CreateScheduleInput, 'projectId'>> {
  status?: ScheduleStatus;
}
