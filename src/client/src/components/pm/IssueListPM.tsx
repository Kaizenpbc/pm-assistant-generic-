import { Plus, AlertCircle, XCircle, MinusCircle } from 'lucide-react';

interface IssueListPMProps {
  issues: any[];
  onAdd?: () => void;
}

function SeverityIcon({ severity }: { severity: string }) {
  const s = (severity || '').toLowerCase();
  if (s === 'critical') return <XCircle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />;
  if (s === 'high') return <AlertCircle className="w-4 h-4 flex-shrink-0 text-orange-500 dark:text-orange-400" />;
  if (s === 'medium') return <MinusCircle className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400" />;
  return <MinusCircle className="w-4 h-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />;
}

function statusTagColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (s === 'in-progress' || s === 'in progress') return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
  if (s === 'resolved') return 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  if (s === 'closed') return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
}

export function IssueListPM({ issues, onAdd }: IssueListPMProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Issues</h3>
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {issues.length}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Issue
          </button>
        )}
      </div>

      {/* List */}
      {issues.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">No issues recorded</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {issues.map((issue: any) => {
            const title: string = issue.title || issue.issueTitle || issue.description || 'Untitled Issue';
            const severity: string = issue.severity || '';
            const status: string = issue.status || '';

            return (
              <li
                key={issue.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-default"
              >
                <SeverityIcon severity={severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{title}</p>
                  {severity && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 capitalize">{severity} severity</p>
                  )}
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
