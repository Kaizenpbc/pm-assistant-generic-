import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { AdminPageWrapper } from './AdminPageWrapper';
import {
  Users,
  Activity,
  FolderKanban,
  Cpu,
  TrendingUp,
  DollarSign,
} from 'lucide-react';

interface AdminStats {
  total_users: number;
  active_users: number;
  total_projects: number;
  total_ai_calls: number;
  total_ai_cost: number;
  total_tokens: number;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/30 border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function fmtCost(cost: number) {
  return `$${Number(cost).toFixed(4)}`;
}

export function AdminSystemPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiService.getAdminStats(),
  });

  return (
    <AdminPageWrapper title="System Stats" subtitle="Platform overview and metrics">
      {isLoading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading stats...</div>}
      {error && <div className="text-center py-12 text-red-500">Failed to load stats.</div>}
      {!isLoading && !error && data?.stats && (() => {
        const s: AdminStats = data.stats;
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Total Users" value={s.total_users} color="bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400" />
            <StatCard icon={Activity} label="Active Users" value={s.active_users} color="bg-green-100 text-green-600" />
            <StatCard icon={FolderKanban} label="Total Projects" value={s.total_projects} color="bg-blue-100 text-blue-600" />
            <StatCard icon={Cpu} label="AI API Calls" value={Number(s.total_ai_calls).toLocaleString()} color="bg-purple-100 text-purple-600" />
            <StatCard icon={TrendingUp} label="Total Tokens" value={Number(s.total_tokens).toLocaleString()} color="bg-orange-100 text-orange-600" />
            <StatCard icon={DollarSign} label="Total AI Cost" value={fmtCost(s.total_ai_cost)} color="bg-red-100 text-red-600" />
          </div>
        );
      })()}
    </AdminPageWrapper>
  );
}
