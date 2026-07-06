import { Plus, AlertTriangle, ShieldAlert, Shield } from 'lucide-react';

interface RiskListPMProps {
  risks: any[];
  onAdd?: () => void;
}

function severityDotColor(severity: string): string {
  const s = (severity || '').toLowerCase();
  if (s === 'critical') return 'text-red-600 dark:text-red-400';
  if (s === 'high') return 'text-orange-500 dark:text-orange-400';
  if (s === 'medium') return 'text-amber-500 dark:text-amber-400';
  return 'text-gray-400 dark:text-gray-500';
}

function SeverityIcon({ severity }: { severity: string }) {
  const s = (severity || '').toLowerCase();
  const cls = `w-4 h-4 flex-shrink-0 ${severityDotColor(severity)}`;
  if (s === 'critical' || s === 'high') return <ShieldAlert className={cls} />;
  if (s === 'medium') return <AlertTriangle className={cls} />;
  return <Shield className={cls} />;
}

function statusTagColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (s === 'mitigated') return 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  if (s === 'monitoring') return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
  if (s === 'closed') return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
}

function impactTagColor(impact: string): string {
  const i = (impact || '').toLowerCase();
  if (i === 'critical' || i === 'high') return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (i === 'medium') return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
}

export function RiskListPM({ risks, onAdd }: RiskListPMProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Risks</h3>
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {risks.length}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Risk
          </button>
        )}
      </div>

      {/* List */}
      {risks.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">No risks recorded</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {risks.map((risk: any) => {
            const title: string = risk.title || risk.riskTitle || risk.description || 'Untitled Risk';
            const severity: string = risk.severity || risk.riskLevel || '';
            const status: string = risk.status || '';
            const impact: string = risk.impact || risk.impactLevel || '';

            return (
              <li
                key={risk.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-default"
              >
                <SeverityIcon severity={severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{title}</p>
                  {impact && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${impactTagColor(impact)}`}>
                        Impact: {impact}
                      </span>
                    </div>
                  )}
                </div>
                {status && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${statusTagColor(status)}`}>
                    {status}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
