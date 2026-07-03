import React, { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  TrendingUp,
  DollarSign,
  CheckCircle,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { AISummaryBanner } from '../components/dashboard/AISummaryBanner';
import { ProjectTable } from '../components/dashboard/ProjectTable';
import { CustomizeDropdown } from '../components/dashboard/CustomizeDropdown';
import { WidgetGrid } from '../components/dashboard/WidgetGrid';
import { EXEC_WIDGETS, loadWidgetIds, saveWidgetIds, loadWidgetOrder, saveWidgetOrder } from '../components/dashboard/WidgetRegistry';
import { RecentActivityWidget } from '../components/dashboard/widgets/RecentActivityWidget';
import { ResourceUtilizationWidget } from '../components/dashboard/widgets/ResourceUtilizationWidget';
import { BurndownMiniWidget } from '../components/dashboard/widgets/BurndownMiniWidget';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  budgetAllocated?: number;
  budgetSpent?: number;
  progressPercentage?: number;
  startDate?: string;
  endDate?: string;
}

const STORAGE_KEY = 'dashboard-widgets:exec';

export const ExecutiveDashboard: React.FC = () => {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => loadWidgetIds(STORAGE_KEY, EXEC_WIDGETS));
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => loadWidgetOrder(STORAGE_KEY, EXEC_WIDGETS));

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  useEffect(() => {
    saveWidgetOrder(STORAGE_KEY, widgetOrder);
  }, [widgetOrder]);

  useEffect(() => {
    saveWidgetIds(STORAGE_KEY, enabledIds);
  }, [enabledIds]);

  const toggleWidget = useCallback((id: string) => {
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });

  const projects: Project[] = projectsData?.projects || [];

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budgetAllocated || 0), 0);

  // On-track: active projects where budget spent <= allocated AND progress is reasonable
  // relative to elapsed time (or has no end date / just started)
  const onTrackCount = projects.filter((p) => {
    if (p.status !== 'active') return false;
    const budgetOk = !p.budgetAllocated || (p.budgetSpent || 0) <= p.budgetAllocated;
    const now = Date.now();
    const start = p.startDate ? new Date(p.startDate).getTime() : now;
    const end = p.endDate ? new Date(p.endDate).getTime() : 0;
    const elapsed = end > start ? (now - start) / (end - start) : 0;
    const progress = (p.progressPercentage || 0) / 100;
    // Schedule OK if no end date, not started yet, or progress within 20% of elapsed time
    const scheduleOk = !end || elapsed <= 0 || progress >= elapsed - 0.2;
    return budgetOk && scheduleOk;
  }).length;
  const onTrackPct = activeProjects > 0 ? Math.round((onTrackCount / activeProjects) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const renderWidget = (id: string) => {
    switch (id) {
      case 'ai-summary':
        return <AISummaryBanner />;
      case 'stats':
        return (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard label="Total Projects" value={String(totalProjects)} icon={FolderKanban} color="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" />
            <StatsCard label="Active" value={String(activeProjects)} icon={TrendingUp} color="bg-green-50 text-green-600" />
            <StatsCard label="Total Budget" value={`$${(totalBudget / 1000).toFixed(0)}K`} icon={DollarSign} color="bg-blue-50 text-blue-600" />
            <StatsCard label="On Track" value={`${onTrackPct}%`} icon={CheckCircle} color="bg-emerald-50 text-emerald-600" />
          </div>
        );
      case 'projects':
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Projects</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">{totalProjects} projects</span>
            </div>
            <ProjectTable projects={projects} />
          </div>
        );
      case 'activity':
        return <RecentActivityWidget />;
      case 'utilization':
        return <ResourceUtilizationWidget />;
      case 'burndown':
        return <BurndownMiniWidget />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Overview</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Portfolio-level view of all projects and key metrics.
          </p>
        </div>
        <CustomizeDropdown
          widgets={EXEC_WIDGETS}
          enabledIds={enabledIds}
          onToggle={toggleWidget}
        />
      </div>

      {/* Widget Grid */}
      <WidgetGrid
        widgets={EXEC_WIDGETS}
        enabledIds={enabledIds}
        widgetOrder={widgetOrder}
        onReorder={setWidgetOrder}
        renderWidget={renderWidget}
      />
    </div>
  );
};

function StatsCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
