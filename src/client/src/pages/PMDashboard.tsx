import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { AISummaryBanner } from '../components/dashboard/AISummaryBanner';
import { TemplatePicker } from '../components/templates/TemplatePicker';
import { ProjectTable, type ProjectRow } from '../components/dashboard/ProjectTable';
import { CustomizeDropdown } from '../components/dashboard/CustomizeDropdown';
import { WidgetGrid } from '../components/dashboard/WidgetGrid';
import { PM_WIDGETS, loadWidgetIds, saveWidgetIds, loadWidgetOrder, saveWidgetOrder } from '../components/dashboard/WidgetRegistry';
import { RecentActivityWidget } from '../components/dashboard/widgets/RecentActivityWidget';
import { ResourceUtilizationWidget } from '../components/dashboard/widgets/ResourceUtilizationWidget';
import { BurndownMiniWidget } from '../components/dashboard/widgets/BurndownMiniWidget';
import { AgentProposalsWidget } from '../components/dashboard/widgets/AgentProposalsWidget';
import { PortfolioKPIBar } from '../components/dashboard/widgets/PortfolioKPIBar';
import { PrioritiesStripWidget } from '../components/dashboard/widgets/PrioritiesStripWidget';
import { QuickActionsWidget } from '../components/dashboard/widgets/QuickActionsWidget';

const STORAGE_KEY = 'dashboard-widgets:pm';

export const PMDashboard: React.FC = () => {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => loadWidgetIds(STORAGE_KEY, PM_WIDGETS));
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => loadWidgetOrder(STORAGE_KEY, PM_WIDGETS));

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  useEffect(() => {
    saveWidgetIds(STORAGE_KEY, enabledIds);
  }, [enabledIds]);

  useEffect(() => {
    saveWidgetOrder(STORAGE_KEY, widgetOrder);
  }, [widgetOrder]);

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

  const projects: ProjectRow[] = projectsData?.data || projectsData?.projects || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Projects</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your projects and track progress.</p>
          </div>
        </div>
        <div className="card text-center py-16">
          <FolderKanban className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-sm font-semibold text-gray-900">No projects yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first project to get started.</p>
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="mt-4 btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
        <TemplatePicker isOpen={showTemplatePicker} onClose={() => setShowTemplatePicker(false)} />
      </div>
    );
  }

  const renderWidget = (id: string) => {
    switch (id) {
      case 'ai-summary':
        return <AISummaryBanner />;
      case 'stats':
        return <PortfolioKPIBar />;
      case 'priorities':
        return <PrioritiesStripWidget />;
      case 'quick-actions':
        return <QuickActionsWidget />;
      case 'projects':
        return <ProjectTable projects={projects} />;
      case 'activity':
        return <RecentActivityWidget />;
      case 'utilization':
        return <ResourceUtilizationWidget />;
      case 'burndown':
        return <BurndownMiniWidget />;
      case 'agent-proposals':
        return <AgentProposalsWidget agentIds={['auto-reschedule-v1', 'schedule-recovery-v1', 'scope-creep-detection-v1', 'resource-optimization-v1', 'dependency-risk-v1']} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Projects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your projects and track progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomizeDropdown
            widgets={PM_WIDGETS}
            enabledIds={enabledIds}
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

      {/* Widget Grid */}
      <WidgetGrid
        widgets={PM_WIDGETS}
        enabledIds={enabledIds}
        widgetOrder={widgetOrder}
        onReorder={setWidgetOrder}
        renderWidget={renderWidget}
      />

      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
      />
    </div>
  );
};
