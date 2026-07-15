interface DelayIndicatorProps {
  delayDays: number;
}

export function DelayIndicator({ delayDays }: DelayIndicatorProps) {
  if (delayDays <= 0) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold px-1.5 py-0.5 leading-none">
      -{delayDays}d
    </span>
  );
}
