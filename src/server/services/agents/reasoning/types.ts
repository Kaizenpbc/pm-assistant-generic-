import type { ConfidenceResult } from '../ConfidenceCalculator';
import type { ActionType } from '../ActionProposalService';

// ---------------------------------------------------------------------------
// Shared action shape used by most agent results
// ---------------------------------------------------------------------------

export interface SuggestedAction {
  actionType: ActionType;
  targetEntityType: string;
  targetEntityId: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Schedule Recovery Types
// ---------------------------------------------------------------------------

export interface RecoveryOption {
  rank: number;
  title: string;
  description: string;
  actions: RecoveryAction[];
  riskAssessment: string;
  estimatedImpact: {
    daysRecovered: number;
    resourceImpact: string;
    criticalPathImpact: string;
  };
}

export interface RecoveryAction {
  actionType: 'update_task_dates' | 'reassign_resource' | 'update_dependency' | 'update_progress' | 'send_notification';
  targetEntityType: string;
  targetEntityId: string;
  targetEntityName: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  reasoning: string;
}

export interface RecoveryPlan {
  rootCause: string;
  impactAnalysis: string;
  options: RecoveryOption[];
  reasoning: string;
  modelCertainty: number;
  confidence: ConfidenceResult;
}

export interface DelayContext {
  taskId: string;
  taskName: string;
  delayDays: number;
  isOnCriticalPath: boolean;
  currentProgress: number;
  expectedEndDate: string;
  estimatedEndDate: string;
}

export interface ReasoningInput {
  projectId: string;
  scheduleId: string;
  delays: DelayContext[];
  scanId?: string;
}

// ---------------------------------------------------------------------------
// Scope Analysis Types
// ---------------------------------------------------------------------------

export interface ScopeAnalysisInput {
  projectId: string;
  indicators: {
    taskCountDelta: number;
    estimateIncreaseDays: number;
    changeRequestCount: number;
    originalTaskCount: number;
    currentTaskCount: number;
  };
  scanId?: string;
}

export interface ScopeAnalysisResult {
  hasScopeCreep: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  rootCauses: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}

// ---------------------------------------------------------------------------
// Budget Analysis Types
// ---------------------------------------------------------------------------

export interface BudgetAnalysisInput {
  projectId: string;
  indicators: {
    BAC: number;
    EV: number;
    AC: number;
    PV: number;
    CPI: number;
    SPI: number;
    EAC: number;
    VAC: number;
    TCPI: number;
    overrunProbability?: number;
    topCostTasks: Array<{ taskId: string; taskName: string; actualCost: number; budgetedCost: number; variance: number }>;
  };
  scanId?: string;
}

export interface BudgetAnalysisResult {
  hasBudgetIssue: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  rootCauses: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}

// ---------------------------------------------------------------------------
// Resource Analysis Types
// ---------------------------------------------------------------------------

export interface ResourceAnalysisInput {
  projectId: string;
  indicators: {
    totalResources: number;
    overAllocatedResources: Array<{ resourceId: string; resourceName: string; role: string; averageUtilization: number; peakUtilization: number }>;
    underUtilizedResources: Array<{ resourceId: string; resourceName: string; role: string; averageUtilization: number }>;
    bottleneckRoles: string[];
  };
  scanId?: string;
}

export interface ResourceAnalysisResult {
  hasResourceIssue: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  rootCauses: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}

// ---------------------------------------------------------------------------
// Portfolio Analysis Types
// ---------------------------------------------------------------------------

export interface PortfolioAnalysisInput {
  userId: string;
  indicators: {
    totalProjects: number;
    activeProjects: number;
    projectSnapshots: Array<{
      projectId: string;
      projectName: string;
      status: string;
      priority: string;
      healthScore: number;
      riskLevel: string;
      completionRate: number;
      budgetUtilization: number;
      CPI: number | null;
      SPI: number | null;
      daysRemaining: number;
      taskCount: number;
      overdueTasks: number;
      resourceCount: number;
      overAllocatedResources: number;
    }>;
    atRiskProjects: Array<{ projectId: string; projectName: string; healthScore: number; riskLevel: string }>;
    budgetDeficitProjects: Array<{ projectId: string; projectName: string; CPI: number | null }>;
    resourceBottlenecks: Array<{ projectId: string; projectName: string; overAllocatedCount: number }>;
    commonRisks: string[];
  };
  scanId?: string;
}

export interface PortfolioAnalysisResult {
  hasPortfolioIssue: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  insights: string[];
  warnings: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}

// ---------------------------------------------------------------------------
// Risk Escalation Types
// ---------------------------------------------------------------------------

export interface RiskEscalationInput {
  userId: string;
  indicators: {
    totalProjects: number;
    compoundRiskProjects: Array<{
      projectId: string;
      projectName: string;
      agentFlags: {
        scheduleDelay: boolean;
        budgetOverrun: boolean;
        scopeCreep: boolean;
        resourceBottleneck: boolean;
        meetingOverdue: boolean;
      };
      details: Record<string, string>;
    }>;
    maxFlagsOnSingleProject: number;
    flagDistribution: Record<string, number>;
  };
  scanId?: string;
}

export interface RiskEscalationResult {
  hasCompoundRisk: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  escalations: string[];
  compoundRisks: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}

// ---------------------------------------------------------------------------
// Stakeholder Report Types
// ---------------------------------------------------------------------------

export interface StakeholderReportInput {
  projectId: string;
  snapshot: {
    projectName: string;
    status: string;
    completionRate: number;
    budgetUtilization: number;
    CPI: number | null;
    SPI: number | null;
    daysRemaining: number;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    upcomingMilestones: Array<{ name: string; endDate: string; daysUntil: number }>;
    recentlyCompleted: Array<{ name: string; completedDate: string }>;
    riskIndicators: string[];
  };
  scanId?: string;
}

export interface StakeholderReportResult {
  overallStatus: 'on_track' | 'at_risk' | 'off_track' | 'critical';
  executiveSummary: string;
  keyHighlights: string[];
  risksAndConcerns: string[];
  upcomingMilestones: string[];
  recommendedActions: string[];
  reasoning: string;
  modelCertainty: number;
  confidence: ConfidenceResult;
}

// ---------------------------------------------------------------------------
// Hygiene Analysis Types
// ---------------------------------------------------------------------------

export interface HygieneAnalysisInput {
  projectId: string;
  indicators: {
    staleTasks: Array<{ taskId: string; taskName: string; daysSinceUpdate: number; status: string }>;
    missingDateTasks: Array<{ taskId: string; taskName: string }>;
    unassignedTasks: Array<{ taskId: string; taskName: string }>;
    missingEstimateTasks: Array<{ taskId: string; taskName: string }>;
    abandonedSprints: Array<{ sprintId: string; sprintName: string; endDate: string }>;
    zeroProgressTasks: Array<{ taskId: string; taskName: string; daysSinceUpdate: number }>;
  };
  scanId?: string;
}

export interface HygieneAnalysisResult {
  hasHygieneIssues: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  issues: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}

// ---------------------------------------------------------------------------
// Dependency Analysis Types
// ---------------------------------------------------------------------------

export interface DependencyAnalysisInput {
  projectId: string;
  indicators: {
    blockedChains: Array<{ chainTaskIds: string[]; chainTaskNames: string[]; blockedByTaskId: string; blockedByTaskName: string; reason: string }>;
    bottleneckTasks: Array<{ taskId: string; taskName: string; dependentCount: number }>;
    longChains: Array<{ depth: number; taskIds: string[]; taskNames: string[] }>;
    totalTasks: number;
    totalDependencies: number;
  };
  scanId?: string;
}

export interface DependencyAnalysisResult {
  hasDependencyRisk: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  risks: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}

// ---------------------------------------------------------------------------
// Lessons Extraction Types
// ---------------------------------------------------------------------------

export interface LessonsExtractionInput {
  projectId: string;
  projectData: {
    projectName: string;
    status: string;
    completionRate: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    budgetVariance: number | null;
    durationDays: number;
    existingLessonsCount: number;
  };
  scanId?: string;
}

export interface LessonsExtractionResult {
  hasLessons: boolean;
  reasoning: string;
  lessons: Array<{
    category: string;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  modelCertainty: number;
  confidence: ConfidenceResult;
}

// ---------------------------------------------------------------------------
// Predictive Alert Types
// ---------------------------------------------------------------------------

export interface PredictiveAlertInput {
  projectId: string;
  indicators: {
    velocityTrend: { current: number; historical: number; declinePercent: number } | null;
    progressTrajectory: { completionRate: number; timeElapsedPercent: number; behindPercent: number };
    riskAccumulation: number;
    similarProjectComparison: { avgCompletionRate: number; avgBudgetVariance: number; sampleSize: number } | null;
  };
  scanId?: string;
}

export interface PredictiveAlertResult {
  hasWarning: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  warnings: string[];
  predictions: string[];
  recommendations: string[];
  modelCertainty: number;
  confidence: ConfidenceResult;
  suggestedActions: SuggestedAction[];
}
