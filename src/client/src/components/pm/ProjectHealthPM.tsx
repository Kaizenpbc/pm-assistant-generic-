interface ProjectHealthPMProps {
  healthScore: number;
  breakdown: {
    scheduleHealth: number;
    budgetHealth: number;
    riskHealth: number;
  };
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function ringColor(score: number): string {
  if (score >= 75) return 'border-green-500';
  if (score >= 50) return 'border-amber-500';
  return 'border-red-500';
}

function barColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function MiniMeter({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`text-[11px] font-semibold ${scoreColor(score)}`}>{pct}</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ProjectHealthPM({ healthScore, breakdown }: ProjectHealthPMProps) {
  const score = Math.max(0, Math.min(100, Math.round(healthScore)));
  const label = score >= 75 ? 'Healthy' : score >= 50 ? 'Watch' : 'At Risk';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Project Health</h3>

      {/* Circular score */}
      <div className="flex flex-col items-center mb-5">
        <div
          className={`w-20 h-20 rounded-full border-[6px] ${ringColor(healthScore)} flex items-center justify-center`}
        >
          <div className="text-center">
            <p className={`text-2xl font-extrabold leading-none ${scoreColor(healthScore)}`}>{score}</p>
          </div>
        </div>
        <p className={`text-xs font-semibold mt-2 ${scoreColor(healthScore)}`}>{label}</p>
      </div>

      {/* Breakdown meters */}
      <div className="space-y-3">
        <MiniMeter label="Schedule" score={breakdown.scheduleHealth} />
        <MiniMeter label="Budget" score={breakdown.budgetHealth} />
        <MiniMeter label="Risk / Scope" score={breakdown.riskHealth} />
      </div>
    </div>
  );
}
