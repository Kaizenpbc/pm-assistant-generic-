import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  TrendingUp,
  DollarSign,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { apiService } from '../services/api';

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
  const navigate = useNavigate();

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });

  const projects: Project[] = projectsData?.data || [];

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budgetAllocated || 0), 0);
  const onTrackCount = projects.filter((p) => {
    const progress = p.progressPercentage || 0;
    return p.status === 'active' && progress >= 20;
  }).length;
  const onTrackPct = activeProjects > 0 ? Math.round((onTrackCount / activeProjects) * 100) : 0;

  const statusStyles: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'bg-green-100 text-green-700' },
    planning: { label: 'Planning', color: 'bg-purple-100 text-purple-700' },
    on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
  };

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
        <h1 className="text-xl font-bold text-gray-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Portfolio-level view of all projects and key metrics.
        </p>
      </div>

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

      {/* Project List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">All Projects</h2>
          <span className="text-xs text-gray-400">{totalProjects} projects</span>
        </div>

        {projects.length === 0 ? (
          <div className="card text-center py-12">
            <FolderKanban className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No projects yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const status = statusStyles[project.status] || statusStyles.planning;
              const budgetPct =
                project.budgetAllocated && project.budgetAllocated > 0
                  ? Math.round(((project.budgetSpent || 0) / project.budgetAllocated) * 100)
                  : 0;

              return (
                <button
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="w-full text-left card hover:shadow-md transition-shadow duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                          {project.name}
                        </h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      {project.description && (
                        <p className="mt-1 text-xs text-gray-500 truncate">{project.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                        {project.budgetAllocated && (
                          <span>Budget: ${(project.budgetAllocated / 1000).toFixed(0)}K ({budgetPct}% spent)</span>
                        )}
                        {project.progressPercentage !== undefined && (
                          <span>Progress: {project.progressPercentage}%</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 ml-4" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
