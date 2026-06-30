import { useQuery } from '@tanstack/react-query';
import { Bell, Clock } from 'lucide-react';
import { apiService } from '../../../services/api';

export function RecentActivityWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'widget'],
    queryFn: () => apiService.getNotifications(8, 0),
    refetchInterval: 60000,
  });

  const notifications = data?.notifications || [];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-3 w-full bg-gray-100 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
      </div>

      {notifications.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className={`flex items-start gap-2 text-xs p-1.5 rounded ${n.readAt ? 'text-gray-500' : 'text-gray-800 bg-primary-50/30'}`}
            >
              <Clock className="w-3 h-3 mt-0.5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="truncate">{n.title || n.message}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">
                  {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
