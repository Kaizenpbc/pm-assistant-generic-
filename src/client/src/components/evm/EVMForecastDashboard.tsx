import { Sparkles, AlertTriangle, AlertCircle, Info } from 'lucide-react';

// ---------------------------------------------------------------------------
// Dollar formatting (matches SCurveChart convention)
// ---------------------------------------------------------------------------
function formatDollar(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Metric Card (matches app-wide style)
// ---------------------------------------------------------------------------
function MetricCard({
  label,
  value,
  color,
  tooltip,
  badge,
}: {
  label: string;
  value: string;
  color: string;
  tooltip?: string;
  badge?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center" title={tooltip}>
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
        {label}
        {badge && (
          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">
            <Sparkles className="h-2.5 w-2.5" />
            {badge}
          </span>
        )}
      </div>
      <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert severity helpers
// ---------------------------------------------------------------------------
const severityStyles: Record<string, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertTriangle },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: AlertCircle },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info },
};

// ---------------------------------------------------------------------------
// Effort / priority badges
// ---------------------------------------------------------------------------
function EffortBadge({ effort }: { effort: string }) {
  const cls =
    effort === 'low'
      ? 'bg-green-100 text-green-700'
      : effort === 'medium'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {effort}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const cls =
    priority <= 1
      ? 'bg-red-100 text-red-700'
      : priority <= 2
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      P{priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------
export function EVMForecastDashboard({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No EVM forecast data available.
      </div>
    );
  }

  const { currentMetrics, forecasts, aiPredictions, earlyWarnings } = data;

  // Determine colors for CPI / SPI
  const cpiColor =
    (currentMetrics?.cpi ?? 1) >= 1 ? 'text-green-600' : (currentMetrics?.cpi ?? 1) >= 0.9 ? 'text-yellow-600' : 'text-red-600';
  const spiColor =
    (currentMetrics?.spi ?? 1) >= 1 ? 'text-green-600' : (currentMetrics?.spi ?? 1) >= 0.9 ? 'text-yellow-600' : 'text-red-600';
  const tcpiColor = (currentMetrics?.tcpi ?? 1) > 1.1 ? 'text-red-600' : 'text-green-600';

  // AI predicted EAC (use the ML / AI forecast if available)
  const aiEAC = aiPredictions?.predictedEAC ?? forecasts?.eacCPI;

  return (
    <div className="space-y-4">
      {/* ----------------------------------------------------------------- */}
      {/* Summary Cards                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="CPI"
          value={(currentMetrics?.cpi ?? '-').toString()}
          color={cpiColor}
          tooltip="Cost Performance Index: EV / AC"
        />
        <MetricCard
          label="SPI"
          value={(currentMetrics?.spi ?? '-').toString()}
          color={spiColor}
          tooltip="Schedule Performance Index: EV / PV"
        />
        <MetricCard
          label="TCPI"
          value={(currentMetrics?.tcpi ?? '-').toString()}
          color={tcpiColor}
          tooltip="To-Complete Performance Index"
        />
        <MetricCard
          label="AI Predicted EAC"
          value={aiEAC != null ? formatDollar(aiEAC) : '-'}
          color="text-indigo-600"
          tooltip="AI / ML predicted Estimate at Completion"
          badge="AI"
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Early Warning Alerts                                              */}
      {/* ----------------------------------------------------------------- */}
      {earlyWarnings && earlyWarnings.length > 0 && (
        <div className="space-y-2">
          {earlyWarnings.map((w: any, i: number) => {
            const sev = severityStyles[w.severity] ?? severityStyles.info;
            const Icon = sev.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${sev.bg} ${sev.border}`}
              >
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${sev.text}`} />
                <div>
                  <span className={`text-xs font-semibold ${sev.text}`}>{w.title ?? w.metric ?? 'Warning'}</span>
                  {w.message && <p className={`text-[11px] mt-0.5 ${sev.text} opacity-80`}>{w.message}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Corrective Actions Table                                          */}
      {/* ----------------------------------------------------------------- */}
      {aiPredictions?.correctiveActions && aiPredictions.correctiveActions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h3 className="text-xs font-semibold text-gray-700">AI-Recommended Corrective Actions</h3>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase text-[10px]">Action</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-500 uppercase text-[10px]">Effort</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-500 uppercase text-[10px]">Priority</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase text-[10px]">Est. Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aiPredictions.correctiveActions.map((action: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className="px-3 py-2 text-gray-700 max-w-xs">{action.description ?? action.action}</td>
                    <td className="px-3 py-2 text-center">
                      <EffortBadge effort={action.effort ?? 'medium'} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PriorityBadge priority={action.priority ?? 3} />
                    </td>
                    <td className="px-3 py-2 text-gray-500">{action.estimatedImpact ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
