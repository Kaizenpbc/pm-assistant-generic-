import { useQuery } from '@tanstack/react-query';
import { Plus, Target, Kanban } from 'lucide-react';
import { apiService } from '../../services/api';

interface Sprint {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  goal?: string;
  start_date?: string;
  end_date?: string;
  velocity_commitment?: number;
  velocity_actual?: number;
}

interface SprintListProps {
  projectId: string;
  onSelect: (sprintId: string) => void;
  onCreate: () => void;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Planning' },
  active: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Active' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Completed' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', label: 'Cancelled' },
};

function formatDate(s?: string): string {
  if (!s) return '--';
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '--';
  }
}

export function SprintList({ projectId, onSelect, onCreate }: SprintListProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => apiService.getSprints(projectId),
  });

  const sprints: Sprint[] = data?.sprints ?? data ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-100 rounded" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Failed to load sprints.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kanban className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-800">Sprints</h3>
          <span className="text-xs text-gray-400">({sprints.length})</span>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Sprint
        </button>
      </div>

      {/* Sprint cards */}
      {sprints.length === 0 ? (
        <div className="p-8 text-center">
          <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No sprints yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first sprint to start planning.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {sprints.map((sprint) => {
            const cfg = statusConfig[sprint.status] || statusConfig.planning;
            const isActive = sprint.status === 'active';

            return (
              <div
                key={sprint.id}
                onClick={() => onSelect(sprint.id)}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  isActive ? 'bg-blue-50/40 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{sprint.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    {sprint.goal && (
                      <p className="text-xs text-gray-500 truncate mb-1">{sprint.goal}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span>{formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}</span>
                    </div>
                  </div>

                  {/* Velocity */}
                  <div className="text-right flex-shrink-0">
                    {sprint.velocity_commitment != null && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                          {sprint.velocity_actual ?? '?'}
                        </span>
                        <span className="text-gray-400"> / {sprint.velocity_commitment} pts</span>
                      </div>
                    )}
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
