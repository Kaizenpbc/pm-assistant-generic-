import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, AlertTriangle, PieChart } from 'lucide-react';
import { apiService } from '../../services/api';
import { AISummaryBanner } from '../../components/dashboard/AISummaryBanner';

export function FinanceDashboard() {
  const { isLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => apiService.getAnalyticsSummary(),
    staleTime: 120000,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => apiService.getProjects(),
    staleTime: 60000,
  });

  const projects = projectsData?.projects || [];
  // Compute budget stats from projects
  const budgetStats = projects.reduce((acc: any, p: any) => {
    const allocated = p.budgetAllocated || 0;
    const spent = p.budgetSpent || 0;
    acc.totalAllocated += allocated;
    acc.totalSpent += spent;
    if (allocated > 0 && spent > allocated) acc.overBudget++;
    else if (allocated > 0) acc.onTrack++;
    return acc;
  }, { totalAllocated: 0, totalSpent: 0, overBudget: 0, onTrack: 0 });

  const utilizationPct = budgetStats.totalAllocated > 0
    ? Math.round((budgetStats.totalSpent / budgetStats.totalAllocated) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance Dashboard</h1>
      </div>

      <AISummaryBanner />

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Budget</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${(budgetStats.totalAllocated / 1000).toFixed(0)}k
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Spent</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${(budgetStats.totalSpent / 1000).toFixed(0)}k
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30">
              <PieChart className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Utilization</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{utilizationPct}%</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Over Budget</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{budgetStats.overBudget}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Budget Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Budgets</h2>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />)}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-gray-500">No projects found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Allocated</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Spent</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Variance</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {projects
                  .filter((p: any) => p.budgetAllocated && p.budgetAllocated > 0)
                  .map((p: any) => {
                    const allocated = p.budgetAllocated || 0;
                    const spent = p.budgetSpent || 0;
                    const variance = allocated - spent;
                    const isOver = variance < 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">${allocated.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">${spent.toLocaleString()}</td>
                        <td className={`py-2 px-3 text-right font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                          {isOver ? '-' : '+'}${Math.abs(variance).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isOver ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {isOver ? 'Over Budget' : 'On Track'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
