import { describe, it, expect } from 'vitest';

// Pure utility functions — import from client source directly
// (no DOM dependencies, works in Node environment)
import { getDefaultViewMode, getPrimaryTabs, getReadinessSteps } from '../../../client/src/utils/methodology';

describe('getDefaultViewMode', () => {
  it('returns gantt for waterfall', () => {
    expect(getDefaultViewMode('waterfall')).toBe('gantt');
  });

  it('returns kanban for agile', () => {
    expect(getDefaultViewMode('agile')).toBe('kanban');
  });

  it('returns gantt for hybrid', () => {
    expect(getDefaultViewMode('hybrid')).toBe('gantt');
  });
});

describe('getPrimaryTabs', () => {
  it('waterfall: sprints in position 4', () => {
    const tabs = getPrimaryTabs('waterfall');
    const ids = tabs.map(t => t.id);
    expect(ids[0]).toBe('overview');
    expect(ids[1]).toBe('schedule');
    expect(ids[2]).toBe('raid');
    expect(ids[3]).toBe('sprints');
  });

  it('agile: sprints promoted to position 2 (after overview)', () => {
    const tabs = getPrimaryTabs('agile');
    const ids = tabs.map(t => t.id);
    expect(ids[0]).toBe('overview');
    expect(ids[1]).toBe('sprints');
    expect(ids[2]).toBe('schedule');
  });

  it('hybrid: sprints promoted to position 3 (after schedule)', () => {
    const tabs = getPrimaryTabs('hybrid');
    const ids = tabs.map(t => t.id);
    expect(ids[0]).toBe('overview');
    expect(ids[1]).toBe('schedule');
    expect(ids[2]).toBe('sprints');
    expect(ids[3]).toBe('raid');
  });

  it('all methodologies return the same number of tabs', () => {
    const w = getPrimaryTabs('waterfall');
    const a = getPrimaryTabs('agile');
    const h = getPrimaryTabs('hybrid');
    expect(w.length).toBe(a.length);
    expect(w.length).toBe(h.length);
  });

  it('all methodologies contain the same tab IDs', () => {
    const w = new Set(getPrimaryTabs('waterfall').map(t => t.id));
    const a = new Set(getPrimaryTabs('agile').map(t => t.id));
    const h = new Set(getPrimaryTabs('hybrid').map(t => t.id));
    expect(w).toEqual(a);
    expect(w).toEqual(h);
  });
});

describe('getReadinessSteps', () => {
  it('waterfall: 5 steps starting with tasks', () => {
    const steps = getReadinessSteps('waterfall');
    expect(steps).toHaveLength(5);
    expect(steps[0].key).toBe('tasks');
    expect(steps[1].key).toBe('dependencies');
    expect(steps[4].key).toBe('simulation');
  });

  it('agile: 5 steps starting with backlog', () => {
    const steps = getReadinessSteps('agile');
    expect(steps).toHaveLength(5);
    expect(steps[0].key).toBe('backlog');
    expect(steps[1].key).toBe('sprint');
    expect(steps[2].key).toBe('team');
    expect(steps[3].key).toBe('velocity');
    expect(steps[4].key).toBe('burndown');
  });

  it('hybrid: 5 steps mixing waterfall and agile', () => {
    const steps = getReadinessSteps('hybrid');
    expect(steps).toHaveLength(5);
    expect(steps[0].key).toBe('tasks');
    expect(steps[1].key).toBe('sprint');
    expect(steps[4].key).toBe('velocity');
  });

  it('agile sprint step uses sprints doneKey', () => {
    const steps = getReadinessSteps('agile');
    const sprintStep = steps.find(s => s.key === 'sprint');
    expect(sprintStep?.doneKey).toBe('sprints');
  });

  it('clicked steps always have clickedStepKey', () => {
    for (const m of ['waterfall', 'agile', 'hybrid'] as const) {
      const steps = getReadinessSteps(m);
      for (const step of steps) {
        if (step.doneKey === 'clicked') {
          expect(step.clickedStepKey).toBeTruthy();
        }
      }
    }
  });
});
