export interface WidgetDef {
  id: string;
  label: string;
  group: string;
  defaultOn: boolean;
}

// Widget definitions — order determines render order
export const PM_WIDGETS: WidgetDef[] = [
  { id: 'ai-summary', label: 'AI Summary', group: 'Insights', defaultOn: true },
  { id: 'stats', label: 'Quick Stats', group: 'Overview', defaultOn: true },
  { id: 'projects', label: 'Project Table', group: 'Overview', defaultOn: true },
  { id: 'activity', label: 'Recent Activity', group: 'Insights', defaultOn: false },
  { id: 'utilization', label: 'Resource Utilization', group: 'Resources', defaultOn: false },
  { id: 'burndown', label: 'Burndown Chart', group: 'Charts', defaultOn: false },
];

export const EXEC_WIDGETS: WidgetDef[] = [
  { id: 'ai-summary', label: 'AI Summary', group: 'Insights', defaultOn: true },
  { id: 'stats', label: 'Portfolio Stats', group: 'Overview', defaultOn: true },
  { id: 'projects', label: 'All Projects', group: 'Overview', defaultOn: true },
  { id: 'activity', label: 'Recent Activity', group: 'Insights', defaultOn: false },
  { id: 'utilization', label: 'Resource Utilization', group: 'Resources', defaultOn: false },
  { id: 'burndown', label: 'Burndown Chart', group: 'Charts', defaultOn: false },
];

export function getDefaultWidgetIds(widgets: WidgetDef[]): string[] {
  return widgets.filter(w => w.defaultOn).map(w => w.id);
}

export function loadWidgetIds(storageKey: string, widgets: WidgetDef[]): Set<string> {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const arr = JSON.parse(stored) as string[];
      return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set(getDefaultWidgetIds(widgets));
}

export function saveWidgetIds(storageKey: string, ids: Set<string>) {
  localStorage.setItem(storageKey, JSON.stringify([...ids]));
}

export function loadWidgetOrder(storageKey: string, widgets: WidgetDef[]): string[] {
  try {
    const stored = localStorage.getItem(storageKey + ':order');
    if (stored) return JSON.parse(stored) as string[];
  } catch { /* ignore */ }
  return widgets.map(w => w.id);
}

export function saveWidgetOrder(storageKey: string, order: string[]) {
  localStorage.setItem(storageKey + ':order', JSON.stringify(order));
}
