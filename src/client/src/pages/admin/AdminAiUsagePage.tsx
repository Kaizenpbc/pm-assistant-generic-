import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { AdminPageWrapper } from './AdminPageWrapper';

interface AiUsageRow {
  username: string;
  email: string;
  full_name: string;
  call_count: number;
  total_tokens: number;
  total_cost: number;
  last_used: string | null;
}

function fmt(date: string | null) {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtCost(cost: number) {
  return `$${Number(cost).toFixed(4)}`;
}

export function AdminAiUsagePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-ai-usage'],
    queryFn: () => apiService.getAdminAiUsage(),
  });

  return (
    <AdminPageWrapper title="AI Usage" subtitle="AI API usage by user">
      {isLoading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading AI usage...</div>}
      {error && <div className="text-center py-12 text-red-500">Failed to load AI usage.</div>}
      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4 text-right">Calls</th>
                <th className="pb-3 pr-4 text-right">Tokens</th>
                <th className="pb-3 pr-4 text-right">Cost</th>
                <th className="pb-3">Last Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data?.usage ?? []).map((r: AiUsageRow) => (
                <tr key={r.username} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-gray-900 dark:text-white">{r.full_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{r.email}</div>
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-200">{Number(r.call_count).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-200">{Number(r.total_tokens).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right font-medium text-gray-900 dark:text-white">{fmtCost(r.total_cost)}</td>
                  <td className="py-3 text-gray-500 dark:text-gray-400">{fmt(r.last_used)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageWrapper>
  );
}
