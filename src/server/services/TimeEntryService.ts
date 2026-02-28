import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { ScheduleService } from './ScheduleService';

export interface TimeEntry {
  id: string;
  taskId: string;
  scheduleId: string;
  projectId: string;
  userId: string;
  date: string;
  hours: number;
  description: string | null;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TimeEntryRow {
  id: string;
  task_id: string;
  schedule_id: string;
  project_id: string;
  user_id: string;
  date: string;
  hours: number;
  description: string | null;
  billable: boolean | number;
  created_at: string;
  updated_at: string;
}

function rowToDTO(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    scheduleId: row.schedule_id,
    projectId: row.project_id,
    userId: row.user_id,
    date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
    hours: Number(row.hours),
    description: row.description,
    billable: !!row.billable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class TimeEntryService {
  private scheduleService = new ScheduleService();

  async create(data: {
    taskId: string;
    scheduleId: string;
    projectId: string;
    userId: string;
    date: string;
    hours: number;
    description?: string;
    billable?: boolean;
  }): Promise<TimeEntry> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO time_entries (id, task_id, schedule_id, project_id, user_id, date, hours, description, billable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.taskId, data.scheduleId, data.projectId, data.userId, data.date, data.hours, data.description || null, data.billable !== false],
    );
    const rows = await databaseService.query<TimeEntryRow>('SELECT * FROM time_entries WHERE id = ?', [id]);
    return rowToDTO(rows[0]);
  }

  async update(id: string, data: { date?: string; hours?: number; description?: string; billable?: boolean }): Promise<TimeEntry> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.date !== undefined) { sets.push('date = ?'); params.push(data.date); }
    if (data.hours !== undefined) { sets.push('hours = ?'); params.push(data.hours); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.billable !== undefined) { sets.push('billable = ?'); params.push(data.billable); }
    if (sets.length > 0) {
      params.push(id);
      await databaseService.query(`UPDATE time_entries SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<TimeEntryRow>('SELECT * FROM time_entries WHERE id = ?', [id]);
    return rowToDTO(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await databaseService.query('DELETE FROM time_entries WHERE id = ?', [id]);
  }

  async getByTask(taskId: string): Promise<TimeEntry[]> {
    const rows = await databaseService.query<TimeEntryRow>(
      'SELECT * FROM time_entries WHERE task_id = ? ORDER BY date DESC',
      [taskId],
    );
    return rows.map(rowToDTO);
  }

  async getByProject(projectId: string, startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    let sql = 'SELECT * FROM time_entries WHERE project_id = ?';
    const params: any[] = [projectId];
    if (startDate) { sql += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND date <= ?'; params.push(endDate); }
    sql += ' ORDER BY date DESC';
    const rows = await databaseService.query<TimeEntryRow>(sql, params);
    return rows.map(rowToDTO);
  }

  async getWeeklyTimesheet(userId: string, weekStart: string): Promise<{
    entries: TimeEntry[];
    days: string[];
    totalHours: number;
  }> {
    const start = new Date(weekStart);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    const endDate = days[6];

    const rows = await databaseService.query<TimeEntryRow>(
      'SELECT * FROM time_entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, task_id',
      [userId, weekStart, endDate],
    );
    const entries = rows.map(rowToDTO);
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    return { entries, days, totalHours };
  }

  async getActualVsEstimated(scheduleId: string): Promise<{
    tasks: Array<{
      taskId: string;
      taskName: string;
      estimatedHours: number;
      actualHours: number;
    }>;
  }> {
    const tasks = await this.scheduleService.findTasksByScheduleId(scheduleId);

    // Get actual hours per task
    const rows = await databaseService.query<{ task_id: string; total: number }>(
      'SELECT task_id, SUM(hours) as total FROM time_entries WHERE schedule_id = ? GROUP BY task_id',
      [scheduleId],
    );
    const actualMap = new Map(rows.map(r => [r.task_id, Number(r.total)]));

    return {
      tasks: tasks.map(t => ({
        taskId: t.id,
        taskName: t.name,
        estimatedHours: (t.estimatedDays || 0) * 8,
        actualHours: actualMap.get(t.id) || 0,
      })),
    };
  }
}

export const timeEntryService = new TimeEntryService();
