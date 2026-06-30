import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

export interface Goal {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  parentId?: string;
  goalType: 'objective' | 'key_result';
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  progress: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: string;
  dueDate?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalData {
  name: string;
  description?: string;
  ownerId: string;
  parentId?: string;
  goalType: 'objective' | 'key_result';
  status?: 'on_track' | 'at_risk' | 'behind' | 'completed';
  progress?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: string;
  dueDate?: string;
  projectId?: string;
}

function rowToGoal(row: any): Goal {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ownerId: row.owner_id,
    parentId: row.parent_id ?? undefined,
    goalType: row.goal_type,
    status: row.status,
    progress: Number(row.progress ?? 0),
    targetValue: row.target_value != null ? Number(row.target_value) : undefined,
    currentValue: row.current_value != null ? Number(row.current_value) : undefined,
    unit: row.unit ?? undefined,
    startDate: row.start_date ? String(row.start_date) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    projectId: row.project_id ?? undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class GoalService {
  async findById(id: string): Promise<Goal | null> {
    const rows = await databaseService.query('SELECT * FROM goals WHERE id = ?', [id]);
    return rows.length > 0 ? rowToGoal(rows[0]) : null;
  }

  async listByOwner(ownerId: string): Promise<Goal[]> {
    const rows = await databaseService.query(
      'SELECT * FROM goals WHERE owner_id = ? ORDER BY created_at DESC',
      [ownerId],
    );
    return rows.map(rowToGoal);
  }

  async listByProject(projectId: string): Promise<Goal[]> {
    const rows = await databaseService.query(
      'SELECT * FROM goals WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
    );
    return rows.map(rowToGoal);
  }

  async list(filters?: { ownerId?: string; projectId?: string; goalType?: string; status?: string }): Promise<Goal[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.ownerId) {
      conditions.push('owner_id = ?');
      values.push(filters.ownerId);
    }
    if (filters?.projectId) {
      conditions.push('project_id = ?');
      values.push(filters.projectId);
    }
    if (filters?.goalType) {
      conditions.push('goal_type = ?');
      values.push(filters.goalType);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await databaseService.query(
      `SELECT * FROM goals ${where} ORDER BY created_at DESC`,
      values,
    );
    return rows.map(rowToGoal);
  }

  async create(data: CreateGoalData): Promise<Goal> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO goals (id, name, description, owner_id, parent_id, goal_type, status, progress,
        target_value, current_value, unit, start_date, due_date, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description ?? null,
        data.ownerId ?? null,
        data.parentId ?? null,
        data.goalType ?? 'objective',
        data.status ?? 'on_track',
        data.progress ?? 0,
        data.targetValue ?? null,
        data.currentValue ?? null,
        data.unit ?? null,
        data.startDate ?? null,
        data.dueDate ?? null,
        data.projectId ?? null,
      ],
    );
    return (await this.findById(id))!;
  }

  async update(id: string, data: Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Goal | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const columnMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      ownerId: 'owner_id',
      parentId: 'parent_id',
      goalType: 'goal_type',
      status: 'status',
      progress: 'progress',
      targetValue: 'target_value',
      currentValue: 'current_value',
      unit: 'unit',
      startDate: 'start_date',
      dueDate: 'due_date',
      projectId: 'project_id',
    };

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(columnMap)) {
      if (key in data) {
        const val = (data as any)[key];
        fields.push(`${column} = ?`);
        values.push(val ?? null);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    await databaseService.query(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`, values);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<boolean> {
    const result: any = await databaseService.query('DELETE FROM goals WHERE id = ?', [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  async recalculateObjectiveProgress(objectiveId: string): Promise<Goal | null> {
    const objective = await this.findById(objectiveId);
    if (!objective || objective.goalType !== 'objective') return objective;

    const children = await databaseService.query(
      'SELECT progress FROM goals WHERE parent_id = ? AND goal_type = ?',
      [objectiveId, 'key_result'],
    );

    if (children.length === 0) return objective;

    const totalProgress = children.reduce((sum: number, row: any) => sum + Number(row.progress ?? 0), 0);
    const avgProgress = Math.round(totalProgress / children.length);

    await databaseService.query(
      'UPDATE goals SET progress = ? WHERE id = ?',
      [avgProgress, objectiveId],
    );

    return (await this.findById(objectiveId))!;
  }
}

export const goalService = new GoalService();
