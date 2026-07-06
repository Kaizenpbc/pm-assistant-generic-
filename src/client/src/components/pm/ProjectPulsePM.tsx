import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import type { ProjectSummaryPM } from '../../types/pm';

interface ProjectPulsePMProps {
  projects: ProjectSummaryPM[];
}

function HealthDot({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${color}`} />;
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Active',    cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    planning:  { label: 'Planning', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    on_hold:   { label: 'On Hold',  cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    completed: { label: 'Done',     cls: 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
    cancelled: { label: 'Cancelled',cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  };
  const cfg = config[status] || { label: status, cls: 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
  );
}

export function ProjectPulsePM({ projects }: ProjectPulsePMProps) {
  const navigate = useNavigate();

  // Sort by lowest health score (most attention needed first), take top 5
  const sorted = [...projects]
    .sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100))
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Project Pulse</h3>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No projects</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map(project => {
            const progress = project.progress ?? 0;
            const barColor = progress >= 75 ? 'bg-green-500' : progress >= 40 ? 'bg-primary-500' : 'bg-amber-500';

            return (
              <li
                key={project.id}
                onClick={() => navigate(`/project/${project.id}/pm`)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg px-2 py-2 transition-colors"
              >
                {/* Top row: name + status */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{project.name}</span>
                  <StatusPill status={project.status} />
                </div>

                {/* Health + progress bar */}
                <div className="flex items-center gap-2">
                  <HealthDot score={project.healthScore ?? 0} />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 w-6 flex-shrink-0">
                    {project.healthScore ?? '--'}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-600">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-7 text-right flex-shrink-0">{progress}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
