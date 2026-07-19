import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, ArrowRight, CheckCheck } from 'lucide-react';
import { apiService } from '../../services/api';
import { timeAgo } from '../../utils/timeAgo';

interface ActivityFeedPMProps {
  limit?: number;
}


function resolveLink(notification: any): string {
  const linkType: string = notification.link_type || notification.linkType || '';
  const projectId: string = notification.project_id || notification.projectId || '';

  if (linkType === 'project' && projectId) return `/project/${projectId}`;
  if (linkType === 'proposal') return '/agent';
  return '/notifications';
}

export function ActivityFeedPM({ limit = 10 }: ActivityFeedPMProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-feed-pm', limit],
    queryFn: () => apiService.getNotifications(limit),
    staleTime: 30_000,
  });

  const notifications: any[] = data?.data || data?.notifications || [];

  async function handleClick(notification: any) {
    if (!notification.read_at) {
      try {
        await apiService.markNotificationRead(notification.id);
        queryClient.invalidateQueries({ queryKey: ['notifications-feed-pm'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      } catch {
        // non-critical — navigate anyway
      }
    }
    navigate(resolveLink(notification));
  }

  async function handleMarkAllRead() {
    try {
      await apiService.markAllNotificationsRead();
      queryClient.invalidateQueries({ queryKey: ['notifications-feed-pm'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    } catch {
      // non-critical
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Activity</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Mark all read"
          >
            <CheckCheck className="w-3 h-3" />
            Mark all read
          </button>
          <Link
            to="/notifications"
            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No recent activity</p>
      ) : (
        <ul className="space-y-1">
          {notifications.map((n: any) => {
            const isUnread = !n.read_at;
            return (
              <li
                key={n.id}
                onClick={() => handleClick(n)}
                className="flex items-start gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Unread dot */}
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${isUnread ? 'bg-teal-500' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                    {n.title || n.message || 'Notification'}
                  </p>
                  {n.created_at && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
