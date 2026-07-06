import { Plus, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';

interface TaskListPMProps {
  tasks: any[];
  onAdd?: () => void;
}

function statusDotColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done') return 'text-green-500';
  if (s === 'in-progress' || s === 'in progress') return 'text-blue-500';
  if (s === 'overdue') return 'text-red-500';
  if (s === 'blocked') return 'text-red-400';
  return 'text-gray-300 dark:text-gray-600';
}

function StatusIcon({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const cls = `w-4 h-4 flex-shrink-0 ${statusDotColor(status)}`;
  if (s === 'completed' || s === 'done') return <CheckCircle2 className={cls} />;
  if (s === 'overdue' || s === 'blocked') return <AlertCircle className={cls} />;
  if (s === 'in-progress' || s === 'in progress') return <Clock className={cls} />;
  return <Circle className={cls} />;
}

function priorityTagColor(priority: string): string {
  const p = (priority || '').toLowerCase();
  if (p === 'critical') return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (p === 'high') return 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
  if (p === 'medium') return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function TaskListPM({ tasks, onAdd }: TaskListPMProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tasks</h3>
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {tasks.length}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        )}
      </div>

      {/* List */}
      {tasks.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">No tasks yet</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {tasks.map((task: any) => {
            const taskName: string = task.name || task.taskName || 'Untitled Task';
            const status: string = task.status || '';
            const priority: string = task.priority || '';
            const assignee: string = task.assignedTo || task.assignee || '';
            const endDate: string = task.endDate || task.plannedEndDate || '';

            return (
              <li
                key={task.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-default"
              >
                <StatusIcon status={status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{taskName}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {assignee && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{assignee}</span>
                    )}
                    {endDate && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatDate(endDate)}</span>
                    )}
                  </div>
                </div>
                {priority && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${priorityTagColor(priority)}`}>
                    {priority}
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
