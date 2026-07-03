import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, AlertTriangle, ChevronDown, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { apiService } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project { id: string; name: string; }
interface Schedule { id: string; name: string; }

interface WorkloadWeek {
  weekStart: string;
  allocated: number;
  capacity: number;
  utilization: number;
}

interface WorkloadEntry {
  resourceId: string;
  resourceName: string;
  role: string;
  weeks: WorkloadWeek[];
  averageUtilization: number;
  isOverAllocated: boolean;
}

interface HistogramDemand { date: string; hours: number; }
interface HistogramResource { resourceName: string; demand: HistogramDemand[]; }
interface OverAllocation { resourceName: string; date: string; demand: number; capacity: number; }
interface HistogramData { resources: HistogramResource[]; overAllocations: OverAllocation[]; }

interface ForecastBottleneck {
  resourceName: string;
  week: string;
  demand: number;
  capacity: number;
  severity: string;
}

interface ForecastData {
  bottlenecks: ForecastBottleneck[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UTIL_COLORS = {
  low: '#22c55e',      // green — under 80%
  optimal: '#3b82f6',  // blue — 80-100%
  over: '#f59e0b',     // amber — 100-120%
  critical: '#ef4444', // red — 120%+
};

function utilColor(pct: number): string {
  if (pct <= 80) return UTIL_COLORS.low;
  if (pct <= 100) return UTIL_COLORS.optimal;
  if (pct <= 120) return UTIL_COLORS.over;
  return UTIL_COLORS.critical;
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResourceManagementPage() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [activeTab, setActiveTab] = useState<'workload' | 'histogram' | 'forecast'>('workload');

  // Queries
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });
  const projects: Project[] = projectsData?.projects || [];

  const { data: schedulesData } = useQuery({
    queryKey: ['schedules', selectedProjectId],
    queryFn: () => apiService.getSchedules(selectedProjectId),
    enabled: !!selectedProjectId,
  });
  const schedules: Schedule[] = schedulesData?.schedules || [];

  const { data: workloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ['workload', selectedProjectId],
    queryFn: () => apiService.getResourceWorkload(selectedProjectId),
    enabled: !!selectedProjectId,
  });
  const workload: WorkloadEntry[] = workloadData?.workload || [];

  const { data: histogramData, isLoading: histogramLoading } = useQuery({
    queryKey: ['histogram', selectedScheduleId],
    queryFn: () => apiService.getResourceHistogram(selectedScheduleId),
    enabled: !!selectedScheduleId,
  });
  const histogram: HistogramData | null = histogramData?.histogram || null;

  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['forecast', selectedProjectId],
    queryFn: () => apiService.getResourceForecast(selectedProjectId, 8),
    enabled: !!selectedProjectId,
  });
  const forecast: ForecastData | null = forecastData || null;

  // Derived stats
  const stats = useMemo(() => {
    if (!workload.length) return { total: 0, overAllocated: 0, avgUtil: 0 };
    const overAllocated = workload.filter(w => w.isOverAllocated).length;
    const avgUtil = Math.round(workload.reduce((s, w) => s + w.averageUtilization, 0) / workload.length);
    return { total: workload.length, overAllocated, avgUtil };
  }, [workload]);

  // Auto-select first schedule
  if (schedules.length > 0 && !selectedScheduleId) {
    setSelectedScheduleId(schedules[0].id);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-lg">
            <Users className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Resource Management</h1>
            <p className="text-sm text-gray-500">Monitor workload, allocation, and capacity across projects</p>
          </div>
        </div>
      </div>

      {/* Project & Schedule selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <select
            value={selectedProjectId}
            onChange={(e) => { setSelectedProjectId(e.target.value); setSelectedScheduleId(''); }}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {schedules.length > 1 && (
          <div className="relative">
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {!selectedProjectId && (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Select a project to view resource data</p>
        </div>
      )}

      {selectedProjectId && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                  <p className="text-xs text-gray-500">Total Resources</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.overAllocated > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <AlertTriangle className={`w-5 h-5 ${stats.overAllocated > 0 ? 'text-red-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.overAllocated}</p>
                  <p className="text-xs text-gray-500">Over-allocated</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgUtil}%</p>
                  <p className="text-xs text-gray-500">Avg Utilization</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-6">
              {([
                { key: 'workload' as const, label: 'Workload Heatmap', icon: BarChart3 },
                { key: 'histogram' as const, label: 'Resource Histogram', icon: Clock },
                { key: 'forecast' as const, label: 'Capacity Forecast', icon: TrendingUp },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workload heatmap tab */}
          {activeTab === 'workload' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {workloadLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              ) : workload.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p>No workload data available for this project.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <th className="sticky left-0 bg-gray-50 dark:bg-gray-700 z-10 text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 min-w-[180px]">Resource</th>
                        <th className="text-left px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 w-16">Avg</th>
                        {workload[0]?.weeks.map((w, i) => (
                          <th key={i} className="text-center px-1 py-3 font-medium text-gray-500 text-xs min-w-[60px]">{formatWeek(w.weekStart)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {workload.map(entry => (
                        <tr key={entry.resourceId} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="sticky left-0 bg-white dark:bg-gray-800 z-10 px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{entry.resourceName}</div>
                            <div className="text-xs text-gray-500">{entry.role}</div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: utilColor(entry.averageUtilization) }}
                            >
                              {Math.round(entry.averageUtilization)}%
                            </span>
                          </td>
                          {entry.weeks.map((w, i) => {
                            const pct = Math.round(w.utilization);
                            return (
                              <td key={i} className="px-1 py-3 text-center">
                                <div
                                  className="mx-auto w-10 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white"
                                  style={{ backgroundColor: utilColor(pct), opacity: pct === 0 ? 0.15 : 0.85 }}
                                  title={`${w.allocated}h / ${w.capacity}h (${pct}%)`}
                                >
                                  {pct > 0 ? `${pct}%` : ''}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Legend */}
              {workload.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500">
                  <span className="font-medium">Utilization:</span>
                  {[
                    { label: '< 80% Under', color: UTIL_COLORS.low },
                    { label: '80-100% Optimal', color: UTIL_COLORS.optimal },
                    { label: '100-120% Warning', color: UTIL_COLORS.over },
                    { label: '> 120% Critical', color: UTIL_COLORS.critical },
                  ].map(l => (
                    <span key={l.label} className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: l.color }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Histogram tab */}
          {activeTab === 'histogram' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {!selectedScheduleId ? (
                <div className="text-center py-12 text-gray-400">Select a schedule to view the histogram.</div>
              ) : histogramLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              ) : !histogram || histogram.resources.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No histogram data available.</div>
              ) : (
                <div className="space-y-6">
                  {/* Over-allocations summary */}
                  {histogram.overAllocations.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-700 dark:text-red-400">{histogram.overAllocations.length} Over-allocation{histogram.overAllocations.length > 1 ? 's' : ''} Detected</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {histogram.overAllocations.slice(0, 6).map((oa, i) => (
                          <div key={i} className="text-xs text-red-600 dark:text-red-400">
                            <span className="font-medium">{oa.resourceName}</span> on {new Date(oa.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {oa.demand}h / {oa.capacity}h
                          </div>
                        ))}
                        {histogram.overAllocations.length > 6 && (
                          <div className="text-xs text-red-500">...and {histogram.overAllocations.length - 6} more</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stacked bar chart per resource */}
                  {histogram.resources.map(res => {
                    const maxH = Math.max(...res.demand.map(d => d.hours), 8);
                    const chartH = 120;
                    const barW = Math.max(4, Math.min(20, 600 / Math.max(res.demand.length, 1)));
                    const chartW = res.demand.length * (barW + 2) + 40;

                    return (
                      <div key={res.resourceName}>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{res.resourceName}</h3>
                        <div className="overflow-x-auto">
                          <svg width={chartW} height={chartH + 30} className="block">
                            {/* 8h capacity line */}
                            <line x1={30} y1={chartH - (8 / maxH) * chartH} x2={chartW} y2={chartH - (8 / maxH) * chartH} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" />
                            <text x={0} y={chartH - (8 / maxH) * chartH + 4} fontSize={9} fill="#ef4444">8h</text>
                            {/* Bars */}
                            {res.demand.map((d, i) => {
                              const h = (d.hours / maxH) * chartH;
                              const isOver = d.hours > 8;
                              return (
                                <g key={i}>
                                  <rect
                                    x={30 + i * (barW + 2)}
                                    y={chartH - h}
                                    width={barW}
                                    height={h}
                                    fill={isOver ? '#ef4444' : '#3b82f6'}
                                    opacity={0.8}
                                    rx={1}
                                  />
                                  {i % Math.max(1, Math.floor(res.demand.length / 10)) === 0 && (
                                    <text x={30 + i * (barW + 2)} y={chartH + 14} fontSize={8} fill="#9ca3af" textAnchor="start" transform={`rotate(45, ${30 + i * (barW + 2)}, ${chartH + 14})`}>
                                      {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                            {/* Y axis */}
                            <line x1={29} y1={0} x2={29} y2={chartH} stroke="#e5e7eb" strokeWidth={1} />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Forecast tab */}
          {activeTab === 'forecast' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {forecastLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              ) : !forecast ? (
                <div className="text-center py-12 text-gray-400">No forecast data available.</div>
              ) : (
                <div className="space-y-6">
                  {/* Bottlenecks */}
                  {forecast.bottlenecks && forecast.bottlenecks.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Predicted Bottlenecks (next 8 weeks)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700">
                              <th className="text-left px-4 py-2 font-semibold text-gray-600">Resource</th>
                              <th className="text-left px-4 py-2 font-semibold text-gray-600">Week</th>
                              <th className="text-right px-4 py-2 font-semibold text-gray-600">Demand</th>
                              <th className="text-right px-4 py-2 font-semibold text-gray-600">Capacity</th>
                              <th className="text-left px-4 py-2 font-semibold text-gray-600">Severity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {forecast.bottlenecks.map((b, i) => (
                              <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{b.resourceName}</td>
                                <td className="px-4 py-2 text-gray-600">{formatWeek(b.week)}</td>
                                <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{b.demand}h</td>
                                <td className="px-4 py-2 text-right text-gray-600">{b.capacity}h</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white ${b.severity === 'critical' ? 'bg-red-500' : b.severity === 'high' ? 'bg-amber-500' : 'bg-yellow-400'}`}>
                                    {b.severity}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <TrendingUp className="w-5 h-5" />
                      <span className="text-sm font-medium">No bottlenecks predicted for the next 8 weeks</span>
                    </div>
                  )}

                  {/* Recommendations */}
                  {forecast.recommendations && forecast.recommendations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Recommendations</h3>
                      <ul className="space-y-1.5">
                        {forecast.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="text-primary-500 mt-0.5">&#8226;</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
