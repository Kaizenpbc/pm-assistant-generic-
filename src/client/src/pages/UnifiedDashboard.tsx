import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { AISummaryBanner } from '../components/dashboard/AISummaryBanner';
import { TemplatePicker } from '../components/templates/TemplatePicker';
import { ProjectTable, type ProjectRow } from '../components/dashboard/ProjectTable';
import { CustomizeDropdown } from '../components/dashboard/CustomizeDropdown';
import { UNIFIED_WIDGETS, loadWidgetIds, saveWidgetIds } from '../components/dashboard/WidgetRegistry';
import { PortfolioKPIBar } from '../components/dashboard/widgets/PortfolioKPIBar';
import { IssuesCreatedVsResolvedChart } from '../components/dashboard/widgets/IssuesCreatedVsResolvedChart';
import { MilestonesWidget } from '../components/dashboard/widgets/MilestonesWidget';
import { BudgetWatchWidget } from '../components/dashboard/widgets/BudgetWatchWidget';
import { RecentActivityWidget } from '../components/dashboard/widgets/RecentActivityWidget';
import { NextBestActionsWidget } from '../components/dashboard/widgets/NextBestActionsWidget';
import { HealthTrendsWidget } from '../components/dashboard/widgets/HealthTrendsWidget';

const STORAGE_KEY = 'dashboard-widgets:unified';
const SCOPE_KEY = 'dashboard:scope';

type Scope = 'portfolio' | 'mine';

export function UnifiedDashboard() {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [enabledSections, setEnabledSections] = useState<Set<string>>(() => loadWidgetIds(STORAGE_KEY, UNIFIED_WIDGETS));
  const [scope, setScope] = useState<Scope>(() => {
    try {
      const stored = localStorage.getItem(SCOPE_KEY);
      if (stored === 'portfolio' || stored === 'mine') return stored;
    } catch { /* ignore */ }
    return 'mine';
  });

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  useEffect(() => {
    saveWidgetIds(STORAGE_KEY, enabledSections);
  }, [enabledSections]);

  useEffect(() => {
    localStorage.setItem(SCOPE_KEY, scope);
  }, [scope]);

  const toggleWidget = useCallback((id: string) => {
    setEnabledSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Fetch projects for both scopes to determine if scope toggle should show
  const { data: myProjectsData, isLoading: myLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });

  const { data: allProjectsData } = useQuery({
    queryKey: ['projects', 'portfolio'],
    queryFn: () => apiService.getProjects('portfolio'),
  });

  const { data: predictions } = useQuery({
    queryKey: ['dashboard-predictions'],
    queryFn: () => apiService.getDashboardPredictions(),
    staleTime: 120_000,
  });

  const myProjects: ProjectRow[] = myProjectsData?.data || myProjectsData?.projects || [];
  const allProjects: ProjectRow[] = allProjectsData?.data || allProjectsData?.projects || [];
  const showScopeToggle = allProjects.length !== myProjects.length;
  const activeProjects = scope === 'portfolio' ? allProjects : myProjects;
  const scopeParam = scope === 'portfolio' ? 'portfolio' as const : undefined;

  // Merge health scores into projects
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

  const show = (id: string) => enabledSections.has(id);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (myLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {showScopeToggle && (
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setScope('mine')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${scope === 'mine' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
              >
                My Projects
              </button>
              <button
                onClick={() => setScope('portfolio')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${scope === 'portfolio' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
              >
                All Projects
              </button>
            </div>
          )}
          <CustomizeDropdown
            widgets={UNIFIED_WIDGETS}
            enabledIds={enabledSections}
            onToggle={toggleWidget}
          />
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      {show('kpi') && <PortfolioKPIBar scope={scopeParam} />}

      {/* Portfolio Intelligence */}
      {show('intel') && <AISummaryBanner />}

      {/* Projects Table */}
      {show('projects') && <ProjectTable projects={projectsWithHealth} />}

      {/* Issues Trend Chart */}
      {show('trend') && <IssuesCreatedVsResolvedChart scope={scopeParam} />}

      {/* 3-column grid */}
      {(show('milestones') || show('budget') || show('activity')) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {show('milestones') && <MilestonesWidget scope={scopeParam} />}
          {show('budget') && <BudgetWatchWidget projects={activeProjects} />}
          {show('activity') && <RecentActivityWidget />}
        </div>
      )}

      {/* Next Best Actions */}
      {show('next-actions') && <NextBestActionsWidget />}

      {/* Health Trends Sparklines */}
      {show('health-trends') && <HealthTrendsWidget projects={activeProjects} />}

      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
      />
    </div>
  );
}
