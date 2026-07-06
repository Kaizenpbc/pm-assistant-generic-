import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { apiService } from '../services/api';
import { ProjectHeaderPM } from '../components/pm/ProjectHeaderPM';
import { ProjectTabsPM } from '../components/pm/ProjectTabsPM';
import { TaskListPM } from '../components/pm/TaskListPM';
import { RiskListPM } from '../components/pm/RiskListPM';
import { IssueListPM } from '../components/pm/IssueListPM';
import { MilestoneListPM } from '../components/pm/MilestoneListPM';
import { ProjectHealthPM } from '../components/pm/ProjectHealthPM';
import { AiAssistantPM } from '../components/pm/AiAssistantPM';
import { ActivityFeedPM } from '../components/pm/ActivityFeedPM';

type TabId = 'tasks' | 'risks' | 'issues' | 'milestones' | 'raid' | 'documents';

function healthLabel(score: number): string {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'Watch';
  return 'At Risk';
}

function extractBreakdown(healthData: any) {
  const h = healthData?.data || healthData;
  return {
    scheduleHealth: h?.scheduleHealth ?? h?.schedule_health ?? h?.scheduleScore ?? 0,
    budgetHealth: h?.budgetHealth ?? h?.budget_health ?? h?.budgetScore ?? 0,
    riskHealth: h?.riskHealth ?? h?.risk_health ?? h?.riskScore ?? 0,
  };
}

export function ProjectDetailPM() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('tasks');

  // ── Project ────────────────────────────────────────────────────────────────
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['pm-project-detail', id],
    queryFn: () => apiService.getProject(id!),
    staleTime: 120_000,
    enabled: !!id,
  });

  // ── Health ─────────────────────────────────────────────────────────────────
  const { data: healthData } = useQuery({
    queryKey: ['pm-project-health-detail', id],
    queryFn: () => apiService.getProjectHealth(id!),
    staleTime: 120_000,
    enabled: !!id,
  });

  // ── Schedules (to get scheduleId for tasks) ────────────────────────────────
  const { data: schedulesData } = useQuery({
    queryKey: ['pm-project-schedules', id],
    queryFn: () => apiService.getSchedules(id!),
    staleTime: 120_000,
    enabled: !!id,
  });

  const schedules: any[] = schedulesData?.data || schedulesData?.schedules || [];
  const primarySchedule = schedules[0] ?? null;
  const scheduleId: string | null = primarySchedule?.id ?? null;

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const { data: tasksData } = useQuery({
    queryKey: ['pm-project-tasks', scheduleId],
    queryFn: () => apiService.getTasks(scheduleId!),
    staleTime: 120_000,
    enabled: !!scheduleId,
  });

  // ── Risks ──────────────────────────────────────────────────────────────────
  const { data: risksData } = useQuery({
    queryKey: ['pm-project-risks-detail', id],
    queryFn: () => apiService.getProjectRisks(id!),
    staleTime: 120_000,
    enabled: !!id,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const project = projectData?.data || projectData?.project || projectData;

  const healthObj = healthData?.data || healthData;
  const healthScore: number = healthObj?.overallHealth ?? healthObj?.healthScore ?? healthObj?.score ?? 0;
  const label = healthLabel(healthScore);
  const breakdown = extractBreakdown(healthData);

  const allTasks: any[] = tasksData?.data || tasksData?.tasks || [];

  // Milestones: tasks flagged as milestone
  const milestones = allTasks.filter(
    (t: any) => t.isMilestone === true || t.milestone === true || t.taskType === 'milestone'
  );

  // Regular tasks (non-milestone)
  const tasks = allTasks.filter(
    (t: any) => !(t.isMilestone === true || t.milestone === true || t.taskType === 'milestone')
  );

  const risks: any[] = risksData?.data || risksData?.risks || [];

  // Issues: risks with type 'issue' or from issues endpoint (risks API may include issues)
  const issues: any[] = risks.filter(
    (r: any) => r.type === 'issue' || r.itemType === 'issue'
  );
  const pureRisks: any[] = risks.filter(
    (r: any) => r.type !== 'issue' && r.itemType !== 'issue'
  );

  const tabCounts: Record<string, number> = {
    tasks: tasks.length,
    risks: pureRisks.length,
    issues: issues.length,
    milestones: milestones.length,
    raid: 0,
    documents: 0,
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Project not found.</p>
        <Link to="/projects-pm" className="mt-2 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
        </Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      {/* Back nav */}
      <Link
        to="/projects-pm"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </Link>

      {/* Header band */}
      <ProjectHeaderPM project={project} healthScore={healthScore} healthLabel={label} />

      {/* Two-column layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* ── Left: tabs + content (col-span-8) ── */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <ProjectTabsPM
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as TabId)}
            counts={tabCounts}
          />

          {/* Tab content */}
          {activeTab === 'tasks' && (
            <TaskListPM tasks={tasks} />
          )}
          {activeTab === 'risks' && (
            <RiskListPM risks={pureRisks} />
          )}
          {activeTab === 'issues' && (
            <IssueListPM issues={issues} />
          )}
          {activeTab === 'milestones' && (
            <MilestoneListPM milestones={milestones} />
          )}
          {activeTab === 'raid' && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">RAID log coming soon.</p>
            </div>
          )}
          {activeTab === 'documents' && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">Documents coming soon.</p>
            </div>
          )}
        </div>

        {/* ── Right rail (col-span-4, sticky) ── */}
        <div className="col-span-12 lg:col-span-4 space-y-4 lg:sticky lg:top-[84px] self-start">
          <ProjectHealthPM healthScore={healthScore} breakdown={breakdown} />
          <AiAssistantPM projectId={id!} projectName={project?.name ?? ''} />
          <ActivityFeedPM limit={6} />
        </div>
      </div>
    </div>
  );
}
