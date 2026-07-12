import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { AdminPageWrapper } from './AdminPageWrapper';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';

interface SystemData {
  uptime: number;
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number; percentUsed: number };
  cpu: { userPercent: number; systemPercent: number };
  db: { poolActive: number; poolIdle: number; poolTotal: number; poolWaiting: number; latencyP50: number; latencyP95: number; latencyP99: number; totalQueries: number };
  redis: { connected: boolean; memoryUsedMB: number | null };
  api: { totalRequests: number; activeRequests: number; p50Ms: number; p95Ms: number; p99Ms: number; errorRate5xx: number };
  ai: { totalRequests: number; inputTokens: number; outputTokens: number; budgetUsedPercent: number; costThisMonth: number; monthlyBudget: number };
  disk: { usedGB: number; totalGB: number; percentUsed: number } | null;
}

interface Warning {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  advice: string;
}

interface TenantRow {
  id: string; name: string; slug: string;
  totalUsers: number; activeUsers: number;
  apiRequestsToday: number; apiRequestsWeek: number;
  aiTokensThisMonth: number; aiCostThisMonth: number;
  projectCount: number; taskCount: number;
  storageRows: number; lastActive: string | null;
}

interface OperationsData {
  system: SystemData;
  warnings: Warning[];
  tenants: TenantRow[];
}

function GaugeCard({ label, value, max, unit, percent }: { label: string; value: string; max?: string; unit?: string; percent: number }) {
  const color = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = percent > 90 ? 'text-red-600 dark:text-red-400' : percent > 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${textColor}`}>
        {value}{unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}
      </p>
      {max && <p className="text-xs text-gray-400 dark:text-gray-500">/ {max}</p>}
      <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function WarningBanner({ warning }: { warning: Warning }) {
  const styles = {
    critical: { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: AlertCircle, iconColor: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: AlertTriangle, iconColor: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', icon: Info, iconColor: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  };
  const s = styles[warning.severity];
  const Icon = s.icon;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${s.bg}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${s.badge}`}>{warning.severity.toUpperCase()}</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{warning.title}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{warning.message}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{warning.advice}</p>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AdminOperationsPage() {
  const [sortCol, setSortCol] = useState<keyof TenantRow>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<OperationsData>({
    queryKey: ['admin-operations'],
    queryFn: () => apiService.getAdminOperations(),
    refetchInterval: 30_000,
  });

  const handleSort = (col: keyof TenantRow) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedTenants = React.useMemo(() => {
    if (!data?.tenants) return [];
    return [...data.tenants].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [data?.tenants, sortCol, sortDir]);

  return (
    <AdminPageWrapper title="Operations Dashboard" subtitle="Real-time system health, warnings, and tenant usage">
      {/* Header with refresh info */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {dataUpdatedAt ? `Last updated: ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''} &middot; Auto-refresh: 30s
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading operations data...</div>}
      {error && <div className="text-center py-12 text-red-500">Failed to load operations data.</div>}

      {data && (
        <>
          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="mb-6 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Warnings</h2>
              {data.warnings.map((w, i) => <WarningBanner key={i} warning={w} />)}
            </div>
          )}

          {/* System Health Gauges */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">System Health</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <GaugeCard
                label="Memory (Heap)"
                value={data.system.memory.heapUsedMB.toFixed(0)}
                max={`${data.system.memory.heapTotalMB.toFixed(0)} MB`}
                unit="MB"
                percent={data.system.memory.percentUsed}
              />
              <GaugeCard
                label="CPU"
                value={(data.system.cpu.userPercent + data.system.cpu.systemPercent).toFixed(1)}
                unit="%"
                percent={data.system.cpu.userPercent + data.system.cpu.systemPercent}
              />
              <GaugeCard
                label="DB Pool"
                value={`${data.system.db.poolActive}`}
                max={`${data.system.db.poolTotal}`}
                percent={data.system.db.poolTotal > 0 ? (data.system.db.poolActive / data.system.db.poolTotal) * 100 : 0}
              />
              <GaugeCard
                label="API p99 Latency"
                value={`${data.system.api.p99Ms}`}
                unit="ms"
                percent={Math.min((data.system.api.p99Ms / 5000) * 100, 100)}
              />
              <GaugeCard
                label="5xx Error Rate"
                value={`${data.system.api.errorRate5xx}`}
                unit="%"
                percent={Math.min(data.system.api.errorRate5xx * 10, 100)}
              />
              <GaugeCard
                label="Redis"
                value={data.system.redis.connected ? (data.system.redis.memoryUsedMB?.toFixed(1) || 'OK') : 'Down'}
                unit={data.system.redis.connected && data.system.redis.memoryUsedMB ? 'MB' : ''}
                percent={data.system.redis.connected ? 20 : 100}
              />
              <GaugeCard
                label="AI Budget"
                value={`$${data.system.ai.costThisMonth.toFixed(2)}`}
                max={`$${data.system.ai.monthlyBudget}`}
                percent={data.system.ai.budgetUsedPercent}
              />
              {data.system.disk && (
                <GaugeCard
                  label="Disk"
                  value={data.system.disk.usedGB.toFixed(1)}
                  max={`${data.system.disk.totalGB.toFixed(1)} GB`}
                  unit="GB"
                  percent={data.system.disk.percentUsed}
                />
              )}
            </div>
            {/* Extra stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Uptime</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatUptime(data.system.uptime)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Requests</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{data.system.api.totalRequests.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">DB Queries</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{data.system.db.totalQueries.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">AI Requests</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{data.system.ai.totalRequests.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Tenant Usage Table */}
          {data.tenants.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Tenant Usage</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {([
                        ['name', 'Name'],
                        ['totalUsers', 'Users'],
                        ['activeUsers', 'Active'],
                        ['projectCount', 'Projects'],
                        ['taskCount', 'Tasks'],
                        ['aiTokensThisMonth', 'AI Tokens'],
                        ['aiCostThisMonth', 'AI Cost'],
                      ] as [keyof TenantRow, string][]).map(([col, label]) => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {sortCol === col && <ArrowUpDown className="w-3 h-3" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTenants.map(t => (
                      <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{t.name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{t.totalUsers}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{t.activeUsers}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{t.projectCount}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{t.taskCount}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{t.aiTokensThisMonth.toLocaleString()}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">${t.aiCostThisMonth.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AdminPageWrapper>
  );
}
