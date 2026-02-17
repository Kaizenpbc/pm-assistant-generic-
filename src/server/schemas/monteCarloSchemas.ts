import { z } from 'zod';

// ---------------------------------------------------------------------------
// Monte Carlo Simulation — Configuration
// ---------------------------------------------------------------------------

export const MonteCarloConfigSchema = z.object({
  iterations: z.number().int().min(100).max(100000).default(10000),
  confidenceLevels: z.array(z.number().min(1).max(99)).max(10).default([50, 80, 90]),
  uncertaintyModel: z.enum(['pert', 'triangular']).default('pert'),
});

export type MonteCarloConfig = z.infer<typeof MonteCarloConfigSchema>;

// ---------------------------------------------------------------------------
// Monte Carlo Simulation — Result
// ---------------------------------------------------------------------------

export const HistogramBinSchema = z.object({
  min: z.number(),
  max: z.number(),
  count: z.number(),
  cumulativePercent: z.number(),
});

export const SensitivityItemSchema = z.object({
  taskId: z.string(),
  taskName: z.string(),
  correlationCoefficient: z.number(),
  rank: z.number(),
});

export const CriticalityIndexItemSchema = z.object({
  taskId: z.string(),
  taskName: z.string(),
  criticalityPercent: z.number(),
});

export const DurationStatsSchema = z.object({
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  stdDev: z.number(),
  p50: z.number(),
  p80: z.number(),
  p90: z.number(),
});

export const CompletionDateSchema = z.object({
  p50: z.string(),
  p80: z.string(),
  p90: z.string(),
});

export const CostForecastSchema = z.object({
  p50: z.number(),
  p80: z.number(),
  p90: z.number(),
});

export const SimulationConfigSchema = z.object({
  iterations: z.number(),
  confidenceLevels: z.array(z.number()),
  uncertaintyModel: z.enum(['pert', 'triangular']),
});

export const MonteCarloResultSchema = z.object({
  completionDate: CompletionDateSchema,
  durationStats: DurationStatsSchema,
  histogram: z.object({
    bins: z.array(HistogramBinSchema),
  }),
  sensitivityAnalysis: z.array(SensitivityItemSchema),
  criticalityIndex: z.array(CriticalityIndexItemSchema),
  costForecast: CostForecastSchema,
  simulationConfig: SimulationConfigSchema,
  iterationsRun: z.number(),
});

export type MonteCarloResult = z.infer<typeof MonteCarloResultSchema>;
export type HistogramBin = z.infer<typeof HistogramBinSchema>;
export type SensitivityItem = z.infer<typeof SensitivityItemSchema>;
export type CriticalityIndexItem = z.infer<typeof CriticalityIndexItemSchema>;
export type DurationStats = z.infer<typeof DurationStatsSchema>;
export type CompletionDate = z.infer<typeof CompletionDateSchema>;
export type CostForecast = z.infer<typeof CostForecastSchema>;
