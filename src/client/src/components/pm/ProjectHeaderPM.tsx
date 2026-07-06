import { Building2, User, Calendar, Layers } from 'lucide-react';

interface ProjectHeaderPMProps {
  project: any;
  healthScore: number;
  healthLabel: string;
}

function healthDotColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function healthPillColor(score: number): string {
  if (score >= 75)
    return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800';
  if (score >= 50)
    return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
  return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800';
}

function priorityPillColor(priority: string): string {
  const p = (priority || '').toLowerCase();
  if (p === 'critical') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
  if (p === 'high') return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300';
  if (p === 'medium') return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

function progressBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function ProjectHeaderPM({ project, healthScore, healthLabel }: ProjectHeaderPMProps) {
  const progress = Math.max(0, Math.min(100, Math.round(project?.progressPercentage ?? project?.progress ?? 0)));
  const priority: string = project?.priority ?? '';
  const client: string = project?.clientName ?? project?.client ?? '';
  const phase: string = project?.phase ?? project?.status ?? '';
  const pmName: string = project?.projectManagerName ?? project?.projectManager ?? '';
  const endDate: string = project?.endDate ?? project?.plannedEndDate ?? '';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        {/* Left: name + pills + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {project?.name ?? 'Unnamed Project'}
            </h1>
            {/* Health pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${healthPillColor(healthScore)}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthDotColor(healthScore)}`} />
              {healthLabel} · {healthScore}
            </span>
            {/* Priority pill */}
            {priority && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityPillColor(priority)}`}>
                {priority}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {client && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                {client}
              </span>
            )}
            {phase && (
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                {phase}
              </span>
            )}
            {pmName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                {pmName}
              </span>
            )}
            {endDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                Due {formatDate(endDate)}
              </span>
            )}
          </div>
        </div>

        {/* Right: big progress */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[120px]">
          <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{progress}%</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">Overall Progress</span>
          <div className="w-28 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressBarColor(healthScore)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
