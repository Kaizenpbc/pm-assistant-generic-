import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingDown, Clock } from 'lucide-react';
import { apiService } from '../../services/api';

interface InsightTile {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
}

function buildInsights(analytics: any): InsightTile[] {
  const tiles: InsightTile[] = [];

  const atRisk: any[] = analytics?.portfolio?.atRiskProjects ?? [];
  if (atRisk.length > 0) {
    tiles.push({
      icon: AlertTriangle,
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-50 dark:bg-red-900/30',
      title: `${atRisk.length} project${atRisk.length > 1 ? 's' : ''} at risk`,
      body: atRisk
        .slice(0, 3)
        .map((p: any) => p.name || p.projectName || 'Unknown')
        .join(', ') + (atRisk.length > 3 ? ` and ${atRisk.length - 3} more` : ''),
    });
  } else {
    const healthTrends = analytics?.trendIndicators;
    tiles.push({
      icon: AlertTriangle,
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-50 dark:bg-green-900/30',
      title: 'No projects at risk',
      body: 'All projects are within healthy thresholds.' + (healthTrends?.healthTrend === 'improving' ? ' Portfolio health is trending up.' : ''),
    });
  }

  const allocated: number = analytics?.budget?.totalAllocated ?? 0;
  const spent: number = analytics?.budget?.totalSpent ?? 0;
  const utilization: number = analytics?.budget?.utilizationPercent ?? 0;
  if (utilization > 90) {
    const overrun = spent - allocated;
    tiles.push({
      icon: TrendingDown,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-900/30',
      title: `Budget utilization at ${Math.round(utilization)}%`,
      body:
        overrun > 0
          ? `Portfolio is over budget by $${(overrun / 1000).toFixed(0)}K. Review spend immediately.`
          : `Approaching budget ceiling. $${((allocated - spent) / 1000).toFixed(0)}K remaining across all projects.`,
    });
  } else {
    tiles.push({
      icon: TrendingDown,
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-50 dark:bg-teal-900/30',
      title: `Budget utilization at ${Math.round(utilization)}%`,
      body: `Portfolio has $${((allocated - spent) / 1000).toFixed(0)}K remaining. On track.`,
    });
  }

  const overdueTasks: number = analytics?.tasks?.overdue ?? 0;
  const trends = analytics?.trendIndicators;
  const overdueTrendText = trends?.overdueTasksTrend === 'improving'
    ? ' Trending down from last week.'
    : trends?.overdueTasksTrend === 'declining'
    ? ' Up from last week.'
    : '';
  tiles.push({
    icon: Clock,
    iconColor:
      overdueTasks === 0
        ? 'text-green-600 dark:text-green-400'
        : overdueTasks <= 5
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400',
    iconBg:
      overdueTasks === 0
        ? 'bg-green-50 dark:bg-green-900/30'
        : overdueTasks <= 5
        ? 'bg-amber-50 dark:bg-amber-900/30'
        : 'bg-red-50 dark:bg-red-900/30',
    title: overdueTasks === 0 ? 'Schedule on track' : `${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''}`,
    body:
      overdueTasks === 0
        ? 'No overdue tasks across the portfolio.' + (trends?.completionRateTrend === 'improving' ? ' Completion rate is trending up.' : '')
        : `${overdueTasks} task${overdueTasks > 1 ? 's are' : ' is'} past due date.${overdueTrendText} Review schedules and re-assign if needed.`,
  });

  return tiles;
}

export function AiPortfolioInsightsPM() {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['pm-analytics-portfolio'],
    queryFn: () => apiService.getAnalyticsSummary(),
    staleTime: 120_000,
  });

  const analytics = analyticsData?.summary || analyticsData?.data || analyticsData;
  const tiles = isLoading ? [] : buildInsights(analytics);

  return (
    <div className="rounded-xl border border-teal-100 dark:border-teal-900/40 bg-gradient-to-br from-teal-50/60 via-white to-white dark:from-teal-950/20 dark:via-gray-800 dark:to-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-teal-500 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Portfolio Intelligence</h3>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 uppercase tracking-wide">
          AI
        </span>
      </div>

      {/* Tiles */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tiles.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <div
                key={i}
                className="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${tile.iconBg}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${tile.iconColor}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">
                      {tile.title}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {tile.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
