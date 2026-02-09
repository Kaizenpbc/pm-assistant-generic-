import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  Activity,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  DollarSign,
  Zap,
} from 'lucide-react';
import { apiService } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeatMapEntry {
  projectId: string;
  projectName: string;
  healthScore: number;
  riskLevel: string;
  budgetUtilization: number;
  progress: number;
}

interface BudgetReallocation {
  surplusCandidates: Array<{ projectId: string; projectName: string; surplus: number }>;
  deficitCandidates: Array<{ projectId: string; projectName: string; deficit: number }>;
  recommendations: string[];
}

interface CrossProjectData {
  resourceConflicts: Array<{ description: string; severity: string }>;
  portfolioRiskHeatMap: HeatMapEntry[];
  budgetReallocation: BudgetReallocation;
  summary: string;
}

interface Anomaly {
  type: string;
  projectId: string;
  projectName: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
}

interface AnomalyData {
  anomalies: Anomaly[];
  summary: string;
  overallHealthTrend: string;
  scannedProjects: number;
}

interface AccuracyData {
  overall: {
    totalRecords: number;
    averageVariance: number;
    accuracy: number;
  };
  byMetric: Record<string, { count: number; accuracy: number }>;
  feedbackSummary: {
    total: number;
    accepted: number;
    modified: number;
    rejected: number;
    acceptanceRate: number;
  };
  improvements: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function healthScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function healthScoreBg(score: number): string {
  if (score >= 75) return 'bg-green-100';
  if (score >= 50) return 'bg-yellow-100';
  return 'bg-red-100';
}

function riskLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-700';
    case 'high':
      return 'bg-orange-100 text-orange-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'low':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function anomalyTypeStyle(type: string): { bg: string; text: string } {
  switch (type) {
    case 'completion_drop':
      return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'budget_spike':
      return { bg: 'bg-orange-100', text: 'text-orange-700' };
    case 'stale_project':
      return { bg: 'bg-gray-200', text: 'text-gray-700' };
    case 'task_rescheduling':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'budget_flatline':
      return { bg: 'bg-purple-100', text: 'text-purple-700' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

function severityIcon(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'medium':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-gray-400" />;
  }
}

function trendIcon(trend: string) {
  switch (trend.toLowerCase()) {
    case 'improving':
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    case 'declining':
      return <TrendingDown className="w-5 h-5 text-red-500" />;
    default:
      return <Minus className="w-5 h-5 text-gray-400" />;
  }
}

function accuracyColor(accuracy: number): string {
  if (accuracy > 80) return 'text-green-600';
  if (accuracy > 60) return 'text-yellow-600';
  return 'text-red-600';
}

function formatAnomalyType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Loading Spinner
// ---------------------------------------------------------------------------

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
  </div>
);

// ---------------------------------------------------------------------------
// Error Card
// ---------------------------------------------------------------------------

const ErrorCard: React.FC<{ message: string }> = ({ message }) => (
  <div className="card text-center py-10">
    <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
    <p className="text-sm text-red-600">{message}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Portfolio Intelligence Section
// ---------------------------------------------------------------------------

const PortfolioIntelligence: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cross-project'],
    queryFn: () => apiService.getCrossProjectIntelligence(),
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorCard message="Failed to load portfolio intelligence." />;

  const cpData: CrossProjectData | undefined = data?.data;
  if (!cpData) return <ErrorCard message="No portfolio data available." />;

  const heatMap = cpData.portfolioRiskHeatMap || [];
  const reallocation = cpData.budgetReallocation;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Brain className="w-4 h-4 text-indigo-500" />
        Portfolio Intelligence
      </h2>

      {/* Summary */}
      {cpData.summary && (
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">{cpData.summary}</p>
      )}

      {/* Risk Heat Map */}
      {heatMap.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-gray-400" />
            Portfolio Risk Heat Map
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Project
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Health
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Risk
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Budget
                  </th>
                  <th className="text-center py-2 pl-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {heatMap.map((entry) => (
                  <tr key={entry.projectId} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">
                      {entry.projectName}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-7 rounded-md text-xs font-bold ${healthScoreBg(entry.healthScore)} ${healthScoreColor(entry.healthScore)}`}
                      >
                        {entry.healthScore}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${riskLevelColor(entry.riskLevel)}`}
                      >
                        {entry.riskLevel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-700">
                          {Math.round(entry.budgetUtilization)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${Math.min(entry.progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">
                          {Math.round(entry.progress)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget Reallocation */}
      {reallocation && (
        <div>
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-gray-400" />
            Budget Reallocation
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Surplus candidates */}
            {reallocation.surplusCandidates && reallocation.surplusCandidates.length > 0 && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Surplus Candidates
                </p>
                <ul className="space-y-1">
                  {reallocation.surplusCandidates.map((c) => (
                    <li
                      key={c.projectId}
                      className="text-xs text-green-800 flex items-center justify-between"
                    >
                      <span>{c.projectName}</span>
                      <span className="font-mono font-medium">
                        +${c.surplus?.toLocaleString() ?? '0'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Deficit candidates */}
            {reallocation.deficitCandidates && reallocation.deficitCandidates.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Deficit Candidates
                </p>
                <ul className="space-y-1">
                  {reallocation.deficitCandidates.map((c) => (
                    <li
                      key={c.projectId}
                      className="text-xs text-red-800 flex items-center justify-between"
                    >
                      <span>{c.projectName}</span>
                      <span className="font-mono font-medium">
                        -${c.deficit?.toLocaleString() ?? '0'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {reallocation.recommendations && reallocation.recommendations.length > 0 && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Recommendations
              </p>
              <ul className="space-y-1.5">
                {reallocation.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs text-indigo-800 leading-relaxed">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Anomaly Detection Section
// ---------------------------------------------------------------------------

const AnomalyDetection: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['anomalies'],
    queryFn: () => apiService.getPortfolioAnomalies(),
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorCard message="Failed to load anomaly data." />;

  const anomalyData: AnomalyData | undefined = data?.data;
  if (!anomalyData) return <ErrorCard message="No anomaly data available." />;

  const anomalies = anomalyData.anomalies || [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-500" />
          Anomaly Detection
        </h2>
        <div className="flex items-center gap-3">
          {/* Anomaly count badge */}
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-semibold">
            <AlertTriangle className="w-3 h-3" />
            {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'}
          </span>

          {/* Health trend */}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            {trendIcon(anomalyData.overallHealthTrend)}
            <span className="capitalize">{anomalyData.overallHealthTrend}</span>
          </span>
        </div>
      </div>

      {/* Summary */}
      {anomalyData.summary && (
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">{anomalyData.summary}</p>
      )}

      {/* Scanned projects count */}
      <p className="text-xs text-gray-400 mb-4">
        Scanned {anomalyData.scannedProjects} project{anomalyData.scannedProjects !== 1 ? 's' : ''}
      </p>

      {/* Anomaly list */}
      {anomalies.length === 0 ? (
        <div className="text-center py-8">
          <Shield className="mx-auto h-10 w-10 text-green-300 mb-2" />
          <p className="text-sm text-gray-500">No anomalies detected. Portfolio looks healthy.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalies.map((anomaly, idx) => {
            const typeStyle = anomalyTypeStyle(anomaly.type);
            return (
              <div
                key={`${anomaly.projectId}-${anomaly.type}-${idx}`}
                className="rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{severityIcon(anomaly.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">{anomaly.title}</h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}
                      >
                        {formatAnomalyType(anomaly.type)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${riskLevelColor(anomaly.severity)}`}
                      >
                        {anomaly.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{anomaly.projectName}</p>
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">
                      {anomaly.description}
                    </p>
                    {anomaly.recommendation && (
                      <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                        <p className="text-xs text-blue-700 flex items-start gap-1.5">
                          <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{anomaly.recommendation}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AI Accuracy Section
// ---------------------------------------------------------------------------

const AIAccuracy: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accuracy'],
    queryFn: () => apiService.getAccuracyReport(),
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorCard message="Failed to load accuracy data." />;

  const accData: AccuracyData | undefined = data?.data;
  if (!accData) return <ErrorCard message="No accuracy data available." />;

  const overall = accData.overall;
  const feedback = accData.feedbackSummary;
  const improvements = accData.improvements || [];
  const totalFeedback = feedback?.total || 0;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-green-500" />
        AI Accuracy
      </h2>

      {/* Overall accuracy */}
      {overall && (
        <div className="flex items-center gap-6 mb-6">
          <div className="text-center">
            <p
              className={`text-4xl font-bold ${accuracyColor(overall.accuracy)}`}
            >
              {Math.round(overall.accuracy)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Overall Accuracy</p>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">{overall.totalRecords}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Records</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">
                {overall.averageVariance?.toFixed(1)}%
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg Variance</p>
            </div>
          </div>
        </div>
      )}

      {/* Feedback summary */}
      {feedback && totalFeedback > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Feedback Summary
          </h3>
          <div className="space-y-2.5">
            {/* Accepted */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Accepted</span>
                <span className="font-medium text-green-700">{feedback.accepted}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{
                    width: `${totalFeedback > 0 ? (feedback.accepted / totalFeedback) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Modified */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Modified</span>
                <span className="font-medium text-yellow-700">{feedback.modified}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{
                    width: `${totalFeedback > 0 ? (feedback.modified / totalFeedback) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Rejected */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Rejected</span>
                <span className="font-medium text-red-700">{feedback.rejected}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{
                    width: `${totalFeedback > 0 ? (feedback.rejected / totalFeedback) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Acceptance rate */}
          <p className="mt-3 text-xs text-gray-500">
            Acceptance rate:{' '}
            <span className="font-semibold text-gray-700">
              {Math.round(feedback.acceptanceRate)}%
            </span>
          </p>
        </div>
      )}

      {/* Improvements */}
      {improvements.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            Improvement Suggestions
          </h3>
          <ul className="space-y-2">
            {improvements.map((item, idx) => (
              <li
                key={idx}
                className="text-sm text-gray-600 leading-relaxed flex items-start gap-2"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ScenarioModelingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Brain className="w-6 h-6 text-indigo-500" />
          Intelligence & Scenarios
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Portfolio-level intelligence, anomaly detection, and AI accuracy tracking.
        </p>
      </div>

      {/* Portfolio Intelligence */}
      <PortfolioIntelligence />

      {/* Anomaly Detection */}
      <AnomalyDetection />

      {/* AI Accuracy */}
      <AIAccuracy />
    </div>
  );
}
