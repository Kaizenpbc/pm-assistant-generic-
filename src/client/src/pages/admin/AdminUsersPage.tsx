import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { AdminPageWrapper } from './AdminPageWrapper';
import {
  ToggleLeft,
  ToggleRight,
  KeyRound,
  Check,
  Unlock,
} from 'lucide-react';

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
  email_verified: number | boolean;
  has_pending_login: number | boolean;
  login_verification_expires: string | null;
}

function fmt(date: string | null) {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AdminUsersPage() {
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

  const clearLoginToken = useMutation({
    mutationFn: (id: string) => apiService.adminClearLoginToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <AdminPageWrapper title="Users" subtitle="Manage platform users">
      {isLoading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading users...</div>}
      {error && <div className="text-center py-12 text-red-500">Failed to load users.</div>}
      {!isLoading && !error && (
        <div className="overflow-x-auto">
          {copiedToken && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Reset token copied: <code className="font-mono text-xs break-all">{copiedToken}</code></span>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Signed up</th>
                <th className="pb-3 pr-4">Login status</th>
                <th className="pb-3 pr-4">Last login</th>
                <th className="pb-3 pr-4 text-right">Projects</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 pl-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data?.users ?? []).map((u: AdminUser) => {
                const active = Boolean(u.is_active);
                const hasPendingLogin = Boolean(u.has_pending_login);
                const loginExpired = hasPendingLogin && u.login_verification_expires && new Date(u.login_verification_expires) < new Date();
                const emailVerified = Boolean(u.email_verified);
                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900 dark:text-white">{u.full_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">@{u.username}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{fmt(u.created_at)}</td>
                    <td className="py-3 pr-4">
                      {loginExpired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Expired token</span>
                      ) : hasPendingLogin ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Pending login</span>
                      ) : !emailVerified ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Unverified</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Verified</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{fmt(u.last_login_at)}</td>
                    <td className="py-3 pr-4 text-right font-medium text-gray-700 dark:text-gray-200">{u.project_count}</td>
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
                          <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                        )}
                        <span className={active ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => resetPassword.mutate(u.id)}
                          disabled={resetPassword.isPending}
                          title="Generate password reset token"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Reset PW
                        </button>
                        {hasPendingLogin && (
                          <button
                            onClick={() => clearLoginToken.mutate(u.id)}
                            disabled={clearLoginToken.isPending}
                            title="Clear login verification token so user can retry login"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Unlock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageWrapper>
  );
}
