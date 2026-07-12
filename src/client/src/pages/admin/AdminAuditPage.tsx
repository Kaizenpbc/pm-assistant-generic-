import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { AdminPageWrapper } from './AdminPageWrapper';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorType: string;
  projectId: string | null;
  source: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function fmt(date: string) {
  return new Date(date).toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
};

export function AdminAuditPage() {
  const [limit] = useState(100);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-audit', limit],
    queryFn: () => apiService.getAdminAudit(limit),
  });

  return (
    <AdminPageWrapper title="Audit Trail" subtitle="Recent activity across all projects">
      {isLoading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading audit trail...</div>}
      {error && <div className="text-center py-12 text-red-500">Failed to load audit trail.</div>}
      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="pb-3 pr-4">Timestamp</th>
                <th className="pb-3 pr-4">Action</th>
                <th className="pb-3 pr-4">Entity</th>
                <th className="pb-3 pr-4">Actor</th>
                <th className="pb-3 pr-4">Source</th>
                <th className="pb-3">Project</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data?.entries ?? []).map((entry: AuditEntry) => {
                const colorClass = ACTION_COLORS[entry.action] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200';
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmt(entry.createdAt)}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900 dark:text-white">{entry.entityType}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{entry.entityId?.slice(0, 8)}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-gray-700 dark:text-gray-200">{entry.actorType}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{entry.actorId?.slice(0, 8)}</div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{entry.source}</td>
                    <td className="py-3 text-xs text-gray-400 dark:text-gray-500 font-mono">{entry.projectId?.slice(0, 8) || '\u2014'}</td>
                  </tr>
                );
              })}
              {(data?.entries ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-gray-400">No audit entries found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageWrapper>
  );
}
