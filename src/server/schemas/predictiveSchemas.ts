import { z } from 'zod';

// Risk Assessment
export const AIRiskItemSchema = z.object({
  type: z.enum(['schedule', 'budget', 'resource', 'weather', 'regulatory', 'technical', 'stakeholder']),
  title: z.string(),
  description: z.string(),
  probability: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  affectedTasks: z.array(z.string()).optional().default([]),
  mitigations: z.array(z.string()),
});

export const AIRiskAssessmentSchema = z.object({
  overallScore: z.number().min(0).max(100),
  overallSeverity: z.enum(['low', 'medium', 'high', 'critical']),
  healthScore: z.number().min(0).max(100),
  risks: z.array(AIRiskItemSchema),
  summary: z.string(),
  trend: z.enum(['improving', 'stable', 'deteriorating']).optional().default('stable'),
});

export type AIRiskAssessment = z.infer<typeof AIRiskAssessmentSchema>;
export type AIRiskItem = z.infer<typeof AIRiskItemSchema>;

// Weather Impact
export const AIWeatherImpactSchema = z.object({
  currentCondition: z.string(),
  impactLevel: z.enum(['none', 'low', 'moderate', 'high', 'severe']),
  estimatedDelayDays: z.number().min(0),
  affectedTasks: z.array(z.object({
    taskName: z.string(),
    reason: z.string(),
    delayRisk: z.enum(['low', 'medium', 'high']),
  })),
  weeklyOutlook: z.array(z.object({
    date: z.string(),
    condition: z.string(),
    workable: z.boolean(),
    risk: z.string().optional(),
  })),
  recommendations: z.array(z.string()),
});

export type AIWeatherImpact = z.infer<typeof AIWeatherImpactSchema>;

// Budget Forecast
export const AIBudgetForecastSchema = z.object({
  cpi: z.number(),
  spi: z.number(),
  eac: z.number(),
  etc: z.number(),
  vac: z.number(),
  burnRateDaily: z.number(),
  burnRateMonthly: z.number(),
  overrunProbability: z.number().min(0).max(100),
  projectedCompletionBudget: z.number(),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

export type AIBudgetForecast = z.infer<typeof AIBudgetForecastSchema>;

// Dashboard Predictions (aggregated)
export const AIDashboardPredictionsSchema = z.object({
  risks: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  weather: z.object({
    condition: z.string(),
    impact: z.string(),
  }),
  budget: z.object({
    overBudget: z.number(),
    onTrack: z.number(),
    averageCPI: z.number().optional(),
  }),
  summary: z.string(),
  highlights: z.array(z.object({
    text: z.string(),
    type: z.enum(['risk', 'success', 'info']),
  })),
  projectHealthScores: z.array(z.object({
    projectId: z.string(),
    healthScore: z.number().min(0).max(100),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  })),
});

export type AIDashboardPredictions = z.infer<typeof AIDashboardPredictionsSchema>;
