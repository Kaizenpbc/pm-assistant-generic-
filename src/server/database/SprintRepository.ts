import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository';
import { databaseService } from './connection';
import type { Sprint, SprintTask } from '../services/SprintService';

interface SprintRow {
  id: string;
  project_id: string;
  schedule_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: string;
  velocity_commitment: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SprintTaskRow {
  id: string;
  sprint_id: string;
  task_id: string;
  story_points: number | null;
  added_at: string;
}

function rowToSprint(row: any): Sprint {
  return {
    id: row.id,
    projectId: row.project_id,
    scheduleId: row.schedule_id,
    name: row.name,
    goal: row.goal,
    startDate: typeof row.start_date === 'string' ? row.start_date : new Date(row.start_date).toISOString().slice(0, 10),
    endDate: typeof row.end_date === 'string' ? row.end_date : new Date(row.end_date).toISOString().slice(0, 10),
    status: row.status,
    velocityCommitment: row.velocity_commitment != null ? Number(row.velocity_commitment) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskRowToDTO(row: SprintTaskRow): SprintTask {
  return {
    id: row.id,
    sprintId: row.sprint_id,
    taskId: row.task_id,
    storyPoints: row.story_points != null ? Number(row.story_points) : null,
    addedAt: row.added_at,
  };
}

export class SprintRepository extends BaseRepository<Sprint> {
  constructor() {
    super('sprints', rowToSprint);
  }

  async create(
    projectId: string,
    scheduleId: string,
    data: { name: string; goal?: string; startDate: string; endDate: string; velocityCommitment?: number },
    userId: string,
  ): Promise<Sprint> {
    const id = uuidv4();
    await this.queryRaw(
      `INSERT INTO sprints (id, project_id, schedule_id, name, goal, start_date, end_date, status, velocity_commitment, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?)`,
      [id, projectId, scheduleId, data.name, data.goal || null, data.startDate, data.endDate, data.velocityCommitment || null, userId],
    );
    return (await this.findById(id))!;
  }

  async findByProject(projectId: string): Promise<Sprint[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM sprints WHERE project_id = ? ORDER BY start_date DESC',
      [projectId],
    );
    return this.mapRows(rows);
  }

  async findByProjectPaginated(projectId: string, limit: number, offset: number): Promise<{ rows: Sprint[]; total: number }> {
    return this.queryPaginated('project_id = ?', [projectId], 'start_date DESC', limit, offset);
  }

  async findBySchedule(scheduleId: string): Promise<Sprint[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM sprints WHERE schedule_id = ? ORDER BY start_date DESC',
      [scheduleId],
    );
    return this.mapRows(rows);
  }

  async update(
    id: string,
    data: { name?: string; goal?: string; startDate?: string; endDate?: string; status?: string; velocityCommitment?: number },
  ): Promise<Sprint> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.goal !== undefined) { sets.push('goal = ?'); params.push(data.goal); }
    if (data.startDate !== undefined) { sets.push('start_date = ?'); params.push(data.startDate); }
    if (data.endDate !== undefined) { sets.push('end_date = ?'); params.push(data.endDate); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    if (data.velocityCommitment !== undefined) { sets.push('velocity_commitment = ?'); params.push(data.velocityCommitment); }
    if (sets.length > 0) {
      params.push(id);
      await this.queryRaw(`UPDATE sprints SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return (await this.findById(id))!;
  }

  async deleteSprint(id: string): Promise<void> {
    await databaseService.transaction(async (conn) => {
      const q = (sql: string, params: any[] = []) => databaseService.queryOn(conn, sql, params);
      await q('DELETE FROM sprint_tasks WHERE sprint_id = ?', [id]);
      await q('DELETE FROM sprints WHERE id = ?', [id]);
    });
  }

  async updateStatus(id: string, status: string): Promise<Sprint> {
    await this.queryRaw(`UPDATE sprints SET status = ? WHERE id = ?`, [status, id]);
    return (await this.findById(id))!;
  }

  // --- Sprint Task operations ---

  async addTask(sprintId: string, taskId: string, storyPoints?: number): Promise<SprintTask> {
    const id = uuidv4();
    await this.queryRaw(
      `INSERT INTO sprint_tasks (id, sprint_id, task_id, story_points) VALUES (?, ?, ?, ?)`,
      [id, sprintId, taskId, storyPoints || null],
    );
    const rows = await this.queryRaw('SELECT * FROM sprint_tasks WHERE id = ?', [id]);
    return taskRowToDTO(rows[0]);
  }

  async removeTask(sprintId: string, taskId: string): Promise<void> {
    await this.queryRaw(
      'DELETE FROM sprint_tasks WHERE sprint_id = ? AND task_id = ?',
      [sprintId, taskId],
    );
  }

  async getSprintBoard(id: string): Promise<{ scheduleId: string | null; tasks: any[] }> {
    const sprintRows = await this.queryRaw('SELECT * FROM sprints WHERE id = ?', [id]);
    const scheduleId = sprintRows[0]?.schedule_id ?? null;

    const rows = await this.queryRaw(
      `SELECT t.*, st.story_points
       FROM sprint_tasks st
       JOIN tasks t ON t.id = st.task_id
       WHERE st.sprint_id = ?
       ORDER BY t.name`,
      [id],
    );

    const tasks = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      priority: row.priority || null,
      assignedTo: row.assigned_to || null,
      storyPoints: row.story_points != null ? Number(row.story_points) : null,
    }));

    return { scheduleId, tasks };
  }

  async getTotalPoints(sprintId: string): Promise<number> {
    const rows = await this.queryRaw(
      'SELECT COALESCE(SUM(story_points), 0) as total FROM sprint_tasks WHERE sprint_id = ?',
      [sprintId],
    );
    return Number(rows[0].total);
  }

  async getCompletedTasksWithDates(sprintId: string): Promise<{ story_points: number; updated_at: string }[]> {
    return this.queryRaw(
      `SELECT st.story_points, t.updated_at
       FROM sprint_tasks st
       JOIN tasks t ON t.id = st.task_id
       WHERE st.sprint_id = ? AND t.status = 'completed'
       ORDER BY t.updated_at`,
      [sprintId],
    );
  }

  async getVelocityHistory(projectId: string): Promise<Array<{ name: string; velocity: number; commitment: number }>> {
    const rows = await this.queryRaw(
      `SELECT s.*, COALESCE(SUM(CASE WHEN t.status = 'completed' THEN st.story_points ELSE 0 END), 0) as completed_points
       FROM sprints s
       LEFT JOIN sprint_tasks st ON st.sprint_id = s.id
       LEFT JOIN tasks t ON t.id = st.task_id
       WHERE s.project_id = ? AND s.status = 'completed'
       GROUP BY s.id
       ORDER BY s.start_date`,
      [projectId],
    );

    return rows.map((row: any) => ({
      name: row.name,
      velocity: Number(row.completed_points),
      commitment: Number(row.velocity_commitment) || 0,
    }));
  }
}

export const sprintRepository = new SprintRepository();
