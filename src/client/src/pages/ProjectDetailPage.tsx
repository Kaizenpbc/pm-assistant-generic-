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
  Bot,
  MapPin,
  Play,
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
import { WorkloadHeatmap } from '../components/resources/WorkloadHeatmap';
import { PerformancePanel } from '../components/evm/PerformancePanel';
import { ResourceForecastPanel } from '../components/resources/ResourceForecastPanel';
import { RebalanceSuggestions } from '../components/resources/RebalanceSuggestions';
import { CapacityChart } from '../components/resources/CapacityChart';
import { AutoReschedulePanel } from '../components/schedule/AutoReschedulePanel';
import { SaveAsTemplateModal } from '../components/templates/SaveAsTemplateModal';
import { AttachmentPanel } from '../components/attachments/AttachmentPanel';
import { NetworkDiagramView } from '../components/network/NetworkDiagramView';
import { BurndownPanel } from '../components/burndown/BurndownPanel';
import { ChangeRequestList } from '../components/approvals/ChangeRequestList';
import { ChangeRequestForm } from '../components/approvals/ChangeRequestForm';
import { ChangeRequestDetail } from '../components/approvals/ChangeRequestDetail';
import { ImportModal } from '../components/schedule/ImportModal';
import * as XLSX from 'xlsx';
import { cleanCsvForImport } from '../utils/csvCleaner';
import { WorkflowEditor } from '../components/approvals/WorkflowEditor';
import { RiskFormModal } from '../components/risks/RiskFormModal';
import { AIScanReviewModal } from '../components/risks/AIScanReviewModal';
import { RAIDDetailPanel } from '../components/risks/RAIDDetailPanel';
import { ResourcesTab } from '../components/project/ResourcesTab';
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
import { TimeTrackingTab } from '../components/project/TimeTrackingTab';
import { BudgetTab } from '../components/project/BudgetTab';
import { SetupChecklist } from '../components/project/SetupChecklist';
import { ProjectReadinessBar } from '../components/onboarding/ProjectReadinessBar';
import { EditProjectModal } from '../components/project/EditProjectModal';
import { AIInsightsTab, StatusReportModal } from './ProjectDetailPage/AIInsightsTab';
import { ScenariosTab } from './ProjectDetailPage/ScenariosTab';
import { AgentActivityTab } from './ProjectDetailPage/AgentActivityTab';
import { OverviewTab } from './ProjectDetailPage/OverviewTab';
import { Pencil, Zap } from 'lucide-react';
import { getPrimaryTabs, getDefaultViewMode, type Methodology } from '../utils/methodology';

type Tab = 'overview' | 'schedule' | 'raid' | 'ai-insights' | 'performance' | 'scenarios' | 'team' | 'agent-activity' | 'change-requests' | 'sprints' | 'resources' | 'time' | 'files' | 'budget';

const financialTabs: { id: Tab; label: string }[] = [
  { id: 'budget', label: 'Budget' },
  { id: 'scenarios', label: 'What-If' },
];

const moreTabs: { id: Tab; label: string }[] = [
  { id: 'resources', label: 'Resources' },
  { id: 'agent-activity', label: 'Agent Activity' },
];


const statusStyles: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  planning: { label: 'Planning', color: 'bg-purple-100 text-purple-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' },
};



function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
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
  const [showEditProject, setShowEditProject] = useState(false);

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

  const { data: riskStatsData } = useQuery({
    queryKey: ['project-risks-stats', id],
    queryFn: () => apiService.getRiskStats(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  const riskStats = riskStatsData?.data || riskStatsData;

  // Readiness bar data — shares cache with ScheduleTab / ResourcesTab
  const { data: readinessSchedulesData } = useQuery({
    queryKey: ['schedules', id],
    queryFn: () => apiService.getSchedules(id!),
    enabled: !!id,
    staleTime: 120_000,
  });
  const readinessSchedules: any[] = readinessSchedulesData?.schedules || [];
  const firstScheduleId = readinessSchedules[0]?.id;

  const { data: readinessTasksData } = useQuery({
    queryKey: ['tasks', firstScheduleId],
    queryFn: () => apiService.getTasks(firstScheduleId),
    enabled: !!firstScheduleId,
    staleTime: 120_000,
  });
  const readinessTasks: any[] = readinessTasksData?.data || readinessTasksData?.tasks || [];

  const { data: readinessResourcesData } = useQuery({
    queryKey: ['resources'],
    queryFn: () => apiService.getResources(),
    staleTime: 120_000,
  });
  const readinessResources: any[] = readinessResourcesData?.resources || [];

  // Sprint count for readiness bar (agile/hybrid)
  const methodology: Methodology = (project?.methodology || 'waterfall') as Methodology;
  const { data: sprintsData } = useQuery({
    queryKey: ['sprints', id],
    queryFn: () => apiService.getSprints(id!),
    enabled: !!id && methodology !== 'waterfall',
    staleTime: 120_000,
  });
  const sprintCount = (sprintsData?.sprints || sprintsData?.data || []).length;

  // Velocity data for agile/hybrid context cards
  const { data: velocityData } = useQuery({
    queryKey: ['sprint-velocity', id],
    queryFn: () => apiService.getVelocityHistory(id!),
    enabled: !!id && methodology !== 'waterfall',
    staleTime: 120_000,
  });

  const velocitySprints: any[] = velocityData?.velocity?.sprints || [];
  const avgVelocity = velocitySprints.length > 0
    ? Math.round(velocitySprints.reduce((a: number, v: any) => a + (v.velocity || 0), 0) / velocitySprints.length)
    : null;

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: ({ status, cancellationReason }: { status: string; cancellationReason?: string }) =>
      apiService.updateProjectStatus(id!, status, cancellationReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowCancelModal(false);
      setCancelReason('');
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiService.updateProject(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowEditProject(false);
    },
  });

  // Prefetch EVM data on project open — so Performance tab loads instantly
  useEffect(() => {
    if (id) {
      queryClient.prefetchQuery({
        queryKey: ['evmForecast', id],
        queryFn: () => apiService.getEVMForecast(id),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: ['evmForecastAI', id],
        queryFn: () => apiService.getEVMAIPredictions(id),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [id, queryClient]);

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
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    if (newStatus === 'cancelled') {
                      setShowCancelModal(true);
                    } else {
                      statusMutation.mutate({ status: newStatus });
                    }
                  }}
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
                      onClick={() => statusMutation.mutate({ status: 'active' })}
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
            {canEditStatus && (
              <button
                onClick={() => setShowEditProject(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {methodology === 'agile' ? (
          <ContextCard
            label="Velocity"
            value={avgVelocity != null ? `${avgVelocity} pts` : '--'}
            icon={Zap}
            color="bg-purple-50 text-purple-600"
            detail={<p className="mt-1 text-xs text-gray-500">avg pts/sprint</p>}
          />
        ) : (
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
        )}
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
          label="Risks"
          value={riskStats ? `${riskStats.openRisks || 0} Open` : '—'}
          icon={ShieldAlert}
          color={
            riskStats?.critical > 0
              ? 'bg-red-50 text-red-600'
              : riskStats?.openRisks > 0
                ? 'bg-orange-50 text-orange-600'
                : 'bg-green-50 text-green-600'
          }
          detail={riskStats?.critical > 0 ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">{riskStats.critical} critical</p>
          ) : undefined}
        />
        {methodology === 'agile' ? (
          <ContextCard
            label="Sprint"
            value={sprintCount > 0 ? `${sprintCount} sprint${sprintCount !== 1 ? 's' : ''}` : 'No sprints'}
            icon={Zap}
            color="bg-purple-50 text-purple-600"
          />
        ) : methodology === 'hybrid' ? (
          <ContextCard
            label="Velocity"
            value={avgVelocity != null ? `${avgVelocity} pts` : '--'}
            icon={Zap}
            color="bg-purple-50 text-purple-600"
            detail={<p className="mt-1 text-xs text-gray-500">avg pts/sprint</p>}
          />
        ) : (
          <ContextCard
            label="Status"
            value={status.label}
            icon={Calendar}
            color={status.color}
          />
        )}
      </div>

      {/* Readiness Bar */}
      <ProjectReadinessBar
        projectId={id!}
        tasks={readinessTasks}
        resources={readinessResources}
        scheduleId={firstScheduleId}
        methodology={methodology}
        sprintCount={sprintCount}
        onTabChange={(tab) => setActiveTab(tab as Tab)}
      />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-visible">
        <nav className="-mb-px flex gap-4 md:gap-6 flex-wrap">
          {getPrimaryTabs(methodology).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <FinancialsDropdown
            tabs={financialTabs}
            activeTab={activeTab}
            onSelect={setActiveTab}
          />
          <MoreTabsDropdown
            tabs={moreTabs}
            activeTab={activeTab}
            onSelect={setActiveTab}
          />
        </nav>
      </div>

      {/* Setup Checklist */}
      {activeTab === 'overview' && <SetupChecklist project={project} onNavigate={(tab) => setActiveTab(tab as Tab)} />}

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab project={project} />}
      {activeTab === 'raid' && <RAIDTab projectId={id!} />}
      {activeTab === 'schedule' && <ScheduleTab projectId={id!} projectName={project.name} projectStartDate={project.startDate || project.start_date} defaultViewMode={getDefaultViewMode(methodology)} />}
      {activeTab === 'ai-insights' && <AIInsightsTab projectId={id!} />}
      {activeTab === 'performance' && <PerformancePanel projectId={id!} onNavigate={(tab) => setActiveTab(tab as Tab)} />}
      {activeTab === 'scenarios' && <ScenariosTab projectId={id!} />}
      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'agent-activity' && <AgentActivityTab projectId={id!} />}
      {activeTab === 'change-requests' && <ChangeRequestsTab projectId={id!} />}
      {activeTab === 'sprints' && <SprintsTab projectId={id!} />}
      {activeTab === 'resources' && <ResourcesTab projectId={id!} />}
      {activeTab === 'time' && <TimeTrackingTab projectId={id!} />}
      {activeTab === 'budget' && <BudgetTab projectId={id!} project={project} />}
      {activeTab === 'files' && (
        <div className="mt-6">
          <AttachmentPanel entityType="project" entityId={id!} />
        </div>
      )}

      {project && (
        <SaveAsTemplateModal
          isOpen={showSaveTemplate}
          onClose={() => setShowSaveTemplate(false)}
          projectId={id!}
          projectName={project.name}
        />
      )}
      {showEditProject && project && (
        <EditProjectModal
          project={project}
          onSave={(data) => updateProjectMutation.mutate(data)}
          onClose={() => setShowEditProject(false)}
          saving={updateProjectMutation.isPending}
        />
      )}

      {showStatusReport && (
        <StatusReportModal
          projectId={id!}
          projectName={project?.name || ''}
          onClose={() => setShowStatusReport(false)}
        />
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cancel Project</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for cancelling this project. This action will be recorded in the audit trail.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
              autoFocus
            />
            {statusMutation.isError && (
              <p className="text-sm text-red-600 mt-2">Failed to cancel project. Please try again.</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => statusMutation.mutate({ status: 'cancelled', cancellationReason: cancelReason.trim() })}
                disabled={!cancelReason.trim() || statusMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {statusMutation.isPending ? 'Cancelling...' : 'Cancel Project'}
              </button>
            </div>
          </div>
        </div>
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
// More Tabs Dropdown
// ---------------------------------------------------------------------------

function MoreTabsDropdown({
  tabs: dropdownTabs,
  activeTab,
  onSelect,
}: {
  tabs: { id: Tab; label: string }[];
  activeTab: Tab;
  onSelect: (id: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActiveInMore = dropdownTabs.some(t => t.id === activeTab);
  const activeLabel = dropdownTabs.find(t => t.id === activeTab)?.label;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`border-b-2 pb-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
          isActiveInMore
            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        {isActiveInMore ? activeLabel : 'More'}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
          {dropdownTabs.map(t => (
            <button
              key={t.id}
              onClick={() => { onSelect(t.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                activeTab === t.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financials Dropdown
// ---------------------------------------------------------------------------

function FinancialsDropdown({
  tabs: dropdownTabs,
  activeTab,
  onSelect,
}: {
  tabs: { id: Tab; label: string }[];
  activeTab: Tab;
  onSelect: (id: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActiveInFinancials = dropdownTabs.some(t => t.id === activeTab);
  const activeLabel = dropdownTabs.find(t => t.id === activeTab)?.label;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`border-b-2 pb-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
          isActiveInFinancials
            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        <DollarSign className="w-3.5 h-3.5" />
        {isActiveInFinancials ? activeLabel : 'Financials'}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
          {dropdownTabs.map(t => (
            <button
              key={t.id}
              onClick={() => { onSelect(t.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                activeTab === t.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------
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
  const [scanCandidates, setScanCandidates] = useState<any[] | null>(null);
  const [showScanReview, setShowScanReview] = useState(false);
  const [scanAiPowered, setScanAiPowered] = useState(true);
  const [importing, setImporting] = useState(false);

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
      const result = await apiService.runAiRiskScan(projectId);
      setScanCandidates(result.data?.candidates || []);
      setScanAiPowered(result.aiPowered !== false);
      setShowScanReview(true);
    } catch {
      // silently fail
    } finally {
      setScanning(false);
    }
  };

  const handleImportSelected = async (items: Record<string, any>[]) => {
    setImporting(true);
    try {
      await apiService.batchImportRisks(projectId, items);
      queryClient.invalidateQueries({ queryKey: ['project-risks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-risks-stats', projectId] });
      setShowScanReview(false);
      setScanCandidates(null);
    } catch {
      // silently fail
    } finally {
      setImporting(false);
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

      {/* AI Scan Review modal */}
      <AIScanReviewModal
        isOpen={showScanReview}
        onClose={() => { setShowScanReview(false); setScanCandidates(null); }}
        onImport={handleImportSelected}
        candidates={scanCandidates || []}
        importing={importing}
        aiPowered={scanAiPowered}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Tab
// ---------------------------------------------------------------------------

function ScheduleTab({ projectId, projectName, projectStartDate, defaultViewMode = 'gantt' }: { projectId: string; projectName?: string; projectStartDate?: string; defaultViewMode?: string }) {
  const queryClient = useQueryClient();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const [viewMode, setViewMode] = useState<'gantt' | 'kanban' | 'table' | 'calendar' | 'network' | 'burndown'>(defaultViewMode as any);
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
            { mode: 'network' as const, icon: MapPin, label: 'Network' },
            { mode: 'burndown' as const, icon: TrendingUp, label: 'Burndown' },
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

function ScheduleGantt({ schedule, viewMode, projectId }: { schedule: any; viewMode: 'gantt' | 'kanban' | 'table' | 'calendar' | 'network' | 'burndown'; projectId: string }) {
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
      return apiService.createTask(schedule.id, payload as Parameters<typeof apiService.createTask>[1]);
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
      oldValues[key] = (task as unknown as Record<string, unknown>)[key];
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
      return { id, oldValue: t ? (t as unknown as Record<string, unknown>)[field] : undefined };
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
    updateMutation.mutate({ taskId, data: { status: newStatus } });
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
      {viewMode === 'network' && (
        <NetworkDiagramView scheduleId={schedule.id} />
      )}
      {viewMode === 'burndown' && (
        <BurndownPanel scheduleId={schedule.id} />
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
// Network Diagram Tab
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Burndown Tab
// ---------------------------------------------------------------------------


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


