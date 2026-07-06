import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  Activity,
  Clock,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { AISummaryBanner } from '../components/dashboard/AISummaryBanner';
import { ProjectTable, type ProjectRow } from '../components/dashboard/ProjectTable';
import { IssuesCreatedVsResolvedChart } from '../components/dashboard/widgets/IssuesCreatedVsResolvedChart';
import { MilestonesWidget } from '../components/dashboard/widgets/MilestonesWidget';
import { BudgetWatchWidget } from '../components/dashboard/widgets/BudgetWatchWidget';
import { CustomizeDropdown } from '../components/dashboard/CustomizeDropdown';
import { loadWidgetIds, saveWidgetIds } from '../components/dashboard/WidgetRegistry';
import type { WidgetDef } from '../components/dashboard/WidgetRegistry';
import { KpiTilePM } from '../components/pm/KpiTilePM';
import { ActionCenterPM } from '../components/pm/ActionCenterPM';
import { ActivityFeedPM } from '../components/pm/ActivityFeedPM';

// ─── Widget registry ──────────────────────────────────────────────────────────

const PM_WIDGETS: WidgetDef[] = [
  { id: 'kpi',         label: 'KPI Tiles',              group: 'Overview', defaultOn: true },
  { id: 'intel',       label: 'Portfolio Intelligence', group: 'Overview', defaultOn: true },
  { id: 'projects',    label: 'Projects Table',         group: 'Overview', defaultOn: true },
  { id: 'action',      label: 'Action Center',          group: 'Overview', defaultOn: true },
  { id: 'trend',       label: 'Issues Trend',           group: 'Charts',   defaultOn: true },
  { id: 'milestones',  label: 'Milestones',             group: 'Details',  defaultOn: true },
  { id: 'budget',      label: 'Budget Watch',           group: 'Details',  defaultOn: true },
  { id: 'activity',    label: 'Activity Feed',          group: 'Details',  defaultOn: true },
];

const STORAGE_KEY = 'dashboard-pm-widgets';
const SCOPE_KEY   = 'dashboard-pm:scope';

type Scope = 'mine' | 'portfolio';

// ─── KPI computation helpers ──────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPM() {
  const [enabledSections, setEnabledSections] = useState<Set<string>>(
    () => loadWidgetIds(STORAGE_KEY, PM_WIDGETS)
  );
  const [scope, setScope] = useState<Scope>(() => {
    try {
      const stored = localStorage.getItem(SCOPE_KEY);
      if (stored === 'portfolio' || stored === 'mine') return stored;
    } catch { /* ignore */ }
    return 'mine';
  });

  // Persist state
  useEffect(() => {
    saveWidgetIds(STORAGE_KEY, enabledSections);
  }, [enabledSections]);

  useEffect(() => {
    localStorage.setItem(SCOPE_KEY, scope);
  }, [scope]);

  // Set AI panel context
  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setEnabledSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const show = (id: string) => enabledSections.has(id);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const { data: myProjectsData, isLoading: myLoading } = useQuery({
    queryKey: ['pm-projects'],
    queryFn: () => apiService.getProjects(),
    staleTime: 120_000,
  });

  const { data: allProjectsData } = useQuery({
    queryKey: ['pm-projects', 'portfolio'],
    queryFn: () => apiService.getProjects('portfolio'),
    staleTime: 120_000,
  });

  const { data: predictions } = useQuery({
    queryKey: ['pm-predictions'],
    queryFn: () => apiService.getDashboardPredictions(),
    staleTime: 120_000,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['pm-analytics'],
    queryFn: () => apiService.getAnalyticsSummary(),
    staleTime: 120_000,
  });

  // ─── Derived data ───────────────────────────────────────────────────────────

  const myProjects: ProjectRow[]  = myProjectsData?.data  || myProjectsData?.projects  || [];
  const allProjects: ProjectRow[] = allProjectsData?.data || allProjectsData?.projects || [];
  const showScopeToggle = allProjects.length !== myProjects.length;
  const activeProjects  = scope === 'portfolio' ? allProjects : myProjects;
  const scopeParam      = scope === 'portfolio' ? 'portfolio' as const : undefined;

  // Merge health scores
  const healthMap = new Map<string, number>();
  if (predictions?.projectHealthScores) {
    for (const h of predictions.projectHealthScores) {
      healthMap.set(h.projectId, h.healthScore);
    }
  }
  const projectsWithHealth: ProjectRow[] = activeProjects.map(p => ({
    ...p,
    healthScore: healthMap.get(p.id) ?? p.healthScore,
  }));

  // Slim project list for ActionCenter
  const projectSummaries = activeProjects.map(p => ({ id: p.id, name: p.name }));

  // ─── KPI values ─────────────────────────────────────────────────────────────

  const pred = predictions?.data || predictions;
  const analytics = analyticsData?.data || analyticsData;

  const healthScores: number[] = pred?.projectHealthScores?.map((s: any) => s.healthScore) || [];
  const avgHealth = healthScores.length > 0
    ? Math.round(healthScores.reduce((a: number, b: number) => a + b, 0) / healthScores.length)
    : 0;

  const overdueTasks  = analytics?.tasks?.overdue ?? 0;
  const risks         = pred?.risks;
  const openRisks     = risks ? (risks.critical || 0) + (risks.high || 0) + (risks.medium || 0) : 0;
  const atRiskCount   = analytics?.portfolio?.atRiskProjects?.length ?? 0;

  const allocated     = analytics?.budget?.totalAllocated ?? 0;
  const spent         = analytics?.budget?.totalSpent     ?? 0;
  const variance      = allocated - spent;
  const utilization   = analytics?.budget?.utilizationPercent ?? 0;

  const varianceStr   = variance >= 0
    ? `+$${formatCompact(variance)}`
    : `-$${formatCompact(Math.abs(variance))}`;

  const kpiColor = (v: number, goodBelow: boolean, warnThresh: number, badThresh: number): 'green' | 'amber' | 'red' | 'teal' | 'gray' => {
    if (goodBelow) {
      return v === 0 ? 'green' : v <= warnThresh ? 'amber' : 'red';
    }
    return v >= badThresh ? 'green' : v >= warnThresh ? 'amber' : 'red';
  };

  const healthColor: 'green' | 'amber' | 'red' | 'teal' | 'gray' =
    healthScores.length === 0 ? 'gray' : avgHealth >= 75 ? 'teal' : avgHealth >= 50 ? 'amber' : 'red';
  const varianceColor: 'green' | 'amber' | 'red' | 'teal' | 'gray' = variance >= 0 ? 'green' : 'red';
  const utilColor: 'green' | 'amber' | 'red' | 'teal' | 'gray' =
    utilization > 95 ? 'red' : utilization >= 80 ? 'amber' : 'green';

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (myLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
            <Eye className="w-3 h-3" />
            Read-only monitoring
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showScopeToggle && (
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setScope('mine')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  scope === 'mine'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                My Projects · {myProjects.length}
              </button>
              <button
                onClick={() => setScope('portfolio')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  scope === 'portfolio'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                All Projects · {allProjects.length}
              </button>
            </div>
          )}
          <CustomizeDropdown
            widgets={PM_WIDGETS}
            enabledIds={enabledSections}
            onToggle={toggleWidget}
          />
        </div>
      </div>

      {/* ── KPI Tiles ── */}
      {show('kpi') && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTilePM
            label="Portfolio Health"
            value={`${avgHealth}%`}
            icon={Activity}
            color={healthColor}
            drillPath="/portfolio"
          />
          <KpiTilePM
            label="Overdue Tasks"
            value={overdueTasks}
            icon={Clock}
            color={kpiColor(overdueTasks, true, 5, 10)}
            drillPath="/kpi/overdue"
          />
          <KpiTilePM
            label="Open Risks"
            value={openRisks}
            icon={AlertTriangle}
            color={kpiColor(openRisks, true, 3, 7)}
            drillPath="/kpi/risks"
          />
          <KpiTilePM
            label="At-Risk Projects"
            value={atRiskCount}
            icon={AlertCircle}
            color={kpiColor(atRiskCount, true, 2, 4)}
            drillPath="/kpi/at-risk"
          />
          <KpiTilePM
            label="Budget Variance"
            value={varianceStr}
            icon={TrendingDown}
            color={varianceColor}
            drillPath="/kpi/budget"
          />
          <KpiTilePM
            label="Budget Utilization"
            value={`${Math.round(utilization)}%`}
            icon={DollarSign}
            color={utilColor}
            drillPath="/kpi/budget"
          />
        </div>
      )}

      {/* ── Portfolio Intelligence ── */}
      {show('intel') && <AISummaryBanner />}

      {/* ── Projects Table ── */}
      {show('projects') && <ProjectTable projects={projectsWithHealth} />}

      {/* ── Action Center ── */}
      {show('action') && <ActionCenterPM projects={projectSummaries} />}

      {/* ── Issues Created vs Resolved ── */}
      {show('trend') && <IssuesCreatedVsResolvedChart scope={scopeParam} />}

      {/* ── 3-column grid ── */}
      {(show('milestones') || show('budget') || show('activity')) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {show('milestones') && <MilestonesWidget scope={scopeParam} />}
          {show('budget')     && <BudgetWatchWidget projects={activeProjects} />}
          {show('activity')   && <ActivityFeedPM limit={10} />}
        </div>
      )}

    </div>
  );
}
