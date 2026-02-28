import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { auditLedgerService } from './AuditLedgerService';

export interface Sprint {
  id: string;
  projectId: string;
  scheduleId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: string;
  velocityCommitment: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface SprintTask {
  id: string;
  sprintId: string;
  taskId: string;
  storyPoints: number | null;
  addedAt: string;
}

interface SprintTaskRow {
  id: string;
  sprint_id: string;
  task_id: string;
  story_points: number | null;
  added_at: string;
}

interface BoardTask {
  id: string;
  name: string;
  status: string;
  storyPoints: number | null;
  [key: string]: any;
}

function rowToDTO(row: SprintRow): Sprint {
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

class SprintService {
  async create(
    projectId: string,
    scheduleId: string,
    data: {
      name: string;
      goal?: string;
      startDate: string;
      endDate: string;
      velocityCommitment?: number;
    },
    userId: string,
  ): Promise<Sprint> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO sprints (id, project_id, schedule_id, name, goal, start_date, end_date, status, velocity_commitment, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?)`,
      [id, projectId, scheduleId, data.name, data.goal || null, data.startDate, data.endDate, data.velocityCommitment || null, userId],
    );
    const rows = await databaseService.query<SprintRow>('SELECT * FROM sprints WHERE id = ?', [id]);
    const sprint = rowToDTO(rows[0]);

    auditLedgerService.append({
      actorId: userId,
      actorType: 'user',
      action: 'sprint.create',
      entityType: 'sprint',
      entityId: id,
      projectId: projectId,
      payload: { after: sprint },
      source: 'web',
    }).catch(() => {});

    return sprint;
  }

  async getByProject(projectId: string): Promise<Sprint[]> {
    const rows = await databaseService.query<SprintRow>(
      'SELECT * FROM sprints WHERE project_id = ? ORDER BY start_date DESC',
      [projectId],
    );
    return rows.map(rowToDTO);
  }

  async getBySchedule(scheduleId: string): Promise<Sprint[]> {
    const rows = await databaseService.query<SprintRow>(
      'SELECT * FROM sprints WHERE schedule_id = ? ORDER BY start_date DESC',
      [scheduleId],
    );
    return rows.map(rowToDTO);
  }

  async getById(id: string): Promise<Sprint | null> {
    const rows = await databaseService.query<SprintRow>('SELECT * FROM sprints WHERE id = ?', [id]);
    return rows.length > 0 ? rowToDTO(rows[0]) : null;
  }

  async update(
    id: string,
    data: {
      name?: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      velocityCommitment?: number;
    },
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
      await databaseService.query(`UPDATE sprints SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<SprintRow>('SELECT * FROM sprints WHERE id = ?', [id]);
    return rowToDTO(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await databaseService.query('DELETE FROM sprint_tasks WHERE sprint_id = ?', [id]);
    await databaseService.query('DELETE FROM sprints WHERE id = ?', [id]);
  }

  async addTask(sprintId: string, taskId: string, storyPoints?: number): Promise<SprintTask> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO sprint_tasks (id, sprint_id, task_id, story_points)
       VALUES (?, ?, ?, ?)`,
      [id, sprintId, taskId, storyPoints || null],
    );
    const rows = await databaseService.query<SprintTaskRow>('SELECT * FROM sprint_tasks WHERE id = ?', [id]);
    const sprintTask = taskRowToDTO(rows[0]);

    const sprint = await this.getById(sprintId);
    auditLedgerService.append({
      actorId: sprint?.createdBy || 'system',
      actorType: 'user',
      action: 'task.add_to_sprint',
      entityType: 'sprint_task',
      entityId: id,
      projectId: sprint?.projectId ?? null,
      payload: { sprintId, taskId, storyPoints },
      source: 'web',
    }).catch(() => {});

    return sprintTask;
  }

  async removeTask(sprintId: string, taskId: string): Promise<void> {
    await databaseService.query(
      'DELETE FROM sprint_tasks WHERE sprint_id = ? AND task_id = ?',
      [sprintId, taskId],
    );
  }

  async startSprint(id: string): Promise<Sprint> {
    const before = await this.getById(id);
    await databaseService.query(
      `UPDATE sprints SET status = 'active' WHERE id = ?`,
      [id],
    );
    const rows = await databaseService.query<SprintRow>('SELECT * FROM sprints WHERE id = ?', [id]);
    const sprint = rowToDTO(rows[0]);

    auditLedgerService.append({
      actorId: sprint.createdBy,
      actorType: 'user',
      action: 'sprint.start',
      entityType: 'sprint',
      entityId: id,
      projectId: sprint.projectId,
      payload: { before, after: sprint },
      source: 'web',
    }).catch(() => {});

    return sprint;
  }

  async completeSprint(id: string): Promise<Sprint> {
    const before = await this.getById(id);
    await databaseService.query(
      `UPDATE sprints SET status = 'completed' WHERE id = ?`,
      [id],
    );
    const rows = await databaseService.query<SprintRow>('SELECT * FROM sprints WHERE id = ?', [id]);
    const sprint = rowToDTO(rows[0]);

    auditLedgerService.append({
      actorId: sprint.createdBy,
      actorType: 'user',
      action: 'sprint.complete',
      entityType: 'sprint',
      entityId: id,
      projectId: sprint.projectId,
      payload: { before, after: sprint },
      source: 'web',
    }).catch(() => {});

    return sprint;
  }

  async getSprintBoard(id: string): Promise<{ scheduleId: string | null; tasks: BoardTask[] }> {
    // Look up the sprint to get its scheduleId
    const sprintRows = await databaseService.query<SprintRow>('SELECT * FROM sprints WHERE id = ?', [id]);
    const scheduleId = sprintRows[0]?.schedule_id ?? null;

    const rows = await databaseService.query<any>(
      `SELECT t.*, st.story_points
       FROM sprint_tasks st
       JOIN schedule_tasks t ON t.id = st.task_id
       WHERE st.sprint_id = ?
       ORDER BY t.name`,
      [id],
    );

    const tasks: BoardTask[] = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      priority: row.priority || null,
      assignedTo: row.assigned_to || null,
      storyPoints: row.story_points != null ? Number(row.story_points) : null,
    }));

    return { scheduleId, tasks };
  }

  async getSprintBurndown(id: string): Promise<{
    dates: string[];
    ideal: number[];
    actual: number[];
    totalPoints: number;
  }> {
    const sprint = await this.getById(id);
    if (!sprint) {
      return { dates: [], ideal: [], actual: [], totalPoints: 0 };
    }

    // Get total story points for the sprint
    const pointsRows = await databaseService.query<{ total: number }>(
      'SELECT COALESCE(SUM(story_points), 0) as total FROM sprint_tasks WHERE sprint_id = ?',
      [id],
    );
    const totalPoints = Number(pointsRows[0].total);

    // Get completed tasks with their completion dates
    const completedRows = await databaseService.query<{ story_points: number; updated_at: string }>(
      `SELECT st.story_points, t.updated_at
       FROM sprint_tasks st
       JOIN schedule_tasks t ON t.id = st.task_id
       WHERE st.sprint_id = ? AND t.status = 'completed'
       ORDER BY t.updated_at`,
      [id],
    );

    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const DAY_MS = 86_400_000;
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS));

    const dates: string[] = [];
    const ideal: number[] = [];
    const actual: number[] = [];

    for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
      const currentDate = new Date(startDate.getTime() + dayIndex * DAY_MS);
      const dateStr = currentDate.toISOString().slice(0, 10);

      dates.push(dateStr);

      // Ideal line: linear decrease from totalPoints to 0
      const idealRemaining = totalPoints * (1 - dayIndex / totalDays);
      ideal.push(Math.max(0, Math.round(idealRemaining * 10) / 10));

      // Actual: total points minus points completed up to this date
      if (currentDate <= today) {
        let completedPoints = 0;
        for (const row of completedRows) {
          const completedDate = new Date(row.updated_at);
          completedDate.setHours(0, 0, 0, 0);
          if (completedDate <= currentDate) {
            completedPoints += Number(row.story_points) || 0;
          }
        }
        actual.push(totalPoints - completedPoints);
      } else {
        actual.push(-1); // future dates
      }
    }

    return { dates, ideal, actual, totalPoints };
  }

  async getVelocityHistory(projectId: string): Promise<{
    sprints: Array<{ name: string; velocity: number; commitment: number }>;
  }> {
    const rows = await databaseService.query<SprintRow>(
      `SELECT * FROM sprints WHERE project_id = ? AND status = 'completed' ORDER BY start_date`,
      [projectId],
    );

    const sprints: Array<{ name: string; velocity: number; commitment: number }> = [];

    for (const row of rows) {
      // Count completed story points for this sprint
      const pointsRows = await databaseService.query<{ total: number }>(
        `SELECT COALESCE(SUM(st.story_points), 0) as total
         FROM sprint_tasks st
         JOIN schedule_tasks t ON t.id = st.task_id
         WHERE st.sprint_id = ? AND t.status = 'completed'`,
        [row.id],
      );

      sprints.push({
        name: row.name,
        velocity: Number(pointsRows[0].total),
        commitment: Number(row.velocity_commitment) || 0,
      });
    }

    return { sprints };
  }
}

export const sprintService = new SprintService();
