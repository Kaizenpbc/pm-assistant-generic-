import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import {
  Users,
  Activity,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  KeyRound,
  Check,
  TrendingUp,
  FolderKanban,
  Cpu,
  DollarSign,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AdminUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: number | boolean;
  created_at: string;
  last_login_at: string | null;
  subscription_tier: string;
  project_count: number;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  total_projects: number;
  total_ai_calls: number;
  total_ai_cost: number;
  total_tokens: number;
}

interface AiUsageRow {
  username: string;
  email: string;
  full_name: string;
  call_count: number;
  total_tokens: number;
  total_cost: number;
  last_used: string | null;
}

type Tab = 'users' | 'system' | 'ai-usage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtCost(cost: number) {
  return `$${Number(cost).toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-4">
      <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
function UsersTab() {
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiService.getAdminUsers(),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiService.setAdminUserStatus(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) => apiService.adminResetUserPassword(id),
    onSuccess: (res) => {
      const token = res.resetToken;
      setCopiedToken(token);
      navigator.clipboard.writeText(token).catch(() => {});
      setTimeout(() => setCopiedToken(null), 4000);
    },
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading users…</div>;
  if (error) return <div className="text-center py-12 text-red-500">Failed to load users.</div>;

  const users: AdminUser[] = data?.users ?? [];

  return (
    <div className="overflow-x-auto">
      {copiedToken && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>Reset token copied: <code className="font-mono text-xs break-all">{copiedToken}</code></span>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4">User</th>
            <th className="pb-3 pr-4">Role</th>
            <th className="pb-3 pr-4">Signed up</th>
            <th className="pb-3 pr-4">Last login</th>
            <th className="pb-3 pr-4 text-right">Projects</th>
            <th className="pb-3 text-center">Status</th>
            <th className="pb-3 pl-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u: AdminUser) => {
            const active = Boolean(u.is_active);
            return (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="py-3 pr-4">
                  <div className="font-medium text-gray-900">{u.full_name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                  <div className="text-xs text-gray-400">@{u.username}</div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    u.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-600">{fmt(u.created_at)}</td>
                <td className="py-3 pr-4 text-gray-600">{fmt(u.last_login_at)}</td>
                <td className="py-3 pr-4 text-right font-medium text-gray-700">{u.project_count}</td>
                <td className="py-3 text-center">
                  <button
                    onClick={() => toggleStatus.mutate({ id: u.id, active: !active })}
                    disabled={toggleStatus.isPending}
                    title={active ? 'Deactivate user' : 'Activate user'}
                    className="inline-flex items-center gap-1 text-xs"
                  >
                    {active ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                    <span className={active ? 'text-green-600' : 'text-gray-400'}>
                      {active ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                </td>
                <td className="py-3 pl-4">
                  <button
                    onClick={() => resetPassword.mutate(u.id)}
                    disabled={resetPassword.isPending}
                    title="Generate password reset token"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Reset PW
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// System tab
// ---------------------------------------------------------------------------
function SystemTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiService.getAdminStats(),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading stats…</div>;
  if (error) return <div className="text-center py-12 text-red-500">Failed to load stats.</div>;

  const s: AdminStats | undefined = data?.stats;
  if (!s) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <StatCard icon={Users} label="Total Users" value={s.total_users} color="bg-indigo-100 text-indigo-600" />
      <StatCard icon={Activity} label="Active Users" value={s.active_users} color="bg-green-100 text-green-600" />
      <StatCard icon={FolderKanban} label="Total Projects" value={s.total_projects} color="bg-blue-100 text-blue-600" />
      <StatCard icon={Cpu} label="AI API Calls" value={Number(s.total_ai_calls).toLocaleString()} color="bg-purple-100 text-purple-600" />
      <StatCard icon={TrendingUp} label="Total Tokens" value={Number(s.total_tokens).toLocaleString()} color="bg-orange-100 text-orange-600" />
      <StatCard icon={DollarSign} label="Total AI Cost" value={fmtCost(s.total_ai_cost)} color="bg-red-100 text-red-600" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Usage tab
// ---------------------------------------------------------------------------
function AiUsageTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-ai-usage'],
    queryFn: () => apiService.getAdminAiUsage(),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading AI usage…</div>;
  if (error) return <div className="text-center py-12 text-red-500">Failed to load AI usage.</div>;

  const rows: AiUsageRow[] = data?.usage ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4">User</th>
            <th className="pb-3 pr-4 text-right">Calls</th>
            <th className="pb-3 pr-4 text-right">Tokens</th>
            <th className="pb-3 pr-4 text-right">Cost</th>
            <th className="pb-3">Last Used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r: AiUsageRow) => (
            <tr key={r.username} className="hover:bg-gray-50">
              <td className="py-3 pr-4">
                <div className="font-medium text-gray-900">{r.full_name}</div>
                <div className="text-xs text-gray-500">{r.email}</div>
              </td>
              <td className="py-3 pr-4 text-right text-gray-700">{Number(r.call_count).toLocaleString()}</td>
              <td className="py-3 pr-4 text-right text-gray-700">{Number(r.total_tokens).toLocaleString()}</td>
              <td className="py-3 pr-4 text-right font-medium text-gray-900">{fmtCost(r.total_cost)}</td>
              <td className="py-3 text-gray-500">{fmt(r.last_used)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function AdminPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('users');

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'system', label: 'System', icon: Activity },
    { id: 'ai-usage', label: 'AI Usage', icon: Cpu },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Platform management and monitoring</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'system' && <SystemTab />}
        {activeTab === 'ai-usage' && <AiUsageTab />}
      </div>
    </div>
  );
}
