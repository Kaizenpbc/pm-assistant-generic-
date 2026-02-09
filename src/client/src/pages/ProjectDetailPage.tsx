import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  ListTodo,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  CloudRain,
  PieChart,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CloudSun,
  MapPin,
  Lightbulb,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';

type Tab = 'overview' | 'schedule' | 'ai-insights' | 'scenarios' | 'team';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'ai-insights', label: 'AI Insights' },
  { id: 'scenarios', label: 'What-If' },
  { id: 'team', label: 'Team' },
];

const statusStyles: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  planning: { label: 'Planning', color: 'bg-purple-100 text-purple-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

const taskStatusStyles: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700' },
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-600 border-red-200',
  high: 'bg-orange-100 text-orange-500 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-500 border-yellow-200',
  low: 'bg-green-100 text-green-500 border-green-200',
};

const severityDotColors: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

function riskScoreColor(score: number): string {
  if (score >= 75) return 'text-red-600';
  if (score >= 50) return 'text-orange-500';
  if (score >= 25) return 'text-yellow-500';
  return 'text-green-500';
}

function riskLevelBadge(level: string): string {
  switch (level?.toLowerCase()) {
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

function impactLevelBadge(level: string): string {
  switch (level?.toLowerCase()) {
    case 'severe':
    case 'high':
      return 'bg-red-100 text-red-700';
    case 'moderate':
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'low':
    case 'minimal':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatDollar(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function AIPoweredBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
      <Sparkles className="h-3 w-3" />
      AI Powered
    </span>
  );
}

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <XCircle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const {
    data: projectData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiService.getProject(id!),
    enabled: !!id,
  });

  const project = projectData?.project;

  // Set AI panel context when project loads
  useEffect(() => {
    if (project) {
      useUIStore.getState().setAIPanelContext({
        type: 'project',
        projectId: id,
        projectName: project.name,
      });
    }
  }, [project, id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500">Project not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 text-sm text-indigo-600 hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const status = statusStyles[project.status] || statusStyles.planning;
  const progress = project.progressPercentage || project.progress_percentage || 0;
  const budgetAllocated = project.budgetAllocated || project.budget_allocated || 0;
  const budgetSpent = project.budgetSpent || project.budget_spent || 0;
  const budgetPct =
    budgetAllocated > 0 ? Math.round((budgetSpent / budgetAllocated) * 100) : 0;

  const daysRemaining =
    project.endDate || project.end_date
      ? Math.ceil(
          (new Date(project.endDate || project.end_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Back Button + Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
              >
                {status.label}
              </span>
            </div>
            {(project.description) && (
              <p className="mt-1 text-sm text-gray-500">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Context Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ContextCard
          label="Progress"
          value={`${progress}%`}
          icon={TrendingUp}
          color="bg-blue-50 text-blue-600"
          detail={
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          }
        />
        <ContextCard
          label="Budget"
          value={`$${(budgetSpent / 1000).toFixed(0)}K / $${(budgetAllocated / 1000).toFixed(0)}K`}
          icon={DollarSign}
          color={budgetPct > 90 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
          detail={
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct > 90 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          }
        />
        <ContextCard
          label="Timeline"
          value={
            daysRemaining !== null ? `${daysRemaining}d remaining` : 'No end date'
          }
          icon={Clock}
          color={
            daysRemaining !== null && daysRemaining < 14
              ? 'bg-orange-50 text-orange-600'
              : 'bg-indigo-50 text-indigo-600'
          }
        />
        <ContextCard
          label="Status"
          value={status.label}
          icon={Calendar}
          color={status.color}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab project={project} />}
      {activeTab === 'schedule' && <ScheduleTab projectId={id!} />}
      {activeTab === 'ai-insights' && <AIInsightsTab projectId={id!} />}
      {activeTab === 'scenarios' && <ScenariosTab projectId={id!} />}
      {activeTab === 'team' && <TeamTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context Card
// ---------------------------------------------------------------------------

function ContextCard({
  label,
  value,
  icon: Icon,
  color,
  detail,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
      {detail}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function OverviewTab({ project }: { project: any }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Project Details */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Project Details</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {project.code && <DetailRow label="Code" value={project.code} />}
            {project.category && <DetailRow label="Category" value={project.category} />}
            {project.priority && <DetailRow label="Priority" value={project.priority} />}
            {(project.startDate || project.start_date) && (
              <DetailRow
                label="Start Date"
                value={new Date(project.startDate || project.start_date).toLocaleDateString()}
              />
            )}
            {(project.endDate || project.end_date) && (
              <DetailRow
                label="End Date"
                value={new Date(project.endDate || project.end_date).toLocaleDateString()}
              />
            )}
            {project.location && <DetailRow label="Location" value={project.location} />}
            {(project.createdAt || project.created_at) && (
              <DetailRow
                label="Created"
                value={new Date(project.createdAt || project.created_at).toLocaleDateString()}
              />
            )}
          </dl>
        </div>
      </div>

      {/* Quick Info Sidebar */}
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Quick Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-medium text-gray-900 capitalize">{project.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Priority</span>
              <span className="font-medium text-gray-900 capitalize">
                {project.priority || 'Not set'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Tab
// ---------------------------------------------------------------------------

function ScheduleTab({ projectId }: { projectId: string }) {
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];

  if (schedulesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <h3 className="text-sm font-semibold text-gray-900">No Schedules</h3>
        <p className="mt-1 text-sm text-gray-500">
          No schedules have been created for this project yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule: any) => (
        <ScheduleCard key={schedule.id} schedule={schedule} />
      ))}
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: any }) {
  const [expanded, setExpanded] = useState(false);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', schedule.id],
    queryFn: () => apiService.getTasks(schedule.id),
    enabled: expanded,
  });

  const tasks: any[] = tasksData?.tasks || [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{schedule.name}</h4>
          {schedule.description && (
            <p className="mt-0.5 text-xs text-gray-500">{schedule.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            {(schedule.startDate || schedule.start_date) && (
              <span>
                Start: {new Date(schedule.startDate || schedule.start_date).toLocaleDateString()}
              </span>
            )}
            {(schedule.endDate || schedule.end_date) && (
              <span>
                End: {new Date(schedule.endDate || schedule.end_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-4">
              <ListTodo className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-xs text-gray-500">No tasks in this schedule.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task: any) => {
                const taskStatus =
                  taskStatusStyles[task.status] || taskStatusStyles.not_started;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {task.name}
                      </p>
                      {task.assignedTo && (
                        <p className="text-xs text-gray-400">Assigned: {task.assignedTo}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${taskStatus.color}`}
                    >
                      {taskStatus.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Insights Tab
// ---------------------------------------------------------------------------

function AIInsightsTab({ projectId }: { projectId: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RiskAssessmentSection projectId={projectId} />
      <WeatherImpactSection projectId={projectId} />
      <div className="lg:col-span-2">
        <BudgetForecastSection projectId={projectId} />
      </div>
    </div>
  );
}

// --- Risk Assessment Section ---

function RiskAssessmentSection({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projectRisks', projectId],
    queryFn: () => apiService.getProjectRisks(projectId),
    enabled: !!projectId,
  });

  const riskData = data?.data;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          <h3 className="text-sm font-semibold text-gray-900">Risk Assessment</h3>
        </div>
        {riskData?.aiPowered && <AIPoweredBadge />}
      </div>

      {isLoading && <SectionSpinner />}

      {error && (
        <SectionError message="Failed to load risk assessment. Please try again later." />
      )}

      {!isLoading && !error && riskData && (
        <div className="space-y-4">
          {/* Overall Score */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${riskScoreColor(riskData.overallRiskScore)}`}>
                {riskData.overallRiskScore}
              </div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                Risk Score
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${riskLevelBadge(riskData.riskLevel)}`}
            >
              {riskData.riskLevel}
            </span>
          </div>

          {/* Individual Risks */}
          {riskData.risks && riskData.risks.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {riskData.risks.map((risk: any, idx: number) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 ${severityColors[risk.severity] || 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${severityDotColors[risk.severity] || 'bg-gray-400'}`}
                      />
                      <span className="text-xs font-semibold capitalize">{risk.severity}</span>
                    </div>
                    {risk.trend && (
                      <span className="text-[10px] text-gray-500 capitalize">{risk.trend}</span>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-gray-900">{risk.title}</h4>
                  {risk.description && (
                    <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">
                      {risk.description}
                    </p>
                  )}
                  <div className="mt-2 flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>Probability</span>
                        <span>{Math.round((risk.probability || 0) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-orange-400 transition-all"
                          style={{ width: `${Math.min((risk.probability || 0) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>Impact</span>
                        <span>{Math.round((risk.impact || 0) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-red-400 transition-all"
                          style={{ width: `${Math.min((risk.impact || 0) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No risks identified for this project.</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Weather Impact Section ---

function WeatherImpactSection({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projectWeather', projectId],
    queryFn: () => apiService.getProjectWeather(projectId),
    enabled: !!projectId,
  });

  const weather = data?.data;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Weather Impact</h3>
        </div>
        {weather?.aiPowered && <AIPoweredBadge />}
      </div>

      {isLoading && <SectionSpinner />}

      {error && (
        <SectionError message="Failed to load weather impact. Please try again later." />
      )}

      {!isLoading && !error && weather && (
        <div className="space-y-4">
          {/* No location fallback */}
          {!weather.currentConditions && !weather.impactLevel ? (
            <div className="flex flex-col items-center py-6 text-center">
              <MapPin className="mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">
                Set project location for weather analysis
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Add a location to this project to receive weather-based impact assessments.
              </p>
            </div>
          ) : (
            <>
              {/* Impact level + current conditions */}
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${impactLevelBadge(weather.impactLevel)}`}
                >
                  {weather.impactLevel} Impact
                </span>
                {weather.currentConditions && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <CloudSun className="h-3.5 w-3.5" />
                    <span>{weather.currentConditions}</span>
                  </div>
                )}
              </div>

              {/* Affected Tasks */}
              {weather.affectedTasks && weather.affectedTasks.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-gray-700">Affected Tasks</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {weather.affectedTasks.map((task: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700"
                      >
                        <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                        <span>{typeof task === 'string' ? task : task.name || task.task || JSON.stringify(task)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly Outlook */}
              {weather.weeklyOutlook && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-gray-700">Weekly Outlook</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {typeof weather.weeklyOutlook === 'string'
                      ? weather.weeklyOutlook
                      : JSON.stringify(weather.weeklyOutlook)}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {weather.recommendations && weather.recommendations.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-gray-700">Recommendations</h4>
                  <ul className="space-y-1.5">
                    {weather.recommendations.map((rec: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs text-gray-600"
                      >
                        <Lightbulb className="mt-0.5 h-3 w-3 text-yellow-500 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Budget Forecast Section ---

function BudgetForecastSection({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projectBudget', projectId],
    queryFn: () => apiService.getProjectBudget(projectId),
    enabled: !!projectId,
  });

  const budget = data?.data;
  const evm = budget?.evmMetrics;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-green-500" />
          <h3 className="text-sm font-semibold text-gray-900">Budget Forecast</h3>
        </div>
        {budget?.aiPowered && <AIPoweredBadge />}
      </div>

      {isLoading && <SectionSpinner />}

      {error && (
        <SectionError message="Failed to load budget forecast. Please try again later." />
      )}

      {!isLoading && !error && budget && (
        <div className="space-y-5">
          {/* EVM Metrics Grid */}
          {evm && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                label="CPI"
                value={evm.cpi != null ? evm.cpi.toFixed(2) : 'N/A'}
                color={evm.cpi != null && evm.cpi >= 1 ? 'text-green-600' : 'text-red-600'}
                tooltip="Cost Performance Index"
              />
              <MetricCard
                label="SPI"
                value={evm.spi != null ? evm.spi.toFixed(2) : 'N/A'}
                color={evm.spi != null && evm.spi >= 1 ? 'text-green-600' : 'text-red-600'}
                tooltip="Schedule Performance Index"
              />
              <MetricCard
                label="EAC"
                value={formatDollar(evm.eac)}
                color="text-gray-900"
                tooltip="Estimate at Completion"
              />
              <MetricCard
                label="ETC"
                value={formatDollar(evm.etc)}
                color="text-gray-900"
                tooltip="Estimate to Complete"
              />
              <MetricCard
                label="VAC"
                value={formatDollar(evm.vac)}
                color={evm.vac != null && evm.vac >= 0 ? 'text-green-600' : 'text-red-600'}
                tooltip="Variance at Completion"
              />
              <MetricCard
                label="Burn Rate"
                value={evm.burnRate != null ? `${(evm.burnRate * 100).toFixed(1)}%` : 'N/A'}
                color="text-gray-900"
                tooltip="Current burn rate"
              />
            </div>
          )}

          {/* Overrun Probability & Projected Completion */}
          <div className="flex flex-wrap items-center gap-4">
            {budget.overrunProbability != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Overrun Probability:</span>
                <span
                  className={`text-sm font-bold ${
                    budget.overrunProbability > 0.5 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {Math.round(budget.overrunProbability * 100)}%
                </span>
              </div>
            )}
            {budget.projectedCompletion && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Projected Completion:</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(budget.projectedCompletion).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {budget.recommendations && budget.recommendations.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-700">Recommendations</h4>
              <ul className="space-y-1.5">
                {budget.recommendations.map((rec: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-gray-600"
                  >
                    <CheckCircle2 className="mt-0.5 h-3 w-3 text-green-500 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center" title={tooltip}>
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// What-If Scenarios Tab
// ---------------------------------------------------------------------------

function ScenariosTab({ projectId }: { projectId: string }) {
  const [scenario, setScenario] = useState('');
  const [budgetChangePct, setBudgetChangePct] = useState<number>(0);
  const [workerChange, setWorkerChange] = useState<number>(0);
  const [daysExtension, setDaysExtension] = useState<number>(0);
  const [scopeChangePct, setScopeChangePct] = useState<number>(0);

  const mutation = useMutation({
    mutationFn: (data: {
      projectId: string;
      scenario: string;
      parameters?: {
        budgetChangePct?: number;
        workerChange?: number;
        daysExtension?: number;
        scopeChangePct?: number;
      };
    }) => apiService.modelScenario(data),
  });

  const handleRunScenario = () => {
    if (!scenario.trim()) return;
    const parameters: any = {};
    if (budgetChangePct !== 0) parameters.budgetChangePct = budgetChangePct;
    if (workerChange !== 0) parameters.workerChange = workerChange;
    if (daysExtension !== 0) parameters.daysExtension = daysExtension;
    if (scopeChangePct !== 0) parameters.scopeChangePct = scopeChangePct;

    mutation.mutate({
      projectId,
      scenario: scenario.trim(),
      parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    });
  };

  const result = mutation.data?.data;

  return (
    <div className="space-y-6">
      {/* Scenario Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900">Model a Scenario</h3>
        </div>

        <div className="space-y-4">
          {/* Scenario Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Scenario Description
            </label>
            <input
              type="text"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g., What if we add 5 more workers and extend the deadline by 2 weeks?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Parameter Sliders */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SliderInput
              label="Budget Change"
              value={budgetChangePct}
              onChange={setBudgetChangePct}
              min={-50}
              max={50}
              step={5}
              unit="%"
            />
            <SliderInput
              label="Worker Change"
              value={workerChange}
              onChange={setWorkerChange}
              min={-20}
              max={20}
              step={1}
              unit=""
            />
            <SliderInput
              label="Days Extension"
              value={daysExtension}
              onChange={setDaysExtension}
              min={0}
              max={180}
              step={7}
              unit=" days"
            />
            <SliderInput
              label="Scope Change"
              value={scopeChangePct}
              onChange={setScopeChangePct}
              min={-50}
              max={50}
              step={5}
              unit="%"
            />
          </div>

          {/* Run Button */}
          <div className="flex justify-end">
            <button
              onClick={handleRunScenario}
              disabled={!scenario.trim() || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Scenario
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {mutation.isError && (
        <SectionError message="Failed to model scenario. Please try again." />
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Confidence */}
          {result.confidence != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Confidence:</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.round(result.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-indigo-600">
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Impact Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {result.scheduleImpact && (
              <ImpactCard
                title="Schedule Impact"
                icon={Calendar}
                iconColor="text-blue-500"
                content={result.scheduleImpact}
              />
            )}
            {result.budgetImpact && (
              <ImpactCard
                title="Budget Impact"
                icon={DollarSign}
                iconColor="text-green-500"
                content={result.budgetImpact}
              />
            )}
            {result.riskImpact && (
              <ImpactCard
                title="Risk Impact"
                icon={ShieldAlert}
                iconColor="text-red-500"
                content={result.riskImpact}
              />
            )}
          </div>

          {/* Resource Impact */}
          {result.resourceImpact && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="mb-2 text-xs font-semibold text-gray-700">Resource Impact</h4>
              <p className="text-sm text-gray-600">
                {typeof result.resourceImpact === 'string'
                  ? result.resourceImpact
                  : JSON.stringify(result.resourceImpact)}
              </p>
            </div>
          )}

          {/* Affected Tasks */}
          {result.affectedTasks && result.affectedTasks.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="mb-2 text-xs font-semibold text-gray-700">Affected Tasks</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {result.affectedTasks.map((task: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700"
                  >
                    <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                    <span>
                      {typeof task === 'string'
                        ? task
                        : task.name || task.task || JSON.stringify(task)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="mb-2 text-xs font-semibold text-gray-700">Recommendations</h4>
              <ul className="space-y-1.5">
                {result.recommendations.map((rec: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-gray-600"
                  >
                    <Lightbulb className="mt-0.5 h-3 w-3 text-yellow-500 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <span className="text-xs font-bold text-gray-900">
          {value > 0 ? '+' : ''}
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function ImpactCard({
  title,
  icon: Icon,
  iconColor,
  content,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  content: any;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h4 className="text-xs font-semibold text-gray-700">{title}</h4>
      </div>
      <p className="text-sm text-gray-600">
        {typeof content === 'string' ? content : JSON.stringify(content)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Tab
// ---------------------------------------------------------------------------

function TeamTab() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <Users className="mx-auto mb-3 h-12 w-12 text-gray-300" />
      <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
      <p className="mt-1 text-sm text-gray-500">
        Team management will be available in a future update.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 capitalize">{value}</dd>
    </div>
  );
}
