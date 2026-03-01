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
  dependency?: string;
  dependencyType?: 'FS' | 'SS' | 'FF' | 'SF';
  risks?: string;
  issues?: string;
  comments?: string;
  parentTaskId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  dependency?: string;
  risks?: string;
  issues?: string;
  comments?: string;
  parentTaskId?: string;
  createdBy: string;
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
    createdBy: row.created_by,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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
      `SELECT * FROM tasks WHERE schedule_id IN (${placeholders}) ORDER BY created_at`,
      scheduleIds,
    );
    return rows.map(rowToTask);
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  async findTasksByScheduleId(scheduleId: string): Promise<Task[]> {
    const rows = await databaseService.query(
      'SELECT * FROM tasks WHERE schedule_id = ? ORDER BY created_at',
      [scheduleId],
    );
    return rows.map(rowToTask);
  }

  async findTaskById(id: string): Promise<Task | null> {
    const rows = await databaseService.query('SELECT * FROM tasks WHERE id = ?', [id]);
    return rows.length > 0 ? rowToTask(rows[0]) : null;
  }

  async findAllTasks(): Promise<Task[]> {
    const rows = await databaseService.query('SELECT * FROM tasks ORDER BY created_at');
    return rows.map(rowToTask);
  }

  async findDependentTasks(taskId: string): Promise<Task[]> {
    const rows = await databaseService.query(
      'SELECT * FROM tasks WHERE dependency = ?',
      [taskId],
    );
    return rows.map(rowToTask);
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

  async createTask(data: CreateTaskData): Promise<Task> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO tasks (id, schedule_id, name, description, status, priority, assigned_to,
        due_date, estimated_days, estimated_duration_hours, actual_duration_hours,
        start_date, end_date, progress_percentage, dependency, dependency_type,
        risks, issues, comments, parent_task_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        data.dependency || null,
        null, // dependencyType not in CreateTaskData currently
        data.risks || null,
        data.issues || null,
        data.comments || null,
        data.parentTaskId || null,
        data.createdBy,
      ],
    );
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
    const deltaMs = deltaDays * 24 * 60 * 60 * 1000;

    if (deltaDays === 0) {
      return { triggeredByTaskId: taskId, deltaDays: 0, affectedTasks: [] };
    }

    const downstream = await this.findAllDownstreamTasks(taskId);
    const affectedTasks: CascadeChange[] = [];

    for (const task of downstream) {
      if (task.dependencyType && task.dependencyType !== 'FS') continue;

      const oldStart = task.startDate ? new Date(task.startDate) : null;
      const oldEnd = task.endDate ? new Date(task.endDate) : null;

      if (!oldStart && !oldEnd) continue;

      const newStart = oldStart ? new Date(oldStart.getTime() + deltaMs) : null;
      const newEnd = oldEnd ? new Date(oldEnd.getTime() + deltaMs) : null;

      const change: CascadeChange = {
        taskId: task.id,
        taskName: task.name,
        oldStartDate: oldStart?.toISOString().split('T')[0] || '',
        newStartDate: newStart?.toISOString().split('T')[0] || '',
        oldEndDate: oldEnd?.toISOString().split('T')[0] || '',
        newEndDate: newEnd?.toISOString().split('T')[0] || '',
        deltaDays,
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
