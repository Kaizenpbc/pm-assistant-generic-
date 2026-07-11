import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  BarChart3,
  Calendar,
  Clock,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { SCurveChart } from './SCurveChart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDollar(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function indexColor(value: number): string {
  if (value >= 1.0) return 'text-green-600 dark:text-green-400';
  if (value >= 0.9) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function indexBgColor(value: number): string {
  if (value >= 1.0) return 'bg-green-600';
  if (value >= 0.9) return 'bg-amber-500';
  return 'bg-red-600';
}

function indexBarTrackColor(value: number): string {
  if (value >= 1.0) return 'bg-green-100 dark:bg-green-900/30';
  if (value >= 0.9) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

function verdictInfo(spi: number, cpi: number): { label: string; bg: string; text: string } {
  const worst = Math.min(spi, cpi);
  if (worst >= 1.0) return { label: 'On Track', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' };
  if (worst >= 0.9) return { label: 'Needs Attention', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' };
  return { label: 'At Risk', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };
}

function pctOfBAC(value: number, bac: number): string {
  if (!bac) return '0%';
  return `${((value / bac) * 100).toFixed(0)}%`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
      {message}
    </div>
  );
}

// Horizontal gauge for SPI/CPI
function IndexGauge({ label, value, variance, varianceLabel, note }: {
  label: string;
  value: number;
  variance: number;
  varianceLabel: string;
  note: string;
}) {
  // Map value 0.50-1.50 to 0%-100%
  const clampedValue = Math.max(0.5, Math.min(1.5, value));
  const pct = ((clampedValue - 0.5) / 1.0) * 100;
  const centerPct = 50; // 1.0 maps to center

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h4>
        <span className={`text-2xl font-bold ${indexColor(value)}`}>
          {value.toFixed(2)}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-3 rounded-full overflow-hidden mb-3" style={{ background: '#e5e7eb' }}>
        {/* Track color */}
        <div className={`absolute inset-0 ${indexBarTrackColor(value)} rounded-full`} />
        {/* Center line (1.0) */}
        <div className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500" style={{ left: `${centerPct}%` }} />
        {/* Dot indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 shadow ${indexBgColor(value)}`}
          style={{ left: `${pct}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-gray-400 mb-3">
        <span>0.50</span>
        <span>1.00</span>
        <span>1.50</span>
      </div>

      {/* Variance */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">{varianceLabel}:</span>
        <span className={`text-sm font-semibold ${variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {variance >= 0 ? '+' : ''}{formatDollar(variance)}
        </span>
      </div>

      {/* Plain-english note */}
      <p className="text-xs text-gray-500 dark:text-gray-400 italic">{note}</p>
    </div>
  );
}

// Input metric card
function InputCard({ label, value, subtitle, colorClass }: {
  label: string;
  value: string;
  subtitle: string;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</div>
    </div>
  );
}

// Empty state
function EmptyState({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const steps = [
    {
      icon: DollarSign,
      title: 'Set the project budget (BAC)',
      desc: 'Define your Budget at Completion so EVM can calculate cost variances.',
      tab: 'budget',
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    },
    {
      icon: Calendar,
      title: 'Baseline the schedule',
      desc: 'Create tasks with planned start/end dates so EVM can measure Planned Value.',
      tab: 'schedule',
      color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    },
    {
      icon: Clock,
      title: 'Record progress & actual cost',
      desc: 'Log time and mark tasks complete so EVM can compute Earned Value and Actual Cost.',
      tab: 'time',
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
      <BarChart3 className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Earned-value tracking isn't set up yet
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Complete these steps to unlock cost and schedule performance insights.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => onNavigate?.(step.tab)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:border-primary-300 dark:hover:border-primary-600 transition-colors group"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${step.color} mb-3`}>
              <step.icon className="h-4 w-4" />
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              {i + 1}. {step.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{step.desc}</div>
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
        Once budget, schedule, and actuals are in place, this panel will show CPI, SPI, forecasts, and AI-driven insights.
      </p>
    </div>
  );
}

// Severity styles for early warnings
const severityStyles: Record<string, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-300', icon: AlertTriangle },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-800 dark:text-yellow-300', icon: AlertCircle },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-300', icon: Info },
};

type ForecastMethod = 'cumulative' | 'composite' | 'management';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PerformancePanel({ projectId, onNavigate }: {
  projectId: string;
  onNavigate?: (tab: string) => void;
}) {
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod>('cumulative');

  const { data: evmData, isLoading: evmLoading, error: evmError } = useQuery({
    queryKey: ['evmForecast', projectId],
    queryFn: () => apiService.getEVMForecast(projectId),
    enabled: !!projectId,
  });

  const { data: sCurveData } = useQuery({
    queryKey: ['sCurve', projectId],
    queryFn: () => apiService.getSCurveData(projectId),
    enabled: !!projectId,
  });

  if (evmLoading) return <SectionSpinner />;
  if (evmError) return <SectionError message="Failed to load performance data." />;

  const forecast = evmData?.result;
  if (!forecast) return <EmptyState onNavigate={onNavigate} />;

  const metrics = forecast.currentMetrics;
  const traditionalForecasts = forecast.forecasts;
  const aiPredictions = forecast.aiPredictions;
  const earlyWarnings = forecast.earlyWarnings;

  const bac = metrics?.BAC ?? 0;
  const pv = metrics?.PV ?? 0;
  const ev = metrics?.EV ?? 0;
  const ac = metrics?.AC ?? 0;
  const cpi = metrics?.cpi ?? 1;
  const spi = metrics?.spi ?? 1;
  const sv = metrics?.SV ?? 0;
  const cv = metrics?.CV ?? 0;
  const tcpi = metrics?.tcpi ?? 1;

  // Empty state: no budget set
  if (bac === 0) return <EmptyState onNavigate={onNavigate} />;

  const verdict = verdictInfo(spi, cpi);

  // Forecast method selector
  const methodOptions: { key: ForecastMethod; label: string; formula: string }[] = [
    { key: 'cumulative', label: 'CPI', formula: 'EAC = BAC / CPI' },
    { key: 'composite', label: 'CPI x SPI', formula: 'EAC = AC + (BAC - EV) / (CPI x SPI)' },
    { key: 'management', label: 'Budget Rate', formula: 'EAC = AC + (BAC - EV)' },
  ];

  const selectedEAC =
    forecastMethod === 'cumulative' ? traditionalForecasts?.eacCumulative ?? traditionalForecasts?.eacCPI :
    forecastMethod === 'composite' ? traditionalForecasts?.eacComposite ?? traditionalForecasts?.eacSPICPI :
    traditionalForecasts?.eacManagement ?? traditionalForecasts?.eacBudgetRate;

  const etc = traditionalForecasts?.ETC ?? (selectedEAC != null ? selectedEAC - ac : null);
  const vac = traditionalForecasts?.VAC ?? (selectedEAC != null ? bac - selectedEAC : null);
  const selectedMethod = methodOptions.find(m => m.key === forecastMethod)!;

  const sCurvePoints = sCurveData?.data || sCurveData || [];

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* [1] Header                                                        */}
      {/* ================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            Project Performance (EVM)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cost & schedule performance vs. baseline
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${verdict.bg} ${verdict.text}`}>
          {verdict.label === 'On Track' && <CheckCircle2 className="h-3.5 w-3.5" />}
          {verdict.label === 'Needs Attention' && <AlertCircle className="h-3.5 w-3.5" />}
          {verdict.label === 'At Risk' && <AlertTriangle className="h-3.5 w-3.5" />}
          {verdict.label}
        </span>
      </div>

      {/* ================================================================= */}
      {/* [3] Inputs Strip                                                  */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InputCard
          label="BAC"
          value={formatDollar(bac)}
          subtitle="Total approved budget"
          colorClass="text-gray-900 dark:text-white"
        />
        <InputCard
          label="PV"
          value={formatDollar(pv)}
          subtitle={`${pctOfBAC(pv, bac)} planned by now`}
          colorClass="text-indigo-600 dark:text-indigo-400"
        />
        <InputCard
          label="EV"
          value={formatDollar(ev)}
          subtitle={`${pctOfBAC(ev, bac)} complete x BAC`}
          colorClass="text-teal-600 dark:text-teal-400"
        />
        <InputCard
          label="AC"
          value={formatDollar(ac)}
          subtitle="Spent to date"
          colorClass="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* ================================================================= */}
      {/* [4] SPI & CPI Gauges                                              */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <IndexGauge
          label="Schedule Performance (SPI)"
          value={spi}
          variance={sv}
          varianceLabel="SV"
          note={spi >= 1.0 ? 'Work is on or ahead of baseline' : 'Earning value slower than planned'}
        />
        <IndexGauge
          label="Cost Performance (CPI)"
          value={cpi}
          variance={cv}
          varianceLabel="CV"
          note={cpi >= 1.0 ? 'Spending is on or under budget' : 'Spending more than value earned'}
        />
      </div>

      {/* ================================================================= */}
      {/* [5] Forecast Card with Method Selector                            */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Estimate at Completion (EAC)</h3>
          {/* Segmented control */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-100 dark:bg-gray-700">
            {methodOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setForecastMethod(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  forecastMethod === opt.key
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {selectedEAC != null ? formatDollar(selectedEAC) : '-'}
            </div>
            {vac != null && (
              <div className={`text-sm font-medium mt-1 ${vac >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                VAC: {vac >= 0 ? '+' : ''}{formatDollar(vac)} vs BAC
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 italic">
            {selectedMethod.formula}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* [6] S-Curve Chart                                                 */}
      {/* ================================================================= */}
      {Array.isArray(sCurvePoints) && sCurvePoints.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">S-Curve</h3>
          <SCurveChart data={sCurvePoints} />
        </div>
      )}

      {/* ================================================================= */}
      {/* [7] Forecast Table                                                */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Metric</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Formula</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Value</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            <tr>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">EAC</td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{selectedMethod.formula}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                {selectedEAC != null ? formatDollar(selectedEAC) : '-'}
              </td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">
                Predicted total cost at project end
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">ETC</td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">EAC - AC</td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                {etc != null ? formatDollar(etc) : '-'}
              </td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">
                Remaining cost to finish
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">VAC</td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">BAC - EAC</td>
              <td className={`px-4 py-2.5 text-right font-semibold ${
                vac != null && vac >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {vac != null ? `${vac >= 0 ? '+' : ''}${formatDollar(vac)}` : '-'}
              </td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">
                {vac != null && vac >= 0 ? 'Under budget' : 'Over budget'} at completion
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">TCPI</td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">(BAC - EV) / (BAC - AC)</td>
              <td className={`px-4 py-2.5 text-right font-semibold ${
                tcpi <= 1.0 ? 'text-green-600 dark:text-green-400' : tcpi <= 1.1 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {tcpi.toFixed(2)}
              </td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">
                {tcpi <= 1.0 ? 'Can meet budget at current pace' : 'Must improve efficiency to meet budget'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ================================================================= */}
      {/* [8] AI Interpretation                                             */}
      {/* ================================================================= */}
      {aiPredictions && (aiPredictions.narrativeSummary || aiPredictions.predictedEAC != null) && (
        <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-300">AI Analysis</h3>
            {aiPredictions.overrunProbability != null && (
              <span className={`ml-auto text-xs font-medium rounded-full px-2 py-0.5 ${
                aiPredictions.overrunProbability > 0.5
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}>
                {Math.round(aiPredictions.overrunProbability * 100)}% overrun probability
              </span>
            )}
          </div>
          {aiPredictions.narrativeSummary && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {aiPredictions.narrativeSummary}
            </p>
          )}
          {aiPredictions.predictedEAC != null && !aiPredictions.narrativeSummary && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              AI-predicted Estimate at Completion: <strong>{formatDollar(aiPredictions.predictedEAC)}</strong>
            </p>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* [9] Early Warnings                                                */}
      {/* ================================================================= */}
      {earlyWarnings && earlyWarnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Early Warnings</h3>
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
                  {w.message && <p className={`text-xs mt-0.5 ${sev.text} opacity-80`}>{w.message}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* Corrective Actions                                                */}
      {/* ================================================================= */}
      {aiPredictions?.correctiveActions && aiPredictions.correctiveActions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Bot className="h-4 w-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI-Recommended Corrective Actions</h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs">Action</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs">Effort</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs">Priority</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs">Est. Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {aiPredictions.correctiveActions.map((action: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs">{action.description ?? action.action}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        action.effort === 'low' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        action.effort === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}>
                        {action.effort ?? 'medium'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        (action.priority ?? 3) <= 1 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                        (action.priority ?? 3) <= 2 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}>
                        P{action.priority ?? 3}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{action.estimatedImpact ?? '-'}</td>
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
