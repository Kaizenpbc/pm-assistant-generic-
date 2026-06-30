type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const riskStyles: Record<RiskLevel, { dot: string; text: string; border: string; bg: string }> = {
  low:      { dot: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700', bg: 'bg-white dark:bg-emerald-950/30' },
  medium:   { dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-300 dark:border-amber-700',   bg: 'bg-white dark:bg-amber-950/30' },
  high:     { dot: 'bg-orange-600',  text: 'text-orange-700 dark:text-orange-400',   border: 'border-orange-300 dark:border-orange-700', bg: 'bg-white dark:bg-orange-950/30' },
  critical: { dot: 'bg-red-600',     text: 'text-red-700 dark:text-red-400',         border: 'border-red-300 dark:border-red-700',       bg: 'bg-white dark:bg-red-950/30' },
};

interface RiskBadgeProps {
  level: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function RiskBadge({ level, size = 'md', showLabel = true, className = '' }: RiskBadgeProps) {
  const style = riskStyles[(level as RiskLevel)] || riskStyles.medium;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider border-2 rounded ${style.text} ${style.border} ${style.bg} ${
        isSm ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-caption'
      } ${className}`}
    >
      <span className={`rounded-sm flex-shrink-0 ${style.dot} ${isSm ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {level}{showLabel && size === 'md' ? ' risk' : ''}
    </span>
  );
}
