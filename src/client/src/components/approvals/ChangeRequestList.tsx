import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, GitPullRequest, Clock } from 'lucide-react';
import { apiService } from '../../services/api';

interface ChangeRequestListProps {
  projectId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const STATUS_OPTIONS = ['all', 'draft', 'pending', 'in_review', 'approved', 'rejected', 'withdrawn'] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
};

const CATEGORY_COLORS: Record<string, string> = {
  scope: 'bg-purple-100 text-purple-800',
  schedule: 'bg-blue-100 text-blue-800',
  budget: 'bg-green-100 text-green-800',
  resource: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-700',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ChangeRequestList({ projectId, onSelect, onNew }: ChangeRequestListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['change-requests', projectId, statusFilter],
    queryFn: () => apiService.getChangeRequests(projectId, statusFilter === 'all' ? undefined : statusFilter),
    enabled: !!projectId,
  });

  const changeRequests: any[] = data?.changeRequests || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Change Requests</h3>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Change Request
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All' : statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500 text-sm">Failed to load change requests.</div>
      ) : changeRequests.length === 0 ? (
        <div className="text-center py-12">
          <GitPullRequest className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No change requests found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wider">Priority</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wider">Requested By</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {changeRequests.map((cr: any) => (
                <tr
                  key={cr.id}
                  onClick={() => onSelect(cr.id)}
                  className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{cr.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cr.category] || CATEGORY_COLORS.other}`}>
                      {cr.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium capitalize">{cr.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cr.status] || STATUS_COLORS.draft}`}>
                      {statusLabel(cr.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{cr.requestedByName || cr.requestedBy || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(cr.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
