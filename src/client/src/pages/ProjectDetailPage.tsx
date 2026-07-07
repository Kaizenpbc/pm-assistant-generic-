import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CloudSun,
  MapPin,
  Lightbulb,
  Play,
  SlidersHorizontal,
  ChevronDown,
  Download,
  Upload,
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
  FileText,
  ClipboardCopy,
  X,
  Target,
  Search,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
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
import { TaskPrioritizationPanel } from '../components/ai/TaskPrioritizationPanel';
import { SaveAsTemplateModal } from '../components/templates/SaveAsTemplateModal';
import { AttachmentPanel } from '../components/attachments/AttachmentPanel';
import { CustomFieldsSection } from '../components/customfields/CustomFieldsSection';
import { NetworkDiagramView } from '../components/network/NetworkDiagramView';
import { BurndownPanel } from '../components/burndown/BurndownPanel';
import { ChangeRequestList } from '../components/approvals/ChangeRequestList';
import { ChangeRequestForm } from '../components/approvals/ChangeRequestForm';
import { ChangeRequestDetail } from '../components/approvals/ChangeRequestDetail';
import { ImportModal } from '../components/schedule/ImportModal';
import * as XLSX from 'xlsx';
import { cleanCsvForImport } from '../utils/csvCleaner';
import { WorkflowEditor } from '../components/approvals/WorkflowEditor';
import { PortalLinkManager } from '../components/portal/PortalLinkManager';
import { RiskFormModal } from '../components/risks/RiskFormModal';
import { RAIDDetailPanel } from '../components/risks/RAIDDetailPanel';
import { ResourceLevelingPanel } from '../components/resources/ResourceLevelingPanel';
import { SprintList } from '../components/sprints/SprintList';
import { SprintPlanningPanel } from '../components/sprints/SprintPlanningPanel';
import { SprintBoard } from '../components/sprints/SprintBoard';
import { SprintBurndownChart } from '../components/sprints/SprintBurndownChart';
import { AvailabilityCalendar } from '../components/resources/AvailabilityCalendar';
import { usePresence } from '../hooks/usePresence';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useColumnState } from '../hooks/useColumnState';
import { COLUMN_DEFS } from '../components/schedule/tableColumns';
import { ColumnPickerDropdown } from '../components/schedule/ColumnPickerDropdown';
import { TaskListMobile } from '../components/tasks/TaskListMobile';
import { useUndoRedo } from '../hooks/useUndoRedo';

type Tab = 'overview' | 'schedule' | 'raid' | 'ai-insights' | 'evm-forecast' | 'scenarios' | 'team' | 'agent-activity' | 'network-diagram' | 'burndown' | 'change-requests' | 'sprints' | 'resource-leveling';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'raid', label: 'RAID' },
  { id: 'change-requests', label: 'Change Requests' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'resource-leveling', label: 'Resource Leveling' },
  { id: 'ai-insights', label: 'AI Insights' },
  { id: 'evm-forecast', label: 'EVM Forecast' },
  { id: 'network-diagram', label: 'Network Diagram' },
  { id: 'burndown', label: 'Burndown' },
  { id: 'scenarios', label: 'What-If' },
  { id: 'team', label: 'Team' },
  { id: 'agent-activity', label: 'Agent Activity' },
];

const statusStyles: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  planning: { label: 'Planning', color: 'bg-purple-100 text-purple-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' },
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
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200';
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
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200';
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
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 text-xs font-medium text-primary-600 dark:text-primary-400">
      <Bot className="h-3 w-3" />
      AI Powered
    </span>
  );
}

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
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
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showStatusReport, setShowStatusReport] = useState(false);

  const { user } = useAuthStore();
  const canEditStatus = user?.role === 'admin' || user?.role === 'project_manager';
  const presenceViewers = usePresence(id);
  const otherViewers = presenceViewers.filter(v => v.userId !== user?.id);

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

  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => apiService.updateProjectStatus(id!, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

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

  // Close export menu on click outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400">Project not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
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
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{project.name}</h1>
              {canEditStatus ? (
                <select
                  value={project.status}
                  onChange={(e) => statusMutation.mutate(e.target.value)}
                  disabled={statusMutation.isPending}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer border border-current border-opacity-30 outline-none pr-5 ${status.color} ${statusMutation.isPending ? 'opacity-60' : 'hover:opacity-80'}`}
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              ) : (
                <>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                  {project.status === 'planning' && (
                    <button
                      onClick={() => statusMutation.mutate('active')}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      Start Project
                    </button>
                  )}
                </>
              )}
            </div>
            {(project.description) && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {otherViewers.length > 0 && (
              <div className="flex items-center mr-1">
                <div className="flex -space-x-2">
                  {otherViewers.slice(0, 5).map((viewer) => {
                    const initials = viewer.username
                      .split(/[\s._-]+/)
                      .map(p => p[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || '?';
                    return (
                      <div
                        key={viewer.userId}
                        className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 border-2 border-white flex items-center justify-center"
                        title={`${viewer.username} is viewing`}
                      >
                        <span className="text-[10px] font-semibold text-primary-700 dark:text-primary-300">{initials}</span>
                      </div>
                    );
                  })}
                  {otherViewers.length > 5 && (
                    <div
                      className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white flex items-center justify-center"
                      title={`${otherViewers.length - 5} more viewers`}
                    >
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">+{otherViewers.length - 5}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5 whitespace-nowrap">viewing</span>
              </div>
            )}
            <button
              onClick={() => setShowStatusReport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 hover:bg-primary-100 dark:bg-primary-900/40 rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Status Report
            </button>
            <button
              onClick={() => setShowSaveTemplate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 hover:bg-primary-100 dark:bg-primary-900/40 rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save as Template
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                  <button
                    onClick={() => { apiService.exportProjectCSV(id!); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => { apiService.exportProjectXML(id!); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export for MS Project
                  </button>
                  <button
                    onClick={() => { apiService.exportProjectPDF(id!); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export as PDF
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { window.print(); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Gantt
                  </button>
                </div>
              )}
            </div>
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
              : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
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
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab project={project} />}
      {activeTab === 'raid' && <RAIDTab projectId={id!} />}
      {activeTab === 'schedule' && <ScheduleTab projectId={id!} projectName={project.name} projectStartDate={project.startDate || project.start_date} />}
      {activeTab === 'ai-insights' && <AIInsightsTab projectId={id!} />}
      {activeTab === 'evm-forecast' && <EVMForecastTab projectId={id!} />}
      {activeTab === 'scenarios' && <ScenariosTab projectId={id!} />}
      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'agent-activity' && <AgentActivityTab projectId={id!} />}
      {activeTab === 'network-diagram' && <NetworkDiagramTab projectId={id!} />}
      {activeTab === 'burndown' && <BurndownTab projectId={id!} />}
      {activeTab === 'change-requests' && <ChangeRequestsTab projectId={id!} />}
      {activeTab === 'sprints' && <SprintsTab projectId={id!} />}
      {activeTab === 'resource-leveling' && <ResourceLevelingTab projectId={id!} />}

      {project && (
        <SaveAsTemplateModal
          isOpen={showSaveTemplate}
          onClose={() => setShowSaveTemplate(false)}
          projectId={id!}
          projectName={project.name}
        />
      )}

      {showStatusReport && (
        <StatusReportModal
          projectId={id!}
          projectName={project?.name || ''}
          onClose={() => setShowStatusReport(false)}
        />
      )}
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {detail}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function OverviewTab({ project }: { project: any }) {
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['project-members', project.id],
    queryFn: () => apiService.getProjectMembers(project.id),
    enabled: !!project.id,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['project-analytics', project.id],
    queryFn: () => apiService.getProjectAnalyticsSummary(project.id),
    enabled: !!project.id,
  });

  // Fetch schedules → primary schedule → tasks (for milestones)
  const { data: schedulesData } = useQuery({
    queryKey: ['schedules', project.id],
    queryFn: () => apiService.getSchedules(project.id),
    enabled: !!project.id,
  });
  const schedules: any[] = schedulesData?.schedules || schedulesData?.data || [];
  const primaryScheduleId: string | null = schedules[0]?.id ?? null;

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['overview-tasks', primaryScheduleId],
    queryFn: () => apiService.getTasks(primaryScheduleId!),
    enabled: !!primaryScheduleId,
  });
  const allTasks: any[] = tasksData?.data || tasksData?.tasks || [];
  const milestones = allTasks
    .filter((t: any) => t.isMilestone === true || t.milestone === true || t.taskType === 'milestone')
    .sort((a: any, b: any) => {
      const da = a.startDate || a.start_date || a.endDate || a.end_date || '';
      const db = b.startDate || b.start_date || b.endDate || b.end_date || '';
      return da.localeCompare(db);
    });

  const members: any[] = membersData?.members || [];
  const summary = analyticsData?.summary || analyticsData;

  const formatDate = (d: string | undefined) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  const startDate = project.startDate || project.start_date;
  const endDate = project.endDate || project.end_date;

  // Timeline calculations
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const elapsedPct = start && end && end > start
    ? Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100))
    : 0;
  const taskProgressPct = summary?.portfolio?.avgProgress ?? summary?.tasks?.completionRate ?? 0;
  const isOverdue = end ? now > end : false;
  const onTrack = isOverdue ? false : taskProgressPct >= elapsedPct - 10;

  // Find project manager from members
  const manager = members.find((m: any) => m.role === 'owner' || m.role === 'manager');
  const managerName = manager ? (manager.user?.name || manager.name || manager.email) : 'Not assigned';

  const maxVisibleMembers = 6;
  const visibleMembers = members.slice(0, maxVisibleMembers);
  const overflowCount = members.length - maxVisibleMembers;

  const taskStats = summary?.tasks;

  const cardClass = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';
  const headingClass = 'text-base font-semibold text-gray-900 dark:text-white mb-4';
  const skeletonPulse = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  return (
    <div className="space-y-6">
      {/* Row 1: Description + Project Details (condensed) + Team Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Description + condensed details */}
        <div className={`lg:col-span-2 space-y-6`}>
          {/* Project Description */}
          {project.description && (
            <div className={cardClass}>
              <h3 className={headingClass}>Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {project.description}
              </p>
            </div>
          )}

          {/* Condensed Project Details — inline chips */}
          <div className={cardClass}>
            <h3 className={headingClass}>Project Details</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {project.priority && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Priority</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[project.priority] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {project.priority}
                  </span>
                </span>
              )}
              {project.category && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Category</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{project.category}</span>
                </span>
              )}
              {project.type && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Type</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{project.type}</span>
                </span>
              )}
              {project.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{project.location}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="text-gray-500 dark:text-gray-400">PM</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {membersLoading ? <span className={`inline-block h-4 w-20 ${skeletonPulse}`} /> : managerName}
                </span>
              </span>
              {startDate && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Start</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(startDate)}</span>
                </span>
              )}
              {endDate && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">End</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(endDate)}</span>
                </span>
              )}
              {project.currency && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Currency</span>
                  <span className="font-medium text-gray-900 dark:text-white">{project.currency.toUpperCase()}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Team Members</span>
          </h3>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${skeletonPulse}`} />
                  <div className={`h-4 w-28 ${skeletonPulse}`} />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No team members assigned</p>
          ) : (
            <div className="space-y-3">
              {visibleMembers.map((m: any, idx: number) => {
                const name = m.user?.name || m.name || m.email || 'Unknown';
                const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                const colors = [
                  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
                ];
                return (
                  <div key={m.id || idx} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${colors[idx % colors.length]}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                      {m.role || 'member'}
                    </span>
                  </div>
                );
              })}
              {overflowCount > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">+{overflowCount} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Task Summary + Timeline Progress + Key Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Task Summary */}
        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Task Summary</span>
          </h3>
          {analyticsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-16 ${skeletonPulse}`} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Total Tasks" value={taskStats?.total ?? 0} />
                <StatBox label="Completed" value={taskStats?.byStatus?.completed ?? 0} color="text-green-600 dark:text-green-400" />
                <StatBox label="Overdue" value={taskStats?.overdue ?? 0} color={taskStats?.overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
                <StatBox label="In Progress" value={taskStats?.byStatus?.in_progress ?? 0} color="text-blue-600 dark:text-blue-400" />
              </div>
              {taskStats?.completedLast30Days != null && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Completed last 30 days: {taskStats.completedLast30Days}
                </p>
              )}
            </>
          )}
        </div>

        {/* Timeline Progress */}
        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline Progress</span>
          </h3>
          {!start || !end ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No start/end dates set.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Elapsed</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">{Math.round(elapsedPct)}%</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Complete</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">{Math.round(taskProgressPct)}%</span>
                </div>
              </div>
              <div className="relative">
                <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-500' : onTrack ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, elapsedPct)}%` }}
                  />
                </div>
                {elapsedPct > 0 && elapsedPct < 100 && (
                  <div className="absolute top-0 w-0.5 h-3 bg-gray-900 dark:bg-white" style={{ left: `${elapsedPct}%` }} title="Today" />
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(startDate)}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">Today</span>
                <span>{formatDate(endDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                {isOverdue ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                  </span>
                ) : onTrack ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> On track
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Behind schedule
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Key Milestones */}
        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Key Milestones</span>
          </h3>
          {tasksLoading || (!primaryScheduleId && schedules.length === 0) ? (
            !primaryScheduleId && !tasksLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No schedule created yet.</p>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-10 ${skeletonPulse}`} />
                ))}
              </div>
            )
          ) : milestones.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No milestones defined. Mark tasks as milestones in the Schedule tab.</p>
          ) : (
            <div className="space-y-2.5">
              {milestones.map((m: any) => {
                const mDate = m.endDate || m.end_date || m.startDate || m.start_date;
                const mStatus = m.status || 'not_started';
                const isPast = mDate && new Date(mDate) < now;
                const isDone = mStatus === 'completed' || mStatus === 'done';
                return (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : isPast ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <div className="w-3 h-3 mt-0.5 rotate-45 border-2 border-primary-500 bg-transparent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isDone ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {m.name}
                      </p>
                      <p className={`text-xs ${isPast && !isDone ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {mDate ? formatDate(mDate) : 'No date'}
                        {isPast && !isDone && ' — overdue'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Attachments + Custom Fields + Portal Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={cardClass}>
          <AttachmentPanel entityType="project" entityId={project.id} />
        </div>
        {project.id && (
          <div className={cardClass}>
            <CustomFieldsSection entityType="project" entityId={project.id} projectId={project.id} />
          </div>
        )}
        {project.id && (
          <div className={cardClass}>
            <PortalLinkManager projectId={project.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 text-center">
      <p className={`text-2xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RAID Tab
// ---------------------------------------------------------------------------

function RAIDTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editRisk, setEditRisk] = useState<any>(null);
  const [defaultType, setDefaultType] = useState<'risk' | 'issue' | 'action' | 'decision'>('risk');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedRaidId, setSelectedRaidId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const filters: Record<string, string> = {};
  if (filterType) filters.type = filterType;
  if (filterStatus) filters.status = filterStatus;
  if (filterSeverity) filters.severity = filterSeverity;
  if (filterSource) filters.source = filterSource;
  if (searchText.trim()) filters.search = searchText.trim();

  const { data: risksData, isLoading } = useQuery({
    queryKey: ['project-risks', projectId, filters],
    queryFn: () => apiService.getRiskItems(projectId, filters),
    enabled: !!projectId,
  });

  const { data: statsData } = useQuery({
    queryKey: ['project-risks-stats', projectId],
    queryFn: () => apiService.getRiskStats(projectId),
    enabled: !!projectId,
  });

  const { data: membersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => apiService.getProjectMembers(projectId),
    enabled: !!projectId,
  });

  const risks: any[] = risksData?.data || [];
  const stats = statsData?.data || {};
  const members: any[] = membersData?.members || [];

  const handleAiScan = async () => {
    setScanning(true);
    try {
      await apiService.runAiRiskScan(projectId);
      queryClient.invalidateQueries({ queryKey: ['project-risks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-risks-stats', projectId] });
    } catch {
      // silently fail
    } finally {
      setScanning(false);
    }
  };

  const openAdd = (type: 'risk' | 'issue' | 'action' | 'decision') => {
    setEditRisk(null);
    setDefaultType(type);
    setShowForm(true);
  };

  const openEdit = (risk: any) => {
    setEditRisk(risk);
    setDefaultType(risk.type);
    setShowForm(true);
  };

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['project-risks', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-risks-stats', projectId] });
  };

  const severityColor = (s: string) => {
    if (s === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (s === 'high') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (s === 'medium') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  };

  const statusColor = (s: string) => {
    if (s === 'open') return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
    if (s === 'monitoring') return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
    if (s === 'mitigating' || s === 'in_progress') return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
    if (s === 'mitigated' || s === 'resolved' || s === 'completed' || s === 'decided') return 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400';
    if (s === 'pending_decision') return 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400';
    if (s === 'deferred') return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
    if (s === 'cancelled' || s === 'reversed') return 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500';
    return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  };

  const typeIndicatorColor = (t: string) => {
    if (t === 'risk') return 'bg-red-500';
    if (t === 'issue') return 'bg-orange-500';
    if (t === 'action') return 'bg-blue-500';
    if (t === 'decision') return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const scoreColor = (score: number) => {
    if (score >= 16) return 'text-red-600 dark:text-red-400';
    if (score >= 10) return 'text-orange-600 dark:text-orange-400';
    if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const formatDate = (d: string | undefined) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const memberName = (userId: string | null) => {
    if (!userId) return '';
    const m = members.find((m: any) => (m.userId || m.id) === userId);
    return m ? (m.userName || m.user?.name || m.name || m.email || '') : '';
  };

  const cardClass = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
  const selectClass = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Open Risks</span>
          <span className="text-sm font-bold text-red-600 dark:text-red-400">{stats.openRisks ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Open Issues</span>
          <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{stats.openIssues ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Open Actions</span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{stats.openActions ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Pending Decisions</span>
          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{stats.pendingDecisions ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Critical</span>
          <span className="text-sm font-bold text-red-700 dark:text-red-300">{stats.critical ?? 0}</span>
        </div>
        {(stats.triggered ?? 0) > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <span className="text-xs text-gray-500 dark:text-gray-400">Triggered</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{stats.triggered}</span>
          </div>
        )}
      </div>

      {/* Actions + Filters bar */}
      <div className={`${cardClass} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => openAdd('risk')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Risk
          </button>
          <button onClick={() => openAdd('issue')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Issue
          </button>
          <button onClick={() => openAdd('action')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Action
          </button>
          <button onClick={() => openAdd('decision')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Decision
          </button>
          <button
            onClick={handleAiScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors disabled:opacity-50"
          >
            {scanning ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            {scanning ? 'Scanning...' : 'AI Scan'}
          </button>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-40 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectClass}>
            <option value="">All Types</option>
            <option value="risk">Risks</option>
            <option value="issue">Issues</option>
            <option value="action">Actions</option>
            <option value="decision">Decisions</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="monitoring">Monitoring</option>
            <option value="mitigating">Mitigating</option>
            <option value="in_progress">In Progress</option>
            <option value="mitigated">Mitigated</option>
            <option value="resolved">Resolved</option>
            <option value="completed">Completed</option>
            <option value="pending_decision">Pending Decision</option>
            <option value="decided">Decided</option>
            <option value="deferred">Deferred</option>
            <option value="cancelled">Cancelled</option>
            <option value="reversed">Reversed</option>
            <option value="closed">Closed</option>
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className={selectClass}>
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={selectClass}>
            <option value="">All Sources</option>
            <option value="manual">Manual</option>
            <option value="ai_detected">AI Detected</option>
            <option value="agent">Agent</option>
          </select>
        </div>
      </div>

      {/* RAID table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : risks.length === 0 ? (
        <div className={`${cardClass} p-8 text-center`}>
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">No RAID Items</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add a Risk, Issue, Action, or Decision — or run AI Scan.
          </p>
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[60px_1fr_80px_72px_100px_100px_60px_80px] gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/30 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span>ID</span>
            <span>Title</span>
            <span>Type</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Owner</span>
            <span>Score</span>
            <span>Date</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {risks.map((risk: any) => {
              const isTerminal = ['cancelled', 'reversed'].includes(risk.status);
              return (
                <div
                  key={risk.id}
                  className={`grid grid-cols-1 md:grid-cols-[60px_1fr_80px_72px_100px_100px_60px_80px] gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors ${isTerminal ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedRaidId(risk.id)}
                >
                  {/* Record ID */}
                  <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400">
                    {risk.recordId || '—'}
                  </span>

                  {/* Title + type indicator */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-6 rounded-full flex-shrink-0 ${typeIndicatorColor(risk.type)}`} />
                    <p className={`text-sm font-medium text-gray-900 dark:text-white truncate ${isTerminal ? 'line-through' : ''}`}>
                      {risk.title}
                    </p>
                    {risk.triggered && <span className="text-amber-500 flex-shrink-0" title="Triggered">⚡</span>}
                  </div>

                  {/* Type badge */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize w-fit ${
                    risk.type === 'risk' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    risk.type === 'issue' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    risk.type === 'action' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}>
                    {risk.type}
                  </span>

                  {/* Severity */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize w-fit ${severityColor(risk.severity)}`}>
                    {risk.severity}
                  </span>

                  {/* Status */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize w-fit ${statusColor(risk.status)}`}>
                    {risk.status.replace('_', ' ')}
                  </span>

                  {/* Owner */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {memberName(risk.ownerId) || '—'}
                  </span>

                  {/* Score */}
                  <span className={`text-sm font-bold ${scoreColor(risk.riskScore)}`}>
                    {(risk.type === 'risk' || risk.type === 'issue') ? risk.riskScore : '—'}
                  </span>

                  {/* Date */}
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {formatDate(risk.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide-out detail panel */}
      {selectedRaidId && (
        <RAIDDetailPanel
          projectId={projectId}
          raidId={selectedRaidId}
          onClose={() => setSelectedRaidId(null)}
          onEdit={(item) => { setSelectedRaidId(null); openEdit(item); }}
          members={members}
        />
      )}

      {/* Form modal */}
      <RiskFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSaved={onSaved}
        projectId={projectId}
        editRisk={editRisk}
        defaultType={defaultType}
        members={members}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Tab
// ---------------------------------------------------------------------------

function ScheduleTab({ projectId, projectName, projectStartDate }: { projectId: string; projectName?: string; projectStartDate?: string }) {
  const queryClient = useQueryClient();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const [viewMode, setViewMode] = useState<'gantt' | 'kanban' | 'table' | 'calendar'>('gantt');
  const [uploadingSchedule, setUploadingSchedule] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const scheduleFileRef = useRef<HTMLInputElement>(null);

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];

  const handleScheduleFileUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setUploadingSchedule(true);
    try {
      let csvText: string;
      const ext = file.name.toLowerCase().split('.').pop();
      const isExcel = ext === 'xlsx' || ext === 'xls' || ext === 'xlsb' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel';

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });
        csvText = cleanCsvForImport(XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]));
      } else if (ext === 'csv') {
        csvText = cleanCsvForImport(await file.text());
      } else {
        setUploadError('Please upload a .csv, .xlsx, or .xls file.');
        setUploadingSchedule(false);
        return;
      }

      const startDate = projectStartDate || new Date().toISOString().split('T')[0];
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const schedule = await apiService.createSchedule({
        projectId,
        name: `${projectName || 'Project'} Schedule`,
        startDate,
        endDate: endDate.toISOString().split('T')[0],
      });
      const scheduleId = schedule.schedule?.id || schedule.id;
      if (scheduleId) {
        await apiService.importTasks(scheduleId, csvText);
      }
      queryClient.invalidateQueries({ queryKey: ['schedules', projectId] });
    } catch {
      setUploadError('Failed to create schedule or import tasks.');
    } finally {
      setUploadingSchedule(false);
      if (scheduleFileRef.current) scheduleFileRef.current.value = '';
    }
  }, [projectId, projectName, projectStartDate, queryClient]);

  if (schedulesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
        <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Schedules</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No schedules have been created for this project yet.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            onClick={() => scheduleFileRef.current?.click()}
            disabled={uploadingSchedule}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            {uploadingSchedule ? 'Importing...' : 'Upload Schedule (.xlsx / .csv)'}
          </button>
          {uploadError && (
            <p className="text-xs text-red-600">{uploadError}</p>
          )}
          <input
            ref={scheduleFileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScheduleFileUpload(file);
            }}
          />
        </div>
      </div>
    );
  }

  if (isMobile) {
    return <MobileScheduleView schedules={schedules} />;
  }

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 overflow-x-auto">
          {([
            { mode: 'gantt' as const, icon: GanttChartSquare, label: 'Gantt' },
            { mode: 'kanban' as const, icon: Kanban, label: 'Kanban' },
            { mode: 'table' as const, icon: Table2, label: 'Table' },
            { mode: 'calendar' as const, icon: CalendarDays, label: 'Calendar' },
          ] as const).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === mode
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700'
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

function MobileScheduleView({ schedules }: { schedules: any[] }) {
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', schedules[0]?.id],
    queryFn: () => apiService.getTasks(schedules[0]?.id),
    enabled: schedules.length > 0,
  });

  const tasks = tasksData?.data || tasksData?.tasks || [];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        {schedules[0]?.name || 'Tasks'}
      </h3>
      <TaskListMobile tasks={tasks} />
    </div>
  );
}

function ScheduleGantt({ schedule, viewMode, projectId }: { schedule: any; viewMode: 'gantt' | 'kanban' | 'table' | 'calendar'; projectId: string }) {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [createTaskDates, setCreateTaskDates] = useState<{ startDate: string; endDate: string; parentTaskId?: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const columnState = useColumnState(schedule.id);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);
  const [showReschedulePanel, setShowReschedulePanel] = useState(false);
  const cpmNeeded = columnState.cpmNeeded;

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', schedule.id],
    queryFn: () => apiService.getTasks(schedule.id),
  });

  const tasks: GanttTask[] = tasksData?.data || tasksData?.tasks || [];

  // Critical Path
  const { data: cpmData } = useQuery({
    queryKey: ['criticalPath', schedule.id],
    queryFn: () => apiService.getCriticalPath(schedule.id),
    enabled: showCriticalPath || cpmNeeded,
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
    mutationFn: (data: TaskFormData & { afterTaskId?: string }) => {
      // Build dependencies[] from predecessors
      const deps = (data.predecessors || [])
        .filter(p => p.dependencyId)
        .map(p => ({ dependencyId: p.dependencyId, dependencyType: p.dependencyType || 'FS', lagDays: parseInt(p.lagDays) || 0 }));
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || undefined,
        status: data.status,
        priority: data.priority,
        assignedTo: data.assignedTo || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        progressPercentage: data.progressPercentage,
        parentTaskId: data.parentTaskId || undefined,
        estimatedDays: data.estimatedDays ? parseInt(data.estimatedDays) : undefined,
        recurrenceRule: data.recurrenceRule || undefined,
        isRecurrenceTemplate: data.isRecurrenceTemplate || undefined,
        isMilestone: data.isMilestone || undefined,
        dependencies: deps.length > 0 ? deps : undefined,
        afterTaskId: data.afterTaskId || undefined,
      };
      return apiService.createTask(schedule.id, payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      setShowAddForm(false);
      setActiveTaskId(null);
    },
  });

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: TaskFormData | Record<string, unknown> }) => {
      if ('name' in data && 'status' in data && 'priority' in data && 'assignedTo' in data) {
        // Full TaskFormData
        const d = data as TaskFormData;
        const deps = (d.predecessors || [])
          .filter(p => p.dependencyId)
          .map(p => ({ dependencyId: p.dependencyId, dependencyType: p.dependencyType || 'FS', lagDays: parseInt(p.lagDays) || 0 }));
        const payload: Record<string, unknown> = {
          name: d.name,
          description: d.description || undefined,
          status: d.status,
          priority: d.priority,
          assignedTo: d.assignedTo || undefined,
          startDate: d.startDate || undefined,
          endDate: d.endDate || undefined,
          progressPercentage: d.progressPercentage,
          parentTaskId: d.parentTaskId || undefined,
          estimatedDays: d.estimatedDays ? parseInt(d.estimatedDays) : undefined,
          recurrenceRule: d.recurrenceRule || undefined,
          isRecurrenceTemplate: d.isRecurrenceTemplate || undefined,
          isMilestone: d.isMilestone || undefined,
          dependencies: deps,
        };
        return apiService.updateTask(schedule.id, taskId, payload);
      }
      return apiService.updateTask(schedule.id, taskId, data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      setEditingTask(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || 'Failed to update task';
      alert(msg);
    },
  });

  // Delete task
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => {
      return apiService.deleteTask(schedule.id, taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      setEditingTask(null);
      setActiveTaskId(null);
    },
  });

  // Undo/redo
  const { canUndo, canRedo, undoDescription, redoDescription, pushAction, undo, redo } = useUndoRedo();

  // Update task with undo support
  const updateTaskWithUndo = useCallback((taskId: string, data: Record<string, unknown>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) { updateMutation.mutate({ taskId, data }); return; }
    // Capture old values for undo
    const oldValues: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      oldValues[key] = (task as any)[key];
    }
    const fieldNames = Object.keys(data).join(', ');
    pushAction({
      description: `Edit ${task.name} (${fieldNames})`,
      undo: () => updateMutation.mutate({ taskId, data: oldValues }),
      redo: () => updateMutation.mutate({ taskId, data }),
    });
    updateMutation.mutate({ taskId, data });
  }, [tasks, updateMutation, pushAction]);

  // Drag-end with undo (bar drag for dates)
  const handleTaskDragEndWithUndo = useCallback((taskId: string, newStart: string, newEnd: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const oldStart = task.startDate;
    const oldEnd = task.endDate;
    pushAction({
      description: `Move ${task.name}`,
      undo: () => updateMutation.mutate({ taskId, data: { startDate: oldStart, endDate: oldEnd } }),
      redo: () => updateMutation.mutate({ taskId, data: { startDate: newStart, endDate: newEnd } }),
    });
    updateMutation.mutate({ taskId, data: { startDate: newStart, endDate: newEnd } });
  }, [tasks, updateMutation, pushAction]);

  // Row reorder with undo
  const handleTaskReorder = useCallback((updates: Array<{ taskId: string; sortOrder: number }>) => {
    // Capture old sortOrders
    const oldOrders = updates.map(u => {
      const t = tasks.find(tt => tt.id === u.taskId);
      return { taskId: u.taskId, sortOrder: t?.sortOrder ?? 0 };
    });
    pushAction({
      description: `Reorder tasks`,
      undo: () => {
        apiService.bulkUpdateTasks(oldOrders.map(o => ({ id: o.taskId, scheduleId: schedule.id, sortOrder: o.sortOrder })));
        queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      },
      redo: () => {
        apiService.bulkUpdateTasks(updates.map(u => ({ id: u.taskId, scheduleId: schedule.id, sortOrder: u.sortOrder })));
        queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      },
    });
    apiService.bulkUpdateTasks(updates.map(u => ({ id: u.taskId, scheduleId: schedule.id, sortOrder: u.sortOrder })));
    queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
  }, [tasks, schedule.id, pushAction, queryClient]);

  // Bulk update with undo
  const handleBulkUpdate = useCallback(async (taskIds: string[], field: string, value: string) => {
    // Capture old values
    const oldValues = taskIds.map(id => {
      const t = tasks.find(tt => tt.id === id);
      return { id, oldValue: t ? (t as any)[field] : undefined };
    });
    pushAction({
      description: `Bulk update ${field} on ${taskIds.length} tasks`,
      undo: async () => {
        await Promise.all(oldValues.map(o => apiService.updateTask(schedule.id, o.id, { [field]: o.oldValue })));
        queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      },
      redo: async () => {
        await Promise.all(taskIds.map(id => apiService.updateTask(schedule.id, id, { [field]: value })));
        queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
      },
    });
    await Promise.all(taskIds.map(id => apiService.updateTask(schedule.id, id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
  }, [tasks, schedule.id, pushAction, queryClient]);

  // Bulk delete (NOT undoable — confirmed by delete dialog)
  const handleBulkDelete = useCallback(async (taskIds: string[]) => {
    await Promise.all(taskIds.map(id => apiService.deleteTask(schedule.id, id)));
    queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] });
  }, [schedule.id, queryClient]);

  // Kanban status change
  const handleKanbanStatusChange = (taskId: string, newStatus: string) => {
    updateMutation.mutate({ taskId, data: { status: newStatus } as any });
  };

  if (tasksLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Controls bar */}
      {/* Shared column picker — all views */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <ColumnPickerDropdown
          columns={COLUMN_DEFS}
          visibleKeys={columnState.visibleKeys}
          onToggle={columnState.toggleColumn}
          onToggleGroup={columnState.toggleGroup}
          onMoveColumn={columnState.moveColumn}
          columnOrder={columnState.columnOrder}
          onResetOrder={() => columnState.setColumnOrder([])}
        />

        {viewMode === 'gantt' && (
          <>
          <div className="h-4 w-px bg-gray-200 mx-1" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
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
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:bg-primary-900/40 rounded-md transition-colors"
          >
            <Save className="w-3 h-3" />
            Save Baseline
          </button>

          {baselines.length > 0 && (
            <>
              <select
                value={selectedBaselineId}
                onChange={(e) => { setSelectedBaselineId(e.target.value); setShowComparison(false); }}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800"
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
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    showComparison
                      ? 'bg-primary-600 text-white'
                      : 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:bg-primary-900/40'
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
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
          >
            <Upload className="w-3 h-3" />
            Import CSV
          </button>

          <button
            onClick={() => setShowReschedulePanel(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
          >
            <Bot className="w-3 h-3" />
            AI Reschedule
          </button>

          {cpmData && showCriticalPath && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
              Project duration: {cpmData.projectDuration} days | Critical tasks: {cpmData.criticalPathTaskIds?.length || 0}
            </span>
          )}
          </>
        )}
      </div>

      {viewMode === 'gantt' && (
        <GanttChart
          tasks={tasks}
          scheduleName={schedule.name}
          scheduleId={schedule.id}
          onTaskSelect={(task) => setActiveTaskId(task.id)}
          onTaskClick={(task) => setEditingTask(task)}
          activeTaskId={activeTaskId}
          onAddTask={() => setShowAddForm(true)}
          onCreateTaskWithDates={(startDate, endDate, parentTaskId) => {
            setCreateTaskDates({ startDate, endDate, parentTaskId });
            setShowAddForm(true);
          }}
          onDeleteTask={(taskId) => deleteMutation.mutate(taskId)}
          columnState={columnState}
          onTaskDragEnd={handleTaskDragEndWithUndo}
          onTaskUpdate={updateTaskWithUndo}
          onTaskReorder={handleTaskReorder}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
          canUndo={canUndo}
          canRedo={canRedo}
          undoDescription={undoDescription}
          redoDescription={redoDescription}
          onUndo={undo}
          onRedo={redo}
          criticalPathTaskIds={showCriticalPath ? cpmData?.criticalPathTaskIds : undefined}
          taskFloatMap={showCriticalPath && cpmData?.tasks ? Object.fromEntries(cpmData.tasks.map((t: any) => [t.taskId, t.totalFloat])) : undefined}
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
          onTaskClick={(task) => { setActiveTaskId(task.id); setEditingTask(task as GanttTask); }}
          onStatusChange={handleKanbanStatusChange}
          activeTaskId={activeTaskId}
        />
      )}
      {viewMode === 'table' && (
        <TableView
          tasks={tasks}
          scheduleId={schedule.id}
          onTaskSelect={(task) => setActiveTaskId(task.id)}
          onTaskClick={(task) => setEditingTask(task)}
          activeTaskId={activeTaskId}
          onTaskUpdate={(taskId, data) => updateMutation.mutate({ taskId, data })}
          columnState={columnState}
          cpmData={cpmData}
          baselineData={comparison}
          scheduleStartDate={schedule.startDate}
        />
      )}
      {viewMode === 'calendar' && (
        <CalendarView
          tasks={tasks}
          onTaskClick={(task) => { setActiveTaskId(task.id); setEditingTask(task); }}
        />
      )}

      {/* Baseline Variance Report */}
      {showComparison && comparison && (
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary-500" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Baseline Variance Report — {comparison.baselineName}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Saved {new Date(comparison.baselineDate).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={() => setShowComparison(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 text-xs"
            >
              Close
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 p-3 text-center">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Health</div>
              <div className={`mt-1 text-lg font-bold ${
                comparison.summary.scheduleHealthPct >= 70 ? 'text-green-600' :
                comparison.summary.scheduleHealthPct >= 40 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {comparison.summary.scheduleHealthPct}%
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 p-3 text-center">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Slipped</div>
              <div className="mt-1 text-lg font-bold text-red-600">{comparison.summary.tasksSlipped}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 p-3 text-center">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">On Track</div>
              <div className="mt-1 text-lg font-bold text-green-600">{comparison.summary.tasksOnTrack}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 p-3 text-center">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Ahead</div>
              <div className="mt-1 text-lg font-bold text-blue-600">{comparison.summary.tasksAhead}</div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 p-3 text-center">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Avg End Var</div>
              <div className={`mt-1 text-lg font-bold ${
                comparison.summary.avgEndVarianceDays > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {comparison.summary.avgEndVarianceDays > 0 ? '+' : ''}{comparison.summary.avgEndVarianceDays}d
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 p-3 text-center">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">New Tasks</div>
              <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{comparison.summary.newTasks}</div>
            </div>
          </div>

          {/* Task Variance Table */}
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase">Task</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase">Start Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase">End Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase">Duration Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase">Progress Var</th>
                  <th className="text-center px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {comparison.taskVariances.map((tv: any) => (
                  <tr key={tv.taskId} className="border-b border-gray-50 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">
                    <td className="px-2 py-1.5 text-gray-800 dark:text-gray-100 font-medium">{tv.taskName}</td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.startVarianceDays > 0 ? 'text-red-600' : tv.startVarianceDays < 0 ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {tv.startVarianceDays > 0 ? '+' : ''}{tv.startVarianceDays}d
                    </td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.endVarianceDays > 0 ? 'text-red-600' : tv.endVarianceDays < 0 ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {tv.endVarianceDays > 0 ? '+' : ''}{tv.endVarianceDays}d
                    </td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.durationVarianceDays > 0 ? 'text-red-600' : tv.durationVarianceDays < 0 ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {tv.durationVarianceDays > 0 ? '+' : ''}{tv.durationVarianceDays}d
                    </td>
                    <td className={`text-center px-2 py-1.5 font-medium ${
                      tv.progressVariancePct > 0 ? 'text-green-600' : tv.progressVariancePct < 0 ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {tv.progressVariancePct > 0 ? '+' : ''}{tv.progressVariancePct}%
                    </td>
                    <td className="text-center px-2 py-1.5">
                      {tv.statusChanged ? (
                        <span className="text-amber-600">{tv.baselineStatus} → {tv.actualStatus}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">{tv.actualStatus}</span>
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
          projectId={projectId}
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
          projectId={projectId}
          activeTaskId={createTaskDates?.parentTaskId || activeTaskId}
          initialStartDate={createTaskDates?.startDate}
          initialEndDate={createTaskDates?.endDate}
          onSave={(data) => {
            // Determine afterTaskId based on active task context
            const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
            let afterTaskId: string | undefined;
            if (activeTask) {
              const hasChildren = tasks.some(t => t.parentTaskId === activeTask.id);
              if (hasChildren) {
                // Active task is a parent — new task becomes its last child (no afterTaskId needed, parentTaskId set in modal)
              } else {
                // Active task is a leaf/sibling — insert after it
                afterTaskId = activeTask.id;
              }
            }
            createMutation.mutate({ ...data, afterTaskId });
          }}
          onClose={() => { setShowAddForm(false); setCreateTaskDates(null); }}
          isSaving={createMutation.isPending}
        />
      )}

      {/* Import CSV Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        scheduleId={schedule.id}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['tasks', schedule.id] })}
      />

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
  const { data: schedulesData } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];
  const firstScheduleId = schedules.length > 0 ? schedules[0].id : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {firstScheduleId && (
        <div className="lg:col-span-2">
          <TaskPrioritizationPanel projectId={projectId} scheduleId={firstScheduleId} />
        </div>
      )}
      <TaskSlipPredictionSection projectId={projectId} />
      <ScopeCreepSection projectId={projectId} />
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

// --- Task Slip Prediction Section ---

function TaskSlipPredictionSection({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['taskSlips', projectId],
    queryFn: () => apiService.getTaskSlipPredictions(projectId),
    enabled: !!projectId,
  });

  const tasks = data?.data?.tasks || [];
  const summary = data?.data?.summary || '';

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const barColor = (prob: number) =>
    prob >= 80 ? 'bg-red-500' : prob >= 60 ? 'bg-orange-500' : prob >= 30 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-5 w-5 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Task Slip Predictions</h3>
      </div>
      {isLoading ? (
        <SectionSpinner />
      ) : tasks.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{summary || 'No tasks at risk of slipping'}</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{summary}</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {tasks.map((task: any) => (
              <div key={task.taskId} className="p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-900 dark:text-white truncate flex-1">{task.taskName}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColor(task.severity)}`}>
                    {task.slipProbability}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-1.5">
                  <div className={`h-1.5 rounded-full ${barColor(task.slipProbability)}`} style={{ width: `${task.slipProbability}%` }} />
                </div>
                {task.reasons.length > 0 && (
                  <ul className="text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5">
                    {task.reasons.map((r: string, i: number) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                )}
                {task.suggestedAction && (
                  <p className="text-[10px] text-primary-600 dark:text-primary-400 mt-1 font-medium">{task.suggestedAction}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Scope Creep Section ---

function ScopeCreepSection({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['scopeCreep', projectId],
    queryFn: () => apiService.getScopeCreepIndicators(projectId),
    enabled: !!projectId,
  });

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-5 w-5 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Scope Creep Detector</h3>
      </div>
      {isLoading ? (
        <SectionSpinner />
      ) : !data?.hasBaseline ? (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">Create a baseline to enable scope creep detection.</p>
          <p className="text-[10px] text-gray-300 mt-1">Go to Schedule → Baselines to create one.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${severityColor(data.severity)}`}>
              {data.severity.charAt(0).toUpperCase() + data.severity.slice(1)} Risk
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-2.5 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{data.indicators?.taskCountDelta ?? 0}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">New Tasks</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-2.5 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">+{data.indicators?.estimateIncreaseDays ?? 0}d</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Estimate Growth</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-2.5 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{data.indicators?.changeRequestCount ?? 0}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Open Change Requests</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-2.5 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{data.baselineComparison?.summary?.scheduleHealthPct ?? 100}%</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Schedule Health</div>
            </div>
          </div>
          {data.baselineComparison?.summary && (
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
              <span>{data.baselineComparison.summary.tasksSlipped} slipped</span>
              <span>{data.baselineComparison.summary.tasksAhead} ahead</span>
              <span>{data.baselineComparison.summary.tasksOnTrack} on track</span>
              <span>{data.baselineComparison.summary.totalTasks} total</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Status Report Modal ---

function StatusReportModal({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const [report, setReport] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => apiService.generateReport({ reportType: 'weekly-status', projectId }),
    onSuccess: (data) => setReport(data),
  });

  useEffect(() => {
    mutation.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const content = report?.report?.content || report?.content || '';

  const sections = content.split(/^## /m).filter(Boolean).map((s: string) => {
    const nlIdx = s.indexOf('\n');
    return { title: s.slice(0, nlIdx).trim(), body: s.slice(nlIdx + 1).trim() };
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `status-report-${projectName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Status Report — {projectName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {content && (
              <>
                <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded">
                  <ClipboardCopy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={handleDownload} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded">
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded">
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Generating status report...</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This may take a few seconds</p>
            </div>
          ) : mutation.isError ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-500">Failed to generate report</p>
              <button onClick={() => mutation.mutate()} className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline">Try again</button>
            </div>
          ) : sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((s: any, i: number) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                  <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{s.body}</div>
                </div>
              ))}
            </div>
          ) : content ? (
            <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{content}</div>
          ) : null}
        </div>
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary-500" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Earned Value Management — S-Curve</h3>
      </div>

      {/* Extended EVM Metrics */}
      {evm && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 mb-4">
          <MetricCard
            label="PV"
            value={formatDollar(evm.plannedValue)}
            color="text-gray-900 dark:text-white"
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
            color="text-gray-900 dark:text-white"
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
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No S-Curve data available for this project.</p>
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Risk Assessment</h3>
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
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
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
                  className={`rounded-lg border p-3 ${severityColors[risk.severity] || 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${severityDotColors[risk.severity] || 'bg-gray-400'}`}
                      />
                      <span className="text-xs font-semibold capitalize">{risk.severity}</span>
                    </div>
                    {risk.trend && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{risk.trend}</span>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">{risk.title}</h4>
                  {risk.description && (
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                      {risk.description}
                    </p>
                  )}
                  <div className="mt-2 flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-0.5">
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
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-0.5">
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
            <p className="text-sm text-gray-400 dark:text-gray-500">No risks identified for this project.</p>
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-blue-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Weather Impact</h3>
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
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Set project location for weather analysis
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
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
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <CloudSun className="h-3.5 w-3.5" />
                    <span>{weather.currentConditions}</span>
                  </div>
                )}
              </div>

              {/* Affected Tasks */}
              {weather.affectedTasks && weather.affectedTasks.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Affected Tasks</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {weather.affectedTasks.map((task: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200"
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
                  <h4 className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">Weekly Outlook</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {typeof weather.weeklyOutlook === 'string'
                      ? weather.weeklyOutlook
                      : JSON.stringify(weather.weeklyOutlook)}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {weather.recommendations && weather.recommendations.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Recommendations</h4>
                  <ul className="space-y-1.5">
                    {weather.recommendations.map((rec: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300"
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-green-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Budget Forecast</h3>
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
                color="text-gray-900 dark:text-white"
                tooltip="Estimate at Completion"
              />
              <MetricCard
                label="ETC"
                value={formatDollar(evm.etc)}
                color="text-gray-900 dark:text-white"
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
                color="text-gray-900 dark:text-white"
                tooltip="Current burn rate"
              />
            </div>
          )}

          {/* Overrun Probability & Projected Completion */}
          <div className="flex flex-wrap items-center gap-4">
            {budget.overrunProbability != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Overrun Probability:</span>
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
                <span className="text-xs text-gray-500 dark:text-gray-400">Projected Completion:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(budget.projectedCompletion).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {budget.recommendations && budget.recommendations.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Recommendations</h4>
              <ul className="space-y-1.5">
                {budget.recommendations.map((rec: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300"
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
    <div className="rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 p-3 text-center" title={tooltip}>
      <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</div>
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
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">CPI / SPI Trend</h3>
              <EVMTrendChart
                historicalData={forecast.historicalTrends.weeklyData}
                predictions={forecast.aiPredictions?.predictedCPI}
              />
            </div>
          )}

          {forecast.forecastComparison?.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Forecast Method Comparison</h3>
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
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-5 w-5 text-primary-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Model a Scenario</h3>
        </div>

        <div className="space-y-4">
          {/* Scenario Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-200">
              Scenario Description
            </label>
            <input
              type="text"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g., What if we add 5 more workers and extend the deadline by 2 weeks?"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Confidence:</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${Math.round(result.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
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
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h4 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Resource Impact</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {typeof result.resourceImpact === 'string'
                  ? result.resourceImpact
                  : JSON.stringify(result.resourceImpact)}
              </p>
            </div>
          )}

          {/* Affected Tasks */}
          {result.affectedTasks && result.affectedTasks.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h4 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Affected Tasks</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {result.affectedTasks.map((task: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200"
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
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h4 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Recommendations</h4>
              <ul className="space-y-1.5">
                {result.recommendations.map((rec: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300"
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
        <label className="text-xs font-medium text-gray-700 dark:text-gray-200">{label}</label>
        <span className="text-xs font-bold text-gray-900 dark:text-white">
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
        className="w-full accent-primary-600"
      />
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">{title}</h4>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
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
    mutationFn: (data: { userId?: string; userName: string; email: string; role: string }) =>
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
    viewer: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  };

  const handleAddMember = () => {
    if (!newMember.userName.trim() || !newMember.email.trim()) return;
    addMemberMutation.mutate({
      userName: newMember.userName,
      email: newMember.email,
      role: newMember.role,
    });
  };

  return (
    <div className="space-y-6">
      {/* Team Members Section */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-500" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Team Members</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">({members.length})</span>
          </div>
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:bg-primary-900/40 rounded-md transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Member
          </button>
        </div>

        {/* Add member form */}
        {showAddMember && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input
                type="text"
                placeholder="Name"
                value={newMember.userName}
                onChange={e => setNewMember({ ...newMember, userName: e.target.value })}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newMember.email}
                onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <select
                value={newMember.role}
                onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
              <button
                onClick={handleAddMember}
                disabled={addMemberMutation.isPending}
                className="text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
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
              <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                      {member.userName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{member.userName}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleColors[member.role] || roleColors.viewer}`}>
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
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-green-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Activity Log</h3>
        </div>

        {auditLoading ? (
          <SectionSpinner />
        ) : auditActivities.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {auditActivities.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-200">
                    <span className="font-medium">{entry.userName}</span>
                    {' '}{entry.action}{' '}
                    {entry.field && <span className="font-medium">{entry.field}</span>}
                    {entry.oldValue && entry.newValue && (
                      <span className="text-gray-400 dark:text-gray-500"> from "{entry.oldValue}" to "{entry.newValue}"</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
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

      {/* Resource Availability Calendar */}
      {resources.length > 0 && (
        <ResourceAvailabilitySection resources={resources} />
      )}
    </div>
  );
}

function ResourceAvailabilitySection({ resources }: { resources: any[] }) {
  const [selectedResourceId, setSelectedResourceId] = useState(resources[0]?.id || '');
  const selectedResource = resources.find((r: any) => r.id === selectedResourceId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Availability for:</label>
        <select
          value={selectedResourceId}
          onChange={e => setSelectedResourceId(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {resources.map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      {selectedResource && (
        <AvailabilityCalendar
          resourceId={selectedResource.id}
          resourceName={selectedResource.name}
        />
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
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Capacity Forecast</h3>
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
// Agent Activity Tab
// ---------------------------------------------------------------------------

const agentLabels: Record<string, string> = {
  auto_reschedule: 'Auto-Reschedule',
  budget: 'Budget',
  monte_carlo: 'Monte Carlo',
  meeting: 'Meeting',
};

const resultBadgeColors: Record<string, string> = {
  alert_created: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  error: 'bg-orange-100 text-orange-700',
};

function AgentActivityTab({ projectId }: { projectId: string }) {
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 25;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const canTriggerScan = user?.role === 'admin' || user?.role === 'project_manager' || user?.role === 'pmo';

  const scanMutation = useMutation({
    mutationFn: () => apiService.triggerAgentScan(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentActivityLog', projectId] });
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['agentActivityLog', projectId, agentFilter, page],
    queryFn: () => apiService.getAgentActivityLog(projectId, limit, page * limit, agentFilter || undefined),
    enabled: !!projectId,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Activity Log</h3>
        <div className="flex items-center gap-3">
          {canTriggerScan && (
            <button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5" />
              {scanMutation.isPending ? 'Running...' : 'Run AI Analysis'}
            </button>
          )}
          {scanMutation.isError && (
            <span className="text-xs text-red-600">Scan failed</span>
          )}
          {scanMutation.isSuccess && !scanMutation.isPending && (
            <span className="text-xs text-green-600">Scan complete</span>
          )}
          <select
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPage(0); }}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
          >
            <option value="">All Agents</option>
            <option value="auto_reschedule">Auto-Reschedule</option>
            <option value="budget">Budget</option>
            <option value="monte_carlo">Monte Carlo</option>
            <option value="meeting">Meeting</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">No agent activity recorded yet</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Time</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Agent</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Result</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-700 dark:text-gray-200">
                      {agentLabels[entry.agentName] || entry.agentName}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${resultBadgeColors[entry.result] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                        {entry.result === 'alert_created' ? 'Alert Created' : entry.result === 'skipped' ? 'Skipped' : 'Error'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded border px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="rounded border px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Network Diagram Tab
// ---------------------------------------------------------------------------

function NetworkDiagramTab({ projectId }: { projectId: string }) {
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  // Auto-select first schedule
  React.useEffect(() => {
    if (schedules.length > 0 && !selectedScheduleId) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId]);

  if (schedulesLoading) return <SectionSpinner />;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Network Diagram</h3>
        {schedules.length > 1 && (
          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
          >
            {schedules.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
      {selectedScheduleId && <NetworkDiagramView scheduleId={selectedScheduleId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Burndown Tab
// ---------------------------------------------------------------------------

function BurndownTab({ projectId }: { projectId: string }) {
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  React.useEffect(() => {
    if (schedules.length > 0 && !selectedScheduleId) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId]);

  if (schedulesLoading) return <SectionSpinner />;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Burndown / Burnup</h3>
        {schedules.length > 1 && (
          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
          >
            {schedules.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
      {selectedScheduleId && <BurndownPanel scheduleId={selectedScheduleId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change Requests Tab
// ---------------------------------------------------------------------------

function ChangeRequestsTab({ projectId }: { projectId: string }) {
  const [view, setView] = useState<'list' | 'form' | 'detail' | 'workflow'>('list');
  const [selectedCrId, setSelectedCrId] = useState<string | undefined>();

  if (view === 'form') {
    return (
      <div className="mt-6">
        <ChangeRequestForm
          projectId={projectId}
          crId={selectedCrId}
          onClose={() => { setView('list'); setSelectedCrId(undefined); }}
          onSaved={() => { setView('list'); setSelectedCrId(undefined); }}
        />
      </div>
    );
  }

  if (view === 'detail' && selectedCrId) {
    return (
      <div className="mt-6">
        <ChangeRequestDetail
          crId={selectedCrId}
          onBack={() => { setView('list'); setSelectedCrId(undefined); }}
        />
      </div>
    );
  }

  if (view === 'workflow') {
    return (
      <div className="mt-6">
        <WorkflowEditor
          projectId={projectId}
          onClose={() => setView('list')}
          onSaved={() => setView('list')}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Change Requests</h3>
        <button
          onClick={() => setView('workflow')}
          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800"
        >
          Manage Workflows
        </button>
      </div>
      <ChangeRequestList
        projectId={projectId}
        onSelect={(id) => { setSelectedCrId(id); setView('detail'); }}
        onNew={() => { setSelectedCrId(undefined); setView('form'); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sprints Tab
// ---------------------------------------------------------------------------

function SprintsTab({ projectId }: { projectId: string }) {
  const { data: schedulesData } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>();
  const [sprintView, setSprintView] = useState<'list' | 'planning' | 'board' | 'burndown'>('list');

  React.useEffect(() => {
    if (schedules.length > 0 && !selectedScheduleId) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sprint Planning</h3>
        <div className="flex items-center gap-3">
          {schedules.length > 1 && (
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
            >
              {schedules.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {selectedSprintId && (
            <div className="flex gap-1">
              {(['list', 'planning', 'board', 'burndown'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSprintView(v)}
                  className={`px-3 py-1 text-xs rounded-md capitalize ${sprintView === v ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {sprintView === 'list' && (
        <SprintList
          projectId={projectId}
          onSelect={(id) => { setSelectedSprintId(id); setSprintView('planning'); }}
          onCreate={() => { setSelectedSprintId(undefined); setSprintView('planning'); }}
        />
      )}
      {sprintView === 'planning' && selectedScheduleId && (
        <SprintPlanningPanel
          projectId={projectId}
          scheduleId={selectedScheduleId}
          sprintId={selectedSprintId || ''}
        />
      )}
      {sprintView === 'board' && selectedSprintId && (
        <SprintBoard sprintId={selectedSprintId} />
      )}
      {sprintView === 'burndown' && selectedSprintId && (
        <SprintBurndownChart sprintId={selectedSprintId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resource Leveling Tab
// ---------------------------------------------------------------------------

function ResourceLevelingTab({ projectId }: { projectId: string }) {
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  React.useEffect(() => {
    if (schedules.length > 0 && !selectedScheduleId) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId]);

  if (schedulesLoading) return <SectionSpinner />;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resource Leveling</h3>
        {schedules.length > 1 && (
          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
          >
            {schedules.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
      {selectedScheduleId && <ResourceLevelingPanel projectId={projectId} scheduleId={selectedScheduleId} />}
    </div>
  );
}

