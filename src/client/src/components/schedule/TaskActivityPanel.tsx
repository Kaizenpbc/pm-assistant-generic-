import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { MessageSquare, Activity, Send, Trash2 } from 'lucide-react';

interface TaskActivityPanelProps {
  scheduleId: string;
  taskId: string;
}

const fieldLabels: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  assignedTo: 'Assignee',
  progressPercentage: 'Progress',
  startDate: 'Start Date',
  endDate: 'End Date',
  name: 'Name',
};

const statusLabels: Record<string, string> = {
  pending: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatValue(field: string | undefined, value: string | undefined): string {
  if (!value) return '(empty)';
  if (field === 'status') return statusLabels[value] || value;
  if (field === 'progressPercentage') return `${value}%`;
  if (field === 'startDate' || field === 'endDate') {
    try {
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return value;
    }
  }
  return value;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function TaskActivityPanel({ scheduleId, taskId }: TaskActivityPanelProps) {
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  const { data: commentsData } = useQuery({
    queryKey: ['taskComments', scheduleId, taskId],
    queryFn: () => apiService.getTaskComments(scheduleId, taskId),
    enabled: tab === 'comments',
  });

  const { data: activityData } = useQuery({
    queryKey: ['taskActivity', scheduleId, taskId],
    queryFn: () => apiService.getTaskActivity(scheduleId, taskId),
    enabled: tab === 'activity',
  });

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => apiService.addTaskComment(scheduleId, taskId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments', scheduleId, taskId] });
      setNewComment('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => apiService.deleteTaskComment(scheduleId, taskId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments', scheduleId, taskId] });
    },
  });

  const comments = commentsData?.comments || [];
  const activities = activityData?.activities || [];

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  return (
    <div className="border-t border-gray-200 mt-4 pt-4">
      {/* Tabs */}
      <div className="flex gap-4 mb-3">
        <button
          onClick={() => setTab('comments')}
          className={`flex items-center gap-1.5 text-xs font-medium pb-1 border-b-2 transition-colors ${
            tab === 'comments'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Comments
          {comments.length > 0 && (
            <span className="bg-gray-100 text-gray-600 text-[9px] font-bold rounded-full px-1.5 py-0.5">
              {comments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`flex items-center gap-1.5 text-xs font-medium pb-1 border-b-2 transition-colors ${
            tab === 'activity'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Activity
        </button>
      </div>

      {/* Comments Tab */}
      {tab === 'comments' && (
        <div>
          {/* Comment input */}
          <form onSubmit={handleSubmitComment} className="flex gap-2 mb-3">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3 h-3" />
              Post
            </button>
          </form>

          {/* Comment list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
            )}
            {comments.map((comment: any) => (
              <div key={comment.id} className="flex gap-2 group">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5">
                  {getInitials(comment.userName || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-700">
                      {comment.userName || 'User'}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {timeAgo(comment.createdAt)}
                    </span>
                    <button
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-300 hover:text-red-500"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {activities.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No activity recorded</p>
          )}
          {activities.map((entry: any) => (
            <div key={entry.id} className="flex gap-2 items-start">
              <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{entry.userName || 'System'}</span>
                  {' '}
                  {entry.action} <span className="font-medium">{fieldLabels[entry.field] || entry.field}</span>
                  {entry.oldValue && entry.newValue && (
                    <>
                      {' from '}
                      <span className="line-through text-gray-400">{formatValue(entry.field, entry.oldValue)}</span>
                      {' to '}
                      <span className="font-medium text-indigo-600">{formatValue(entry.field, entry.newValue)}</span>
                    </>
                  )}
                </p>
                <span className="text-[9px] text-gray-400">{timeAgo(entry.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
