import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { AISummaryBanner } from '../components/dashboard/AISummaryBanner';
import { TemplatePicker } from '../components/templates/TemplatePicker';
import { ProjectTable, type ProjectRow } from '../components/dashboard/ProjectTable';

export const PMDashboard: React.FC = () => {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });

  const projects: ProjectRow[] = projectsData?.projects || [];

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
          <p className="mt-1 text-sm text-gray-500">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <FolderKanban className="w-4 h-4" />
            <span>Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Active</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {projects.filter((p) => p.status === 'active').length}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span>Planning</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {projects.filter((p) => p.status === 'planning').length}
          </p>
        </div>
      </div>

      {/* Project Table */}
      <ProjectTable projects={projects} />

      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
      />
    </div>
  );
};
