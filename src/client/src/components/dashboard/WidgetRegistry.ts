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
  { id: 'agent-proposals', label: 'Agent Insights', group: 'Agents', defaultOn: true },
];

export const EXEC_WIDGETS: WidgetDef[] = [
  { id: 'ai-summary', label: 'AI Summary', group: 'Insights', defaultOn: true },
  { id: 'stats', label: 'Portfolio Stats', group: 'Overview', defaultOn: true },
  { id: 'projects', label: 'All Projects', group: 'Overview', defaultOn: true },
  { id: 'activity', label: 'Recent Activity', group: 'Insights', defaultOn: false },
  { id: 'utilization', label: 'Resource Utilization', group: 'Resources', defaultOn: false },
  { id: 'burndown', label: 'Burndown Chart', group: 'Charts', defaultOn: false },
  { id: 'agent-proposals', label: 'Agent Insights', group: 'Agents', defaultOn: true },
];

export const SCRUM_MASTER_WIDGETS: WidgetDef[] = [
  { id: 'ai-summary', label: 'AI Summary', group: 'Insights', defaultOn: true },
  { id: 'sprints', label: 'Active Sprints', group: 'Agile', defaultOn: true },
  { id: 'velocity', label: 'Velocity Chart', group: 'Agile', defaultOn: true },
  { id: 'burndown', label: 'Sprint Burndown', group: 'Charts', defaultOn: true },
  { id: 'blocked', label: 'Blocked Tasks', group: 'Agile', defaultOn: true },
  { id: 'capacity', label: 'Team Capacity', group: 'Resources', defaultOn: false },
  { id: 'agent-proposals', label: 'Agent Insights', group: 'Agents', defaultOn: false },
];

export const FINANCE_WIDGETS: WidgetDef[] = [
  { id: 'ai-summary', label: 'AI Summary', group: 'Insights', defaultOn: true },
  { id: 'budget-overview', label: 'Budget Overview', group: 'Finance', defaultOn: true },
  { id: 'evm-metrics', label: 'EVM Metrics', group: 'Finance', defaultOn: true },
  { id: 'cost-variance', label: 'Cost Variance', group: 'Finance', defaultOn: true },
  { id: 'budget-alerts', label: 'Budget Alerts', group: 'Finance', defaultOn: true },
  { id: 'forecast', label: 'Budget Forecast', group: 'Finance', defaultOn: false },
  { id: 'agent-proposals', label: 'Budget Agent Insights', group: 'Agents', defaultOn: true },
];

export const RISK_WIDGETS: WidgetDef[] = [
  { id: 'ai-summary', label: 'AI Summary', group: 'Insights', defaultOn: true },
  { id: 'stats', label: 'Risk Stats', group: 'Overview', defaultOn: true },
  { id: 'risk-table', label: 'Risk Summary', group: 'Overview', defaultOn: true },
  { id: 'agent-proposals', label: 'Risk Agent Insights', group: 'Agents', defaultOn: true },
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
