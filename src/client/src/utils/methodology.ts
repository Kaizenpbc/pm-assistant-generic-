export type Methodology = 'waterfall' | 'agile' | 'hybrid';

type Tab = 'overview' | 'schedule' | 'raid' | 'ai-insights' | 'performance' | 'scenarios' | 'team' | 'agent-activity' | 'change-requests' | 'sprints' | 'resources' | 'time' | 'files' | 'budget';

export function getDefaultViewMode(m: Methodology): string {
  return m === 'agile' ? 'kanban' : 'gantt';
}

export function getPrimaryTabs(m: Methodology): { id: Tab; label: string }[] {
  const base: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'raid', label: 'RAID' },
    { id: 'sprints', label: 'Sprints' },
    { id: 'team', label: 'Team' },
    { id: 'time', label: 'Time' },
    { id: 'files', label: 'Files' },
    { id: 'performance', label: 'Performance' },
    { id: 'ai-insights', label: 'AI Insights' },
    { id: 'change-requests', label: 'Changes' },
  ];

  if (m === 'agile') {
    // Promote Sprints to position 2 (after Overview, before Schedule)
    const withoutSprints = base.filter(t => t.id !== 'sprints');
    const overviewIdx = withoutSprints.findIndex(t => t.id === 'overview');
    withoutSprints.splice(overviewIdx + 1, 0, { id: 'sprints', label: 'Sprints' });
    return withoutSprints;
  }

  if (m === 'hybrid') {
    // Promote Sprints to position 3 (after Schedule, before RAID)
    const withoutSprints = base.filter(t => t.id !== 'sprints');
    const scheduleIdx = withoutSprints.findIndex(t => t.id === 'schedule');
    withoutSprints.splice(scheduleIdx + 1, 0, { id: 'sprints', label: 'Sprints' });
    return withoutSprints;
  }

  // Waterfall: default order (sprints stays in position 4)
  return base;
}

export interface ReadinessStepConfig {
  key: string;
  label: string;
  tooltip: string;
  doneKey: 'tasks' | 'dependencies' | 'resources' | 'sprints' | 'clicked';
  clickedStepKey?: string;
  targetTab: string;
}

export function getReadinessSteps(m: Methodology): ReadinessStepConfig[] {
  if (m === 'agile') {
    return [
      { key: 'backlog', label: 'Backlog', tooltip: 'Create user stories in your backlog', doneKey: 'tasks', targetTab: 'schedule' },
      { key: 'sprint', label: 'Sprint', tooltip: 'Create your first sprint to start iterating', doneKey: 'sprints', targetTab: 'sprints' },
      { key: 'team', label: 'Team', tooltip: 'Add team members for capacity planning', doneKey: 'resources', targetTab: 'resources' },
      { key: 'velocity', label: 'Velocity', tooltip: 'Review velocity to forecast future sprints', doneKey: 'clicked', clickedStepKey: 'velocity', targetTab: 'sprints' },
      { key: 'burndown', label: 'Burndown', tooltip: 'Track sprint progress with burndown charts', doneKey: 'clicked', clickedStepKey: 'burndown', targetTab: 'sprints' },
    ];
  }

  if (m === 'hybrid') {
    return [
      { key: 'tasks', label: 'Tasks', tooltip: 'Import or create tasks to build your schedule', doneKey: 'tasks', targetTab: 'schedule' },
      { key: 'sprint', label: 'Sprint', tooltip: 'Create sprints for iterative delivery', doneKey: 'sprints', targetTab: 'sprints' },
      { key: 'resources', label: 'Resources', tooltip: 'Add team members for workload forecasting', doneKey: 'resources', targetTab: 'resources' },
      { key: 'critical-path', label: 'Critical Path', tooltip: 'See which tasks drive your finish date', doneKey: 'clicked', clickedStepKey: 'critical-path', targetTab: 'schedule' },
      { key: 'velocity', label: 'Velocity', tooltip: 'Track team velocity across sprints', doneKey: 'clicked', clickedStepKey: 'velocity', targetTab: 'sprints' },
    ];
  }

  // Waterfall (default)
  return [
    { key: 'tasks', label: 'Tasks', tooltip: 'Import or create tasks to build your schedule', doneKey: 'tasks', targetTab: 'schedule' },
    { key: 'dependencies', label: 'Dependencies', tooltip: 'Link tasks to reveal your critical path', doneKey: 'dependencies', targetTab: 'schedule' },
    { key: 'resources', label: 'Resources', tooltip: 'Add team members for workload and cost forecasting', doneKey: 'resources', targetTab: 'resources' },
    { key: 'critical-path', label: 'Critical Path', tooltip: 'See which tasks drive your finish date', doneKey: 'clicked', clickedStepKey: 'critical-path', targetTab: 'schedule' },
    { key: 'simulation', label: 'Simulation', tooltip: 'Run Monte Carlo to quantify schedule risk', doneKey: 'clicked', clickedStepKey: 'simulation', targetTab: 'simulation' },
  ];
}

