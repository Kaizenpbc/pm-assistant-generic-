import { z } from 'zod';

// ---------------------------------------------------------------------------
// Learning & Feedback
// ---------------------------------------------------------------------------

export const AIFeedbackRecordSchema = z.object({
  feature: z.string().max(100),
  projectId: z.string().max(100).optional(),
  userAction: z.enum(['accepted', 'modified', 'rejected']),
  suggestionData: z.record(z.string(), z.unknown()).optional(),
  modifiedData: z.record(z.string(), z.unknown()).optional(),
  feedbackText: z.string().max(5000).optional(),
});

export type AIFeedbackRecord = z.infer<typeof AIFeedbackRecordSchema>;

export const AIAccuracyRecordSchema = z.object({
  projectId: z.string(),
  taskId: z.string().optional(),
  metricType: z.enum(['duration_estimate', 'cost_estimate', 'risk_prediction', 'dependency_accuracy']),
  predictedValue: z.number(),
  actualValue: z.number(),
  projectType: z.string().optional(),
});

export type AIAccuracyRecord = z.infer<typeof AIAccuracyRecordSchema>;

export const AIAccuracyReportSchema = z.object({
  overall: z.object({
    totalRecords: z.number(),
    averageVariance: z.number(),
    accuracy: z.number().min(0).max(100),
  }),
  byMetric: z.array(z.object({
    metricType: z.string(),
    count: z.number(),
    averageVariance: z.number(),
    accuracy: z.number(),
  })),
  byProjectType: z.array(z.object({
    projectType: z.string(),
    count: z.number(),
    averageVariance: z.number(),
    accuracy: z.number(),
  })),
  feedbackSummary: z.object({
    total: z.number(),
    accepted: z.number(),
    modified: z.number(),
    rejected: z.number(),
    acceptanceRate: z.number(),
  }),
  improvements: z.array(z.string()),
});

export type AIAccuracyReport = z.infer<typeof AIAccuracyReportSchema>;

export const AILearningContextSchema = z.object({
  accuracyByType: z.array(z.object({
    metricType: z.string(),
    accuracy: z.number(),
    averageVariance: z.number(),
    sampleSize: z.number(),
  })),
  commonAdjustments: z.array(z.object({
    feature: z.string(),
    rejectionRate: z.number(),
    modificationRate: z.number(),
    topFeedback: z.string().optional(),
  })),
  benchmarks: z.object({
    avgDurationAccuracy: z.number(),
    avgCostAccuracy: z.number(),
    avgRiskAccuracy: z.number(),
  }),
});

export type AILearningContext = z.infer<typeof AILearningContextSchema>;

// ---------------------------------------------------------------------------
// What-If Scenarios
// ---------------------------------------------------------------------------

export const AIScenarioRequestSchema = z.object({
  projectId: z.string().max(100),
  scenario: z.string().max(10000),
  parameters: z.object({
    budgetChangePct: z.number().optional(),
    workerChange: z.number().optional(),
    daysExtension: z.number().optional(),
    scopeChangePct: z.number().optional(),
  }).optional(),
});

export type AIScenarioRequest = z.infer<typeof AIScenarioRequestSchema>;

export const AIScenarioResultSchema = z.object({
  scheduleImpact: z.object({
    originalDays: z.number(),
    projectedDays: z.number(),
    changePct: z.number(),
    explanation: z.string(),
  }),
  budgetImpact: z.object({
    originalBudget: z.number(),
    projectedBudget: z.number(),
    changePct: z.number(),
    explanation: z.string(),
  }),
  resourceImpact: z.object({
    currentWorkers: z.number(),
    projectedWorkers: z.number(),
    explanation: z.string(),
  }),
  riskImpact: z.object({
    currentRiskScore: z.number(),
    projectedRiskScore: z.number(),
    newRisks: z.array(z.string()),
    explanation: z.string(),
  }),
  affectedTasks: z.array(z.object({
    taskName: z.string(),
    impact: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type AIScenarioResult = z.infer<typeof AIScenarioResultSchema>;

// ---------------------------------------------------------------------------
// Cross-Project Intelligence
// ---------------------------------------------------------------------------

export const AICrossProjectInsightSchema = z.object({
  resourceConflicts: z.array(z.object({
    userId: z.string(),
    userName: z.string(),
    activeTasks: z.number(),
    projectCount: z.number(),
    projects: z.array(z.string()),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    recommendation: z.string(),
  })),
  portfolioRiskHeatMap: z.array(z.object({
    projectId: z.string(),
    projectName: z.string(),
    healthScore: z.number(),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    budgetUtilization: z.number(),
    progress: z.number(),
  })),
  budgetReallocation: z.object({
    surplusCandidates: z.array(z.object({
      projectId: z.string(),
      projectName: z.string(),
      cpi: z.number(),
      spi: z.number(),
      estimatedSurplus: z.number(),
    })),
    deficitCandidates: z.array(z.object({
      projectId: z.string(),
      projectName: z.string(),
      cpi: z.number(),
      spi: z.number(),
      estimatedDeficit: z.number(),
    })),
    recommendations: z.array(z.string()),
  }),
  similarProjectInsights: z.array(z.object({
    projectId: z.string(),
    projectName: z.string(),
    category: z.string(),
    budgetAllocated: z.number(),
    finalBudget: z.number(),
    durationDays: z.number(),
    status: z.string(),
    lessonsLearned: z.string(),
  })),
  summary: z.string(),
});

export type AICrossProjectInsight = z.infer<typeof AICrossProjectInsightSchema>;

// ---------------------------------------------------------------------------
// Anomaly Detection
// ---------------------------------------------------------------------------

export const AIAnomalySchema = z.object({
  type: z.enum([
    'completion_drop',
    'budget_spike',
    'stale_project',
    'task_rescheduling',
    'budget_flatline',
  ]),
  projectId: z.string(),
  projectName: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  recommendation: z.string(),
  detectedAt: z.string(),
  dataPoints: z.record(z.string(), z.unknown()).optional(),
});

export type AIAnomaly = z.infer<typeof AIAnomalySchema>;

export const AIAnomalyReportSchema = z.object({
  anomalies: z.array(AIAnomalySchema),
  summary: z.string(),
  overallHealthTrend: z.enum(['improving', 'stable', 'deteriorating']),
  scannedProjects: z.number(),
  aiPowered: z.boolean(),
});

export type AIAnomalyReport = z.infer<typeof AIAnomalyReportSchema>;
