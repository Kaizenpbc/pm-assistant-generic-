import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layers, DollarSign, TrendingUp, CheckCircle, AlertTriangle, FolderKanban, BarChart3, Users } from 'lucide-react';
import { apiService } from '../services/api';
import { GanttChart, type GanttTask } from '../components/schedule/GanttChart';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortfolioItem {
  projectId: string;
  projectName: string;
  status: string;
  priority: string;
  startDate?: string;
  endDate?: string;
  budgetAllocated: number;
  budgetSpent: number;
  progressPercentage: number;
  totalTasks: number;
  completedTasks: number;
  tasks: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    startDate?: string;
    endDate?: string;
    progressPercentage?: number;
    parentTaskId?: string;
    assignedTo?: string;
    dependency?: string;
    dependencyType?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  planning: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  on_hold: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  completed: { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function healthLabel(item: PortfolioItem): { label: string; color: string } {
  const budgetOk = !item.budgetAllocated || item.budgetSpent <= item.budgetAllocated;
  const now = Date.now();
  const start = item.startDate ? new Date(item.startDate).getTime() : now;
  const end = item.endDate ? new Date(item.endDate).getTime() : 0;
  const elapsed = end > start ? (now - start) / (end - start) : 0;
  const progress = (item.progressPercentage || 0) / 100;
  const scheduleOk = !end || elapsed <= 0 || progress >= elapsed - 0.2;

  if (budgetOk && scheduleOk) return { label: 'On Track', color: 'text-green-600' };
  if (!budgetOk && !scheduleOk) return { label: 'Critical', color: 'text-red-600' };
  return { label: 'At Risk', color: 'text-amber-600' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view, setView] = useState<'dashboard' | 'gantt' | 'resources'>('dashboard');

  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiService.getPortfolio(),
  });

  const portfolioItems: PortfolioItem[] = data?.portfolioItems || [];

  // Filtered items
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return portfolioItems;
    return portfolioItems.filter(p => p.status === statusFilter);
  }, [portfolioItems, statusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = portfolioItems.length;
    const active = portfolioItems.filter(p => p.status === 'active').length;
    const totalBudget = portfolioItems.reduce((s, p) => s + (p.budgetAllocated || 0), 0);
    const totalSpent = portfolioItems.reduce((s, p) => s + (p.budgetSpent || 0), 0);
    const totalTasks = portfolioItems.reduce((s, p) => s + p.totalTasks, 0);
    const completedTasks = portfolioItems.reduce((s, p) => s + p.completedTasks, 0);
    const avgProgress = total > 0 ? Math.round(portfolioItems.reduce((s, p) => s + p.progressPercentage, 0) / total) : 0;
    const onTrack = portfolioItems.filter(p => p.status === 'active' && healthLabel(p).label === 'On Track').length;
    const atRisk = portfolioItems.filter(p => p.status === 'active' && healthLabel(p).label !== 'On Track').length;
    return { total, active, totalBudget, totalSpent, totalTasks, completedTasks, avgProgress, onTrack, atRisk };
  }, [portfolioItems]);

  // Status breakdown
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of portfolioItems) counts[p.status] = (counts[p.status] || 0) + 1;
    return counts;
  }, [portfolioItems]);

  // Gantt tasks
  const ganttTasks: GanttTask[] = useMemo(() => {
    const tasks: GanttTask[] = [];
    for (const item of filtered) {
      const projectTaskId = `project-${item.projectId}`;
      let earliest = item.startDate;
      let latest = item.endDate;
      for (const t of item.tasks) {
        if (t.startDate && (!earliest || new Date(t.startDate) < new Date(earliest))) earliest = t.startDate;
        if (t.endDate && (!latest || new Date(t.endDate) > new Date(latest))) latest = t.endDate;
      }
      tasks.push({
        id: projectTaskId,
        name: item.projectName,
        status: item.status === 'active' ? 'in_progress' : item.status === 'planning' ? 'pending' : item.status,
        priority: item.priority,
        startDate: earliest ? new Date(earliest).toISOString() : undefined,
        endDate: latest ? new Date(latest).toISOString() : undefined,
        progressPercentage: item.progressPercentage,
      });
      for (const t of item.tasks) {
        if (!t.parentTaskId) {
          tasks.push({
            id: t.id, name: t.name, status: t.status, priority: t.priority,
            startDate: t.startDate ? new Date(t.startDate).toISOString() : undefined,
            endDate: t.endDate ? new Date(t.endDate).toISOString() : undefined,
            progressPercentage: t.progressPercentage, parentTaskId: projectTaskId,
            assignedTo: t.assignedTo, dependency: t.dependency, dependencyType: t.dependencyType,
          });
        }
      }
    }
    return tasks;
  }, [filtered]);

  const handleTaskClick = (task: GanttTask) => {
    if (task.id.startsWith('project-')) navigate(`/project/${task.id.replace('project-', '')}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load portfolio data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
            <Layers className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Portfolio Overview</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{kpis.total} projects &middot; {kpis.totalTasks} tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('dashboard')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === 'dashboard' ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
          >
            <BarChart3 className="w-3.5 h-3.5 inline mr-1" />Dashboard
          </button>
          <button
            onClick={() => setView('gantt')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === 'gantt' ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
          >
            <Layers className="w-3.5 h-3.5 inline mr-1" />Timeline
          </button>
          <button
            onClick={() => setView('resources')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === 'resources' ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1" />Resources
          </button>
        </div>
      </div>

      {portfolioItems.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
          <Layers className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No Projects</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No projects found in your portfolio.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard label="Total Projects" value={String(kpis.total)} icon={FolderKanban} color="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" />
            <KPICard label="Active" value={String(kpis.active)} icon={TrendingUp} color="bg-green-50 text-green-600" />
            <KPICard label="On Track" value={String(kpis.onTrack)} icon={CheckCircle} color="bg-emerald-50 text-emerald-600" />
            <KPICard label="At Risk" value={String(kpis.atRisk)} icon={AlertTriangle} color="bg-amber-50 text-amber-600" />
            <KPICard label="Budget" value={formatCurrency(kpis.totalBudget)} icon={DollarSign} color="bg-blue-50 text-blue-600" />
            <KPICard label="Spent" value={formatCurrency(kpis.totalSpent)} icon={DollarSign} color={kpis.totalSpent > kpis.totalBudget ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'} />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
            >
              All ({portfolioItems.length})
            </button>
            {Object.entries(statusCounts).map(([status, count]) => {
              const sc = STATUS_COLORS[status] || STATUS_COLORS.active;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors capitalize ${statusFilter === status ? `${sc.bg} ${sc.text} ring-2 ring-offset-1 ring-current` : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                >
                  {status.replace('_', ' ')} ({count})
                </button>
              );
            })}
          </div>

          {view === 'resources' ? (
            <PortfolioResourcesView />
          ) : view === 'dashboard' ? (
            <>
              {/* Budget Overview Bar */}
              {kpis.totalBudget > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Portfolio Budget</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(kpis.totalSpent)} of {formatCurrency(kpis.totalBudget)} ({kpis.totalBudget > 0 ? Math.round((kpis.totalSpent / kpis.totalBudget) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${kpis.totalSpent > kpis.totalBudget ? 'bg-red-500' : kpis.totalSpent > kpis.totalBudget * 0.9 ? 'bg-amber-500' : 'bg-primary-500'}`}
                      style={{ width: `${Math.min(100, kpis.totalBudget > 0 ? (kpis.totalSpent / kpis.totalBudget) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Project Cards */}
              <div className="space-y-3">
                {filtered.map(item => {
                  const health = healthLabel(item);
                  const budgetPct = item.budgetAllocated > 0 ? Math.round((item.budgetSpent / item.budgetAllocated) * 100) : 0;
                  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.active;
                  return (
                    <div
                      key={item.projectId}
                      onClick={() => navigate(`/project/${item.projectId}`)}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.projectName}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${sc.bg} ${sc.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>{item.completedTasks}/{item.totalTasks} tasks</span>
                            {item.budgetAllocated > 0 && <span>{formatCurrency(item.budgetSpent)} / {formatCurrency(item.budgetAllocated)}</span>}
                            {item.endDate && <span>Due {new Date(item.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-semibold ${health.color}`}>{health.label}</span>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{item.progressPercentage}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Progress bar */}
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${item.progressPercentage}%` }} />
                        </div>
                        {/* Budget bar (if applicable) */}
                        {item.budgetAllocated > 0 && (
                          <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden" title={`Budget: ${budgetPct}%`}>
                            <div
                              className={`h-full rounded-full ${budgetPct > 100 ? 'bg-red-500' : budgetPct > 90 ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(100, budgetPct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Gantt Timeline View */
            <GanttChart
              tasks={ganttTasks}
              scheduleName="Portfolio Timeline"
              onTaskClick={handleTaskClick}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portfolio Resources View
// ---------------------------------------------------------------------------

interface PortfolioResource {
  resourceId: string;
  resourceName: string;
  role: string;
  costRateHourly: number | null;
  projects: { projectId: string; projectName: string; averageUtilization: number }[];
  combinedUtilization: number;
  isOverAllocated: boolean;
}

interface PortfolioContention {
  resourceId: string;
  resourceName: string;
  role: string;
  projects: { projectId: string; projectName: string; averageUtilization: number }[];
  combinedUtilization: number;
}

interface PortfolioResourcesSummary {
  totalResources: number;
  overAllocatedCount: number;
  avgUtilization: number;
  totalWeeklyCost: number;
}

function PortfolioResourcesView() {
  const { data, isLoading } = useQuery({
    queryKey: ['portfolioResources'],
    queryFn: () => apiService.getPortfolioResources(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const resources: PortfolioResource[] = data?.resources || [];
  const contentions: PortfolioContention[] = data?.contentions || [];
  const summary: PortfolioResourcesSummary = data?.summary || { totalResources: 0, overAllocatedCount: 0, avgUtilization: 0, totalWeeklyCost: 0 };

  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
        <Users className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No Resource Data</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No resources are assigned across your projects.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Total Resources" value={String(summary.totalResources)} icon={Users} color="bg-blue-50 text-blue-600" />
        <KPICard label="Over-Allocated" value={String(summary.overAllocatedCount)} icon={AlertTriangle} color={summary.overAllocatedCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} />
        <KPICard label="Avg Utilization" value={`${summary.avgUtilization}%`} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
        <KPICard label="Weekly Cost" value={summary.totalWeeklyCost > 0 ? `$${summary.totalWeeklyCost.toLocaleString()}` : '--'} icon={DollarSign} color="bg-blue-50 text-blue-600" />
      </div>

      {/* Cross-project contention */}
      {contentions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Cross-Project Contention</h3>
            <span className="text-xs text-red-500">{contentions.length} resource{contentions.length !== 1 ? 's' : ''} over-allocated across projects</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Resource</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Role</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Projects</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Combined</th>
                </tr>
              </thead>
              <tbody>
                {contentions.map(c => (
                  <tr key={c.resourceId} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{c.resourceName}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{c.role}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.projects.map(p => (
                          <span key={p.projectId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {p.projectName} ({p.averageUtilization}%)
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white ${c.combinedUtilization > 150 ? 'bg-red-500' : 'bg-amber-500'}`}>
                        {c.combinedUtilization}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All resources table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resource Utilization</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Resource</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Role</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">$/hr</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-300"># Projects</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Utilization</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Projects</th>
              </tr>
            </thead>
            <tbody>
              {resources.map(r => (
                <tr key={r.resourceId} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.resourceName}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.role}</td>
                  <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">
                    {r.costRateHourly != null ? `$${r.costRateHourly.toFixed(0)}` : '--'}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">{r.projects.length}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                      r.combinedUtilization > 120 ? 'bg-red-500' : r.combinedUtilization > 100 ? 'bg-amber-500' : r.combinedUtilization > 80 ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {r.combinedUtilization}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {r.projects.map(p => p.projectName).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KPICard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
