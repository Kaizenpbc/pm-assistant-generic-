import React, { useState } from 'react';
import {
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  DollarSign,
  Cloud,
  Activity,
  Lightbulb,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectHealth {
  projectId: string;
  projectName: string;
  healthScore: number;
  riskLevel: string;
  // Extended fields (from dashboard predictions or health endpoint)
  breakdown?: {
    scheduleHealth: number;
    budgetHealth: number;
    riskHealth?: number;
    weatherHealth?: number;
  };
  trend?: 'improving' | 'deteriorating' | 'stable';
  recommendation?: string;
}

interface DashboardSummary {
  summary?: string;
  highlights?: Array<{ text: string; type: string }>;
  risks?: { critical: number; high: number; medium: number; low: number };
  weather?: { condition: string; impact: string };
  budget?: { overBudget: number; onTrack: number };
}

interface PredictionCardsProps {
  projects: ProjectHealth[];
  dashboardSummary?: DashboardSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreRingColor(score: number): string {
  if (score >= 75) return 'border-green-400 bg-green-50';
  if (score >= 50) return 'border-yellow-400 bg-yellow-50';
  return 'border-red-400 bg-red-50';
}

function getBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

const riskBadgeStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const highlightStyles: Record<string, string> = {
  risk: 'text-red-600 bg-red-50',
  success: 'text-green-600 bg-green-50',
  info: 'text-blue-600 bg-blue-50',
};

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === 'improving') return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (trend === 'deteriorating') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

// ---------------------------------------------------------------------------
// Score Breakdown Bar
// ---------------------------------------------------------------------------

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0 text-gray-400">{icon}</span>
      <span className="text-[10px] text-gray-500 w-14 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold w-6 text-right ${getScoreColor(score)}`}>{score}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable Project Card
// ---------------------------------------------------------------------------

function ProjectHealthCard({ project }: { project: ProjectHealth }) {
  const [expanded, setExpanded] = useState(false);
  const badgeStyle = riskBadgeStyles[project.riskLevel] || riskBadgeStyles.medium;
  const hasDetails = project.breakdown || project.trend || project.recommendation;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full p-3 flex items-center gap-3 text-left ${hasDetails ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
      >
        {/* Health score circle */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${getScoreRingColor(project.healthScore)}`}
        >
          <span className={`text-sm font-bold ${getScoreColor(project.healthScore)}`}>
            {project.healthScore}
          </span>
        </div>

        {/* Project info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-gray-900 truncate" title={project.projectName}>
              {project.projectName}
            </p>
            {project.trend && <TrendIcon trend={project.trend} />}
          </div>
          <span
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${badgeStyle}`}
          >
            {project.riskLevel === 'critical' || project.riskLevel === 'high' ? (
              <AlertTriangle className="h-2.5 w-2.5" />
            ) : null}
            {project.riskLevel}
          </span>
        </div>

        {/* Expand toggle */}
        {hasDetails && (
          <span className="text-gray-400 flex-shrink-0">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && hasDetails && (
        <div className="border-t border-gray-100 px-3 py-2.5 space-y-2 bg-gray-50/50">
          {/* Score breakdown */}
          {project.breakdown && (
            <div className="space-y-1.5">
              <ScoreBar
                label="Schedule"
                score={project.breakdown.scheduleHealth}
                icon={<Calendar className="h-2.5 w-2.5" />}
              />
              <ScoreBar
                label="Budget"
                score={project.breakdown.budgetHealth}
                icon={<DollarSign className="h-2.5 w-2.5" />}
              />
              {project.breakdown.riskHealth !== undefined && (
                <ScoreBar
                  label="Risk"
                  score={project.breakdown.riskHealth}
                  icon={<Shield className="h-2.5 w-2.5" />}
                />
              )}
              {project.breakdown.weatherHealth !== undefined && (
                <ScoreBar
                  label="Weather"
                  score={project.breakdown.weatherHealth}
                  icon={<Cloud className="h-2.5 w-2.5" />}
                />
              )}
            </div>
          )}

          {/* Trend */}
          {project.trend && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <TrendIcon trend={project.trend} />
              <span className={
                project.trend === 'improving' ? 'text-green-600'
                : project.trend === 'deteriorating' ? 'text-red-600'
                : 'text-gray-500'
              }>
                {project.trend === 'improving' ? 'Improving' : project.trend === 'deteriorating' ? 'Deteriorating' : 'Stable'}
              </span>
            </div>
          )}

          {/* Recommendation */}
          {project.recommendation && (
            <div className="flex items-start gap-1.5 text-[10px] text-gray-600">
              <Lightbulb className="h-2.5 w-2.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>{project.recommendation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Summary Banner
// ---------------------------------------------------------------------------

function DashboardSummaryBanner({ summary }: { summary: DashboardSummary }) {
  if (!summary.summary && !summary.highlights?.length) return null;

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 mb-3">
      {/* Summary text */}
      {summary.summary && (
        <p className="text-xs text-gray-700 leading-relaxed mb-2">{summary.summary}</p>
      )}

      {/* Stat pills row */}
      <div className="flex flex-wrap gap-2 mb-2">
        {summary.risks && (summary.risks.critical > 0 || summary.risks.high > 0) && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">
            <AlertTriangle className="h-2.5 w-2.5" />
            {summary.risks.critical} critical, {summary.risks.high} high
          </span>
        )}
        {summary.weather && summary.weather.impact !== 'No weather impacts expected' && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
            <Cloud className="h-2.5 w-2.5" />
            {summary.weather.condition}
          </span>
        )}
        {summary.budget && summary.budget.overBudget > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700">
            <DollarSign className="h-2.5 w-2.5" />
            {summary.budget.overBudget} over budget
          </span>
        )}
      </div>

      {/* Highlights */}
      {summary.highlights && summary.highlights.length > 0 && (
        <div className="space-y-1">
          {summary.highlights.map((h, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium ${highlightStyles[h.type] || highlightStyles.info}`}
            >
              <Activity className="h-2.5 w-2.5 flex-shrink-0" />
              {h.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PredictionCards({ projects, dashboardSummary }: PredictionCardsProps) {
  if (!projects || projects.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-900">Project Health Scores</h3>
      </div>

      {/* Dashboard-level summary */}
      {dashboardSummary && <DashboardSummaryBanner summary={dashboardSummary} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {projects.map((project) => (
          <ProjectHealthCard key={project.projectId} project={project} />
        ))}
      </div>
    </div>
  );
}
