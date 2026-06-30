import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { reportBuilderService } from './ReportBuilderService';
import { emailService } from './EmailService';

export interface ReportSchedule {
  id: string;
  templateId: string;
  createdBy: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string[];
  format: 'csv';
  isActive: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReportScheduleRow {
  id: string;
  template_id: string;
  created_by: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  recipients: string;
  format: 'csv';
  is_active: boolean | number;
  next_run_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDTO(row: ReportScheduleRow): ReportSchedule {
  let recipients: string[] = [];
  try {
    recipients = typeof row.recipients === 'string' ? JSON.parse(row.recipients) : row.recipients;
  } catch { recipients = []; }

  return {
    id: row.id,
    templateId: row.template_id,
    createdBy: row.created_by,
    frequency: row.frequency,
    dayOfWeek: row.day_of_week,
    dayOfMonth: row.day_of_month,
    timeOfDay: row.time_of_day,
    recipients,
    format: row.format,
    isActive: !!row.is_active,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    lastRunError: row.last_run_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ReportScheduleService {
  async create(data: {
    templateId: string;
    createdBy: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    recipients: string[];
    isActive?: boolean;
  }): Promise<ReportSchedule> {
    const id = uuidv4();
    const timeOfDay = data.timeOfDay || '08:00';
    const nextRunAt = this.computeNextRun(data.frequency, data.dayOfWeek ?? null, data.dayOfMonth ?? null, timeOfDay);

    await databaseService.query(
      `INSERT INTO report_schedules (id, template_id, created_by, frequency, day_of_week, day_of_month, time_of_day, recipients, is_active, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.templateId,
        data.createdBy,
        data.frequency,
        data.dayOfWeek ?? null,
        data.dayOfMonth ?? null,
        timeOfDay,
        JSON.stringify(data.recipients),
        data.isActive !== false,
        nextRunAt,
      ],
    );

    return (await this.getById(id))!;
  }

  async getById(id: string): Promise<ReportSchedule | null> {
    const rows = await databaseService.query<ReportScheduleRow>(
      'SELECT * FROM report_schedules WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? rowToDTO(rows[0]) : null;
  }

  async listByUser(userId: string): Promise<ReportSchedule[]> {
    const rows = await databaseService.query<ReportScheduleRow>(
      'SELECT * FROM report_schedules WHERE created_by = ? ORDER BY created_at DESC',
      [userId],
    );
    return rows.map(rowToDTO);
  }

  async getByTemplateId(templateId: string): Promise<ReportSchedule[]> {
    const rows = await databaseService.query<ReportScheduleRow>(
      'SELECT * FROM report_schedules WHERE template_id = ?',
      [templateId],
    );
    return rows.map(rowToDTO);
  }

  async update(id: string, data: Partial<{
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    timeOfDay: string;
    recipients: string[];
    isActive: boolean;
  }>): Promise<ReportSchedule | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.frequency !== undefined) { fields.push('frequency = ?'); values.push(data.frequency); }
    if (data.dayOfWeek !== undefined) { fields.push('day_of_week = ?'); values.push(data.dayOfWeek); }
    if (data.dayOfMonth !== undefined) { fields.push('day_of_month = ?'); values.push(data.dayOfMonth); }
    if (data.timeOfDay !== undefined) { fields.push('time_of_day = ?'); values.push(data.timeOfDay); }
    if (data.recipients !== undefined) { fields.push('recipients = ?'); values.push(JSON.stringify(data.recipients)); }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive); }

    // Recompute next_run_at if schedule changed
    if (data.frequency !== undefined || data.dayOfWeek !== undefined || data.dayOfMonth !== undefined || data.timeOfDay !== undefined) {
      const current = await this.getById(id);
      if (current) {
        const freq = data.frequency ?? current.frequency;
        const dow = data.dayOfWeek !== undefined ? data.dayOfWeek : current.dayOfWeek;
        const dom = data.dayOfMonth !== undefined ? data.dayOfMonth : current.dayOfMonth;
        const tod = data.timeOfDay ?? current.timeOfDay;
        const nextRun = this.computeNextRun(freq, dow, dom, tod);
        fields.push('next_run_at = ?');
        values.push(nextRun);
      }
    }

    if (fields.length === 0) return this.getById(id);

    values.push(id);
    await databaseService.query(
      `UPDATE report_schedules SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    await databaseService.query('DELETE FROM report_schedules WHERE id = ?', [id]);
  }

  async getDueSchedules(): Promise<ReportSchedule[]> {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const rows = await databaseService.query<ReportScheduleRow>(
      'SELECT * FROM report_schedules WHERE is_active = TRUE AND next_run_at <= ?',
      [now],
    );
    return rows.map(rowToDTO);
  }

  async executeDueSchedules(): Promise<number> {
    const dueSchedules = await this.getDueSchedules();
    let executed = 0;

    for (const schedule of dueSchedules) {
      try {
        // Generate report
        const template = await reportBuilderService.getTemplateById(schedule.templateId);
        if (!template) {
          await this.updateRunStatus(schedule.id, 'error', 'Template not found');
          continue;
        }

        const { data: csvContent } = await reportBuilderService.exportReport(schedule.templateId, 'csv');

        // Send email
        await emailService.sendReportEmail(
          schedule.recipients,
          template.name,
          csvContent as string,
        );

        // Update status
        const nextRun = this.computeNextRun(
          schedule.frequency,
          schedule.dayOfWeek,
          schedule.dayOfMonth,
          schedule.timeOfDay,
        );
        await this.updateRunStatus(schedule.id, 'success', null, nextRun);
        executed++;
      } catch (err: any) {
        console.error(`[ReportScheduleService] Failed to execute schedule ${schedule.id}:`, err);
        const nextRun = this.computeNextRun(
          schedule.frequency,
          schedule.dayOfWeek,
          schedule.dayOfMonth,
          schedule.timeOfDay,
        );
        await this.updateRunStatus(schedule.id, 'error', err.message || 'Unknown error', nextRun);
      }
    }

    if (executed > 0) {
      console.log(`[ReportScheduleService] Executed ${executed} scheduled report(s)`);
    }

    return executed;
  }

  private async updateRunStatus(id: string, status: string, error: string | null, nextRunAt?: string): Promise<void> {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (nextRunAt) {
      await databaseService.query(
        `UPDATE report_schedules SET last_run_at = ?, last_run_status = ?, last_run_error = ?, next_run_at = ? WHERE id = ?`,
        [now, status, error, nextRunAt, id],
      );
    } else {
      await databaseService.query(
        `UPDATE report_schedules SET last_run_at = ?, last_run_status = ?, last_run_error = ? WHERE id = ?`,
        [now, status, error, id],
      );
    }
  }

  computeNextRun(
    frequency: 'daily' | 'weekly' | 'monthly',
    dayOfWeek: number | null,
    dayOfMonth: number | null,
    timeOfDay: string,
  ): string {
    const now = new Date();
    const [hours, minutes] = (timeOfDay || '08:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (frequency === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
      const targetDay = dayOfWeek ?? 1; // default Monday
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      next.setDate(next.getDate() + daysUntil);
    } else if (frequency === 'monthly') {
      const targetDate = dayOfMonth ?? 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDate);
      }
    }

    return next.toISOString().replace('T', ' ').substring(0, 19);
  }
}

export const reportScheduleService = new ReportScheduleService();
