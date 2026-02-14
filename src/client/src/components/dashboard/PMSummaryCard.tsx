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
      className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg hover:border-indigo-300 transition-all duration-200 w-full group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      aria-label={`PM: ${fullName}. ${projectCount} projects. ${onTrack} on track, ${atRisk} at risk, ${delayed} delayed.`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
          <span className="text-base font-semibold text-indigo-600">{initials}</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-base">{fullName}</h3>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {/* Projects count */}
      <div className="flex items-center gap-2 mb-4">
        <FolderKanban className="w-4 h-4 text-gray-400" aria-hidden="true" />
        <span className="text-sm text-gray-600">{projectCount} Projects</span>
      </div>

      {/* Status indicators — grid layout for consistent spacing (WCAG 1.4.1) */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="flex flex-col items-center rounded-lg bg-green-50 py-2 px-1">
          <TrendingUp className="w-4 h-4 text-green-600 mb-1" aria-hidden="true" />
          <span className="text-lg font-bold text-green-700">{onTrack}</span>
          <span className="text-xs text-green-600">On Track</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-yellow-50 py-2 px-1">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mb-1" aria-hidden="true" />
          <span className="text-lg font-bold text-yellow-700">{atRisk}</span>
          <span className="text-xs text-yellow-600">At Risk</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-red-50 py-2 px-1">
          <Clock className="w-4 h-4 text-red-600 mb-1" aria-hidden="true" />
          <span className="text-lg font-bold text-red-700">{delayed}</span>
          <span className="text-xs text-red-600">Delayed</span>
        </div>
      </div>

      {/* Budget Bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-500 mb-1.5">
          <span>Budget</span>
          <span className="font-medium">${(totalSpent / 1e6).toFixed(1)}M / ${(totalBudget / 1e6).toFixed(1)}M ({budgetPct}%)</span>
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
