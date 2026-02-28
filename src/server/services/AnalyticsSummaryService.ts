import { databaseService } from '../database/connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsSummary {
  portfolio: {
    totalProjects: number;
    byStatus: Record<string, number>;
    avgProgress: number;
    atRiskProjects: Array<{ id: string; name: string; reason: string }>;
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    overdue: number;
    completedLast30Days: number;
  };
  budget: {
    totalAllocated: number;
    totalSpent: number;
    utilizationPercent: number;
    projectsOverBudget: Array<{ id: string; name: string; overrunPercent: number }>;
  };
  trends: {
    tasksCompletedByWeek: Array<{ week: string; count: number }>;
  };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Row helpers (snake_case DB rows)
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  budget_allocated: number | null;
  budget_spent: number | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  progress: number | null;
}

interface StatusCountRow {
  status: string;
  cnt: number;
}

interface TaskStatusRow {
  status: string;
  cnt: number;
}

interface OverdueRow {
  overdue_count: number;
}

interface CompletedRecentRow {
  completed_count: number;
}

interface WeekRow {
  week_label: string;
  cnt: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class AnalyticsSummaryService {
  // -----------------------------------------------------------------------
  // Full portfolio summary for a user
  // -----------------------------------------------------------------------
  async getSummary(userId: string): Promise<AnalyticsSummary> {
    const projectCondition = `(p.created_by = ?)`;
    const projectParams: any[] = [userId];

    return this.buildSummary(projectCondition, projectParams);
  }

  // -----------------------------------------------------------------------
  // Single-project summary
  // -----------------------------------------------------------------------
  async getProjectSummary(projectId: string): Promise<AnalyticsSummary> {
    const projectCondition = `(p.id = ?)`;
    const projectParams: any[] = [projectId];

    return this.buildSummary(projectCondition, projectParams);
  }

  // -----------------------------------------------------------------------
  // Shared builder
  // -----------------------------------------------------------------------
  private async buildSummary(
    projectCondition: string,
    projectParams: any[],
  ): Promise<AnalyticsSummary> {
    // 1. Fetch matching projects
    const projects = await databaseService.query<ProjectRow>(
      `SELECT id, name, status,
              COALESCE(budget_allocated, 0) AS budget_allocated,
              COALESCE(budget_spent, 0)     AS budget_spent,
              start_date, end_date, 0 AS progress
       FROM projects p
       WHERE ${projectCondition}`,
      projectParams,
    );

    // 2. Portfolio stats
    const byStatus: Record<string, number> = {};
    let totalAllocated = 0;
    let totalSpent = 0;
    const atRiskProjects: Array<{ id: string; name: string; reason: string }> = [];
    const overBudgetProjects: Array<{ id: string; name: string; overrunPercent: number }> = [];

    const projectIds = projects.map((p) => p.id);

    for (const p of projects) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;

      const allocated = Number(p.budget_allocated) || 0;
      const spent = Number(p.budget_spent) || 0;
      totalAllocated += allocated;
      totalSpent += spent;

      // At-risk: budget utilisation > 80 %
      if (allocated > 0 && spent / allocated > 0.8) {
        atRiskProjects.push({
          id: p.id,
          name: p.name,
          reason: `Budget utilisation at ${((spent / allocated) * 100).toFixed(0)}%`,
        });
      }

      // Also at-risk: behind schedule (progress < expected based on timeline)
      if (p.start_date && p.end_date) {
        const start = new Date(p.start_date).getTime();
        const end = new Date(p.end_date).getTime();
        const now = Date.now();
        if (end > start && now > start) {
          const elapsed = Math.min(1, (now - start) / (end - start));
          const actualProgress = Number(p.progress) || 0;
          if (elapsed > 0.3 && actualProgress < elapsed * 100 - 20) {
            // Only flag if not already flagged for budget
            if (!atRiskProjects.find((r) => r.id === p.id)) {
              atRiskProjects.push({
                id: p.id,
                name: p.name,
                reason: `Progress ${actualProgress.toFixed(0)}% vs expected ${(elapsed * 100).toFixed(0)}%`,
              });
            }
          }
        }
      }

      // Over budget
      if (allocated > 0 && spent > allocated) {
        overBudgetProjects.push({
          id: p.id,
          name: p.name,
          overrunPercent: Math.round(((spent - allocated) / allocated) * 100),
        });
      }
    }

    const utilizationPercent =
      totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

    // 3. Task stats — only for projects that belong to this user
    let tasksByStatus: Record<string, number> = {};
    let totalTasks = 0;
    let overdueCount = 0;
    let completedLast30 = 0;
    let weeklyTrends: Array<{ week: string; count: number }> = [];

    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',');

      // Tasks by status
      const taskStatusRows = await databaseService.query<TaskStatusRow>(
        `SELECT st.status, COUNT(*) AS cnt
         FROM schedule_tasks st
         JOIN schedules s ON s.id = st.schedule_id
         WHERE s.project_id IN (${placeholders})
         GROUP BY st.status`,
        [...projectIds],
      );
      for (const row of taskStatusRows) {
        tasksByStatus[row.status] = Number(row.cnt);
        totalTasks += Number(row.cnt);
      }

      // Overdue tasks
      const overdueRows = await databaseService.query<OverdueRow>(
        `SELECT COUNT(*) AS overdue_count
         FROM schedule_tasks st
         JOIN schedules s ON s.id = st.schedule_id
         WHERE s.project_id IN (${placeholders})
           AND st.status NOT IN ('completed','done','cancelled')
           AND st.end_date < NOW()`,
        [...projectIds],
      );
      overdueCount = Number(overdueRows[0]?.overdue_count) || 0;

      // Completed in last 30 days
      const completedRows = await databaseService.query<CompletedRecentRow>(
        `SELECT COUNT(*) AS completed_count
         FROM schedule_tasks st
         JOIN schedules s ON s.id = st.schedule_id
         WHERE s.project_id IN (${placeholders})
           AND st.status IN ('completed','done')
           AND st.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [...projectIds],
      );
      completedLast30 = Number(completedRows[0]?.completed_count) || 0;

      // Trends: tasks completed by week (last 12 weeks)
      const weekRows = await databaseService.query<WeekRow>(
        `SELECT DATE_FORMAT(
                  DATE_SUB(st.updated_at, INTERVAL (WEEKDAY(st.updated_at)) DAY),
                  '%Y-%m-%d'
                ) AS week_label,
                COUNT(*) AS cnt
         FROM schedule_tasks st
         JOIN schedules s ON s.id = st.schedule_id
         WHERE s.project_id IN (${placeholders})
           AND st.status IN ('completed','done')
           AND st.updated_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
         GROUP BY week_label
         ORDER BY week_label`,
        [...projectIds],
      );
      weeklyTrends = weekRows.map((r) => ({
        week: r.week_label,
        count: Number(r.cnt),
      }));
    }

    // Average progress — use task completion ratio as proxy
    const avgProgress =
      totalTasks > 0
        ? Math.round(
            (((tasksByStatus['completed'] || 0) + (tasksByStatus['done'] || 0)) / totalTasks) * 100,
          )
        : 0;

    return {
      portfolio: {
        totalProjects: projects.length,
        byStatus,
        avgProgress,
        atRiskProjects,
      },
      tasks: {
        total: totalTasks,
        byStatus: tasksByStatus,
        overdue: overdueCount,
        completedLast30Days: completedLast30,
      },
      budget: {
        totalAllocated,
        totalSpent,
        utilizationPercent,
        projectsOverBudget: overBudgetProjects,
      },
      trends: {
        tasksCompletedByWeek: weeklyTrends,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const analyticsSummaryService = new AnalyticsSummaryService();
