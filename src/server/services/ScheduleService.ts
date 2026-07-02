import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { auditLedgerService } from './AuditLedgerService';
import { dagWorkflowService } from './DagWorkflowService';

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependency {
  id?: string;
  taskId?: string;
  dependencyId: string;
  dependencyType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays: number;
}

export interface Task {
  id: string;
  scheduleId: string;
  name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: string;
  estimatedDays?: number;
  estimatedDurationHours?: number;
  actualDurationHours?: number;
  startDate?: string;
  endDate?: string;
  progressPercentage?: number;
  /** @deprecated Use dependencies[] instead. Kept for backward compat — synced from first dep. */
  dependency?: string;
  /** @deprecated Use dependencies[] instead. */
  dependencyType?: 'FS' | 'SS' | 'FF' | 'SF';
  risks?: string;
  issues?: string;
  comments?: string;
  parentTaskId?: string;
  recurrenceRule?: string;
  recurrenceParentId?: string;
  isRecurrenceTemplate?: boolean;
  isMilestone?: boolean;
  /** @deprecated Use dependencies[] instead. */
  dependencyLagDays?: number;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Multi-dependency support — all predecessors for this task */
  dependencies: TaskDependency[];
}

export interface CreateScheduleData {
  projectId: string;
  name: string;
  description?: string;
  startDate: Date | string;
  endDate: Date | string;
  createdBy: string;
}

export interface CreateTaskData {
  scheduleId: string;
  name: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: Date | string;
  estimatedDays?: number;
  estimatedDurationHours?: number;
  actualDurationHours?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  progressPercentage?: number;
  /** @deprecated Use dependencies[] instead */
  dependency?: string;
  /** @deprecated Use dependencies[] instead */
  dependencyType?: 'FS' | 'FF' | 'SS' | 'SF';
  risks?: string;
  issues?: string;
  comments?: string;
  parentTaskId?: string;
  isMilestone?: boolean;
  /** @deprecated Use dependencies[] instead */
  dependencyLagDays?: number;
  afterTaskId?: string;
  createdBy: string;
  /** Multi-dependency support */
  dependencies?: Array<{ dependencyId: string; dependencyType?: 'FS' | 'SS' | 'FF' | 'SF'; lagDays?: number }>;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface CascadeChange {
  taskId: string;
  taskName: string;
  oldStartDate: string;
  newStartDate: string;
  oldEndDate: string;
  newEndDate: string;
  deltaDays: number;
}

export interface CascadeResult {
  triggeredByTaskId: string;
  deltaDays: number;
  affectedTasks: CascadeChange[];
}

export interface TaskActivityEntry {
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
// Dependency validation
// ---------------------------------------------------------------------------

export class DependencyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyValidationError';
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function toDateStr(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function rowToSchedule(row: any): Schedule {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? undefined,
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    status: row.status,
    createdBy: row.created_by,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToTask(row: any): Task {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to ?? undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    estimatedDays: row.estimated_days != null ? Number(row.estimated_days) : undefined,
    estimatedDurationHours: row.estimated_duration_hours != null ? Number(row.estimated_duration_hours) : undefined,
    actualDurationHours: row.actual_duration_hours != null ? Number(row.actual_duration_hours) : undefined,
    startDate: row.start_date ? String(row.start_date) : undefined,
    endDate: row.end_date ? String(row.end_date) : undefined,
    progressPercentage: row.progress_percentage != null ? Number(row.progress_percentage) : undefined,
    dependency: row.dependency ?? undefined,
    dependencyType: row.dependency_type ?? undefined,
    risks: row.risks ?? undefined,
    issues: row.issues ?? undefined,
    comments: row.comments ?? undefined,
    parentTaskId: row.parent_task_id ?? undefined,
    recurrenceRule: row.recurrence_rule ?? undefined,
    recurrenceParentId: row.recurrence_parent_id ?? undefined,
    isRecurrenceTemplate: row.is_recurrence_template === 1 || row.is_recurrence_template === true,
    isMilestone: row.is_milestone === 1 || row.is_milestone === true,
    dependencyLagDays: row.dependency_lag_days != null ? Number(row.dependency_lag_days) : 0,
    sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
    createdBy: row.created_by,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    dependencies: [],
  };
}

function rowToComment(row: any): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    userName: row.user_name,
    text: row.text,
    createdAt: String(row.created_at),
  };
}

function rowToActivity(row: any): TaskActivityEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    userName: row.user_name,
    action: row.action,
    field: row.field ?? undefined,
    oldValue: row.old_value ?? undefined,
    newValue: row.new_value ?? undefined,
    createdAt: String(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ScheduleService {

  // -------------------------------------------------------------------------
  // Multi-dependency helpers (junction table)
  // -------------------------------------------------------------------------

  async loadDependenciesForTasks(taskIds: string[]): Promise<Map<string, TaskDependency[]>> {
    const map = new Map<string, TaskDependency[]>();
    if (taskIds.length === 0) return map;
    const placeholders = taskIds.map(() => '?').join(', ');
    const rows = await databaseService.query(
      `SELECT id, task_id, dependency_id, dependency_type, lag_days FROM task_dependencies WHERE task_id IN (${placeholders})`,
      taskIds,
    );
    for (const r of rows) {
      const dep: TaskDependency = {
        id: r.id,
        taskId: r.task_id,
        dependencyId: r.dependency_id,
        dependencyType: r.dependency_type,
        lagDays: Number(r.lag_days) || 0,
      };
      const tid = r.task_id as string;
      const arr = map.get(tid) || [];
      arr.push(dep);
      map.set(tid, arr);
    }
    return map;
  }

  async attachDependencies(tasks: Task[]): Promise<void> {
    if (tasks.length === 0) return;
    const depMap = await this.loadDependenciesForTasks(tasks.map(t => t.id));
    for (const task of tasks) {
      task.dependencies = depMap.get(task.id) || [];
      // Sync legacy fields from first dependency for backward compat
      if (task.dependencies.length > 0) {
        const first = task.dependencies[0];
        task.dependency = first.dependencyId;
        task.dependencyType = first.dependencyType;
        task.dependencyLagDays = first.lagDays;
      }
    }
  }

  async findByProjectId(projectId: string): Promise<Schedule[]> {
    const rows = await databaseService.query(
      'SELECT * FROM schedules WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
    );
    return rows.map(rowToSchedule);
  }

  async findById(id: string): Promise<Schedule | null> {
    const rows = await databaseService.query('SELECT * FROM schedules WHERE id = ?', [id]);
    return rows.length > 0 ? rowToSchedule(rows[0]) : null;
  }

  async create(data: CreateScheduleData): Promise<Schedule> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO schedules (id, project_id, name, description, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.projectId,
        data.name,
        data.description || null,
        toDateStr(data.startDate),
        toDateStr(data.endDate),
        'active',
        data.createdBy,
      ],
    );
    return (await this.findById(id))!;
  }

  async update(id: string, data: Partial<Omit<Schedule, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>): Promise<Schedule | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const columnMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      startDate: 'start_date',
      endDate: 'end_date',
      status: 'status',
      createdBy: 'created_by',
    };

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(columnMap)) {
      if (key in data) {
        let val = (data as any)[key];
        if ((key === 'startDate' || key === 'endDate') && val) {
          val = toDateStr(val);
        }
        fields.push(`${column} = ?`);
        values.push(val ?? null);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    await databaseService.query(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`, values);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<boolean> {
    // Tasks are ON DELETE CASCADE in the schema
    const result: any = await databaseService.query('DELETE FROM schedules WHERE id = ?', [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Batch lookups (avoid N+1 patterns)
  // -------------------------------------------------------------------------

  async findByProjectIds(projectIds: string[]): Promise<Schedule[]> {
    if (projectIds.length === 0) return [];
    const placeholders = projectIds.map(() => '?').join(', ');
    const rows = await databaseService.query(
      `SELECT * FROM schedules WHERE project_id IN (${placeholders}) ORDER BY created_at DESC`,
      projectIds,
    );
    return rows.map(rowToSchedule);
  }

  async findTasksByScheduleIds(scheduleIds: string[]): Promise<Task[]> {
    if (scheduleIds.length === 0) return [];
    const placeholders = scheduleIds.map(() => '?').join(', ');
    const rows = await databaseService.query(
      `SELECT * FROM tasks WHERE schedule_id IN (${placeholders}) ORDER BY sort_order, created_at`,
      scheduleIds,
    );
    const tasks = rows.map(rowToTask);
    await this.attachDependencies(tasks);
    return tasks;
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  async findTasksByScheduleId(scheduleId: string): Promise<Task[]> {
    const rows = await databaseService.query(
      'SELECT * FROM tasks WHERE schedule_id = ? ORDER BY sort_order, created_at',
      [scheduleId],
    );
    const tasks = rows.map(rowToTask);
    await this.attachDependencies(tasks);
    return tasks;
  }

  async findTaskById(id: string): Promise<Task | null> {
    const rows = await databaseService.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const task = rowToTask(rows[0]);
    await this.attachDependencies([task]);
    return task;
  }

  async findAllTasks(): Promise<Task[]> {
    const rows = await databaseService.query('SELECT * FROM tasks ORDER BY sort_order, created_at LIMIT 1000');
    const tasks = rows.map(rowToTask);
    await this.attachDependencies(tasks);
    return tasks;
  }

  async findDependentTasks(taskId: string): Promise<Task[]> {
    const rows = await databaseService.query(
      `SELECT t.* FROM tasks t
       INNER JOIN task_dependencies td ON td.task_id = t.id
       WHERE td.dependency_id = ?`,
      [taskId],
    );
    const tasks = rows.map(rowToTask);
    await this.attachDependencies(tasks);
    return tasks;
  }

  async findAllDownstreamTasks(taskId: string): Promise<Task[]> {
    const result: Task[] = [];
    const visited = new Set<string>();

    const collect = async (id: string) => {
      const dependents = await this.findDependentTasks(id);
      for (const dep of dependents) {
        if (!visited.has(dep.id)) {
          visited.add(dep.id);
          result.push(dep);
          await collect(dep.id);
        }
      }
    };

    await collect(taskId);
    return result;
  }

  async validateDependency(taskId: string | null, dependencyId: string, scheduleId: string): Promise<void> {
    // 1. Self-reference
    if (taskId && dependencyId === taskId) {
      throw new DependencyValidationError('A task cannot depend on itself');
    }

    // 2. Dependency must exist
    const depTask = await this.findTaskById(dependencyId);
    if (!depTask) {
      throw new DependencyValidationError(`Dependency task '${dependencyId}' not found`);
    }

    // 3. Same schedule
    if (depTask.scheduleId !== scheduleId) {
      throw new DependencyValidationError('Dependency must be in the same schedule');
    }

    // 4. Circular detection (skip for new tasks — no downstream possible)
    if (taskId) {
      const downstream = await this.findAllDownstreamTasks(taskId);
      if (downstream.some(d => d.id === dependencyId)) {
        throw new DependencyValidationError('Circular dependency detected: the dependency task is already downstream of this task');
      }
    }
  }

  async createTask(data: CreateTaskData): Promise<Task> {
    const id = uuidv4();

    // Determine sort_order based on afterTaskId
    let sortOrder = 0;
    if (data.afterTaskId) {
      const afterTask = await this.findTaskById(data.afterTaskId);
      if (afterTask) {
        sortOrder = afterTask.sortOrder + 1;
        // Shift all subsequent tasks in this schedule
        await databaseService.query(
          'UPDATE tasks SET sort_order = sort_order + 1 WHERE schedule_id = ? AND sort_order >= ?',
          [data.scheduleId, sortOrder],
        );
      }
    } else {
      // Append to end: max sort_order + 1
      const maxRows = await databaseService.query(
        'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM tasks WHERE schedule_id = ?',
        [data.scheduleId],
      );
      sortOrder = (maxRows[0]?.max_order ?? -1) + 1;
    }

    // Normalize dependencies: merge legacy single dep into dependencies array
    let deps = data.dependencies || [];
    if (deps.length === 0 && data.dependency) {
      deps = [{ dependencyId: data.dependency, dependencyType: data.dependencyType || 'FS', lagDays: data.dependencyLagDays ?? 0 }];
    }
    if (deps.length > 20) {
      throw new DependencyValidationError('A task cannot have more than 20 predecessors');
    }

    // Validate all dependencies before insert
    for (const dep of deps) {
      await this.validateDependency(null, dep.dependencyId, data.scheduleId);
    }

    // Sync legacy columns from first dep (backward compat)
    const firstDep = deps[0];
    const legacyDepId = firstDep?.dependencyId || null;
    const legacyDepType = firstDep?.dependencyType || null;
    const legacyLag = firstDep?.lagDays ?? 0;

    await databaseService.query(
      `INSERT INTO tasks (id, schedule_id, name, description, status, priority, assigned_to,
        due_date, estimated_days, estimated_duration_hours, actual_duration_hours,
        start_date, end_date, progress_percentage, dependency, dependency_type,
        risks, issues, comments, parent_task_id, is_milestone, dependency_lag_days, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.scheduleId,
        data.name,
        data.description || null,
        data.status || 'pending',
        data.priority || 'medium',
        data.assignedTo || null,
        toDateStr(data.dueDate),
        data.estimatedDays ?? null,
        data.estimatedDurationHours ?? null,
        data.actualDurationHours ?? null,
        toDateStr(data.startDate),
        toDateStr(data.endDate),
        data.progressPercentage ?? 0,
        legacyDepId,
        legacyDepType,
        data.risks || null,
        data.issues || null,
        data.comments || null,
        data.parentTaskId || null,
        data.isMilestone ? 1 : 0,
        legacyLag,
        sortOrder,
        data.createdBy,
      ],
    );

    // Insert junction table rows
    for (const dep of deps) {
      const depId = uuidv4();
      await databaseService.query(
        `INSERT INTO task_dependencies (id, task_id, dependency_id, dependency_type, lag_days) VALUES (?, ?, ?, ?, ?)`,
        [depId, id, dep.dependencyId, dep.dependencyType || 'FS', dep.lagDays ?? 0],
      );
    }

    const task = (await this.findTaskById(id))!;

    // Look up projectId from schedule
    const schedule = await this.findById(data.scheduleId);
    auditLedgerService.append({
      actorId: data.createdBy,
      actorType: 'user',
      action: 'task.create',
      entityType: 'task',
      entityId: id,
      projectId: schedule?.projectId ?? null,
      payload: { after: task },
      source: 'web',
    }).catch(() => {});

    // Fire event-driven workflow triggers (non-blocking)
    dagWorkflowService.evaluateTaskChange(task, null, this).catch(err =>
      console.error('[Workflow] evaluateTaskChange error:', err)
    );

    return task;
  }

  async updateTask(id: string, data: Partial<Omit<Task, 'id' | 'scheduleId' | 'createdAt' | 'updatedAt'>>): Promise<Task | null> {
    const oldTask = await this.findTaskById(id);
    if (!oldTask) return null;

    // Handle multi-dependency updates via junction table
    if (data.dependencies !== undefined) {
      const deps = data.dependencies;
      if (deps.length > 20) {
        throw new DependencyValidationError('A task cannot have more than 20 predecessors');
      }
      for (const dep of deps) {
        await this.validateDependency(id, dep.dependencyId, oldTask.scheduleId);
      }
      // Replace strategy: delete all, re-insert
      await databaseService.query('DELETE FROM task_dependencies WHERE task_id = ?', [id]);
      for (const dep of deps) {
        const depRowId = uuidv4();
        await databaseService.query(
          `INSERT INTO task_dependencies (id, task_id, dependency_id, dependency_type, lag_days) VALUES (?, ?, ?, ?, ?)`,
          [depRowId, id, dep.dependencyId, dep.dependencyType || 'FS', dep.lagDays ?? 0],
        );
      }
      // Sync legacy columns from first dep
      const first = deps[0];
      data.dependency = first?.dependencyId ?? (null as any);
      data.dependencyType = first?.dependencyType ?? (null as any);
      data.dependencyLagDays = first?.lagDays ?? 0;
    } else if (data.dependency !== undefined) {
      // Legacy single-dep update — sync to junction table
      if (data.dependency) {
        await this.validateDependency(id, data.dependency, oldTask.scheduleId);
      }
      await databaseService.query('DELETE FROM task_dependencies WHERE task_id = ?', [id]);
      if (data.dependency) {
        const depRowId = uuidv4();
        await databaseService.query(
          `INSERT INTO task_dependencies (id, task_id, dependency_id, dependency_type, lag_days) VALUES (?, ?, ?, ?, ?)`,
          [depRowId, id, data.dependency, data.dependencyType || 'FS', data.dependencyLagDays ?? 0],
        );
      }
    }

    // Auto-log field changes as activity
    const trackFields: (keyof Task)[] = ['status', 'priority', 'assignedTo', 'progressPercentage', 'startDate', 'endDate', 'name'];
    for (const field of trackFields) {
      if (field in data && data[field as keyof typeof data] !== undefined) {
        const oldVal = String(oldTask[field] ?? '');
        const newVal = String(data[field as keyof typeof data] ?? '');
        if (oldVal !== newVal) {
          await this.logActivity(id, '1', 'System', 'updated', field, oldVal, newVal);
        }
      }
    }

    const columnMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      status: 'status',
      priority: 'priority',
      assignedTo: 'assigned_to',
      dueDate: 'due_date',
      estimatedDays: 'estimated_days',
      estimatedDurationHours: 'estimated_duration_hours',
      actualDurationHours: 'actual_duration_hours',
      startDate: 'start_date',
      endDate: 'end_date',
      progressPercentage: 'progress_percentage',
      dependency: 'dependency',
      dependencyType: 'dependency_type',
      risks: 'risks',
      issues: 'issues',
      comments: 'comments',
      parentTaskId: 'parent_task_id',
      recurrenceRule: 'recurrence_rule',
      recurrenceParentId: 'recurrence_parent_id',
      isRecurrenceTemplate: 'is_recurrence_template',
      isMilestone: 'is_milestone',
      dependencyLagDays: 'dependency_lag_days',
      createdBy: 'created_by',
    };

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(columnMap)) {
      if (key in data) {
        let val = (data as any)[key];
        if (['startDate', 'endDate', 'dueDate'].includes(key) && val) {
          val = toDateStr(val);
        }
        fields.push(`${column} = ?`);
        values.push(val ?? null);
      }
    }

    if (fields.length === 0) return oldTask;

    values.push(id);
    await databaseService.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = (await this.findTaskById(id))!;

    // Audit log
    const schedule = await this.findById(oldTask.scheduleId);
    auditLedgerService.append({
      actorId: data.createdBy || oldTask.createdBy,
      actorType: 'user',
      action: 'task.update',
      entityType: 'task',
      entityId: id,
      projectId: schedule?.projectId ?? null,
      payload: { before: oldTask, after: updated, changes: data },
      source: 'web',
    }).catch(() => {});

    // Fire event-driven workflow triggers (non-blocking)
    dagWorkflowService.evaluateTaskChange(updated, oldTask, this).catch(err =>
      console.error('[Workflow] evaluateTaskChange error:', err)
    );

    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    const existing = await this.findTaskById(id);
    const result: any = await databaseService.query('DELETE FROM tasks WHERE id = ?', [id]);
    const deleted = (result.affectedRows ?? 0) > 0;

    if (deleted && existing) {
      // Junction table rows are cascade-deleted automatically.
      // Also clear legacy denormalized columns on other tasks that referenced this one.
      await databaseService.query(
        'UPDATE tasks SET dependency = NULL, dependency_type = NULL, dependency_lag_days = 0 WHERE dependency = ?',
        [id],
      );

      const schedule = await this.findById(existing.scheduleId);
      auditLedgerService.append({
        actorId: existing.createdBy,
        actorType: 'user',
        action: 'task.delete',
        entityType: 'task',
        entityId: id,
        projectId: schedule?.projectId ?? null,
        payload: { before: existing },
        source: 'web',
      }).catch(() => {});
    }

    return deleted;
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  async addComment(taskId: string, text: string, userId: string, userName: string): Promise<TaskComment> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO task_comments (id, task_id, user_id, user_name, text) VALUES (?, ?, ?, ?, ?)`,
      [id, taskId, userId, userName, text],
    );
    const rows = await databaseService.query('SELECT * FROM task_comments WHERE id = ?', [id]);
    return rowToComment(rows[0]);
  }

  async getComments(taskId: string): Promise<TaskComment[]> {
    const rows = await databaseService.query(
      'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at DESC',
      [taskId],
    );
    return rows.map(rowToComment);
  }

  async deleteComment(commentId: string): Promise<boolean> {
    const result: any = await databaseService.query('DELETE FROM task_comments WHERE id = ?', [commentId]);
    return (result.affectedRows ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Activity Feed
  // -------------------------------------------------------------------------

  async logActivity(
    taskId: string,
    userId: string,
    userName: string,
    action: string,
    field?: string,
    oldValue?: string,
    newValue?: string,
  ): Promise<TaskActivityEntry> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO task_activities (id, task_id, user_id, user_name, action, field, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, taskId, userId, userName, action, field || null, oldValue || null, newValue || null],
    );
    const rows = await databaseService.query('SELECT * FROM task_activities WHERE id = ?', [id]);
    return rowToActivity(rows[0]);
  }

  async getActivities(taskId: string): Promise<TaskActivityEntry[]> {
    const rows = await databaseService.query(
      'SELECT * FROM task_activities WHERE task_id = ? ORDER BY created_at DESC',
      [taskId],
    );
    return rows.map(rowToActivity);
  }

  async getActivitiesBySchedule(scheduleId: string): Promise<TaskActivityEntry[]> {
    const rows = await databaseService.query(
      `SELECT a.* FROM task_activities a
       INNER JOIN tasks t ON a.task_id = t.id
       WHERE t.schedule_id = ?
       ORDER BY a.created_at DESC`,
      [scheduleId],
    );
    return rows.map(rowToActivity);
  }

  async getAllActivities(): Promise<TaskActivityEntry[]> {
    const rows = await databaseService.query(
      'SELECT * FROM task_activities ORDER BY created_at DESC',
    );
    return rows.map(rowToActivity);
  }

  // -------------------------------------------------------------------------
  // Auto-Scheduling: Cascade Reschedule
  // -------------------------------------------------------------------------

  async cascadeReschedule(taskId: string, oldEndDate: Date, newEndDate: Date): Promise<CascadeResult> {
    const deltaDays = Math.round((newEndDate.getTime() - oldEndDate.getTime()) / (1000 * 60 * 60 * 24));

    if (deltaDays === 0) {
      return { triggeredByTaskId: taskId, deltaDays: 0, affectedTasks: [] };
    }

    // Load trigger task's schedule to get all tasks for multi-dep resolution
    const triggerTask = await this.findTaskById(taskId);
    if (!triggerTask) return { triggeredByTaskId: taskId, deltaDays: 0, affectedTasks: [] };

    const allTasks = await this.findTasksByScheduleId(triggerTask.scheduleId);
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const downstream = await this.findAllDownstreamTasks(taskId);
    const affectedTasks: CascadeChange[] = [];

    for (const task of downstream) {
      // For multi-dep: compute new start = MAX of all FS predecessors' endDate + lag
      let computedStart: Date | null = null;
      let allFS = true;
      for (const dep of task.dependencies) {
        if (dep.dependencyType !== 'FS') { allFS = false; continue; }
        const predTask = taskMap.get(dep.dependencyId);
        if (!predTask?.endDate) continue;
        const predEnd = new Date(predTask.endDate);
        const start = new Date(predEnd.getTime() + (dep.lagDays || 0) * 86_400_000 + 86_400_000);
        if (!computedStart || start > computedStart) computedStart = start;
      }

      if (!allFS && !computedStart) continue; // skip non-FS-only tasks if no FS deps

      const oldStart = task.startDate ? new Date(task.startDate) : null;
      const oldEnd = task.endDate ? new Date(task.endDate) : null;
      if (!oldStart && !oldEnd) continue;

      let newStart: Date | null = null;
      let newEnd: Date | null = null;

      if (computedStart && oldStart && oldEnd) {
        const duration = oldEnd.getTime() - oldStart.getTime();
        newStart = computedStart;
        newEnd = new Date(computedStart.getTime() + duration);
      } else if (oldStart && oldEnd) {
        // Fallback: simple shift
        const deltaMs = deltaDays * 86_400_000;
        newStart = new Date(oldStart.getTime() + deltaMs);
        newEnd = new Date(oldEnd.getTime() + deltaMs);
      }

      if (!newStart && !newEnd) continue;
      // Only shift if dates actually changed
      if (newStart && oldStart && newStart.getTime() === oldStart.getTime()) continue;

      const change: CascadeChange = {
        taskId: task.id,
        taskName: task.name,
        oldStartDate: oldStart?.toISOString().split('T')[0] || '',
        newStartDate: newStart?.toISOString().split('T')[0] || '',
        oldEndDate: oldEnd?.toISOString().split('T')[0] || '',
        newEndDate: newEnd?.toISOString().split('T')[0] || '',
        deltaDays: newStart && oldStart ? Math.round((newStart.getTime() - oldStart.getTime()) / 86_400_000) : deltaDays,
      };

      // Apply the shift
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      if (newStart) { updateFields.push('start_date = ?'); updateValues.push(newStart.toISOString().split('T')[0]); }
      if (newEnd) { updateFields.push('end_date = ?'); updateValues.push(newEnd.toISOString().split('T')[0]); }

      if (updateFields.length > 0) {
        updateValues.push(task.id);
        await databaseService.query(
          `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues,
        );
        // Update the in-memory taskMap so subsequent tasks see the new dates
        const updated = taskMap.get(task.id);
        if (updated) {
          if (newStart) updated.startDate = newStart.toISOString().split('T')[0];
          if (newEnd) updated.endDate = newEnd.toISOString().split('T')[0];
        }
      }

      await this.logActivity(task.id, '1', 'System', 'auto-rescheduled', 'dates',
        `${change.oldStartDate} - ${change.oldEndDate}`,
        `${change.newStartDate} - ${change.newEndDate}`,
      );

      affectedTasks.push(change);
    }

    return { triggeredByTaskId: taskId, deltaDays, affectedTasks };
  }
}

export const scheduleService = new ScheduleService();
