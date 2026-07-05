import { analyticsSummaryRepository } from '../database/AnalyticsSummaryRepository';

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
    const projects = await analyticsSummaryRepository.findProjects(projectCondition, projectParams);

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
      // Tasks by status
      const taskStatusRows = await analyticsSummaryRepository.getTaskStatusCounts(projectIds);
      for (const row of taskStatusRows) {
        tasksByStatus[row.status] = Number(row.cnt);
        totalTasks += Number(row.cnt);
      }

      // Overdue tasks
      overdueCount = await analyticsSummaryRepository.getOverdueCount(projectIds);

      // Completed in last 30 days
      completedLast30 = await analyticsSummaryRepository.getCompletedLast30Days(projectIds);

      // Trends: tasks completed by week (last 12 weeks)
      const weekRows = await analyticsSummaryRepository.getWeeklyCompletionTrends(projectIds);
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
