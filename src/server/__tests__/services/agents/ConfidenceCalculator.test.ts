import { describe, it, expect, vi } from 'vitest';

// Mock databaseService to avoid config validation
vi.mock('../../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
  },
}));

import { ConfidenceCalculator } from '../../../services/agents/ConfidenceCalculator';

const calc = new ConfidenceCalculator();

describe('ConfidenceCalculator', () => {
  describe('compute', () => {
    it('returns high confidence for strong factors', () => {
      const result = calc.compute({ dataQuality: 90, historicalAccuracy: 85, modelCertainty: 80 });
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.label).toBe('high');
      expect(result.canPropose).toBe(true);
      expect(result.canAutoExecute).toBe(true);
    });

    it('returns medium confidence for moderate factors', () => {
      const result = calc.compute({ dataQuality: 70, historicalAccuracy: 65, modelCertainty: 60 });
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
      expect(result.label).toBe('medium');
      expect(result.canPropose).toBe(true);
      expect(result.canAutoExecute).toBe(false);
    });

    it('returns low confidence for weak factors', () => {
      const result = calc.compute({ dataQuality: 50, historicalAccuracy: 45, modelCertainty: 40 });
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(60);
      expect(result.label).toBe('low');
      expect(result.canPropose).toBe(true);
      expect(result.canAutoExecute).toBe(false);
    });

    it('returns very_low confidence and blocks proposals for poor factors', () => {
      const result = calc.compute({ dataQuality: 20, historicalAccuracy: 30, modelCertainty: 10 });
      expect(result.score).toBeLessThan(40);
      expect(result.label).toBe('very_low');
      expect(result.canPropose).toBe(false);
      expect(result.canAutoExecute).toBe(false);
    });

    it('clamps score to 0-100 range', () => {
      const high = calc.compute({ dataQuality: 110, historicalAccuracy: 110, modelCertainty: 110 });
      expect(high.score).toBeLessThanOrEqual(100);

      const low = calc.compute({ dataQuality: -10, historicalAccuracy: -10, modelCertainty: -10 });
      expect(low.score).toBeGreaterThanOrEqual(0);
    });

    it('uses correct weights (40/30/30)', () => {
      // dataQuality=100, rest=0 → 100*0.4 = 40
      const dqOnly = calc.compute({ dataQuality: 100, historicalAccuracy: 0, modelCertainty: 0 });
      expect(dqOnly.score).toBe(40);

      // historicalAccuracy=100, rest=0 → 100*0.3 = 30
      const haOnly = calc.compute({ dataQuality: 0, historicalAccuracy: 100, modelCertainty: 0 });
      expect(haOnly.score).toBe(30);

      // modelCertainty=100, rest=0 → 100*0.3 = 30
      const mcOnly = calc.compute({ dataQuality: 0, historicalAccuracy: 0, modelCertainty: 100 });
      expect(mcOnly.score).toBe(30);
    });
  });

  describe('computeDataQuality', () => {
    it('returns 100 for perfect data', () => {
      const score = calc.computeDataQuality({
        totalTasks: 10,
        tasksWithDates: 10,
        tasksWithAssignments: 10,
        tasksUpdatedRecently: 10,
        hasBudgetData: true,
        hasResourceData: true,
      });
      expect(score).toBe(100);
    });

    it('returns 10 for zero tasks', () => {
      const score = calc.computeDataQuality({
        totalTasks: 0,
        tasksWithDates: 0,
        tasksWithAssignments: 0,
        tasksUpdatedRecently: 0,
        hasBudgetData: false,
        hasResourceData: false,
      });
      expect(score).toBe(10);
    });

    it('deducts for missing dates (-5 each)', () => {
      const score = calc.computeDataQuality({
        totalTasks: 10,
        tasksWithDates: 7,       // 3 missing = -15
        tasksWithAssignments: 10,
        tasksUpdatedRecently: 10,
        hasBudgetData: true,
        hasResourceData: true,
      });
      expect(score).toBe(85);
    });

    it('deducts for missing budget (-15) and resources (-10)', () => {
      const score = calc.computeDataQuality({
        totalTasks: 10,
        tasksWithDates: 10,
        tasksWithAssignments: 10,
        tasksUpdatedRecently: 10,
        hasBudgetData: false,
        hasResourceData: false,
      });
      expect(score).toBe(75);
    });

    it('deducts for few tasks (-10)', () => {
      const score = calc.computeDataQuality({
        totalTasks: 3,
        tasksWithDates: 3,
        tasksWithAssignments: 3,
        tasksUpdatedRecently: 3,
        hasBudgetData: true,
        hasResourceData: true,
      });
      expect(score).toBe(90); // -10 for < 5 tasks
    });

    it('floors at 10', () => {
      const score = calc.computeDataQuality({
        totalTasks: 20,
        tasksWithDates: 0,    // -100
        tasksWithAssignments: 0,  // -60
        tasksUpdatedRecently: 0,  // -100
        hasBudgetData: false,     // -15
        hasResourceData: false,   // -10
      });
      expect(score).toBe(10);
    });
  });
});
