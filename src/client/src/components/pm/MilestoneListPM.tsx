import { Plus, Flag, CheckCircle2, Clock } from 'lucide-react';

interface MilestoneListPMProps {
  milestones: any[];
  onAdd?: () => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  try {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function statusTagColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done') return 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  if (s === 'overdue') return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (s === 'at-risk' || s === 'at risk') return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
  return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
}

function MilestoneIcon({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done')
    return <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-500" />;
  if (s === 'overdue')
    return <Clock className="w-4 h-4 flex-shrink-0 text-red-500" />;
  return <Flag className="w-4 h-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />;
}

export function MilestoneListPM({ milestones, onAdd }: MilestoneListPMProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Milestones</h3>
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {milestones.length}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Milestone
          </button>
        )}
      </div>

      {/* List */}
      {milestones.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">No milestones yet</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {milestones.map((ms: any) => {
            const name: string = ms.name || ms.milestoneName || ms.taskName || 'Untitled Milestone';
            const dueDate: string = ms.dueDate || ms.endDate || ms.plannedEndDate || '';
            const status: string = ms.status || '';
            const days = daysUntil(dueDate);

            return (
              <li
                key={ms.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-default"
              >
                <MilestoneIcon status={status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {dueDate && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatDate(dueDate)}</span>
                    )}
                    {days !== null && (
                      <span
                        className={`text-[11px] font-medium ${
                          days < 0
                            ? 'text-red-500'
                            : days <= 7
                            ? 'text-amber-500'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d away`}
                      </span>
                    )}
                  </div>
                </div>
                {status && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${statusTagColor(status)}`}>
                    {status}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
