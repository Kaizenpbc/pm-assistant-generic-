export interface WidgetDef {
  id: string;
  label: string;
  group: string;
  defaultOn: boolean;
}

// Unified dashboard widgets — fixed layout order, togglable visibility
export const UNIFIED_WIDGETS: WidgetDef[] = [
  { id: 'kpi', label: 'KPI Tiles', group: 'Overview', defaultOn: true },
  { id: 'intel', label: 'Portfolio Intelligence', group: 'Overview', defaultOn: true },
  { id: 'projects', label: 'Projects Table', group: 'Overview', defaultOn: true },
  { id: 'trend', label: 'Issues Trend', group: 'Charts', defaultOn: true },
  { id: 'milestones', label: 'Milestones', group: 'Details', defaultOn: true },
  { id: 'budget', label: 'Budget Watch', group: 'Details', defaultOn: true },
  { id: 'activity', label: 'Recent Activity', group: 'Details', defaultOn: true },
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
