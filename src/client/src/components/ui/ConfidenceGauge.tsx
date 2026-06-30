function gaugeColor(score: number): string {
  if (score >= 80) return '#059669'; // emerald-600
  if (score >= 60) return '#d97706'; // amber-600
  return '#dc2626';                  // red-600
}

function gaugeTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

interface ConfidenceGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceGauge({ score, size = 'md', className = '' }: ConfidenceGaugeProps) {
  const dims = size === 'sm' ? 40 : size === 'lg' ? 72 : 56;
  const strokeWidth = size === 'sm' ? 4 : size === 'lg' ? 6 : 5;
  const r = (dims - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  const color = gaugeColor(score);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: dims, height: dims }}>
      <svg width={dims} height={dims} className="-rotate-90">
        <circle
          cx={dims / 2} cy={dims / 2} r={r}
          fill="none" stroke="currentColor"
          className="text-neutral-200 dark:text-neutral-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={dims / 2} cy={dims / 2} r={r}
          fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className={`absolute font-bold ${gaugeTextColor(score)} ${
        size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
      }`}>
        {score.toFixed(0)}
      </span>
    </div>
  );
}

interface ConfidenceBarProps {
  score: number;
  label?: string;
  className?: string;
}

export function ConfidenceBar({ score, label, className = '' }: ConfidenceBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs text-neutral-500 dark:text-neutral-400 w-28 flex-shrink-0">{label}</span>}
      <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: gaugeColor(score) }}
        />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${gaugeTextColor(score)}`}>
        {score.toFixed(0)}%
      </span>
    </div>
  );
}
