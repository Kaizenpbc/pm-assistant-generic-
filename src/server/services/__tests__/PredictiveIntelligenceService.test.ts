import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config BEFORE any service imports (prevents env var validation)
// ---------------------------------------------------------------------------
vi.mock('../../config', () => ({
  config: {
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

// ---------------------------------------------------------------------------
// Mock database layer
// ---------------------------------------------------------------------------
vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
    query: vi.fn().mockResolvedValue([[]]),
  },
}));

// ---------------------------------------------------------------------------
// Mock Claude service (AI disabled for deterministic tests)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Mock AI usage logger
// ---------------------------------------------------------------------------
vi.mock('../aiUsageLogger', () => ({
  logAIUsage: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Configurable mock data for ProjectService
// ---------------------------------------------------------------------------
let mockProjects: any[] = [];
let mockProjectById: Record<string, any> = {};

vi.mock('../ProjectService', () => ({
  ProjectService: class {
    async findAll() { return mockProjects; }
    async findById(id: string) { return mockProjectById[id] || null; }
  },
}));

// ---------------------------------------------------------------------------
// Configurable mock data for ScheduleService
// ---------------------------------------------------------------------------
let mockSchedulesByProject: Record<string, any[]> = {};
let mockTasksBySchedule: Record<string, any[]> = {};

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async findByProjectId(projectId: string) {
      return mockSchedulesByProject[projectId] || [];
    }
    async findTasksByScheduleId(scheduleId: string) {
      return mockTasksBySchedule[scheduleId] || [];
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock ResourceService
// ---------------------------------------------------------------------------
vi.mock('../ResourceService', () => ({
  ResourceService: class {
    async findAll() { return []; }
    async findById() { return null; }
    async getResourceUtilization() { return []; }
  },
}));

// ---------------------------------------------------------------------------
// Mock data provider manager (weather)
// ---------------------------------------------------------------------------
vi.mock('../dataProviders', () => ({
  dataProviderManager: {
    getWeather: vi.fn().mockResolvedValue(null),
  },
}));

// ---------------------------------------------------------------------------
// Now import the service and utility functions
// ---------------------------------------------------------------------------
import {
  computeDeterministicRiskScore,
  computeEVMMetrics,
  categorizeWeatherImpact,
  isOutdoorTask,
  PredictiveIntelligenceService,
  type ProjectMetrics,
} from '../predictiveIntelligence';

// ---------------------------------------------------------------------------
// Helper to build ProjectMetrics with defaults
// ---------------------------------------------------------------------------
function metrics(overrides: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    completionRate: 50,
    scheduleVariance: 0,
    budgetUtilization: 50,
    totalTasks: 10,
    completedTasks: 5,
    overdueTasks: 0,
    daysElapsed: 60,
    daysRemaining: 60,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('PredictiveIntelligenceService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15'));
    mockProjects = [];
    mockProjectById = {};
    mockSchedulesByProject = {};
    mockTasksBySchedule = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // 1. computeDeterministicRiskScore
  // ==========================================================================

  describe('computeDeterministicRiskScore', () => {
    it('returns low severity and high healthScore when all metrics are healthy', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 0 }),
        50,
      );
      expect(result.score).toBe(0);
      expect(result.healthScore).toBe(100);
      expect(result.severity).toBe('low');
    });

    // --- Schedule risk thresholds ---

    it('adds 30 points when schedule variance < -20%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: -25, overdueTasks: 0 }),
        50,
      );
      expect(result.score).toBe(30);
    });

    it('adds 20 points when schedule variance is between -20% and -10%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: -15, overdueTasks: 0 }),
        50,
      );
      expect(result.score).toBe(20);
    });

    it('adds 10 points when schedule variance is between -10% and 0%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: -5, overdueTasks: 0 }),
        50,
      );
      expect(result.score).toBe(10);
    });

    it('adds 0 points when schedule variance is exactly 0', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 0, overdueTasks: 0 }),
        50,
      );
      // scheduleVariance < 0 is false when exactly 0, so no schedule risk
      expect(result.score).toBe(0);
    });

    // --- Budget risk thresholds ---

    it('adds 30 points when budget utilization > 100%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 0 }),
        105,
      );
      expect(result.score).toBe(30);
    });

    it('adds 20 points when budget utilization is between 90% and 100%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 0 }),
        95,
      );
      expect(result.score).toBe(20);
    });

    it('adds 10 points when budget utilization is between 75% and 90%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 0 }),
        80,
      );
      expect(result.score).toBe(10);
    });

    // --- Overdue task ratio ---

    it('adds 25 points when overdue ratio > 30%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 4, totalTasks: 10 }),
        50,
      );
      // overdueRatio = 4/10 = 0.4 > 0.3 => +25
      expect(result.score).toBe(25);
    });

    it('adds 15 points when overdue ratio is between 15% and 30%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 2, totalTasks: 10 }),
        50,
      );
      // overdueRatio = 2/10 = 0.2 > 0.15 => +15
      expect(result.score).toBe(15);
    });

    it('adds 5 points when overdue ratio is between 0% and 15%', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 1, totalTasks: 10 }),
        50,
      );
      // overdueRatio = 1/10 = 0.1 > 0 but <= 0.15 => +5
      expect(result.score).toBe(5);
    });

    it('handles zero total tasks without division error', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 0, totalTasks: 0 }),
        50,
      );
      // overdueRatio defaults to 0 when totalTasks is 0
      expect(result.score).toBe(0);
    });

    // --- Completion urgency ---

    it('adds 15 points when completion < 50% with < 30 days remaining', () => {
      const result = computeDeterministicRiskScore(
        metrics({
          scheduleVariance: 5,
          overdueTasks: 0,
          completionRate: 30,
          daysRemaining: 20,
        }),
        50,
      );
      expect(result.score).toBe(15);
    });

    it('does not add urgency points when completion >= 50%', () => {
      const result = computeDeterministicRiskScore(
        metrics({
          scheduleVariance: 5,
          overdueTasks: 0,
          completionRate: 60,
          daysRemaining: 20,
        }),
        50,
      );
      expect(result.score).toBe(0);
    });

    // --- Score cap and severity mapping ---

    it('caps the score at 100', () => {
      // Stack all maximum risk factors:
      // scheduleVariance < -20 => 30
      // budget > 100 => 30
      // overdueRatio > 0.3 => 25
      // completion urgency => 15
      // Total = 100 (exactly at cap)
      const result = computeDeterministicRiskScore(
        metrics({
          scheduleVariance: -25,
          overdueTasks: 5,
          totalTasks: 10,
          completionRate: 30,
          daysRemaining: 20,
        }),
        110,
      );
      expect(result.score).toBe(100);
      expect(result.healthScore).toBe(0);
    });

    it('classifies severity as critical when score >= 70', () => {
      // Schedule -25 => 30, budget 110 => 30, overdue 4/10 => 25 = 85
      const result = computeDeterministicRiskScore(
        metrics({
          scheduleVariance: -25,
          overdueTasks: 4,
          totalTasks: 10,
        }),
        110,
      );
      expect(result.score).toBe(85);
      expect(result.severity).toBe('critical');
    });

    it('classifies severity as high when score is between 45 and 69', () => {
      // Schedule -15 => 20, budget 95 => 20, overdue 1/10 => 5 = 45
      const result = computeDeterministicRiskScore(
        metrics({
          scheduleVariance: -15,
          overdueTasks: 1,
          totalTasks: 10,
        }),
        95,
      );
      expect(result.score).toBe(45);
      expect(result.severity).toBe('high');
    });

    it('classifies severity as medium when score is between 20 and 44', () => {
      // Schedule -5 => 10, budget 80 => 10 = 20
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: -5, overdueTasks: 0 }),
        80,
      );
      expect(result.score).toBe(20);
      expect(result.severity).toBe('medium');
    });

    it('classifies severity as low when score < 20', () => {
      // Only overdue 1/10 => 5
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: 5, overdueTasks: 1, totalTasks: 10 }),
        50,
      );
      expect(result.score).toBe(5);
      expect(result.severity).toBe('low');
    });

    it('computes healthScore as 100 - score', () => {
      const result = computeDeterministicRiskScore(
        metrics({ scheduleVariance: -15, overdueTasks: 0 }),
        80,
      );
      // Schedule => 20, budget => 10 = 30
      expect(result.score).toBe(30);
      expect(result.healthScore).toBe(70);
    });
  });

  // ==========================================================================
  // 2. computeEVMMetrics
  // ==========================================================================

  describe('computeEVMMetrics', () => {
    it('computes standard EVM metrics for a normal project', () => {
      const result = computeEVMMetrics(100000, 55000, 50, 60, 120);

      // PV = 100000 * (60/120) = 50000
      expect(result.plannedValue).toBe(50000);
      // EV = 100000 * (50/100) = 50000
      expect(result.earnedValue).toBe(50000);
      // AC = 55000
      expect(result.actualCost).toBe(55000);
      // CPI = 50000/55000 = 0.91
      expect(result.cpi).toBeCloseTo(0.91, 1);
      // SPI = 50000/50000 = 1.0
      expect(result.spi).toBe(1);
      // CV = 50000 - 55000 = -5000
      expect(result.cv).toBe(-5000);
      // SV = 50000 - 50000 = 0
      expect(result.sv).toBe(0);
    });

    it('returns CPI = 1 when actual cost is zero', () => {
      const result = computeEVMMetrics(100000, 0, 50, 30, 100);
      expect(result.cpi).toBe(1);
    });

    it('returns SPI = 1 when planned value is zero', () => {
      // PV = 100000 * (0/100) = 0
      const result = computeEVMMetrics(100000, 10000, 50, 0, 100);
      expect(result.spi).toBe(1);
    });

    it('returns SPI = 1 when totalDays is zero', () => {
      const result = computeEVMMetrics(100000, 10000, 50, 0, 0);
      expect(result.spi).toBe(1);
    });

    it('computes EAC correctly when CPI > 0', () => {
      // CPI = (100000*0.5) / 50000 = 1.0
      const result = computeEVMMetrics(100000, 50000, 50, 50, 100);
      // EAC = BAC / CPI = 100000 / 1.0 = 100000
      expect(result.eac).toBe(100000);
    });

    it('computes ETC as max(0, EAC - AC)', () => {
      const result = computeEVMMetrics(100000, 50000, 50, 50, 100);
      // EAC = 100000, AC = 50000 => ETC = 50000
      expect(result.etc).toBe(50000);
    });

    it('computes VAC as BAC - EAC', () => {
      const result = computeEVMMetrics(100000, 50000, 50, 50, 100);
      // VAC = 100000 - 100000 = 0
      expect(result.vac).toBe(0);
    });

    it('computes burn rate when daysElapsed > 0', () => {
      const result = computeEVMMetrics(100000, 30000, 30, 60, 120);
      // burnRateDaily = 30000 / 60 = 500
      expect(result.burnRateDaily).toBe(500);
      // burnRateMonthly = 500 * 30 = 15000
      expect(result.burnRateMonthly).toBe(15000);
    });

    it('returns zero burn rate when daysElapsed is zero', () => {
      const result = computeEVMMetrics(100000, 0, 0, 0, 100);
      expect(result.burnRateDaily).toBe(0);
      expect(result.burnRateMonthly).toBe(0);
    });

    it('caps percent elapsed at 1.0 when daysElapsed > totalDays', () => {
      // daysElapsed = 150, totalDays = 100 => percentElapsed capped at 1.0
      const result = computeEVMMetrics(100000, 80000, 80, 150, 100);
      // PV = 100000 * min(150/100, 1) = 100000
      expect(result.plannedValue).toBe(100000);
    });

    it('computes TCPI against BAC correctly', () => {
      const result = computeEVMMetrics(100000, 50000, 50, 50, 100);
      // TCPI_BAC = (BAC - EV) / (BAC - AC) = (100000 - 50000) / (100000 - 50000) = 1.0
      expect(result.tcpiBAC).toBe(1);
    });

    it('computes TCPI against EAC correctly', () => {
      const result = computeEVMMetrics(100000, 50000, 50, 50, 100);
      // When CPI = 1: EAC = BAC = 100000
      // TCPI_EAC = (BAC - EV) / (EAC - AC) = 50000 / 50000 = 1.0
      expect(result.tcpiEAC).toBe(1);
    });

    it('handles over-budget scenario (CPI < 1)', () => {
      // EV = 100000 * 0.4 = 40000, AC = 60000
      // CPI = 40000/60000 = 0.67
      const result = computeEVMMetrics(100000, 60000, 40, 50, 100);
      expect(result.cpi).toBeCloseTo(0.67, 1);
      expect(result.cv).toBeLessThan(0); // negative cost variance
      expect(result.eac).toBeGreaterThan(100000); // projected overrun
      expect(result.vac).toBeLessThan(0); // negative variance at completion
    });

    it('handles under-budget scenario (CPI > 1)', () => {
      // EV = 100000 * 0.6 = 60000, AC = 40000
      // CPI = 60000/40000 = 1.5
      const result = computeEVMMetrics(100000, 40000, 60, 50, 100);
      expect(result.cpi).toBe(1.5);
      expect(result.cv).toBeGreaterThan(0);
      expect(result.eac).toBeLessThan(100000);
      expect(result.vac).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. categorizeWeatherImpact
  // ==========================================================================

  describe('categorizeWeatherImpact', () => {
    // --- Severe ---

    it('returns severe for thunderstorm condition codes', () => {
      expect(categorizeWeatherImpact('thunderstorm', 5, 20)).toBe('severe');
    });

    it('returns severe for storm condition codes', () => {
      expect(categorizeWeatherImpact('tropical-storm', 5, 20)).toBe('severe');
    });

    it('returns severe when precipitation > 50mm', () => {
      expect(categorizeWeatherImpact('clear', 55, 20)).toBe('severe');
    });

    it('returns severe when wind > 80 kph', () => {
      expect(categorizeWeatherImpact('clear', 0, 85)).toBe('severe');
    });

    // --- High ---

    it('returns high for heavy rain condition', () => {
      expect(categorizeWeatherImpact('heavy-rain', 5, 20)).toBe('high');
    });

    it('returns high when precipitation > 20mm', () => {
      expect(categorizeWeatherImpact('cloudy', 25, 20)).toBe('high');
    });

    it('returns high when wind > 50 kph', () => {
      expect(categorizeWeatherImpact('clear', 0, 55)).toBe('high');
    });

    // --- Moderate ---

    it('returns moderate when precipitation > 10mm', () => {
      expect(categorizeWeatherImpact('cloudy', 15, 20)).toBe('moderate');
    });

    it('returns moderate when wind > 30 kph', () => {
      expect(categorizeWeatherImpact('clear', 0, 35)).toBe('moderate');
    });

    it('returns moderate when condition includes "rain"', () => {
      expect(categorizeWeatherImpact('light-rain', 2, 10)).toBe('moderate');
    });

    // --- Low ---

    it('returns low when precipitation > 2mm (but not higher categories)', () => {
      expect(categorizeWeatherImpact('cloudy', 5, 10)).toBe('low');
    });

    it('returns low for drizzle conditions', () => {
      expect(categorizeWeatherImpact('light-drizzle', 0, 10)).toBe('low');
    });

    it('returns low for overcast conditions', () => {
      expect(categorizeWeatherImpact('overcast', 0, 10)).toBe('low');
    });

    // --- None ---

    it('returns none for clear skies with no precipitation or wind', () => {
      expect(categorizeWeatherImpact('clear', 0, 10)).toBe('none');
    });

    it('returns none for partly-cloudy with minimal weather', () => {
      expect(categorizeWeatherImpact('partly-cloudy', 0, 15)).toBe('none');
    });

    it('is case-insensitive for condition codes', () => {
      expect(categorizeWeatherImpact('THUNDERSTORM', 0, 0)).toBe('severe');
      expect(categorizeWeatherImpact('Heavy-Rain', 0, 0)).toBe('high');
    });
  });

  // ==========================================================================
  // 4. isOutdoorTask
  // ==========================================================================

  describe('isOutdoorTask', () => {
    it('returns true for construction-related task names', () => {
      expect(isOutdoorTask('Foundation Pouring Phase 1')).toBe(true);
    });

    it('returns true for excavation tasks', () => {
      expect(isOutdoorTask('Site Excavation Work')).toBe(true);
    });

    it('returns true for paving tasks', () => {
      expect(isOutdoorTask('Road Paving - Section A')).toBe(true);
    });

    it('returns true for roofing tasks', () => {
      expect(isOutdoorTask('Install Roofing Materials')).toBe(true);
    });

    it('returns true for landscaping tasks', () => {
      expect(isOutdoorTask('Park Landscaping')).toBe(true);
    });

    it('returns true for concrete tasks', () => {
      expect(isOutdoorTask('Concrete pouring lot B')).toBe(true);
    });

    it('returns true for demolition tasks', () => {
      expect(isOutdoorTask('Building Demolition Phase 2')).toBe(true);
    });

    it('returns true for survey tasks', () => {
      expect(isOutdoorTask('Land Survey')).toBe(true);
    });

    it('returns true for inspection tasks', () => {
      expect(isOutdoorTask('Site Inspection Report')).toBe(true);
    });

    it('returns false for indoor/office tasks', () => {
      expect(isOutdoorTask('Budget Review Meeting')).toBe(false);
      expect(isOutdoorTask('Design Document Approval')).toBe(false);
      expect(isOutdoorTask('Software Development Sprint')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isOutdoorTask('CONCRETE WORK')).toBe(true);
      expect(isOutdoorTask('construction phase')).toBe(true);
    });

    it('checks category parameter as well', () => {
      expect(isOutdoorTask('Phase 1 Work', 'construction')).toBe(true);
      expect(isOutdoorTask('Phase 1 Work', 'office')).toBe(false);
    });

    it('handles empty strings', () => {
      expect(isOutdoorTask('')).toBe(false);
      expect(isOutdoorTask('', '')).toBe(false);
    });

    it('returns true for site preparation tasks', () => {
      expect(isOutdoorTask('Site Preparation and Grading')).toBe(true);
    });
  });

  // ==========================================================================
  // 5. PredictiveIntelligenceService.getProjectHealthScore
  // ==========================================================================

  describe('getProjectHealthScore', () => {
    let service: PredictiveIntelligenceService;

    // Minimal mock FastifyInstance
    const mockFastify = {
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    } as any;

    beforeEach(() => {
      service = new PredictiveIntelligenceService(mockFastify);
    });

    it('returns a health score between 0 and 100', async () => {
      const now = new Date('2026-06-15');
      mockProjectById['proj-1'] = {
        id: 'proj-1',
        name: 'Test Project',
        status: 'active',
        priority: 'high',
        projectType: 'construction',
        budgetAllocated: 100000,
        budgetSpent: 50000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-1'] = [
        { id: 'sch-1', name: 'Main Schedule', startDate: now, endDate: now },
      ];
      mockTasksBySchedule['sch-1'] = [
        { id: 't1', name: 'Task 1', status: 'completed', priority: 'high' },
        { id: 't2', name: 'Task 2', status: 'in_progress', priority: 'medium' },
      ];

      const result = await service.getProjectHealthScore('proj-1');

      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.aiPowered).toBe(false);
      expect(result.breakdown).toHaveProperty('scheduleHealth');
      expect(result.breakdown).toHaveProperty('budgetHealth');
      expect(result.breakdown).toHaveProperty('riskHealth');
      expect(result.breakdown).toHaveProperty('weatherHealth');
    });

    it('returns higher health scores for on-track projects', async () => {
      mockProjectById['proj-good'] = {
        id: 'proj-good',
        name: 'Good Project',
        status: 'active',
        priority: 'medium',
        projectType: 'it',
        budgetAllocated: 100000,
        budgetSpent: 25000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-good'] = [
        { id: 'sch-g', name: 'Schedule', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      // 6 of 10 tasks completed, which is ahead of ~45% elapsed time
      mockTasksBySchedule['sch-g'] = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        name: `Task ${i}`,
        status: i < 6 ? 'completed' : 'in_progress',
        priority: 'medium',
      }));

      const result = await service.getProjectHealthScore('proj-good');

      expect(result.healthScore).toBeGreaterThanOrEqual(40);
      expect(['low', 'medium']).toContain(result.riskLevel);
    });

    it('returns lower health for over-budget projects', async () => {
      mockProjectById['proj-bad'] = {
        id: 'proj-bad',
        name: 'Over Budget Project',
        status: 'active',
        priority: 'high',
        projectType: 'construction',
        budgetAllocated: 100000,
        budgetSpent: 120000, // 120% utilization
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-bad'] = [
        { id: 'sch-b', name: 'Schedule', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      mockTasksBySchedule['sch-b'] = [
        { id: 't1', name: 'Task 1', status: 'in_progress', priority: 'high' },
        { id: 't2', name: 'Task 2', status: 'pending', priority: 'medium' },
      ];

      const result = await service.getProjectHealthScore('proj-bad');

      // budgetHealth when utilization > 100%: max(0, 100 - 120) = 0
      expect(result.breakdown.budgetHealth).toBe(0);
    });

    it('assigns risk level based on healthScore thresholds', async () => {
      // A reasonably healthy project
      mockProjectById['proj-h'] = {
        id: 'proj-h',
        name: 'Healthy Project',
        status: 'active',
        priority: 'medium',
        projectType: 'it',
        budgetAllocated: 100000,
        budgetSpent: 40000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-h'] = [
        { id: 'sch-h', name: 'Sched', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      mockTasksBySchedule['sch-h'] = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        name: `Task ${i}`,
        status: i < 5 ? 'completed' : 'in_progress',
        priority: 'medium',
      }));

      const result = await service.getProjectHealthScore('proj-h');

      // Verify risk level corresponds to a valid category
      expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);

      // Verify riskLevel aligns with healthScore
      if (result.healthScore >= 75) expect(result.riskLevel).toBe('low');
      else if (result.healthScore >= 50) expect(result.riskLevel).toBe('medium');
      else if (result.healthScore >= 25) expect(result.riskLevel).toBe('high');
      else expect(result.riskLevel).toBe('critical');
    });

    it('uses weighted composite: 40% schedule, 30% budget, 20% risk, 10% weather', async () => {
      mockProjectById['proj-w'] = {
        id: 'proj-w',
        name: 'Weighted Test',
        status: 'active',
        priority: 'medium',
        projectType: 'it',
        budgetAllocated: 100000,
        budgetSpent: 50000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-w'] = [
        { id: 'sch-w', name: 'Sched', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      mockTasksBySchedule['sch-w'] = [
        { id: 't1', name: 'Task 1', status: 'completed', priority: 'medium' },
      ];

      const result = await service.getProjectHealthScore('proj-w');

      // Verify the breakdown components exist and are in [0, 100] range
      const b = result.breakdown;
      expect(b.scheduleHealth).toBeGreaterThanOrEqual(0);
      expect(b.scheduleHealth).toBeLessThanOrEqual(100);
      expect(b.budgetHealth).toBeGreaterThanOrEqual(0);
      expect(b.budgetHealth).toBeLessThanOrEqual(100);
      expect(b.riskHealth).toBeGreaterThanOrEqual(0);
      expect(b.riskHealth).toBeLessThanOrEqual(100);
      expect(b.weatherHealth).toBeGreaterThanOrEqual(0);
      expect(b.weatherHealth).toBeLessThanOrEqual(100);

      // Verify the composite matches the formula
      const expected = Math.round(
        b.scheduleHealth * 0.4 +
        b.budgetHealth * 0.3 +
        b.riskHealth * 0.2 +
        b.weatherHealth * 0.1,
      );
      expect(result.healthScore).toBe(expected);
    });
  });

  // ==========================================================================
  // 6. PredictiveIntelligenceService.forecastBudget
  // ==========================================================================

  describe('forecastBudget', () => {
    let service: PredictiveIntelligenceService;

    const mockFastify = {
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    } as any;

    beforeEach(() => {
      service = new PredictiveIntelligenceService(mockFastify);
    });

    it('returns EVM metrics and overrunProbability in fallback mode', async () => {
      mockProjectById['proj-b'] = {
        id: 'proj-b',
        name: 'Budget Project',
        status: 'active',
        priority: 'medium',
        projectType: 'construction',
        budgetAllocated: 200000,
        budgetSpent: 120000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-b'] = [
        { id: 'sch-b', name: 'Sched', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      mockTasksBySchedule['sch-b'] = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        name: `Task ${i}`,
        status: i < 4 ? 'completed' : 'in_progress',
        priority: 'medium',
      }));

      const result = await service.forecastBudget('proj-b');

      expect(result.aiPowered).toBe(false);
      expect(result.forecast).toHaveProperty('cpi');
      expect(result.forecast).toHaveProperty('spi');
      expect(result.forecast).toHaveProperty('eac');
      expect(result.forecast).toHaveProperty('overrunProbability');
      expect(result.forecast).toHaveProperty('recommendations');
      expect(result.forecast).toHaveProperty('summary');
      expect(result.forecast.overrunProbability).toBeGreaterThanOrEqual(0);
      expect(result.forecast.overrunProbability).toBeLessThanOrEqual(100);
    });

    it('assigns 85% overrun probability when CPI < 0.8', async () => {
      // 40% complete, spent 120000 of 200000
      // EV = 200000 * 0.4 = 80000, AC = 120000
      // CPI = 80000/120000 = 0.67 < 0.8
      mockProjectById['proj-over'] = {
        id: 'proj-over',
        name: 'Over Budget',
        status: 'active',
        priority: 'high',
        projectType: 'it',
        budgetAllocated: 200000,
        budgetSpent: 120000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-over'] = [
        { id: 'sch-o', name: 'Sched', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      mockTasksBySchedule['sch-o'] = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        name: `Task ${i}`,
        status: i < 4 ? 'completed' : 'in_progress',
        priority: 'medium',
      }));

      const result = await service.forecastBudget('proj-over');

      expect(result.forecast.cpi).toBeLessThan(0.8);
      expect(result.forecast.overrunProbability).toBe(85);
    });

    it('assigns 10% overrun probability when CPI >= 1.1', async () => {
      // 70% complete, spent 50000 of 200000
      // EV = 200000 * 0.7 = 140000, AC = 50000
      // CPI = 140000/50000 = 2.8 >= 1.1
      mockProjectById['proj-under'] = {
        id: 'proj-under',
        name: 'Under Budget',
        status: 'active',
        priority: 'low',
        projectType: 'it',
        budgetAllocated: 200000,
        budgetSpent: 50000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-under'] = [
        { id: 'sch-u', name: 'Sched', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      mockTasksBySchedule['sch-u'] = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        name: `Task ${i}`,
        status: i < 7 ? 'completed' : 'in_progress',
        priority: 'medium',
      }));

      const result = await service.forecastBudget('proj-under');

      expect(result.forecast.cpi).toBeGreaterThanOrEqual(1.1);
      expect(result.forecast.overrunProbability).toBe(10);
    });

    it('provides budget recommendations based on CPI/SPI', async () => {
      mockProjectById['proj-rec'] = {
        id: 'proj-rec',
        name: 'Recommendation Test',
        status: 'active',
        priority: 'medium',
        projectType: 'it',
        budgetAllocated: 100000,
        budgetSpent: 50000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      mockSchedulesByProject['proj-rec'] = [
        { id: 'sch-r', name: 'Sched', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      ];
      mockTasksBySchedule['sch-r'] = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        name: `Task ${i}`,
        status: i < 5 ? 'completed' : 'in_progress',
        priority: 'medium',
      }));

      const result = await service.forecastBudget('proj-rec');

      expect(Array.isArray(result.forecast.recommendations)).toBe(true);
      expect(result.forecast.recommendations.length).toBeGreaterThan(0);
      expect(typeof result.forecast.summary).toBe('string');
      expect(result.forecast.summary.length).toBeGreaterThan(0);
    });
  });
});
