import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, ChevronsUpDown, FolderKanban } from 'lucide-react';

export interface ProjectRow {
  id: string;
  name: string;
  status: string;
  priority?: string;
  projectType?: string;
  progressPercentage?: number;
  budgetAllocated?: number;
  budgetSpent?: number;
  startDate?: string;
  endDate?: string;
}

type SortKey =
  | 'name'
  | 'status'
  | 'priority'
  | 'projectType'
  | 'progressPercentage'
  | 'budgetAllocated'
  | 'budgetPct'
  | 'endDate'
  | 'daysRemaining';

const statusStyles: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  planning: { label: 'Planning', color: 'bg-purple-100 text-purple-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

const priorityStyles: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const statusOrder: Record<string, number> = {
  active: 0,
  planning: 1,
  on_hold: 2,
  completed: 3,
  cancelled: 4,
};

const typeLabels: Record<string, string> = {
  it: 'IT',
  construction: 'Construction',
  infrastructure: 'Infrastructure',
  roads: 'Roads',
  other: 'Other',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysRemaining(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />;
  return dir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
    : <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />;
}

interface Props {
  projects: ProjectRow[];
}

export function ProjectTable({ projects }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...projects].sort((a, b) => {
    let valA: number | string;
    let valB: number | string;

    switch (sortKey) {
      case 'name':
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case 'status':
        valA = statusOrder[a.status] ?? 99;
        valB = statusOrder[b.status] ?? 99;
        break;
      case 'priority':
        valA = priorityOrder[a.priority ?? ''] ?? 99;
        valB = priorityOrder[b.priority ?? ''] ?? 99;
        break;
      case 'projectType':
        valA = (typeLabels[a.projectType ?? ''] ?? a.projectType ?? '').toLowerCase();
        valB = (typeLabels[b.projectType ?? ''] ?? b.projectType ?? '').toLowerCase();
        break;
      case 'progressPercentage':
        valA = a.progressPercentage ?? 0;
        valB = b.progressPercentage ?? 0;
        break;
      case 'budgetAllocated':
        valA = a.budgetAllocated ?? 0;
        valB = b.budgetAllocated ?? 0;
        break;
      case 'budgetPct': {
        const pctA = a.budgetAllocated ? (a.budgetSpent ?? 0) / a.budgetAllocated : 0;
        const pctB = b.budgetAllocated ? (b.budgetSpent ?? 0) / b.budgetAllocated : 0;
        valA = pctA;
        valB = pctB;
        break;
      }
      case 'endDate':
        valA = a.endDate ?? '';
        valB = b.endDate ?? '';
        break;
      case 'daysRemaining':
        valA = daysRemaining(a.endDate) ?? Infinity;
        valB = daysRemaining(b.endDate) ?? Infinity;
        break;
      default:
        valA = '';
        valB = '';
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function Th({ label, sortable, col }: { label: string; sortable?: SortKey; col?: string }) {
    const active = sortable !== undefined && sortKey === sortable;
    return (
      <th
        className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${col ?? ''} ${sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
        onClick={sortable ? () => handleSort(sortable) : undefined}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sortable && <SortIcon active={active} dir={sortDir} />}
        </span>
      </th>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="card text-center py-12">
        <FolderKanban className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-900">No projects yet</h3>
        <p className="mt-1 text-sm text-gray-500">Create your first project to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <Th label="Name" sortable="name" />
            <Th label="Status" sortable="status" />
            <Th label="Priority" sortable="priority" />
            <Th label="Type" sortable="projectType" />
            <Th label="Progress" sortable="progressPercentage" />
            <Th label="Budget" sortable="budgetAllocated" />
            <Th label="Spent" sortable="budgetPct" />
            <Th label="End Date" sortable="endDate" />
            <Th label="Days Left" sortable="daysRemaining" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((project) => {
            const status = statusStyles[project.status] || statusStyles.planning;
            const progress = project.progressPercentage ?? 0;
            const budgetAllocated = project.budgetAllocated ?? 0;
            const budgetSpent = project.budgetSpent ?? 0;
            const budgetPct = budgetAllocated > 0 ? Math.round((budgetSpent / budgetAllocated) * 100) : null;
            const days = daysRemaining(project.endDate);

            return (
              <tr
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="cursor-pointer hover:bg-indigo-50 transition-colors"
              >
                {/* Name */}
                <td className="px-3 py-3 max-w-[220px]">
                  <span className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block">
                    {project.name}
                  </span>
                </td>

                {/* Status */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </td>

                {/* Priority */}
                <td className="px-3 py-3 whitespace-nowrap">
                  {project.priority ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${priorityStyles[project.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                      {project.priority}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* Type */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                  {project.projectType ? (typeLabels[project.projectType] ?? project.projectType) : '—'}
                </td>

                {/* Progress */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2 min-w-[80px]">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-8 text-right">{progress}%</span>
                  </div>
                </td>

                {/* Budget Allocated */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                  {budgetAllocated > 0 ? formatDollar(budgetAllocated) : <span className="text-gray-300">—</span>}
                </td>

                {/* Budget Spent % */}
                <td className="px-3 py-3 whitespace-nowrap">
                  {budgetPct !== null ? (
                    <span className={`text-sm font-medium ${budgetPct > 90 ? 'text-red-600' : 'text-gray-600'}`}>
                      {budgetPct}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* End Date */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(project.endDate)}
                </td>

                {/* Days Remaining */}
                <td className="px-3 py-3 whitespace-nowrap">
                  {days !== null ? (
                    <span className={`text-sm font-medium ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-orange-500' : 'text-gray-600'}`}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
