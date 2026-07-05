import { databaseService } from './connection';

export interface ProjectRow {
  id: string;
  name: string;
  status: string;
  budget_allocated: number | null;
  budget_spent: number | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  progress: number | null;
}

class AnalyticsSummaryRepository {
  async findProjects(condition: string, params: unknown[]): Promise<ProjectRow[]> {
    return databaseService.query<ProjectRow>(
      `SELECT id, name, status,
              COALESCE(budget_allocated, 0) AS budget_allocated,
              COALESCE(budget_spent, 0)     AS budget_spent,
              start_date, end_date, 0 AS progress
       FROM projects p
       WHERE ${condition}`,
      params,
    );
  }

  async getTaskStatusCounts(projectIds: string[]): Promise<Array<{ status: string; cnt: number }>> {
    const placeholders = projectIds.map(() => '?').join(',');
    return databaseService.query<{ status: string; cnt: number }>(
      `SELECT st.status, COUNT(*) AS cnt
       FROM tasks st
       JOIN schedules s ON s.id = st.schedule_id
       WHERE s.project_id IN (${placeholders})
       GROUP BY st.status`,
      [...projectIds],
    );
  }

  async getOverdueCount(projectIds: string[]): Promise<number> {
    const placeholders = projectIds.map(() => '?').join(',');
    const rows = await databaseService.query<{ overdue_count: number }>(
      `SELECT COUNT(*) AS overdue_count
       FROM tasks st
       JOIN schedules s ON s.id = st.schedule_id
       WHERE s.project_id IN (${placeholders})
         AND st.status NOT IN ('completed','done','cancelled')
         AND st.end_date < NOW()`,
      [...projectIds],
    );
    return Number(rows[0]?.overdue_count) || 0;
  }

  async getCompletedLast30Days(projectIds: string[]): Promise<number> {
    const placeholders = projectIds.map(() => '?').join(',');
    const rows = await databaseService.query<{ completed_count: number }>(
      `SELECT COUNT(*) AS completed_count
       FROM tasks st
       JOIN schedules s ON s.id = st.schedule_id
       WHERE s.project_id IN (${placeholders})
         AND st.status IN ('completed','done')
         AND st.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [...projectIds],
    );
    return Number(rows[0]?.completed_count) || 0;
  }

  async getWeeklyCompletionTrends(projectIds: string[]): Promise<Array<{ week_label: string; cnt: number }>> {
    const placeholders = projectIds.map(() => '?').join(',');
    return databaseService.query<{ week_label: string; cnt: number }>(
      `SELECT DATE_FORMAT(
                DATE_SUB(st.updated_at, INTERVAL (WEEKDAY(st.updated_at)) DAY),
                '%Y-%m-%d'
              ) AS week_label,
              COUNT(*) AS cnt
       FROM tasks st
       JOIN schedules s ON s.id = st.schedule_id
       WHERE s.project_id IN (${placeholders})
         AND st.status IN ('completed','done')
         AND st.updated_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
       GROUP BY week_label
       ORDER BY week_label`,
      [...projectIds],
    );
  }
}

export const analyticsSummaryRepository = new AnalyticsSummaryRepository();
