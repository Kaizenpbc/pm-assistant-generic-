import { useNavigate } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import type { ProjectRow } from '../ProjectTable';

interface Props {
  projects: ProjectRow[];
}

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function BudgetWatchWidget({ projects }: Props) {
  const navigate = useNavigate();

  const withBudget = projects
    .filter(p => (p.budgetAllocated ?? 0) > 0)
    .map(p => ({
      ...p,
      spentPct: Math.round(((p.budgetSpent ?? 0) / p.budgetAllocated!) * 100),
    }))
    .sort((a, b) => b.spentPct - a.spentPct)
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Budget Watch</h3>
      </div>

      {withBudget.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No projects with budgets</p>
      ) : (
        <ul className="space-y-3">
          {withBudget.map((p) => {
            const barColor = p.spentPct > 100 ? 'bg-red-500' : p.spentPct > 80 ? 'bg-amber-500' : 'bg-green-500';
            return (
              <li
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${p.spentPct > 100 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : p.spentPct > 80 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {p.spentPct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-600">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(p.spentPct, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDollar(p.budgetSpent ?? 0)} / {formatDollar(p.budgetAllocated!)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
