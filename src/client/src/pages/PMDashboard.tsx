import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  DollarSign,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { useFilterStore } from '../stores/filterStore';
import { AISummaryBanner } from '../components/dashboard/AISummaryBanner';
import { TemplatePicker } from '../components/templates/TemplatePicker';

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

const statusStyles: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  planning: { label: 'Planning', color: 'bg-purple-100 text-purple-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

const priorityStyles: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
};

export const PMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const { selectedPortfolioId, selectedPmUserId } = useFilterStore();

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', selectedPortfolioId, selectedPmUserId],
    queryFn: () => apiService.getProjects({ portfolioId: selectedPortfolioId, pmUserId: selectedPmUserId }),
  });

  const projects: Project[] = projectsData?.projects || [];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="mt-1 text-base text-gray-500">
            Manage your projects and track progress.
          </p>
        </div>
        <button
          onClick={() => setShowTemplatePicker(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* AI Summary Banner */}
      <AISummaryBanner />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-base text-gray-500 mb-1">
            <FolderKanban className="w-5 h-5" />
            <span>Total</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-base text-gray-500 mb-1">
            <TrendingUp className="w-5 h-5" />
            <span>Active</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {projects.filter((p) => p.status === 'active').length}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-base text-gray-500 mb-1">
            <Clock className="w-5 h-5" />
            <span>Planning</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {projects.filter((p) => p.status === 'planning').length}
          </p>
        </div>
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <div className="card text-center py-12">
          <FolderKanban className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No projects yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first project to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const status = statusStyles[project.status] || statusStyles.planning;
            const progress = project.progressPercentage || 0;
            const budgetAllocated = project.budgetAllocated || 0;
            const budgetSpent = project.budgetSpent || 0;
            const budgetPct =
              budgetAllocated > 0 ? Math.round((budgetSpent / budgetAllocated) * 100) : 0;

            return (
              <button
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="text-left card hover:shadow-md transition-shadow duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {project.priority && (
                        <span className={`text-xs font-medium capitalize ${priorityStyles[project.priority] || 'text-gray-500'}`}>
                          {project.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
                </div>

                {project.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                )}

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium text-gray-900">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Budget info */}
                {budgetAllocated > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>
                      ${(budgetSpent / 1000).toFixed(0)}K / ${(budgetAllocated / 1000).toFixed(0)}K
                      ({budgetPct}%)
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
      />
    </div>
  );
};
