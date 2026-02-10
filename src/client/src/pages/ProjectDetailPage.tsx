import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Clock,
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
  Download,
  Printer,
  BarChart3,
  Kanban,
  GanttChartSquare,
  Table2,
  Save,
  Users,
  Plus,
  Trash2,
  Activity,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { GanttChart, type GanttTask } from '../components/schedule/GanttChart';
import { TaskFormModal, type TaskFormData } from '../components/schedule/TaskFormModal';
import { KanbanBoard } from '../components/schedule/KanbanBoard';
import { TableView } from '../components/schedule/TableView';
import { CalendarView } from '../components/schedule/CalendarView';
import { SCurveChart } from '../components/evm/SCurveChart';
import { WorkloadHeatmap } from '../components/resources/WorkloadHeatmap';
import { EVMForecastDashboard } from '../components/evm/EVMForecastDashboard';
import { EVMTrendChart } from '../components/evm/EVMTrendChart';
import { ForecastComparisonChart } from '../components/evm/ForecastComparisonChart';
import { ResourceForecastPanel } from '../components/resources/ResourceForecastPanel';
import { RebalanceSuggestions } from '../components/resources/RebalanceSuggestions';
import { CapacityChart } from '../components/resources/CapacityChart';
import { AutoReschedulePanel } from '../components/schedule/AutoReschedulePanel';

type Tab = 'overview' | 'schedule' | 'ai-insights' | 'evm-forecast' | 'scenarios' | 'team';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'ai-insights', label: 'AI Insights' },
  { id: 'evm-forecast', label: 'EVM Forecast' },
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => apiService.exportProjectCSV(id!)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={() => apiService.exportProjectPDF(id!)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Gantt
            </button>
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
      {activeTab === 'evm-forecast' && <EVMForecastTab projectId={id!} />}
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
  const [viewMode, setViewMode] = useState<'gantt' | 'kanban' | 'table' | 'calendar'>('gantt');

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
      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {([
            { mode: 'gantt' as const, icon: GanttChartSquare, label: 'Gantt' },
            { mode: 'kanban' as const, icon: Kanban, label: 'Kanban' },
            { mode: 'table' as const, icon: Table2, label: 'Table' },
            { mode: 'calendar' as const, icon: CalendarDays, label: 'Calendar' },
          ] as const).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {schedules.map((schedule: any) => (
        <ScheduleGantt key={schedule.id} schedule={schedule} viewMode={viewMode} projectId={projectId} />
      ))}
    </div>
  );
}

function ScheduleGantt({ schedule, viewMode, projectId: _projectId }: { schedule: any; viewMode: 'gantt' | 'kanban' | 'table' | 'calendar'; projectId: string }) {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);
  const [showReschedulePanel, setShowReschedulePanel] = useState(false);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', schedule.id],
    queryFn: () => apiService.getTasks(schedule.id),
  });

  const tasks: GanttTask[] = tasksData?.tasks || [];

  // Critical Path
  const { data: cpmData } = useQuery({
    queryKey: ['criticalPath', schedule.id],
    queryFn: () => apiService.getCriticalPath(schedule.id),
    enabled: showCriticalPath,
  });

  // Baselines
  const { data: baselinesData } = useQuery({
    queryKey: ['baselines', schedule.id],
    queryFn: () => apiService.getBaselines(schedule.id),
  });

  const baselines = baselinesData?.baselines || [];
  const selectedBaseline = baselines.find((b: any) => b.id === selectedBaselineId);

  // Baseline comparison
  const { data: comparisonData } = useQuery({
    queryKey: ['baselineComparison', schedule.id, selectedBaselineId],
    queryFn: () => apiService.compareBaseline(schedule.id, selectedBaselineId),
    enabled: !!selectedBaselineId && showComparison,
  });

  const comparison = comparisonData?.comparison;

  const createBaselineMutation = useMutation({
    mutationFn: () => apiService.createBaseline(schedule.id, `Baseline ${new Date().toLocaleDateString()}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baselines', schedule.id] });
    },
  });

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (data: TaskFormData) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || undefined,
        status: data.status,
        priority: data.priority,
        assignedTo: data.assignedTo || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        progressPercentage: data.progressPercentage,
        dependency: data.dependency || undefined,
        parentTaskId: data.parentTaskId || undefined,
        estimatedDays: data.estimatedDays ? parseInt(data.estimatedDays) : undefined,
      };
      return apiService.createTask(schedule.id, payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      setShowAddForm(false);
    },
  });

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: TaskFormData | Record<string, unknown> }) => {
      if ('name' in data && 'status' in data && 'priority' in data && 'assignedTo' in data) {
        // Full TaskFormData
        const d = data as TaskFormData;
        const payload: Record<string, unknown> = {
          name: d.name,
          description: d.description || undefined,
          status: d.status,
          priority: d.priority,
          assignedTo: d.assignedTo || undefined,
          startDate: d.startDate || undefined,
          endDate: d.endDate || undefined,
          progressPercentage: d.progressPercentage,
          dependency: d.dependency || undefined,
          parentTaskId: d.parentTaskId || undefined,
          estimatedDays: d.estimatedDays ? parseInt(d.estimatedDays) : undefined,
        };
        return apiService.updateTask(schedule.id, taskId, payload);
      }
      return apiService.updateTask(schedule.id, taskId, data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      setEditingTask(null);
    },
  });

  // Delete task
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => {
      return apiService.updateTask(schedule.id, taskId, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      setEditingTask(null);
    },
  });

  // Kanban status change
  const handleKanbanStatusChange = (taskId: string, newStatus: string) => {
    updateMutation.mutate({ taskId, data: { status: newStatus } as any });
  };

  if (tasksLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Controls bar */}
      {viewMode === 'gantt' && (
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showCriticalPath}
              onChange={(e) => setShowCriticalPath(e.target.checked)}
              className="accent-red-600 w-3.5 h-3.5"
            />
            Show Critical Path
          </label>

          <div className="h-4 w-px bg-gray-200 mx-1" />

          <button
            onClick={() => createBaselineMutation.mutate()}
            disabled={createBaselineMutation.isPending}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
          >
            <Save className="w-3 h-3" />
            Save Baseline
          </button>

          {baselines.length > 0 && (
            <>
              <select
                value={selectedBaselineId}
                onChange={(e) => { setSelectedBaselineId(e.target.value); setShowComparison(false); }}
                className="text-[10px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white"
              >
                <option value="">No baseline overlay</option>
                {baselines.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({new Date(b.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {selectedBaselineId && (
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    showComparison
                      ? 'bg-indigo-600 text-white'
                      : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                  Variance Report
                </button>
              )}
            </>
          )}

          <div className="h-4 w-px bg-gray-200 mx-1" />

          <button
            onClick={() => setShowReschedulePanel(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            AI Reschedule
          </button>

          {cpmData && showCriticalPath && (
            <span className="text-[10px] text-gray-400 ml-auto">
              Project duration: {cpmData.projectDuration} days | Critical tasks: {cpmData.criticalPathTaskIds?.length || 0}
            </span>
          )}
        </div>
      )}

      {viewMode === 'gantt' && (
        <GanttChart
          tasks={tasks}
          scheduleName={schedule.name}
          onTaskClick={(task) => setEditingTask(task)}
          onAddTask={() => setShowAddForm(true)}
          criticalPathTaskIds={showCriticalPath ? cpmData?.criticalPathTaskIds : undefined}
          baselineTasks={selectedBaseline?.tasks?.map((bt: any) => ({
            taskId: bt.taskId,
            startDate: bt.startDate,
            endDate: bt.endDate,
          }))}
        />
      )}
      {viewMode === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={(task) => setEditingTask(task as GanttTask)}
          onStatusChange={handleKanbanStatusChange}
        />
      )}
      {viewMode === 'table' && (
        <TableView
          tasks={tasks}
          onTaskClick={(task) => setEditingTask(task)}
          onTaskUpdate={(taskId, data) => updateMutation.mutate({ taskId, data })}
        />
      )}
      {viewMode === 'calendar' && (
        <CalendarView
          tasks={tasks}
          onTaskClick={(task) => setEditingTask(task)}
        />
      )}

      {/* Baseline Variance Report */}
      {showComparison && comparison && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Baseline Variance Report — {comparison.baselineName}
              </h3>
              <span className="text-[10px] text-gray-400">
                Saved {new Date(comparison.baselineDate).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={() => setShowComparison(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Close
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <div className="text-[10px] font-medium text-gray-400 uppercase">Health</div>
              <div className={`mt-1 text-lg font-bold ${
                comparison.summary.scheduleHealthPct >= 70 ? 'text-green-600' :
                comparison.summary.scheduleHealthPct >= 40 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {comparison.summary.scheduleHealthPct}%
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <div className="text-[10px] font-medium text-gray-400 uppercase">Slipped</div>
              <div className="mt-1 text-lg font-bold text-red-600">{comparison.summary.tasksSlipped}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <div className="text-[10px] font-medium text-gray-400 uppercase">On Track</div>
              <div className="mt-1 text-lg font-bold text-green-600">{comparison.summary.tasksOnTrack}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <div className="text-[10px] font-medium text-gray-400 uppercase">Ahead</div>
              <div className="mt-1 text-lg font-bold text-blue-600">{comparison.summary.tasksAhead}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <div className="text-[10px] font-medium text-gray-400 uppercase">Avg End Var</div>
              <div className={`mt-1 text-lg font-bold ${
                comparison.summary.avgEndVarianceDays > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {comparison.summary.avgEndVarianceDays > 0 ? '+' : ''}{comparison.summary.avgEndVarianceDays}d
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <div className="text-[10px] font-medium text-gray-400 uppercase">New Tasks</div>
              <div className="mt-1 text-lg font-bold text-gray-900">{comparison.summary.newTasks}</div>
            </div>
          </div>

          {/* Task Variance Table */}
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500 uppercase">Task</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 uppercase">Start Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 uppercase">End Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 uppercase">Duration Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 uppercase">Progress Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {comparison.taskVariances.map((tv: any) => (
                  <tr key={tv.taskId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-800 font-medium">{tv.taskName}</td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.startVarianceDays > 0 ? 'text-red-600' : tv.startVarianceDays < 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {tv.startVarianceDays > 0 ? '+' : ''}{tv.startVarianceDays}d
                    </td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.endVarianceDays > 0 ? 'text-red-600' : tv.endVarianceDays < 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {tv.endVarianceDays > 0 ? '+' : ''}{tv.endVarianceDays}d
                    </td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.durationVarianceDays > 0 ? 'text-red-600' : tv.durationVarianceDays < 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {tv.durationVarianceDays > 0 ? '+' : ''}{tv.durationVarianceDays}d
                    </td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.progressVariancePct > 0 ? 'text-green-600' : tv.progressVariancePct < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {tv.progressVariancePct > 0 ? '+' : ''}{tv.progressVariancePct}%
                    </td>
                    <td className="text-center px-2 py-1.5">
                      {tv.statusChanged ? (
                        <span className="text-amber-600">{tv.baselineStatus} → {tv.actualStatus}</span>
                      ) : (
                        <span className="text-gray-400">{tv.actualStatus}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingTask && (
        <TaskFormModal
          task={editingTask}
          allTasks={tasks}
          scheduleId={schedule.id}
          onSave={(data) => updateMutation.mutate({ taskId: editingTask.id, data })}
          onDelete={(taskId) => deleteMutation.mutate(taskId)}
          onClose={() => setEditingTask(null)}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* Add modal */}
      {showAddForm && (
        <TaskFormModal
          task={null}
          allTasks={tasks}
          scheduleId={schedule.id}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setShowAddForm(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {/* AI Reschedule Panel */}
      {showReschedulePanel && (
        <AutoReschedulePanel
          scheduleId={schedule.id}
          onClose={() => {
            setShowReschedulePanel(false);
            queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
          }}
        />
      )}
    </>
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
      <div className="lg:col-span-2">
        <EVMSCurveSection projectId={projectId} />
      </div>
    </div>
  );
}

// --- EVM S-Curve Section ---

function EVMSCurveSection({ projectId }: { projectId: string }) {
  const { data: sCurveData, isLoading: sCurveLoading } = useQuery({
    queryKey: ['sCurve', projectId],
    queryFn: () => apiService.getSCurveData(projectId),
    enabled: !!projectId,
  });

  const { data: budgetData } = useQuery({
    queryKey: ['projectBudget', projectId],
    queryFn: () => apiService.getProjectBudget(projectId),
    enabled: !!projectId,
  });

  const evm = budgetData?.data?.evmMetrics;
  const sCurve = sCurveData?.data || [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-900">Earned Value Management — S-Curve</h3>
      </div>

      {/* Extended EVM Metrics */}
      {evm && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7 mb-4">
          <MetricCard
            label="PV"
            value={formatDollar(evm.plannedValue)}
            color="text-gray-900"
            tooltip="Planned Value"
          />
          <MetricCard
            label="EV"
            value={formatDollar(evm.earnedValue)}
            color="text-blue-600"
            tooltip="Earned Value"
          />
          <MetricCard
            label="AC"
            value={formatDollar(evm.actualCost)}
            color="text-red-600"
            tooltip="Actual Cost"
          />
          <MetricCard
            label="CV"
            value={formatDollar(evm.cv)}
            color={evm.cv >= 0 ? 'text-green-600' : 'text-red-600'}
            tooltip="Cost Variance (EV - AC)"
          />
          <MetricCard
            label="SV"
            value={formatDollar(evm.sv)}
            color={evm.sv >= 0 ? 'text-green-600' : 'text-red-600'}
            tooltip="Schedule Variance (EV - PV)"
          />
          <MetricCard
            label="TCPI (BAC)"
            value={evm.tcpiBAC != null ? evm.tcpiBAC.toFixed(2) : 'N/A'}
            color={evm.tcpiBAC != null && evm.tcpiBAC <= 1 ? 'text-green-600' : 'text-red-600'}
            tooltip="To-Complete Performance Index (BAC)"
          />
          <MetricCard
            label="TCPI (EAC)"
            value={evm.tcpiEAC != null ? evm.tcpiEAC.toFixed(2) : 'N/A'}
            color="text-gray-900"
            tooltip="To-Complete Performance Index (EAC)"
          />
        </div>
      )}

      {/* S-Curve Chart */}
      {sCurveLoading && <SectionSpinner />}
      {!sCurveLoading && sCurve.length > 0 && (
        <SCurveChart data={sCurve} height={280} />
      )}
      {!sCurveLoading && sCurve.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No S-Curve data available for this project.</p>
      )}
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
// EVM Forecast Tab
// ---------------------------------------------------------------------------

function EVMForecastTab({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['evmForecast', projectId],
    queryFn: () => apiService.getEVMForecast(projectId),
    enabled: !!projectId,
  });

  const forecast = data?.result;

  return (
    <div className="space-y-6">
      {isLoading && <SectionSpinner />}
      {error && <SectionError message="Failed to load EVM forecast." />}
      {!isLoading && !error && forecast && (
        <>
          <EVMForecastDashboard data={forecast} />

          {forecast.historicalTrends?.weeklyData?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">CPI / SPI Trend</h3>
              <EVMTrendChart
                historicalData={forecast.historicalTrends.weeklyData}
                predictions={forecast.aiPredictions?.predictedCPI}
              />
            </div>
          )}

          {forecast.forecastComparison?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Forecast Method Comparison</h3>
              <ForecastComparisonChart
                data={forecast.forecastComparison}
                bac={forecast.currentMetrics?.BAC || 0}
              />
            </div>
          )}
        </>
      )}
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
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: workloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ['resourceWorkload', id],
    queryFn: () => apiService.getResourceWorkload(id!),
    enabled: !!id,
  });

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => apiService.getResources(),
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['projectMembers', id],
    queryFn: () => apiService.getProjectMembers(id!),
    enabled: !!id,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['auditTrail', id],
    queryFn: () => apiService.getAuditTrail(id!),
    enabled: !!id,
  });

  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ userName: '', email: '', role: 'editor' });

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; userName: string; email: string; role: string }) =>
      apiService.addProjectMember(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', id] });
      setShowAddMember(false);
      setNewMember({ userName: '', email: '', role: 'editor' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiService.removeProjectMember(id!, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projectMembers', id] }),
  });

  const workload = workloadData?.workload || [];
  const resources = resourcesData?.resources || [];
  const members = membersData?.members || [];
  const auditActivities = auditData?.activities || [];

  const roleColors: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    editor: 'bg-green-100 text-green-700',
    viewer: 'bg-gray-100 text-gray-600',
  };

  const handleAddMember = () => {
    if (!newMember.userName.trim() || !newMember.email.trim()) return;
    addMemberMutation.mutate({
      userId: `user-${Math.random().toString(36).substr(2, 6)}`,
      userName: newMember.userName,
      email: newMember.email,
      role: newMember.role,
    });
  };

  return (
    <div className="space-y-6">
      {/* Team Members Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
            <span className="text-xs text-gray-400">({members.length})</span>
          </div>
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Member
          </button>
        </div>

        {/* Add member form */}
        {showAddMember && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input
                type="text"
                placeholder="Name"
                value={newMember.userName}
                onChange={e => setNewMember({ ...newMember, userName: e.target.value })}
                className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newMember.email}
                onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <select
                value={newMember.role}
                onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
              <button
                onClick={handleAddMember}
                disabled={addMemberMutation.isPending}
                className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {addMemberMutation.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {membersLoading ? (
          <SectionSpinner />
        ) : (
          <div className="space-y-2">
            {members.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-indigo-600">
                      {member.userName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{member.userName}</div>
                    <div className="text-[10px] text-gray-400">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${roleColors[member.role] || roleColors.viewer}`}>
                    {member.role}
                  </span>
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Log Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-green-500" />
          <h3 className="text-sm font-semibold text-gray-900">Activity Log</h3>
        </div>

        {auditLoading ? (
          <SectionSpinner />
        ) : auditActivities.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {auditActivities.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-3 h-3 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">
                    <span className="font-medium">{entry.userName}</span>
                    {' '}{entry.action}{' '}
                    {entry.field && <span className="font-medium">{entry.field}</span>}
                    {entry.oldValue && entry.newValue && (
                      <span className="text-gray-400"> from "{entry.oldValue}" to "{entry.newValue}"</span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resource Optimizer */}
      <ResourceOptimizerSection projectId={id!} />

      {/* Workload Heatmap */}
      {(workloadLoading || resourcesLoading) ? (
        <SectionSpinner />
      ) : (
        <WorkloadHeatmap workload={workload} resources={resources} />
      )}
    </div>
  );
}

function ResourceOptimizerSection({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['resourceForecast', projectId],
    queryFn: () => apiService.getResourceForecast(projectId),
    enabled: !!projectId,
  });

  const forecast = data?.result;

  if (isLoading) return <SectionSpinner />;
  if (error || !forecast) return null;

  return (
    <>
      <ResourceForecastPanel projectId={projectId} />

      {forecast.capacityForecast?.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Capacity Forecast</h3>
          <CapacityChart data={forecast.capacityForecast} />
        </div>
      )}

      {forecast.rebalanceSuggestions?.length > 0 && (
        <RebalanceSuggestions suggestions={forecast.rebalanceSuggestions} />
      )}
    </>
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
