import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  ListTodo,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiService } from '../services/api';

type Tab = 'overview' | 'schedule' | 'team';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'team', label: 'Team' },
];

const statusStyles: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  planning: { label: 'Planning', color: 'bg-purple-100 text-purple-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

const taskStatusStyles: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700' },
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const {
    data: projectData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiService.getProject(id!),
    enabled: !!id,
  });

  const project = projectData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500">Project not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 text-sm text-indigo-600 hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const status = statusStyles[project.status] || statusStyles.planning;
  const progress = project.progressPercentage || project.progress_percentage || 0;
  const budgetAllocated = project.budgetAllocated || project.budget_allocated || 0;
  const budgetSpent = project.budgetSpent || project.budget_spent || 0;
  const budgetPct =
    budgetAllocated > 0 ? Math.round((budgetSpent / budgetAllocated) * 100) : 0;

  const daysRemaining =
    project.endDate || project.end_date
      ? Math.ceil(
          (new Date(project.endDate || project.end_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Back Button + Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
              >
                {status.label}
              </span>
            </div>
            {(project.description) && (
              <p className="mt-1 text-sm text-gray-500">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Context Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ContextCard
          label="Progress"
          value={`${progress}%`}
          icon={TrendingUp}
          color="bg-blue-50 text-blue-600"
          detail={
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          }
        />
        <ContextCard
          label="Budget"
          value={`$${(budgetSpent / 1000).toFixed(0)}K / $${(budgetAllocated / 1000).toFixed(0)}K`}
          icon={DollarSign}
          color={budgetPct > 90 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
          detail={
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct > 90 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          }
        />
        <ContextCard
          label="Timeline"
          value={
            daysRemaining !== null ? `${daysRemaining}d remaining` : 'No end date'
          }
          icon={Clock}
          color={
            daysRemaining !== null && daysRemaining < 14
              ? 'bg-orange-50 text-orange-600'
              : 'bg-indigo-50 text-indigo-600'
          }
        />
        <ContextCard
          label="Status"
          value={status.label}
          icon={Calendar}
          color={status.color}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab project={project} />}
      {activeTab === 'schedule' && <ScheduleTab projectId={id!} />}
      {activeTab === 'team' && <TeamTab />}
    </div>
  );
}

function ContextCard({
  label,
  value,
  icon: Icon,
  color,
  detail,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
      {detail}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function OverviewTab({ project }: { project: any }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Project Details */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Project Details</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {project.code && <DetailRow label="Code" value={project.code} />}
            {project.category && <DetailRow label="Category" value={project.category} />}
            {project.priority && <DetailRow label="Priority" value={project.priority} />}
            {(project.startDate || project.start_date) && (
              <DetailRow
                label="Start Date"
                value={new Date(project.startDate || project.start_date).toLocaleDateString()}
              />
            )}
            {(project.endDate || project.end_date) && (
              <DetailRow
                label="End Date"
                value={new Date(project.endDate || project.end_date).toLocaleDateString()}
              />
            )}
            {project.location && <DetailRow label="Location" value={project.location} />}
            {(project.createdAt || project.created_at) && (
              <DetailRow
                label="Created"
                value={new Date(project.createdAt || project.created_at).toLocaleDateString()}
              />
            )}
          </dl>
        </div>
      </div>

      {/* Quick Info Sidebar */}
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Quick Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-medium text-gray-900 capitalize">{project.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Priority</span>
              <span className="font-medium text-gray-900 capitalize">
                {project.priority || 'Not set'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({ projectId }: { projectId: string }) {
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.data || [];

  if (schedulesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <h3 className="text-sm font-semibold text-gray-900">No Schedules</h3>
        <p className="mt-1 text-sm text-gray-500">
          No schedules have been created for this project yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule: any) => (
        <ScheduleCard key={schedule.id} schedule={schedule} />
      ))}
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: any }) {
  const [expanded, setExpanded] = useState(false);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', schedule.id],
    queryFn: () => apiService.getTasks(schedule.id),
    enabled: expanded,
  });

  const tasks: any[] = tasksData?.data || [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{schedule.name}</h4>
          {schedule.description && (
            <p className="mt-0.5 text-xs text-gray-500">{schedule.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            {(schedule.startDate || schedule.start_date) && (
              <span>
                Start: {new Date(schedule.startDate || schedule.start_date).toLocaleDateString()}
              </span>
            )}
            {(schedule.endDate || schedule.end_date) && (
              <span>
                End: {new Date(schedule.endDate || schedule.end_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-4">
              <ListTodo className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-xs text-gray-500">No tasks in this schedule.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task: any) => {
                const taskStatus =
                  taskStatusStyles[task.status] || taskStatusStyles.not_started;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {task.name}
                      </p>
                      {task.assignedTo && (
                        <p className="text-xs text-gray-400">Assigned: {task.assignedTo}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${taskStatus.color}`}
                    >
                      {taskStatus.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamTab() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <Users className="mx-auto mb-3 h-12 w-12 text-gray-300" />
      <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
      <p className="mt-1 text-sm text-gray-500">
        Team management will be available in a future update.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 capitalize">{value}</dd>
    </div>
  );
}
