import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Shield, DollarSign, TrendingUp } from 'lucide-react';
import { apiService } from '../../services/api';

function SkeletonBanner() {
  return (
    <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-5 w-5 rounded bg-indigo-200" />
        <div className="h-4 w-40 rounded bg-indigo-200" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-indigo-200" />
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-indigo-200" />
            <div className="h-3 w-16 rounded bg-indigo-100" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-indigo-200" />
          <div className="flex gap-2">
            <div className="h-5 w-12 rounded-full bg-indigo-200" />
            <div className="h-5 w-12 rounded-full bg-indigo-200" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-indigo-200" />
          <div className="h-4 w-32 rounded bg-indigo-200" />
        </div>
      </div>
    </div>
  );
}

function getHealthColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getHealthBgColor(score: number): string {
  if (score >= 75) return 'bg-green-100 border-green-300';
  if (score >= 50) return 'bg-yellow-100 border-yellow-300';
  return 'bg-red-100 border-red-300';
}

export function AISummaryBanner() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-predictions'],
    queryFn: () => apiService.getDashboardPredictions(),
    staleTime: 60000,
  });

  if (isLoading) {
    return <SkeletonBanner />;
  }

  if (isError || !data?.data) {
    return null;
  }

  const pred = data.data;

  // Adapt to actual API shape
  const risks = pred.risks || { critical: 0, high: 0, medium: 0, low: 0 };
  const budget = pred.budget || {};
  const highlights: Array<{ text: string; type?: string }> = pred.highlights || [];
  const summary: string = pred.summary || '';
  const projectHealthScores: Array<{ projectId: string; healthScore: number; riskLevel: string }> = pred.projectHealthScores || [];

  // Compute an average portfolio health score from project scores
  const portfolioHealthScore = projectHealthScores.length > 0
    ? Math.round(projectHealthScores.reduce((sum: number, p: any) => sum + (p.healthScore || 0), 0) / projectHealthScores.length)
    : 50;

  return (
    <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-5">
      {/* Title row */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-indigo-700">AI Portfolio Intelligence</h2>
        {data.aiPowered && (
          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">AI</span>
        )}
      </div>

      {/* Main content: 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Health Score */}
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${getHealthBgColor(portfolioHealthScore)}`}
          >
            <span className={`text-xl font-bold ${getHealthColor(portfolioHealthScore)}`}>
              {portfolioHealthScore}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Portfolio Health
            </p>
            <p className={`text-sm font-semibold ${getHealthColor(portfolioHealthScore)}`}>
              {portfolioHealthScore >= 75
                ? 'Good'
                : portfolioHealthScore >= 50
                  ? 'Fair'
                  : 'At Risk'}
            </p>
          </div>
        </div>

        {/* Middle: Risk Summary */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Risk Summary
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {risks.critical > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {risks.critical} Critical
              </span>
            )}
            {risks.high > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {risks.high} High
              </span>
            )}
            {risks.medium > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                {risks.medium} Medium
              </span>
            )}
            {risks.low > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {risks.low} Low
              </span>
            )}
            {risks.critical === 0 && risks.high === 0 && risks.medium === 0 && risks.low === 0 && (
              <span className="text-xs text-gray-400">No active risks</span>
            )}
          </div>
        </div>

        {/* Right: Budget Overview */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Budget Status
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">
              {budget.onTrack || 0} on track
              {budget.overBudget > 0 && (
                <span className="text-red-500 ml-2">
                  {budget.overBudget} over budget
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Summary + Highlights */}
      {(summary || highlights.length > 0) && (
        <div className="mt-4 border-t border-indigo-100 pt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
            <p className="text-xs font-medium text-indigo-600">Key Insights</p>
          </div>
          {summary && (
            <p className="text-xs text-gray-600 mb-1">{summary}</p>
          )}
          {highlights.length > 0 && (
            <ul className="space-y-1">
              {highlights.slice(0, 3).map((h, idx) => (
                <li key={idx} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-indigo-300 flex-shrink-0" />
                  {typeof h === 'string' ? h : h.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
