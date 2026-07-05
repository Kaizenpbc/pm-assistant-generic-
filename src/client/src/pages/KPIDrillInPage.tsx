import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  HeartPulse,
  Clock,
  ShieldAlert,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useState, useMemo } from 'react';

type DrillInType = 'health' | 'overdue' | 'risks' | 'at-risk' | 'budget-variance' | 'budget-utilization';

interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
}

const typeConfig: Record<DrillInType, { title: string; icon: React.ElementType; subtitle: (count: number) => string }> = {
  health: { title: 'Portfolio Health', icon: HeartPulse, subtitle: (n) => `${n} projects` },
  overdue: { title: 'Overdue Tasks', icon: Clock, subtitle: (n) => `${n} overdue tasks` },
  risks: { title: 'Open Risks', icon: ShieldAlert, subtitle: (n) => `${n} projects with elevated risk` },
  'at-risk': { title: 'At-Risk Projects', icon: AlertTriangle, subtitle: (n) => `${n} at-risk projects` },
  'budget-variance': { title: 'Budget Variance', icon: DollarSign, subtitle: (n) => `${n} projects over budget` },
  'budget-utilization': { title: 'Budget Utilization', icon: TrendingUp, subtitle: (n) => `${n} projects over budget` },
};

const validTypes = new Set<string>(['health', 'overdue', 'risks', 'at-risk', 'budget-variance', 'budget-utilization']);

function getScope(): 'portfolio' | undefined {
  try {
    const val = localStorage.getItem('dashboard:scope');
    return val === 'portfolio' ? 'portfolio' : undefined;
  } catch {
    return undefined;
  }
}

function riskLevelColor(level: string) {
  switch (level?.toLowerCase()) {
    case 'critical': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
    case 'high': return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30';
    case 'medium': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30';
    case 'low': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
    default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800';
  }
}

function healthDot(score: number) {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color} mr-2`} />;
}

export function KPIDrillInPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const scope = getScope();

  const isValid = validTypes.has(type || '');
  const config = isValid ? typeConfig[type as DrillInType] : null;

  const needsPredictions = type === 'health' || type === 'risks';
  const needsOverdue = type === 'overdue';
  const needsAnalytics = type === 'at-risk' || type === 'budget-variance' || type === 'budget-utilization';

  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ['dashboard-predictions'],
    queryFn: () => apiService.getDashboardPredictions(),
    staleTime: 120_000,
    enabled: needsPredictions,
  });

  const { data: overdueTasks, isLoading: overdueLoading } = useQuery({
    queryKey: ['dashboard-overdue-tasks', scope],
    queryFn: () => apiService.getDashboardOverdueTasks(scope),
    staleTime: 120_000,
    enabled: needsOverdue,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics-summary', scope],
    queryFn: () => apiService.getAnalyticsSummary(scope),
    staleTime: 120_000,
    enabled: needsAnalytics,
  });

  const isLoading = (needsPredictions && predictionsLoading) || (needsOverdue && overdueLoading) || (needsAnalytics && analyticsLoading);

  const { rows, columns } = useMemo(() => {
    if (!isValid) return { rows: [], columns: [] };

    switch (type as DrillInType) {
      case 'health': {
        const scores = predictions?.projectHealthScores || [];
        const cols: ColumnDef[] = [
          { key: 'projectName', label: 'Project', sortable: true },
          {
            key: 'healthScore', label: 'Health Score', sortable: true,
            render: (r: any) => <span className="flex items-center">{healthDot(r.healthScore)}{r.healthScore}%</span>,
          },
          {
            key: 'riskLevel', label: 'Risk Level', sortable: true,
            render: (r: any) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskLevelColor(r.riskLevel)}`}>{r.riskLevel}</span>,
          },
        ];
        return { rows: scores, columns: cols };
      }

      case 'overdue': {
        const tasks = overdueTasks?.tasks || overdueTasks || [];
        const withDays = tasks.map((t: any) => {
          const due = t.dueDate || t.end_date;
          const daysOverdue = due ? Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 86400000)) : 0;
          return { ...t, daysOverdue, dueDate: due };
        });
        const cols: ColumnDef[] = [
          { key: 'name', label: 'Task', sortable: true, render: (r: any) => r.name || r.title },
          { key: 'projectName', label: 'Project', sortable: true, render: (r: any) => r.projectName || r.project_name || '-' },
          {
            key: 'priority', label: 'Priority', sortable: true,
            render: (r: any) => {
              const p = r.priority || 'medium';
              const cls = p === 'critical' || p === 'high' ? 'text-red-600' : p === 'medium' ? 'text-amber-600' : 'text-gray-500';
              return <span className={`text-xs font-medium ${cls}`}>{p}</span>;
            },
          },
          { key: 'dueDate', label: 'Due Date', sortable: true, render: (r: any) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '-' },
          {
            key: 'daysOverdue', label: 'Days Overdue', sortable: true,
            render: (r: any) => <span className="text-red-600 font-medium">{r.daysOverdue}</span>,
          },
        ];
        return { rows: withDays, columns: cols };
      }

      case 'risks': {
        const scores = (predictions?.projectHealthScores || []).filter((s: any) => s.riskLevel && s.riskLevel.toLowerCase() !== 'low');
        const cols: ColumnDef[] = [
          { key: 'projectName', label: 'Project', sortable: true },
          {
            key: 'riskLevel', label: 'Risk Level', sortable: true,
            render: (r: any) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskLevelColor(r.riskLevel)}`}>{r.riskLevel}</span>,
          },
          {
            key: 'healthScore', label: 'Health Score', sortable: true,
            render: (r: any) => <span className="flex items-center">{healthDot(r.healthScore)}{r.healthScore}%</span>,
          },
        ];
        return { rows: scores, columns: cols };
      }

      case 'at-risk': {
        const projects = analytics?.portfolio?.atRiskProjects || [];
        const cols: ColumnDef[] = [
          { key: 'name', label: 'Project', sortable: true },
          { key: 'reason', label: 'Reason', sortable: true, render: (r: any) => r.reason || r.status || '-' },
        ];
        return { rows: projects, columns: cols };
      }

      case 'budget-variance':
      case 'budget-utilization': {
        const projects = analytics?.budget?.projectsOverBudget || [];
        const cols: ColumnDef[] = [
          { key: 'name', label: 'Project', sortable: true, render: (r: any) => r.name || r.projectName },
          {
            key: 'overrunPercent', label: 'Overrun %', sortable: true,
            render: (r: any) => {
              const pct = r.overrunPercent ?? r.overrun ?? 0;
              const cls = pct > 20 ? 'text-red-600' : pct > 10 ? 'text-amber-600' : 'text-green-600';
              return <span className={`font-medium ${cls}`}>{typeof pct === 'number' ? `${pct.toFixed(1)}%` : pct}</span>;
            },
          },
        ];
        return { rows: projects, columns: cols };
      }

      default:
        return { rows: [], columns: [] };
    }
  }, [type, predictions, overdueTasks, analytics, isValid]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function getRowProjectId(row: any): string | undefined {
    return row.projectId || row.project_id || row.id;
  }

  if (!isValid) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Page not found</p>
        <button onClick={() => navigate('/dashboard')} className="text-primary-600 hover:underline flex items-center gap-1 mx-auto">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  const Icon = config!.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{config!.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{config!.subtitle(sortedRows.length)}</p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          No data available
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 ${col.sortable ? 'cursor-pointer hover:text-gray-900 dark:hover:text-white select-none' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row: any, i: number) => {
                const projectId = getRowProjectId(row);
                return (
                  <tr
                    key={row.id || i}
                    className={`border-b border-gray-100 dark:border-gray-700/50 ${projectId ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}`}
                    onClick={() => projectId && navigate(`/project/${projectId}`)}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {col.render ? col.render(row) : (row[col.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
