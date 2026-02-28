import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  DollarSign,
  Calendar,
  MessageSquare,
  Send,
  GanttChartSquare,
  FileText,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { apiService } from '../services/api';

interface PortalData {
  project: {
    name: string;
    description: string;
    status: string;
    progressPercentage: number;
    startDate: string;
    endDate: string;
    budgetAllocated: number;
    budgetSpent: number;
  };
  permissions: {
    canViewGantt: boolean;
    canViewBudget: boolean;
    canComment: boolean;
    canViewReports: boolean;
  };
  taskStats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
  comments: Array<{
    id: string;
    authorName: string;
    content: string;
    created_at: string;
  }>;
}

const statusStyles: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700' },
  planning: { label: 'Planning', bg: 'bg-purple-100', text: 'text-purple-700' },
  on_hold: { label: 'On Hold', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { label: 'Completed', bg: 'bg-blue-100', text: 'text-blue-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-600' },
};

function daysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function PortalViewPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [authorName, setAuthorName] = useState('');
  const [commentContent, setCommentContent] = useState('');

  const { data, isLoading, error } = useQuery<PortalData>({
    queryKey: ['portalView', token],
    queryFn: () => apiService.getPortalView(token!),
    enabled: !!token,
    retry: false,
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { entityType: string; entityId: string; authorName: string; content: string }) =>
      apiService.addPortalComment(token!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalView', token] });
      setCommentContent('');
    },
  });

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !commentContent.trim()) return;
    commentMutation.mutate({
      entityType: 'project',
      entityId: token!,
      authorName: authorName.trim(),
      content: commentContent.trim(),
    });
  };

  // -- Loading state --
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading portal...</p>
        </div>
      </div>
    );
  }

  // -- Error / invalid token state --
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Portal Unavailable
          </h1>
          <p className="text-sm text-gray-600">
            This portal link is invalid, expired, or has been deactivated. Please
            contact your project manager for an updated link.
          </p>
        </div>
      </div>
    );
  }

  const { project, permissions, taskStats, comments } = data;
  const status = statusStyles[project.status] || statusStyles.active;
  const remaining = daysRemaining(project.endDate);
  const budgetPct =
    project.budgetAllocated > 0
      ? Math.round((project.budgetSpent / project.budgetAllocated) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">
            Client Portal
          </p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-indigo-100 text-sm mt-1">
            Kovarti PM Assistant
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Project Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Project Status
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
            >
              {status.label}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mb-4">{project.description}</p>
          )}
          {/* Progress bar */}
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span className="font-medium text-gray-900">
              {project.progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(project.progressPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Task Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<BarChart3 className="w-5 h-5 text-indigo-600" />}
            label="Total Tasks"
            value={taskStats.total}
            bg="bg-indigo-50"
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-yellow-600" />}
            label="Pending"
            value={taskStats.pending}
            bg="bg-yellow-50"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5 text-blue-600" />}
            label="In Progress"
            value={taskStats.in_progress}
            bg="bg-blue-50"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
            label="Completed"
            value={taskStats.completed}
            bg="bg-green-50"
          />
        </div>

        {/* Timeline Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Timeline
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Start Date
              </p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {formatDate(project.startDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                End Date
              </p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {formatDate(project.endDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Days Remaining
              </p>
              <p
                className={`text-sm font-medium mt-0.5 ${
                  remaining < 0
                    ? 'text-red-600'
                    : remaining < 14
                    ? 'text-yellow-600'
                    : 'text-gray-900'
                }`}
              >
                {remaining < 0
                  ? `${Math.abs(remaining)} days overdue`
                  : `${remaining} days`}
              </p>
            </div>
          </div>
        </div>

        {/* Budget Summary (conditional) */}
        {permissions.canViewBudget && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              Budget Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Allocated
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(project.budgetAllocated)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Spent
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(project.budgetSpent)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Remaining
                </p>
                <p
                  className={`text-lg font-bold ${
                    budgetPct > 90 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(project.budgetAllocated - project.budgetSpent)}
                </p>
              </div>
            </div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span>Budget Used</span>
              <span
                className={`font-medium ${
                  budgetPct > 90 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {budgetPct}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  budgetPct > 90
                    ? 'bg-red-500'
                    : budgetPct > 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Gantt placeholder (conditional) */}
        {permissions.canViewGantt && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <GanttChartSquare className="w-5 h-5 text-indigo-600" />
              Gantt Chart
            </h2>
            <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <div className="text-center">
                <GanttChartSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Timeline view - Interactive Gantt chart coming soon
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reports placeholder (conditional) */}
        {permissions.canViewReports && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Reports
            </h2>
            <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <div className="text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Project reports and analytics will appear here
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comments Section (conditional) */}
        {permissions.canComment && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Comments
            </h2>

            {/* Comment List */}
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500 mb-6 py-4 text-center">
                No comments yet. Be the first to leave a comment.
              </p>
            ) : (
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border-b border-gray-100 pb-3 last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.authorName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment Form */}
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Comment
                </label>
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Write your comment..."
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={
                  commentMutation.isPending ||
                  !authorName.trim() ||
                  !commentContent.trim()
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
                {commentMutation.isPending ? 'Sending...' : 'Submit Comment'}
              </button>
              {commentMutation.isError && (
                <p className="text-xs text-red-600">
                  Failed to submit comment. Please try again.
                </p>
              )}
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-4xl mx-auto px-6 py-4 text-center">
          <p className="text-xs text-gray-400">
            Powered by Kovarti PM Assistant
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
