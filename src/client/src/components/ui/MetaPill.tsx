import React from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const variantClasses: Record<Variant, string> = {
  default:  'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
  success:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning:  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger:   'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info:     'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  muted:    'bg-neutral-50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
};

interface MetaPillProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export function MetaPill({ children, variant = 'default', className = '' }: MetaPillProps) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
