import { useQuery } from '@tanstack/react-query';
import { Activity, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import { apiService } from '../../services/api';
import { AISummaryBanner } from '../../components/dashboard/AISummaryBanner';
import { AgentProposalsWidget } from '../../components/dashboard/widgets/AgentProposalsWidget';

export function ScrumMasterDashboard() {
  // Fetch projects first, then sprints for each project
  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-sprints'],
    queryFn: () => apiService.getProjects(),
    staleTime: 60000,
  });

  const projectIds: string[] = (projectsData?.data || projectsData?.projects || []).map((p: any) => p.id);

  const { data: sprintsData, isLoading: sprintsLoading } = useQuery({
    queryKey: ['all-sprints', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return { sprints: [] };
      const results = await Promise.all(
        projectIds.slice(0, 10).map(pid => apiService.getSprints(pid).catch(() => ({ data: [] })))
      );
      const allSprints = results.flatMap(r => r?.data || r?.sprints || []);
      return { sprints: allSprints };
    },
    staleTime: 60000,
    enabled: projectIds.length > 0,
  });

  const sprints = (sprintsData?.sprints || []).filter((s: any) => s.status === 'active');
  const velocity = { average: null as number | null, history: [] as any[] };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scrum Master Dashboard</h1>
      </div>

      <AISummaryBanner />

      {/* Sprint Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30">
              <Activity className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active Sprints</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{sprints.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Velocity</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {velocity?.average ? Math.round(velocity.average) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Blocked Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {sprints.reduce((sum: number, s: any) => sum + (s.blockedCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sprints */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          Active Sprints
        </h2>
        {sprintsLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded" />)}
          </div>
        ) : sprints.length === 0 ? (
          <p className="text-sm text-gray-500">No active sprints</p>
        ) : (
          <div className="space-y-3">
            {sprints.map((sprint: any) => {
              const total = (sprint.totalTasks || 0);
              const done = (sprint.completedTasks || 0);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={sprint.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{sprint.name}</h3>
                    <span className="text-xs text-gray-500">{done}/{total} tasks</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{pct}% complete</span>
                    {sprint.endDate && (
                      <span>Ends: {new Date(sprint.endDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agent Proposals */}
      <AgentProposalsWidget agentIds={['auto-reschedule-v1', 'scope-creep-detection-v1']} />

      {/* Velocity Trend */}
      {velocity?.history && velocity.history.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-gray-400" />
            Velocity History
          </h2>
          <div className="flex items-end gap-2 h-32">
            {velocity.history.slice(-8).map((v: any, idx: number) => {
              const max = Math.max(...velocity.history.map((h: any) => h.points || 0));
              const height = max > 0 ? ((v.points || 0) / max) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary-200 dark:bg-primary-800 rounded-t"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <span className="text-[10px] text-gray-400">{v.points || 0}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
