import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Play, CheckCircle2, Target, GripVertical } from 'lucide-react';
import { apiService } from '../../services/api';

interface Task {
  id: string;
  name: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  story_points?: number;
  storyPoints?: number;
}

interface Sprint {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  goal?: string;
  start_date?: string;
  end_date?: string;
  velocity_commitment?: number;
  tasks?: Task[];
}

interface SprintPlanningPanelProps {
  projectId: string;
  scheduleId: string;
  sprintId: string;
}

const priorityBadge: Record<string, { bg: string; text: string }> = {
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { bg: 'bg-green-100', text: 'text-green-700' },
};

const statusBadge: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-700' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

function getPoints(task: Task): number {
  return task.story_points ?? task.storyPoints ?? 0;
}

function TaskCard({
  task,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  actionColor,
}: {
  task: Task;
  actionLabel: string;
  actionIcon: React.ElementType;
  onAction: () => void;
  actionColor: string;
}) {
  const pBadge = priorityBadge[task.priority || 'medium'] || priorityBadge.medium;
  const sBadge = statusBadge[task.status] || statusBadge.pending;

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 hover:shadow-sm transition-shadow group">
      <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-900 truncate">{task.name}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${pBadge.bg} ${pBadge.text} capitalize`}>
            {task.priority || 'medium'}
          </span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sBadge.bg} ${sBadge.text}`}>
            {(task.status || 'pending').replace('_', ' ')}
          </span>
        </div>
      </div>
      {getPoints(task) > 0 && (
        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex-shrink-0">
          {getPoints(task)} pts
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        title={actionLabel}
        className={`p-1 rounded hover:bg-opacity-20 transition-colors flex-shrink-0 ${actionColor}`}
      >
        <ActionIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function SprintPlanningPanel({ projectId, scheduleId, sprintId }: SprintPlanningPanelProps) {
  const queryClient = useQueryClient();

  const { data: sprintData, isLoading: sprintLoading } = useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => apiService.getSprint(sprintId),
  });

  const { data: allTasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', scheduleId],
    queryFn: () => apiService.getTasks(scheduleId),
  });

  const sprint: Sprint | null = sprintData?.sprint ?? sprintData ?? null;
  const allTasks: Task[] = allTasksData?.tasks ?? allTasksData ?? [];
  const sprintTasks: Task[] = sprint?.tasks ?? [];
  const sprintTaskIds = useMemo(() => new Set(sprintTasks.map((t) => t.id)), [sprintTasks]);

  const backlogTasks = useMemo(
    () => allTasks.filter((t) => !sprintTaskIds.has(t.id)),
    [allTasks, sprintTaskIds],
  );

  const totalPoints = useMemo(
    () => sprintTasks.reduce((sum, t) => sum + getPoints(t), 0),
    [sprintTasks],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
    queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
  };

  const addTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiService.addSprintTask(sprintId, taskId),
    onSuccess: invalidate,
  });

  const removeTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiService.removeSprintTask(sprintId, taskId),
    onSuccess: invalidate,
  });

  const startSprintMutation = useMutation({
    mutationFn: () => apiService.startSprint(sprintId),
    onSuccess: invalidate,
  });

  const completeSprintMutation = useMutation({
    mutationFn: () => apiService.completeSprint(sprintId),
    onSuccess: invalidate,
  });

  // ----- Create sprint form state (shown when sprint data is missing) -----
  const [createForm, setCreateForm] = useState({
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
    velocity_commitment: '',
  });

  const createSprintMutation = useMutation({
    mutationFn: () =>
      apiService.createSprint({
        projectId,
        scheduleId,
        name: createForm.name,
        goal: createForm.goal || undefined,
        startDate: createForm.start_date,
        endDate: createForm.end_date,
        velocityCommitment: createForm.velocity_commitment
          ? Number(createForm.velocity_commitment)
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });

  const isLoading = sprintLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-40 bg-gray-100 rounded" />
            <div className="h-40 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // If no sprint data found, show create form
  if (!sprint) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-800">Create Sprint</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sprint Name *</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Sprint 1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Goal</label>
            <textarea
              value={createForm.goal}
              onChange={(e) => setCreateForm((f) => ({ ...f, goal: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              rows={2}
              placeholder="What should this sprint achieve?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input
                type="date"
                value={createForm.start_date}
                onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date *</label>
              <input
                type="date"
                value={createForm.end_date}
                onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Velocity Commitment</label>
            <input
              type="number"
              value={createForm.velocity_commitment}
              onChange={(e) => setCreateForm((f) => ({ ...f, velocity_commitment: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="e.g. 30"
              min={0}
            />
          </div>
          <button
            onClick={() => createSprintMutation.mutate()}
            disabled={!createForm.name || !createForm.start_date || !createForm.end_date || createSprintMutation.isPending}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-md transition-colors"
          >
            {createSprintMutation.isPending ? 'Creating...' : 'Create Sprint'}
          </button>
        </div>
      </div>
    );
  }

  const canStart = sprint.status === 'planning';
  const canComplete = sprint.status === 'active';

  return (
    <div className="space-y-4">
      {/* Sprint header */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{sprint.name}</h3>
            {sprint.goal && <p className="text-xs text-gray-500 mt-0.5">{sprint.goal}</p>}
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
              {sprint.start_date && (
                <span>
                  {new Date(sprint.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' - '}
                  {sprint.end_date
                    ? new Date(sprint.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '?'}
                </span>
              )}
              {sprint.velocity_commitment != null && (
                <span>Commitment: {sprint.velocity_commitment} pts</span>
              )}
              <span className="font-medium text-indigo-600">Sprint total: {totalPoints} pts</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canStart && (
              <button
                onClick={() => startSprintMutation.mutate()}
                disabled={startSprintMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 px-3 py-1.5 rounded-md transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {startSprintMutation.isPending ? 'Starting...' : 'Start Sprint'}
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => completeSprintMutation.mutate()}
                disabled={completeSprintMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 px-3 py-1.5 rounded-md transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completeSprintMutation.isPending ? 'Completing...' : 'Complete Sprint'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Backlog column */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Backlog</h4>
            <span className="text-[10px] font-bold text-gray-400 bg-white rounded-full w-5 h-5 flex items-center justify-center">
              {backlogTasks.length}
            </span>
          </div>
          <div className="p-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
            {backlogTasks.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">All tasks are in this sprint</div>
            ) : (
              backlogTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  actionLabel="Add to Sprint"
                  actionIcon={Plus}
                  onAction={() => addTaskMutation.mutate(task.id)}
                  actionColor="text-indigo-600 hover:bg-indigo-100"
                />
              ))
            )}
          </div>
        </div>

        {/* Sprint column */}
        <div className="rounded-lg border border-indigo-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Sprint</h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-500 bg-white rounded-full px-2 py-0.5">
                {totalPoints} pts
              </span>
              <span className="text-[10px] font-bold text-gray-400 bg-white rounded-full w-5 h-5 flex items-center justify-center">
                {sprintTasks.length}
              </span>
            </div>
          </div>
          <div className="p-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
            {sprintTasks.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                Add tasks from the backlog to plan this sprint
              </div>
            ) : (
              sprintTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  actionLabel="Remove from Sprint"
                  actionIcon={Trash2}
                  onAction={() => removeTaskMutation.mutate(task.id)}
                  actionColor="text-red-500 hover:bg-red-100"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
