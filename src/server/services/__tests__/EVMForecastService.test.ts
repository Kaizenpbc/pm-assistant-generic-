import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before any service imports (prevents env var validation)
vi.mock('../../config', () => ({
  config: {
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

vi.mock('../claudeService', () => ({
  claudeService: {
    isAvailable: () => false,
    completeWithJsonSchema: vi.fn(),
  },
  PromptTemplate: class {
    constructor(public template: string, public version: string) {}
    render(vars: Record<string, string>) { return this.template; }
  },
}));

import { EVMForecastService } from '../EVMForecastService';
import type { EVMCurrentMetrics, EVMEarlyWarning } from '../../schemas/evmForecastSchemas';

// ---------------------------------------------------------------------------
// We need to test the private methods. Since they compute pure business logic,
// we'll access them via prototype or by exercising the public API.
// To isolate the pure-logic methods, we extract them via a test subclass.
// ---------------------------------------------------------------------------

class TestableEVMForecastService extends EVMForecastService {
  // Expose private methods for testing
  public testComputeCurrentMetrics(BAC: number, sCurveData: { date: string; pv: number; ev: number; ac: number }[]) {
    return (this as any).computeCurrentMetrics(BAC, sCurveData);
  }

  public testGenerateEarlyWarnings(metrics: EVMCurrentMetrics) {
    return (this as any).generateEarlyWarnings(metrics);
  }

  public testComputeTraditionalForecasts(metrics: EVMCurrentMetrics) {
    return (this as any).computeTraditionalForecasts(metrics);
  }

  public testComputeHistoricalTrends(BAC: number, sCurveData: { date: string; pv: number; ev: number; ac: number }[]) {
    return (this as any).computeHistoricalTrends(BAC, sCurveData);
  }
}

describe('EVMForecastService', () => {
  let service: TestableEVMForecastService;

  // Use a fixed "today" so tests are deterministic
  const TODAY = '2026-06-15';

  beforeEach(() => {
    service = new TestableEVMForecastService();
    // Mock Date to control "today"
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // computeCurrentMetrics
  // =========================================================================

  describe('computeCurrentMetrics', () => {
    it('computes standard EVM metrics from S-curve data', () => {
      const BAC = 100000;
      const sCurveData = [
        { date: '2026-01-01', pv: 10000, ev: 8000, ac: 9000 },
        { date: '2026-03-01', pv: 30000, ev: 25000, ac: 28000 },
        { date: '2026-06-01', pv: 60000, ev: 50000, ac: 55000 },
      ];

      const metrics: EVMCurrentMetrics = service.testComputeCurrentMetrics(BAC, sCurveData);

      // Latest point on or before today (2026-06-15) is 2026-06-01
      expect(metrics.BAC).toBe(100000);
      expect(metrics.EV).toBe(50000);
      expect(metrics.AC).toBe(55000);
      expect(metrics.PV).toBe(60000);

      // CPI = EV/AC = 50000/55000 ≈ 0.9091
      expect(metrics.CPI).toBeCloseTo(0.9091, 3);

      // SPI = EV/PV = 50000/60000 ≈ 0.8333
      expect(metrics.SPI).toBeCloseTo(0.8333, 3);

      // EAC = BAC/CPI = 100000/0.9091 ≈ 110000
      expect(metrics.EAC).toBeGreaterThan(100000);

      // ETC = EAC - AC (should be positive)
      expect(metrics.ETC).toBeGreaterThan(0);

      // VAC = BAC - EAC (should be negative since over budget)
      expect(metrics.VAC).toBeLessThan(0);

      // TCPI = (BAC - EV) / (BAC - AC) = 50000/45000 ≈ 1.1111
      expect(metrics.TCPI).toBeCloseTo(1.1111, 3);
    });

    it('returns default metrics when no S-curve data matches', () => {
      const BAC = 100000;
      // All dates are in the future
      const sCurveData = [
        { date: '2027-01-01', pv: 50000, ev: 50000, ac: 50000 },
      ];

      const metrics: EVMCurrentMetrics = service.testComputeCurrentMetrics(BAC, sCurveData);

      // Falls back to first point since nothing is on or before today
      // Actually the code says: if pastPoints.length > 0 use last, else if sCurveData.length > 0 use first
      // Since all dates are future, pastPoints is empty, falls back to sCurveData[0]
      expect(metrics.EV).toBe(50000);
    });

    it('handles empty S-curve data', () => {
      const metrics: EVMCurrentMetrics = service.testComputeCurrentMetrics(100000, []);

      expect(metrics.EV).toBe(0);
      expect(metrics.AC).toBe(0);
      expect(metrics.PV).toBe(0);
      expect(metrics.CPI).toBe(1); // AC is 0 → default CPI = 1
      expect(metrics.SPI).toBe(1); // PV is 0 → default SPI = 1
    });

    it('handles perfect performance (CPI = SPI = 1)', () => {
      const BAC = 100000;
      const sCurveData = [
        { date: '2026-06-01', pv: 50000, ev: 50000, ac: 50000 },
      ];

      const metrics: EVMCurrentMetrics = service.testComputeCurrentMetrics(BAC, sCurveData);

      expect(metrics.CPI).toBe(1);
      expect(metrics.SPI).toBe(1);
      expect(metrics.EAC).toBe(100000);
      expect(metrics.VAC).toBe(0);
    });

    it('computes ahead-of-schedule metrics correctly (SPI > 1)', () => {
      const BAC = 100000;
      const sCurveData = [
        { date: '2026-06-01', pv: 40000, ev: 50000, ac: 45000 },
      ];

      const metrics: EVMCurrentMetrics = service.testComputeCurrentMetrics(BAC, sCurveData);

      expect(metrics.SPI).toBeGreaterThan(1); // Ahead of schedule
      expect(metrics.CPI).toBeGreaterThan(1); // Under budget
      expect(metrics.VAC).toBeGreaterThan(0); // Positive variance = savings
    });
  });

  // =========================================================================
  // generateEarlyWarnings
  // =========================================================================

  describe('generateEarlyWarnings', () => {
    it('generates critical CPI warning when CPI < 0.8', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 30000, AC: 45000, PV: 40000,
        CPI: 0.67, SPI: 0.75, EAC: 150000, ETC: 105000, VAC: -50000, TCPI: 1.5,
      };

      const warnings: EVMEarlyWarning[] = service.testGenerateEarlyWarnings(metrics);

      const costWarning = warnings.find(w => w.type === 'cost');
      expect(costWarning).toBeDefined();
      expect(costWarning!.severity).toBe('critical');
    });

    it('generates warning-level CPI alert when 0.8 <= CPI < 0.9', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 45000, AC: 52000, PV: 50000,
        CPI: 0.865, SPI: 0.9, EAC: 115607, ETC: 63607, VAC: -15607, TCPI: 1.15,
      };

      const warnings: EVMEarlyWarning[] = service.testGenerateEarlyWarnings(metrics);

      const costWarning = warnings.find(w => w.type === 'cost');
      expect(costWarning).toBeDefined();
      expect(costWarning!.severity).toBe('warning');
    });

    it('generates schedule warning when SPI < 0.8', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 30000, AC: 30000, PV: 50000,
        CPI: 1.0, SPI: 0.6, EAC: 100000, ETC: 70000, VAC: 0, TCPI: 1.0,
      };

      const warnings: EVMEarlyWarning[] = service.testGenerateEarlyWarnings(metrics);

      const scheduleWarning = warnings.find(w => w.type === 'schedule');
      expect(scheduleWarning).toBeDefined();
      expect(scheduleWarning!.severity).toBe('critical');
    });

    it('generates TCPI warning when TCPI > 1.3', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 30000, AC: 60000, PV: 50000,
        CPI: 0.5, SPI: 0.6, EAC: 200000, ETC: 140000, VAC: -100000, TCPI: 1.75,
      };

      const warnings: EVMEarlyWarning[] = service.testGenerateEarlyWarnings(metrics);

      const tcpiWarning = warnings.find(w => w.type === 'completion');
      expect(tcpiWarning).toBeDefined();
      expect(tcpiWarning!.severity).toBe('critical');
    });

    it('generates combined warning when both CPI and SPI < 0.9', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 35000, AC: 45000, PV: 50000,
        CPI: 0.78, SPI: 0.7, EAC: 128205, ETC: 83205, VAC: -28205, TCPI: 1.18,
      };

      const warnings: EVMEarlyWarning[] = service.testGenerateEarlyWarnings(metrics);

      const combined = warnings.find(w => w.type === 'combined');
      expect(combined).toBeDefined();
      expect(combined!.severity).toBe('critical');
    });

    it('generates budget overrun warning based on VAC percentage', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 40000, AC: 50000, PV: 45000,
        CPI: 0.8, SPI: 0.889, EAC: 125000, ETC: 75000, VAC: -25000, TCPI: 1.2,
      };

      const warnings: EVMEarlyWarning[] = service.testGenerateEarlyWarnings(metrics);

      const budgetWarning = warnings.find(w => w.type === 'budget');
      expect(budgetWarning).toBeDefined();
      // 25% overrun → critical
      expect(budgetWarning!.severity).toBe('critical');
    });

    it('returns positive status when all metrics are healthy', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 50000, AC: 48000, PV: 48000,
        CPI: 1.04, SPI: 1.04, EAC: 96154, ETC: 48154, VAC: 3846, TCPI: 0.96,
      };

      const warnings: EVMEarlyWarning[] = service.testGenerateEarlyWarnings(metrics);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('status');
      expect(warnings[0].severity).toBe('info');
    });
  });

  // =========================================================================
  // computeTraditionalForecasts
  // =========================================================================

  describe('computeTraditionalForecasts', () => {
    it('computes three EAC methods correctly', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 40000, AC: 50000, PV: 45000,
        CPI: 0.8, SPI: 0.889, EAC: 125000, ETC: 75000, VAC: -25000, TCPI: 1.2,
      };

      const forecasts = service.testComputeTraditionalForecasts(metrics);

      // Method 1: EAC = BAC / CPI = 100000 / 0.8 = 125000
      expect(forecasts.eacCumulative).toBe(125000);

      // Method 2: EAC = AC + (BAC - EV) / (CPI * SPI) = 50000 + 60000 / 0.7112
      const expectedComposite = 50000 + 60000 / (0.8 * 0.889);
      expect(forecasts.eacComposite).toBeCloseTo(expectedComposite, 0);

      // Method 3: EAC = AC + (BAC - EV) = 50000 + 60000 = 110000
      expect(forecasts.eacManagement).toBe(110000);
    });

    it('handles CPI = 0 gracefully (falls back to BAC)', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 0, AC: 0, PV: 10000,
        CPI: 0, SPI: 0, EAC: 100000, ETC: 100000, VAC: 0, TCPI: 1,
      };

      const forecasts = service.testComputeTraditionalForecasts(metrics);

      expect(forecasts.eacCumulative).toBe(100000);
      expect(forecasts.eacComposite).toBe(100000);
    });

    it('handles perfect CPI = 1 and SPI = 1', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 50000, AC: 50000, PV: 50000,
        CPI: 1, SPI: 1, EAC: 100000, ETC: 50000, VAC: 0, TCPI: 1,
      };

      const forecasts = service.testComputeTraditionalForecasts(metrics);

      expect(forecasts.eacCumulative).toBe(100000);
      expect(forecasts.eacComposite).toBe(100000);
      expect(forecasts.eacManagement).toBe(100000);
    });

    it('under-budget project (CPI > 1) produces EAC < BAC', () => {
      const metrics: EVMCurrentMetrics = {
        BAC: 100000, EV: 60000, AC: 50000, PV: 55000,
        CPI: 1.2, SPI: 1.091, EAC: 83333, ETC: 33333, VAC: 16667, TCPI: 0.8,
      };

      const forecasts = service.testComputeTraditionalForecasts(metrics);

      expect(forecasts.eacCumulative).toBeLessThan(100000);
      expect(forecasts.eacManagement).toBe(90000); // 50000 + 40000
    });
  });

  // =========================================================================
  // computeHistoricalTrends
  // =========================================================================

  describe('computeHistoricalTrends', () => {
    it('computes weekly CPI/SPI from S-curve data', () => {
      const sCurveData = [
        { date: '2026-01-15', pv: 10000, ev: 9000, ac: 11000 },
        { date: '2026-02-15', pv: 20000, ev: 18000, ac: 21000 },
        { date: '2026-06-01', pv: 50000, ev: 45000, ac: 50000 },
      ];

      const trends = service.testComputeHistoricalTrends(100000, sCurveData);

      expect(trends).toHaveLength(3);

      // First week: CPI = 9000/11000, SPI = 9000/10000
      expect(trends[0].cpi).toBeCloseTo(9000 / 11000, 3);
      expect(trends[0].spi).toBeCloseTo(9000 / 10000, 3);
      expect(trends[0].date).toBe('2026-01-15');
    });

    it('returns empty array when BAC is 0', () => {
      const trends = service.testComputeHistoricalTrends(0, [
        { date: '2026-01-01', pv: 100, ev: 100, ac: 100 },
      ]);

      expect(trends).toEqual([]);
    });

    it('filters out future dates', () => {
      const sCurveData = [
        { date: '2026-06-01', pv: 50000, ev: 45000, ac: 50000 },
        { date: '2026-12-01', pv: 90000, ev: 85000, ac: 90000 }, // future
      ];

      const trends = service.testComputeHistoricalTrends(100000, sCurveData);

      expect(trends).toHaveLength(1);
      expect(trends[0].date).toBe('2026-06-01');
    });

    it('handles AC = 0 with default CPI = 1', () => {
      const sCurveData = [
        { date: '2026-01-01', pv: 10000, ev: 5000, ac: 0 },
      ];

      const trends = service.testComputeHistoricalTrends(100000, sCurveData);

      expect(trends[0].cpi).toBe(1);
    });
  });
});
