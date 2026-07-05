import { useQuery } from '@tanstack/react-query';
import { Zap, ArrowRight, Clock, CheckCircle, Search, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiService } from '../../../services/api';

interface ActionItem {
  id: string;
  type: 'Approve' | 'Review' | 'Investigate';
  description: string;
  link: string;
  time: string;
  priority: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_CONFIG = {
  Approve: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  Review: { icon: Search, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  Investigate: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
};

export function NextBestActionsWidget() {
  const { data: proposalsData, isLoading: proposalsLoading } = useQuery({
    queryKey: ['next-actions-proposals'],
    queryFn: () => apiService.getAgentProposals({ status: 'pending', limit: 10 }),
    staleTime: 30000,
  });

  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ['next-actions-notifications'],
    queryFn: () => apiService.getNotifications(10),
    staleTime: 30000,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['next-actions-analytics'],
    queryFn: () => apiService.getAnalyticsSummary(),
    staleTime: 60000,
  });

  const isLoading = proposalsLoading || notificationsLoading || analyticsLoading;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 animate-pulse">
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded" />)}
        </div>
      </div>
    );
  }

  const actions: ActionItem[] = [];

  // Proposals -> Approve actions (priority 1 = highest)
  const proposals = proposalsData?.data || proposalsData?.proposals || [];
  for (const p of proposals.slice(0, 5)) {
    actions.push({
      id: `proposal-${p.id}`,
      type: 'Approve',
      description: `Review proposal: ${p.title}`,
      link: '/agent',
      time: p.created_at ? timeAgo(p.created_at) : '',
      priority: p.risk_level === 'critical' ? 0 : p.risk_level === 'high' ? 1 : 2,
    });
  }

  // Notifications -> Investigate actions (priority 3)
  const notifications = notificationsData?.data || notificationsData?.notifications || [];
  const unreadHighSeverity = notifications.filter((n: any) => !n.read_at && n.severity === 'high');
  for (const n of unreadHighSeverity.slice(0, 3)) {
    actions.push({
      id: `notif-${n.id}`,
      type: 'Investigate',
      description: n.title || n.message || 'Urgent notification',
      link: '/notifications',
      time: n.created_at ? timeAgo(n.created_at) : '',
      priority: 3,
    });
  }

  // Analytics -> Review health actions (priority 4)
  const summary = analyticsData?.data || analyticsData;
  const atRiskProjects = summary?.projectBreakdown?.filter((p: any) => p.healthScore != null && p.healthScore < 60) || [];
  for (const p of atRiskProjects.slice(0, 3)) {
    actions.push({
      id: `health-${p.projectId || p.id}`,
      type: 'Review',
      description: `Review project health: ${p.projectName || p.name}`,
      link: `/projects/${p.projectId || p.id}`,
      time: '',
      priority: 4,
    });
  }

  // Sort by priority, take top 5
  const sorted = actions.sort((a, b) => a.priority - b.priority).slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Next Best Actions</h3>
        </div>
        <Link
          to="/notifications"
          className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
        >
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No actions needed right now</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(item => {
            const cfg = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            return (
              <Link
                key={item.id}
                to={item.link}
                className="block border border-gray-100 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white line-clamp-1">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>{item.type}</span>
                      {item.time && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {item.time}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
