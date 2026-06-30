import type { ReactNode } from 'react';
import type { WidgetDef } from './WidgetRegistry';

interface WidgetGridProps {
  widgets: WidgetDef[];
  enabledIds: Set<string>;
  renderWidget: (id: string) => ReactNode;
}

export function WidgetGrid({ widgets, enabledIds, renderWidget }: WidgetGridProps) {
  const visible = widgets.filter(w => enabledIds.has(w.id));

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No widgets enabled. Click Customize to add widgets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map(w => (
        <div key={w.id}>{renderWidget(w.id)}</div>
      ))}
    </div>
  );
}
