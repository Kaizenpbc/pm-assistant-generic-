import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Shield, DollarSign, TrendingUp } from 'lucide-react';
import { apiService } from '../../services/api';

interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface BudgetOverview {
  totalAllocated: number;
  totalSpent: number;
  projectsOverBudget: number;
}

interface DashboardPredictions {
  portfolioHealthScore: number;
  riskSummary: RiskSummary;
  budgetOverview: BudgetOverview;
  highlights: string[];
  projectHealthScores: Array<{
    projectId: string;
    projectName: string;
    healthScore: number;
    riskLevel: string;
  }>;
}

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

  const predictions: DashboardPredictions = data.data;
  const {
    portfolioHealthScore,
    riskSummary,
    budgetOverview,
    highlights,
  } = predictions;

  const budgetPct =
    budgetOverview.totalAllocated > 0
      ? Math.round((budgetOverview.totalSpent / budgetOverview.totalAllocated) * 100)
      : 0;

  return (
    <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-5">
      {/* Title row */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-indigo-700">AI Portfolio Intelligence</h2>
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
            {riskSummary.critical > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {riskSummary.critical} Critical
              </span>
            )}
            {riskSummary.high > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {riskSummary.high} High
              </span>
            )}
            {riskSummary.medium > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                {riskSummary.medium} Medium
              </span>
            )}
            {riskSummary.low > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {riskSummary.low} Low
              </span>
            )}
            {riskSummary.critical === 0 &&
              riskSummary.high === 0 &&
              riskSummary.medium === 0 &&
              riskSummary.low === 0 && (
                <span className="text-xs text-gray-400">No active risks</span>
              )}
          </div>
        </div>

        {/* Right: Budget Overview */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Budget Overview
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              ${(budgetOverview.totalSpent / 1_000_000).toFixed(1)}M{' '}
              <span className="text-gray-400 font-normal">/</span>{' '}
              ${(budgetOverview.totalAllocated / 1_000_000).toFixed(1)}M
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetPct > 90 ? 'bg-red-500' : budgetPct > 75 ? 'bg-yellow-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-500">{budgetPct}%</span>
            </div>
            {budgetOverview.projectsOverBudget > 0 && (
              <p className="mt-1 text-[11px] text-red-500">
                {budgetOverview.projectsOverBudget} project
                {budgetOverview.projectsOverBudget > 1 ? 's' : ''} over budget
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Highlights */}
      {highlights && highlights.length > 0 && (
        <div className="mt-4 border-t border-indigo-100 pt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
            <p className="text-xs font-medium text-indigo-600">Key Insights</p>
          </div>
          <ul className="space-y-1">
            {highlights.slice(0, 3).map((highlight, idx) => (
              <li key={idx} className="text-xs text-gray-600 flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-indigo-300 flex-shrink-0" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
