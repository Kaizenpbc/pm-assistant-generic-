import React from 'react';
import { User, FolderKanban, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface PMSummaryCardProps {
  userId: string;
  fullName: string;
  email: string;
  projectCount: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  totalBudget: number;
  totalSpent: number;
  onClick: () => void;
}

export const PMSummaryCard: React.FC<PMSummaryCardProps> = ({
  fullName,
  email,
  projectCount,
  onTrack,
  atRisk,
  delayed,
  totalBudget,
  totalSpent,
  onClick,
}) => {
  const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-lg hover:border-indigo-300 transition-all duration-200 w-full group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      aria-label={`PM: ${fullName}. ${projectCount} projects. ${onTrack} on track, ${atRisk} at risk, ${delayed} delayed.`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
          <span className="text-base font-semibold text-indigo-600">{initials}</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-base">{fullName}</h3>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {/* Projects count */}
      <div className="flex items-center gap-2 mb-3">
        <FolderKanban className="w-4 h-4 text-gray-400" aria-hidden="true" />
        <span className="text-sm text-gray-600">{projectCount} Projects</span>
      </div>

      {/* Status Pills (WCAG 1.4.1 - not color-only, includes text labels + icons) */}
      <div className="flex gap-2 mb-3">
        <span className="inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full bg-green-50 text-green-700">
          <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" /> {onTrack} On Track
        </span>
        <span className="inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {atRisk} At Risk
        </span>
        <span className="inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full bg-red-50 text-red-700">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {delayed} Delayed
        </span>
      </div>

      {/* Budget Bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>Budget</span>
          <span>${(totalSpent / 1e6).toFixed(1)}M / ${(totalBudget / 1e6).toFixed(1)}M ({budgetPct}%)</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${budgetPct > 90 ? 'bg-red-500' : budgetPct > 75 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
};
