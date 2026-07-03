import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schedule Recovery Schema
// ---------------------------------------------------------------------------

export const RecoveryResponseSchema = z.object({
  rootCause: z.string(),
  impactAnalysis: z.string(),
  modelCertainty: z.number().min(0).max(100),
  reasoning: z.string(),
  options: z.array(z.object({
    rank: z.number(),
    title: z.string(),
    description: z.string(),
    riskAssessment: z.string(),
    estimatedImpact: z.object({
      daysRecovered: z.number(),
      resourceImpact: z.string(),
      criticalPathImpact: z.string(),
    }),
    actions: z.array(z.object({
      actionType: z.enum(['update_task_dates', 'reassign_resource', 'update_dependency', 'update_progress', 'send_notification']),
      targetTaskId: z.string(),
      targetTaskName: z.string(),
      field: z.string(),
      oldValue: z.string(),
      newValue: z.string(),
      reasoning: z.string(),
    })),
  })),
});

export type RecoveryResponse = z.infer<typeof RecoveryResponseSchema>;

// ---------------------------------------------------------------------------
// Scope Analysis Schema
// ---------------------------------------------------------------------------

export const ScopeAnalysisResponseSchema = z.object({
  hasScopeCreep: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  rootCauses: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['create_change_request', 'send_notification']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type ScopeAnalysisResponse = z.infer<typeof ScopeAnalysisResponseSchema>;

// ---------------------------------------------------------------------------
// Budget Analysis Schema
// ---------------------------------------------------------------------------

export const BudgetAnalysisResponseSchema = z.object({
  hasBudgetIssue: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  rootCauses: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['create_change_request', 'send_notification', 'update_budget']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type BudgetAnalysisResponse = z.infer<typeof BudgetAnalysisResponseSchema>;

// ---------------------------------------------------------------------------
// Resource Analysis Schema
// ---------------------------------------------------------------------------

export const ResourceAnalysisResponseSchema = z.object({
  hasResourceIssue: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  rootCauses: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['reassign_resource', 'send_notification', 'create_change_request']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type ResourceAnalysisResponse = z.infer<typeof ResourceAnalysisResponseSchema>;

// ---------------------------------------------------------------------------
// Portfolio Analysis Schema
// ---------------------------------------------------------------------------

export const PortfolioAnalysisResponseSchema = z.object({
  hasPortfolioIssue: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  insights: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['send_notification', 'create_change_request']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type PortfolioAnalysisResponse = z.infer<typeof PortfolioAnalysisResponseSchema>;

// ---------------------------------------------------------------------------
// Risk Escalation Schema
// ---------------------------------------------------------------------------

export const RiskEscalationResponseSchema = z.object({
  hasCompoundRisk: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  escalations: z.array(z.string()),
  compoundRisks: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['send_notification', 'create_change_request']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type RiskEscalationResponse = z.infer<typeof RiskEscalationResponseSchema>;

// ---------------------------------------------------------------------------
// Stakeholder Report Schema
// ---------------------------------------------------------------------------

export const StakeholderReportResponseSchema = z.object({
  overallStatus: z.enum(['on_track', 'at_risk', 'off_track', 'critical']),
  executiveSummary: z.string(),
  keyHighlights: z.array(z.string()),
  risksAndConcerns: z.array(z.string()),
  upcomingMilestones: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  reasoning: z.string(),
  modelCertainty: z.number().min(0).max(100),
});

export type StakeholderReportResponse = z.infer<typeof StakeholderReportResponseSchema>;

// ---------------------------------------------------------------------------
// Hygiene Analysis Schema
// ---------------------------------------------------------------------------

export const HygieneAnalysisResponseSchema = z.object({
  hasHygieneIssues: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['send_notification']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type HygieneAnalysisResponse = z.infer<typeof HygieneAnalysisResponseSchema>;

// ---------------------------------------------------------------------------
// Dependency Analysis Schema
// ---------------------------------------------------------------------------

export const DependencyAnalysisResponseSchema = z.object({
  hasDependencyRisk: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['send_notification', 'update_dependency']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type DependencyAnalysisResponse = z.infer<typeof DependencyAnalysisResponseSchema>;

// ---------------------------------------------------------------------------
// Lessons Extraction Schema
// ---------------------------------------------------------------------------

export const LessonsExtractionResponseSchema = z.object({
  hasLessons: z.boolean(),
  reasoning: z.string(),
  lessons: z.array(z.object({
    category: z.string(),
    title: z.string(),
    description: z.string(),
    impact: z.enum(['low', 'medium', 'high']),
    recommendation: z.string(),
  })),
  modelCertainty: z.number().min(0).max(100),
});

export type LessonsExtractionResponse = z.infer<typeof LessonsExtractionResponseSchema>;

// ---------------------------------------------------------------------------
// Predictive Alert Schema
// ---------------------------------------------------------------------------

export const PredictiveAlertResponseSchema = z.object({
  hasWarning: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string(),
  warnings: z.array(z.string()),
  predictions: z.array(z.string()),
  recommendations: z.array(z.string()),
  modelCertainty: z.number().min(0).max(100),
  suggestedActions: z.array(z.object({
    actionType: z.enum(['send_notification', 'create_change_request']),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type PredictiveAlertResponse = z.infer<typeof PredictiveAlertResponseSchema>;
