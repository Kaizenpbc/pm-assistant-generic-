import { z } from 'zod';

// --- Contributing Task (embedded in BottleneckPrediction) ---

export const ContributingTaskSchema = z.object({
  taskId: z.string(),
  taskName: z.string(),
  hoursPerWeek: z.number(),
});

export type ContributingTask = z.infer<typeof ContributingTaskSchema>;

// --- Bottleneck Prediction ---

export const BottleneckPredictionSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  week: z.string(),
  utilization: z.number(),
  contributingTasks: z.array(ContributingTaskSchema),
  severity: z.enum(['warning', 'critical', 'severe']),
});

export type BottleneckPrediction = z.infer<typeof BottleneckPredictionSchema>;

// --- Burnout Risk ---

export const BurnoutRiskSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  consecutiveOverloadWeeks: z.number(),
  averageUtilization: z.number(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

export type BurnoutRisk = z.infer<typeof BurnoutRiskSchema>;

// --- Capacity Week ---

export const CapacityWeekSchema = z.object({
  week: z.string(),
  totalCapacity: z.number(),
  totalAllocated: z.number(),
  surplus: z.number(),
  deficit: z.number(),
});

export type CapacityWeek = z.infer<typeof CapacityWeekSchema>;

// --- Rebalance Suggestion ---

export const RebalanceSuggestionSchema = z.object({
  type: z.enum(['reassign', 'delay', 'split', 'hire']),
  description: z.string(),
  affectedResourceId: z.string().optional(),
  affectedTaskId: z.string().optional(),
  estimatedImpact: z.string(),
  confidence: z.number().min(0).max(100),
});

export type RebalanceSuggestion = z.infer<typeof RebalanceSuggestionSchema>;

// --- Skill Match ---

export const SkillMatchSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  matchScore: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  availableCapacity: z.number(),
});

export type SkillMatch = z.infer<typeof SkillMatchSchema>;

// --- Resource Forecast Result (aggregate) ---

export const ResourceForecastResultSchema = z.object({
  bottlenecks: z.array(BottleneckPredictionSchema),
  burnoutRisks: z.array(BurnoutRiskSchema),
  capacityForecast: z.array(CapacityWeekSchema),
  rebalanceSuggestions: z.array(RebalanceSuggestionSchema).optional(),
  summary: z.object({
    totalResources: z.number(),
    overAllocatedCount: z.number(),
    averageUtilization: z.number(),
  }),
});

export type ResourceForecastResult = z.infer<typeof ResourceForecastResultSchema>;
