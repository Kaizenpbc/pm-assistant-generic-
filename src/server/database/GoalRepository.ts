import { BaseRepository } from './BaseRepository';
import { v4 as uuidv4 } from 'uuid';

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

const COLUMN_MAP: Record<string, string> = {
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

export class GoalRepository extends BaseRepository<Goal> {
  constructor() {
    super('goals', rowToGoal);
  }

  async findByOwner(ownerId: string): Promise<Goal[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM goals WHERE owner_id = ? ORDER BY created_at DESC',
      [ownerId],
    );
    return this.mapRows(rows);
  }

  async findByProject(projectId: string): Promise<Goal[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM goals WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
    );
    return this.mapRows(rows);
  }

  async findFiltered(filters?: { ownerId?: string; projectId?: string; goalType?: string; status?: string }): Promise<Goal[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters?.ownerId) { conditions.push('owner_id = ?'); values.push(filters.ownerId); }
    if (filters?.projectId) { conditions.push('project_id = ?'); values.push(filters.projectId); }
    if (filters?.goalType) { conditions.push('goal_type = ?'); values.push(filters.goalType); }
    if (filters?.status) { conditions.push('status = ?'); values.push(filters.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.queryRaw(
      `SELECT * FROM goals ${where} ORDER BY created_at DESC`,
      values,
    );
    return this.mapRows(rows);
  }

  async insert(data: {
    name: string; description?: string; ownerId: string; parentId?: string;
    goalType?: string; status?: string; progress?: number;
    targetValue?: number; currentValue?: number; unit?: string;
    startDate?: string; dueDate?: string; projectId?: string;
  }): Promise<Goal> {
    const id = uuidv4();
    await this.queryRaw(
      `INSERT INTO goals (id, name, description, owner_id, parent_id, goal_type, status, progress,
        target_value, current_value, unit, start_date, due_date, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.name, data.description ?? null, data.ownerId ?? null,
        data.parentId ?? null, data.goalType ?? 'objective', data.status ?? 'on_track',
        data.progress ?? 0, data.targetValue ?? null, data.currentValue ?? null,
        data.unit ?? null, data.startDate ?? null, data.dueDate ?? null, data.projectId ?? null,
      ],
    );
    return (await this.findById(id))!;
  }

  async update(id: string, data: Record<string, any>): Promise<Goal | null> {
    const update = this.buildUpdate(data, COLUMN_MAP);
    if (!update) return this.findById(id);
    update.values.push(id);
    await this.queryRaw(update.sql, update.values);
    return this.findById(id);
  }

  async getChildProgress(parentId: string): Promise<number[]> {
    const rows = await this.queryRaw(
      'SELECT progress FROM goals WHERE parent_id = ? AND goal_type = ?',
      [parentId, 'key_result'],
    );
    return rows.map((r: any) => Number(r.progress ?? 0));
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    await this.queryRaw('UPDATE goals SET progress = ? WHERE id = ?', [progress, id]);
  }
}

export const goalRepository = new GoalRepository();
