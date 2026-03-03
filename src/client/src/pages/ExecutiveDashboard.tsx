import React, { useEffect } from 'react';
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

export const ExecutiveDashboard: React.FC = () => {

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });

  const projects: Project[] = projectsData?.projects || [];

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budgetAllocated || 0), 0);
  const onTrackCount = projects.filter((p) => {
    const progress = p.progressPercentage || 0;
    return p.status === 'active' && progress >= 20;
  }).length;
  const onTrackPct = activeProjects > 0 ? Math.round((onTrackCount / activeProjects) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Portfolio-level view of all projects and key metrics.
        </p>
      </div>

      {/* AI Summary Banner */}
      <AISummaryBanner />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Total Projects"
          value={String(totalProjects)}
          icon={FolderKanban}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatsCard
          label="Active"
          value={String(activeProjects)}
          icon={TrendingUp}
          color="bg-green-50 text-green-600"
        />
        <StatsCard
          label="Total Budget"
          value={`$${(totalBudget / 1000).toFixed(0)}K`}
          icon={DollarSign}
          color="bg-blue-50 text-blue-600"
        />
        <StatsCard
          label="On Track"
          value={`${onTrackPct}%`}
          icon={CheckCircle}
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Project Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">All Projects</h2>
          <span className="text-xs text-gray-400">{totalProjects} projects</span>
        </div>
        <ProjectTable projects={projects} />
      </div>
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
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
