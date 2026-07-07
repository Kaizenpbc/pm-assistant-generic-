import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IterationCw, Loader2 } from 'lucide-react';
import { apiService } from '../../../services/api';

interface Project {
  id: string;
  name: string;
}

interface Sprint {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  totalTasks?: number;
  completedTasks?: number;
}

interface VelocityPoint {
  sprintName: string;
  velocity: number;
}

interface Props {
  projects: Project[];
}

export function SprintSnapshotWidget({ projects }: Props) {
  const navigate = useNavigate();

  const sprintQueries = useQueries({
    queries: projects.slice(0, 10).map(p => ({
      queryKey: ['sprints', p.id, 'widget'],
      queryFn: () => apiService.getSprints(p.id),
      staleTime: 120_000,
    })),
  });

  const velocityQueries = useQueries({
    queries: projects.slice(0, 10).map(p => ({
      queryKey: ['velocity', p.id, 'widget'],
      queryFn: () => apiService.getVelocityHistory(p.id),
      staleTime: 120_000,
    })),
  });

  const isLoading = sprintQueries.some(q => q.isLoading);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <IterationCw className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sprint Snapshot</h3>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Collect active sprints across projects
  const rows: { project: Project; sprint: Sprint; velocity: number[] }[] = [];
  projects.slice(0, 10).forEach((p, i) => {
    const sprints: Sprint[] = sprintQueries[i]?.data?.sprints || sprintQueries[i]?.data || [];
    const activeSprint = sprints.find(s => s.status === 'active');
    if (!activeSprint) return;

    const velData: VelocityPoint[] = velocityQueries[i]?.data?.velocity || velocityQueries[i]?.data || [];
    const last3 = velData.slice(-3).map(v => v.velocity);

    rows.push({ project: p, sprint: activeSprint, velocity: last3 });
  });

  const displayRows = rows.slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <IterationCw className="h-4 w-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sprint Snapshot</h3>
      </div>

      {displayRows.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No active sprints</p>
      ) : (
        <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
          {displayRows.map(({ project, sprint, velocity }) => {
            const total = sprint.totalTasks || 0;
            const done = sprint.completedTasks || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            const start = new Date(sprint.startDate);
            const end = new Date(sprint.endDate);
            const now = new Date();
            const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
            const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000));
            const dayLabel = `Day ${Math.min(elapsed, totalDays)} of ${totalDays}`;

            return (
              <div
                key={sprint.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{project.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sprint.name} &middot; {dayLabel}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{done}/{total}</span>
                    {velocity.length > 0 && (
                      <p className="text-[10px] text-gray-400">vel: {velocity.join(', ')}</p>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-primary-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
