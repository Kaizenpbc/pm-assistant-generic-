import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { apiService } from '../services/api';
import { GanttChart, type GanttTask } from '../components/schedule/GanttChart';

export function PortfolioPage() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiService.getPortfolio(),
  });

  const portfolioItems = data?.portfolioItems || [];

  // Transform portfolio data into GanttTask[] hierarchy:
  // Each project becomes a parent row, its tasks become children
  const ganttTasks: GanttTask[] = useMemo(() => {
    const tasks: GanttTask[] = [];

    for (const item of portfolioItems) {
      // Project-level row (parent)
      const projectTaskId = `project-${item.projectId}`;

      // Compute project dates from tasks if not set
      let earliest = item.startDate;
      let latest = item.endDate;
      let totalProgress = 0;
      let taskCount = 0;

      for (const t of item.tasks) {
        if (t.startDate && (!earliest || new Date(t.startDate) < new Date(earliest))) {
          earliest = t.startDate;
        }
        if (t.endDate && (!latest || new Date(t.endDate) > new Date(latest))) {
          latest = t.endDate;
        }
        totalProgress += t.progressPercentage || 0;
        taskCount++;
      }

      tasks.push({
        id: projectTaskId,
        name: item.projectName,
        status: item.status === 'active' ? 'in_progress' : item.status === 'planning' ? 'pending' : item.status,
        priority: item.priority,
        startDate: earliest ? new Date(earliest).toISOString() : undefined,
        endDate: latest ? new Date(latest).toISOString() : undefined,
        progressPercentage: taskCount > 0 ? Math.round(totalProgress / taskCount) : 0,
      });

      // Add top-level tasks (without parentTaskId) as children of the project
      for (const t of item.tasks) {
        if (!t.parentTaskId) {
          tasks.push({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            startDate: t.startDate ? new Date(t.startDate).toISOString() : undefined,
            endDate: t.endDate ? new Date(t.endDate).toISOString() : undefined,
            progressPercentage: t.progressPercentage,
            parentTaskId: projectTaskId,
            assignedTo: t.assignedTo,
            dependency: t.dependency,
            dependencyType: t.dependencyType,
          });
        }
      }
    }

    return tasks;
  }, [portfolioItems]);

  const handleTaskClick = (task: GanttTask) => {
    // If it's a project row, navigate to the project
    if (task.id.startsWith('project-')) {
      const projectId = task.id.replace('project-', '');
      navigate(`/project/${projectId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500">Failed to load portfolio data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <Layers className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-sm text-gray-500">Cross-project timeline view of all projects and milestones</p>
        </div>
      </div>

      {portfolioItems.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Layers className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-900">No Projects</h3>
          <p className="mt-1 text-sm text-gray-500">No projects found in your portfolio.</p>
        </div>
      ) : (
        <GanttChart
          tasks={ganttTasks}
          scheduleName="Portfolio Timeline"
          onTaskClick={handleTaskClick}
        />
      )}
    </div>
  );
}
