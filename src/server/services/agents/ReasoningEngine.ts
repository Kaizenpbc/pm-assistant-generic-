import { z } from 'zod';
import { claudeService, CompletionResult } from '../claudeService';
import { scheduleService, Task, Schedule } from '../ScheduleService';
import { resourceService, Resource, ResourceWorkload } from '../ResourceService';
import { CriticalPathService, CriticalPathResult } from '../CriticalPathService';
import { projectService, Project } from '../ProjectService';
import { agentCostTracker } from './AgentCostTracker';
import { confidenceCalculator, ConfidenceResult, DataQualityInput } from './ConfidenceCalculator';
import type { ActionType } from './ActionProposalService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown code fences (```json ... ```) that Claude sometimes wraps around JSON responses */
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Types
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
  reasoning: string;           // Full chain-of-thought
  modelCertainty: number;      // 0-100, Claude's self-assessed certainty
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

// Claude's structured response schema
const RecoveryResponseSchema = z.object({
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

type RecoveryResponse = z.infer<typeof RecoveryResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const ScopeAnalysisResponseSchema = z.object({
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

type ScopeAnalysisResponse = z.infer<typeof ScopeAnalysisResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const BudgetAnalysisResponseSchema = z.object({
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

type BudgetAnalysisResponse = z.infer<typeof BudgetAnalysisResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const ResourceAnalysisResponseSchema = z.object({
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

type ResourceAnalysisResponse = z.infer<typeof ResourceAnalysisResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const PortfolioAnalysisResponseSchema = z.object({
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

type PortfolioAnalysisResponse = z.infer<typeof PortfolioAnalysisResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const RiskEscalationResponseSchema = z.object({
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

type RiskEscalationResponse = z.infer<typeof RiskEscalationResponseSchema>;

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

const StakeholderReportResponseSchema = z.object({
  overallStatus: z.enum(['on_track', 'at_risk', 'off_track', 'critical']),
  executiveSummary: z.string(),
  keyHighlights: z.array(z.string()),
  risksAndConcerns: z.array(z.string()),
  upcomingMilestones: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  reasoning: z.string(),
  modelCertainty: z.number().min(0).max(100),
});

type StakeholderReportResponse = z.infer<typeof StakeholderReportResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const HygieneAnalysisResponseSchema = z.object({
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

type HygieneAnalysisResponse = z.infer<typeof HygieneAnalysisResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const DependencyAnalysisResponseSchema = z.object({
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

type DependencyAnalysisResponse = z.infer<typeof DependencyAnalysisResponseSchema>;

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

const LessonsExtractionResponseSchema = z.object({
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

type LessonsExtractionResponse = z.infer<typeof LessonsExtractionResponseSchema>;

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
  suggestedActions: Array<{
    actionType: ActionType;
    targetEntityType: string;
    targetEntityId: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reasoning: string;
  }>;
}

const PredictiveAlertResponseSchema = z.object({
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

type PredictiveAlertResponse = z.infer<typeof PredictiveAlertResponseSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const criticalPathService = new CriticalPathService();
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export class ReasoningEngine {
  /**
   * Given detected delays, reason about root cause and generate recovery options.
   */
  async generateRecoveryPlan(input: ReasoningInput): Promise<RecoveryPlan | null> {
    // 1. Assemble context
    const context = await this.assembleContext(input);
    if (!context) return null;

    // 2. Compute data quality for confidence
    const dataQuality = this.computeDataQualityFromContext(context);

    // 3. Get historical accuracy
    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'schedule-recovery-v1',
      input.projectId,
    );

    // 4. Check if Claude is available
    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping reasoning');
      return null;
    }

    // 5. Build prompt and call Claude
    const prompt = this.buildPrompt(context, input.delays);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed:', err);
      return null;
    }

    // 6. Track cost
    await agentCostTracker.record({
      agentId: 'schedule-recovery-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    // 7. Parse and validate response
    let parsed: RecoveryResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = RecoveryResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse Claude response:', err);
      return null;
    }

    // 8. Compute confidence
    const confidence = confidenceCalculator.compute({
      dataQuality,
      historicalAccuracy,
      modelCertainty: parsed.modelCertainty,
    });

    // 9. Map Claude's response to typed RecoveryPlan
    const options: RecoveryOption[] = parsed.options.map(opt => ({
      rank: opt.rank,
      title: opt.title,
      description: opt.description,
      riskAssessment: opt.riskAssessment,
      estimatedImpact: opt.estimatedImpact,
      actions: opt.actions.map(a => {
        const task = context.tasks.find(t => t.id === a.targetTaskId);
        return {
          actionType: a.actionType,
          targetEntityType: 'task',
          targetEntityId: a.targetTaskId,
          targetEntityName: a.targetTaskName,
          oldValue: { [a.field]: a.oldValue },
          newValue: { [a.field]: a.newValue },
          reasoning: a.reasoning,
        };
      }),
    }));

    return {
      rootCause: parsed.rootCause,
      impactAnalysis: parsed.impactAnalysis,
      options,
      reasoning: parsed.reasoning,
      modelCertainty: parsed.modelCertainty,
      confidence,
    };
  }

  // -------------------------------------------------------------------------
  // Scope Creep Analysis
  // -------------------------------------------------------------------------

  async generateScopeAnalysis(input: ScopeAnalysisInput): Promise<ScopeAnalysisResult | null> {
    // 1. Get project context
    const project = await projectService.findById(input.projectId);
    if (!project) return null;

    const schedules = await scheduleService.findByProjectId(input.projectId);
    let allTasks: Task[] = [];
    for (const s of schedules) {
      const tasks = await scheduleService.findTasksByScheduleId(s.id);
      allTasks = allTasks.concat(tasks);
    }

    // 2. Compute data quality
    const now = Date.now();
    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: allTasks.length,
      tasksWithDates: allTasks.filter(t => t.startDate || t.endDate).length,
      tasksWithAssignments: allTasks.filter(t => t.assignedTo).length,
      tasksUpdatedRecently: allTasks.filter(t => {
        const updated = new Date(t.updatedAt ?? t.createdAt).getTime();
        return (now - updated) < FOURTEEN_DAYS_MS;
      }).length,
      hasBudgetData: !!project.budgetAllocated,
      hasResourceData: false,
    });

    // 3. Get historical accuracy
    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'scope-creep-detection-v1',
      input.projectId,
    );

    // 4. Check Claude availability
    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping scope analysis');
      return null;
    }

    // 5. Build prompt and call Claude
    const prompt = this.buildScopePrompt(project, input.indicators, allTasks);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getScopeSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for scope analysis:', err);
      return null;
    }

    // 6. Track cost
    await agentCostTracker.record({
      agentId: 'scope-creep-detection-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    // 7. Parse and validate
    let parsed: ScopeAnalysisResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = ScopeAnalysisResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse scope analysis response:', err);
      return null;
    }

    // 8. Compute confidence
    const confidence = confidenceCalculator.compute({
      dataQuality,
      historicalAccuracy,
      modelCertainty: parsed.modelCertainty,
    });

    // 9. Map response
    return {
      hasScopeCreep: parsed.hasScopeCreep,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      rootCauses: parsed.rootCauses,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getScopeSystemPrompt(): string {
    return `You are an expert project management AI agent specializing in scope management. Your role is to analyze project scope indicators and determine if scope creep is occurring.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based.

Your response must include:
1. hasScopeCreep: Whether scope creep is occurring (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis
4. rootCauses: List of identified root causes
5. recommendations: Actionable recommendations
6. modelCertainty: Your confidence (0-100)
7. suggestedActions: Concrete actions (create_change_request or send_notification)

For actions, use these types:
- create_change_request: Recommend creating a formal change request
- send_notification: Send a notification to stakeholders`;
  }

  private buildScopePrompt(
    project: Project,
    indicators: ScopeAnalysisInput['indicators'],
    tasks: Task[],
  ): string {
    const recentTasks = tasks
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map(t => ({ id: t.id, name: t.name, status: t.status, estimatedDays: t.estimatedDays, createdAt: t.createdAt }));

    return `## Project Context

**Project**: ${project.name} (${project.status})

## Scope Creep Indicators

- **Original task count**: ${indicators.originalTaskCount}
- **Current task count**: ${indicators.currentTaskCount} (delta: +${indicators.taskCountDelta})
- **Estimate increase**: +${indicators.estimateIncreaseDays} days
- **Open change requests**: ${indicators.changeRequestCount}

## Recent Tasks (newest first)

\`\`\`json
${JSON.stringify(recentTasks, null, 2)}
\`\`\`

## Instructions

Analyze the scope indicators above. Consider:
1. Is the task count growth proportional to the project phase?
2. Are estimate increases justified by complexity discovery or genuine scope additions?
3. Are change requests being properly managed?
4. What is the impact on schedule and budget if this trend continues?

Respond with valid JSON matching the scope analysis schema.`;
  }

  // -------------------------------------------------------------------------
  // Budget Analysis
  // -------------------------------------------------------------------------

  async generateBudgetAnalysis(input: BudgetAnalysisInput): Promise<BudgetAnalysisResult | null> {
    // 1. Get project context
    const project = await projectService.findById(input.projectId);
    if (!project) return null;

    const schedules = await scheduleService.findByProjectId(input.projectId);
    let allTasks: Task[] = [];
    for (const s of schedules) {
      const tasks = await scheduleService.findTasksByScheduleId(s.id);
      allTasks = allTasks.concat(tasks);
    }

    // 2. Compute data quality
    const now = Date.now();
    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: allTasks.length,
      tasksWithDates: allTasks.filter(t => t.startDate || t.endDate).length,
      tasksWithAssignments: allTasks.filter(t => t.assignedTo).length,
      tasksUpdatedRecently: allTasks.filter(t => {
        const updated = new Date(t.updatedAt ?? t.createdAt).getTime();
        return (now - updated) < FOURTEEN_DAYS_MS;
      }).length,
      hasBudgetData: !!project.budgetAllocated,
      hasResourceData: false,
    });

    // 3. Get historical accuracy
    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'budget-intelligence-v1',
      input.projectId,
    );

    // 4. Check Claude availability
    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping budget analysis');
      return null;
    }

    // 5. Build prompt and call Claude
    const prompt = this.buildBudgetPrompt(project, input.indicators, allTasks);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getBudgetSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for budget analysis:', err);
      return null;
    }

    // 6. Track cost
    await agentCostTracker.record({
      agentId: 'budget-intelligence-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    // 7. Parse and validate
    let parsed: BudgetAnalysisResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = BudgetAnalysisResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse budget analysis response:', err);
      return null;
    }

    // 8. Compute confidence
    const confidence = confidenceCalculator.compute({
      dataQuality,
      historicalAccuracy,
      modelCertainty: parsed.modelCertainty,
    });

    // 9. Map response
    return {
      hasBudgetIssue: parsed.hasBudgetIssue,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      rootCauses: parsed.rootCauses,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getBudgetSystemPrompt(): string {
    return `You are an expert project cost engineer and Earned Value Management (EVM) analyst. Your role is to analyze project budget health and recommend corrective actions.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based.

Your response must include:
1. hasBudgetIssue: Whether there is a significant budget concern (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis
4. rootCauses: List of identified root causes for budget deviation
5. recommendations: Actionable recovery recommendations
6. modelCertainty: Your confidence (0-100)
7. suggestedActions: Concrete actions (create_change_request, send_notification, or update_budget)

For actions, use these types:
- create_change_request: Recommend creating a formal change request for budget reallocation or scope reduction
- send_notification: Escalate to stakeholders or management
- update_budget: Recommend budget line item adjustments`;
  }

  private buildBudgetPrompt(
    project: Project,
    indicators: BudgetAnalysisInput['indicators'],
    tasks: Task[],
  ): string {
    const tasksByStatus = {
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      notStarted: tasks.filter(t => t.status === 'pending').length,
      total: tasks.length,
    };

    const topCostSection = indicators.topCostTasks.length > 0
      ? `\n## Top Cost-Variance Tasks\n\n${indicators.topCostTasks.map(t =>
          `- **${t.taskName}** (${t.taskId.slice(0, 8)}): Actual $${t.actualCost.toFixed(0)} vs Budget $${t.budgetedCost.toFixed(0)} (variance: $${t.variance.toFixed(0)})`
        ).join('\n')}`
      : '';

    return `## Project Context

**Project**: ${project.name} (${project.status})
**Budget (BAC)**: $${indicators.BAC.toFixed(0)}

## Current EVM Metrics

- **Earned Value (EV)**: $${indicators.EV.toFixed(0)}
- **Actual Cost (AC)**: $${indicators.AC.toFixed(0)}
- **Planned Value (PV)**: $${indicators.PV.toFixed(0)}
- **Cost Performance Index (CPI)**: ${indicators.CPI.toFixed(4)} ${indicators.CPI < 1 ? '(over budget)' : '(under budget)'}
- **Schedule Performance Index (SPI)**: ${indicators.SPI.toFixed(4)} ${indicators.SPI < 1 ? '(behind schedule)' : '(ahead of schedule)'}
- **Estimate at Completion (EAC)**: $${indicators.EAC.toFixed(0)}
- **Variance at Completion (VAC)**: $${indicators.VAC.toFixed(0)} ${indicators.VAC < 0 ? '(projected overrun)' : '(projected savings)'}
- **To-Complete Performance Index (TCPI)**: ${indicators.TCPI.toFixed(4)}
${indicators.overrunProbability !== undefined ? `- **AI Overrun Probability**: ${indicators.overrunProbability}%` : ''}

## Task Status Summary

- Completed: ${tasksByStatus.completed}/${tasksByStatus.total}
- In Progress: ${tasksByStatus.inProgress}/${tasksByStatus.total}
- Not Started: ${tasksByStatus.notStarted}/${tasksByStatus.total}
${topCostSection}

## Instructions

Analyze the EVM metrics and project context above. Consider:
1. What is causing the cost deviation? Is it systemic or isolated to specific tasks?
2. Is the CPI trend likely to continue, improve, or worsen?
3. What corrective actions would most effectively bring the project back on budget?
4. Should scope be reduced, or can cost recovery be achieved through other means?
5. What is the realistic EAC given current performance?

Respond with valid JSON matching the budget analysis schema.`;
  }

  // -------------------------------------------------------------------------
  // Resource Analysis
  // -------------------------------------------------------------------------

  async generateResourceAnalysis(input: ResourceAnalysisInput): Promise<ResourceAnalysisResult | null> {
    // 1. Get project context
    const project = await projectService.findById(input.projectId);
    if (!project) return null;

    const schedules = await scheduleService.findByProjectId(input.projectId);
    let allTasks: Task[] = [];
    for (const s of schedules) {
      const tasks = await scheduleService.findTasksByScheduleId(s.id);
      allTasks = allTasks.concat(tasks);
    }

    // 2. Compute data quality
    const now = Date.now();
    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: allTasks.length,
      tasksWithDates: allTasks.filter(t => t.startDate || t.endDate).length,
      tasksWithAssignments: allTasks.filter(t => t.assignedTo).length,
      tasksUpdatedRecently: allTasks.filter(t => {
        const updated = new Date(t.updatedAt ?? t.createdAt).getTime();
        return (now - updated) < FOURTEEN_DAYS_MS;
      }).length,
      hasBudgetData: !!project.budgetAllocated,
      hasResourceData: input.indicators.totalResources > 0,
    });

    // 3. Get historical accuracy
    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'resource-optimization-v1',
      input.projectId,
    );

    // 4. Check Claude availability
    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping resource analysis');
      return null;
    }

    // 5. Build prompt and call Claude
    const prompt = this.buildResourcePrompt(project, input.indicators, allTasks);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getResourceSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for resource analysis:', err);
      return null;
    }

    // 6. Track cost
    await agentCostTracker.record({
      agentId: 'resource-optimization-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    // 7. Parse and validate
    let parsed: ResourceAnalysisResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = ResourceAnalysisResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse resource analysis response:', err);
      return null;
    }

    // 8. Compute confidence
    const confidence = confidenceCalculator.compute({
      dataQuality,
      historicalAccuracy,
      modelCertainty: parsed.modelCertainty,
    });

    // 9. Map response
    return {
      hasResourceIssue: parsed.hasResourceIssue,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      rootCauses: parsed.rootCauses,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getResourceSystemPrompt(): string {
    return `You are an expert project resource manager and capacity planning specialist. Your role is to analyze resource allocation imbalances and recommend corrective actions.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based.

Your response must include:
1. hasResourceIssue: Whether there is a significant resource imbalance (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis
4. rootCauses: List of identified root causes for resource imbalance
5. recommendations: Actionable recommendations for rebalancing
6. modelCertainty: Your confidence (0-100)
7. suggestedActions: Concrete actions (reassign_resource, send_notification, or create_change_request)

For actions, use these types:
- reassign_resource: Recommend reassigning a resource from one task to another
- send_notification: Escalate to stakeholders or management
- create_change_request: Recommend a formal change request for staffing or scope changes`;
  }

  private buildResourcePrompt(
    project: Project,
    indicators: ResourceAnalysisInput['indicators'],
    tasks: Task[],
  ): string {
    const tasksByStatus = {
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      notStarted: tasks.filter(t => t.status === 'pending').length,
      total: tasks.length,
    };

    const overAllocatedSection = indicators.overAllocatedResources.length > 0
      ? `\n## Over-Allocated Resources\n\n${indicators.overAllocatedResources.map(r =>
          `- **${r.resourceName}** (${r.role}): avg ${r.averageUtilization}%, peak ${r.peakUtilization}%`
        ).join('\n')}`
      : '';

    const underUtilizedSection = indicators.underUtilizedResources.length > 0
      ? `\n## Under-Utilized Resources\n\n${indicators.underUtilizedResources.map(r =>
          `- **${r.resourceName}** (${r.role}): avg ${r.averageUtilization}%`
        ).join('\n')}`
      : '';

    const bottleneckSection = indicators.bottleneckRoles.length > 0
      ? `\n## Bottleneck Roles\n\nAll members in these roles are >80% utilized: ${indicators.bottleneckRoles.join(', ')}`
      : '';

    return `## Project Context

**Project**: ${project.name} (${project.status})
**Total Resources**: ${indicators.totalResources}

## Resource Summary

- **Over-allocated**: ${indicators.overAllocatedResources.length} resource(s) above 100% utilization
- **Under-utilized**: ${indicators.underUtilizedResources.length} resource(s) below 40% utilization
- **Bottleneck roles**: ${indicators.bottleneckRoles.length > 0 ? indicators.bottleneckRoles.join(', ') : 'none'}
${overAllocatedSection}${underUtilizedSection}${bottleneckSection}

## Task Status Summary

- Completed: ${tasksByStatus.completed}/${tasksByStatus.total}
- In Progress: ${tasksByStatus.inProgress}/${tasksByStatus.total}
- Not Started: ${tasksByStatus.notStarted}/${tasksByStatus.total}

## Instructions

Analyze the resource allocation above. Consider:
1. Can under-utilized resources take on work from over-allocated resources (matching roles/skills)?
2. Are bottleneck roles blocking project progress?
3. Should additional resources be requested or scope be reduced?
4. What is the risk of burnout for over-allocated resources?
5. What is the optimal rebalancing strategy with minimal disruption?

Respond with valid JSON matching the resource analysis schema.`;
  }

  // -------------------------------------------------------------------------
  // Portfolio Analysis
  // -------------------------------------------------------------------------

  async generatePortfolioAnalysis(input: PortfolioAnalysisInput): Promise<PortfolioAnalysisResult | null> {
    // 1. Compute data quality from portfolio breadth
    const snapshots = input.indicators.projectSnapshots;
    const projectsWithBudget = snapshots.filter(s => s.budgetUtilization > 0).length;
    const projectsWithTasks = snapshots.filter(s => s.taskCount > 0).length;
    const projectsWithResources = snapshots.filter(s => s.resourceCount > 0).length;

    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: snapshots.reduce((sum, s) => sum + s.taskCount, 0),
      tasksWithDates: snapshots.reduce((sum, s) => sum + s.taskCount, 0), // assume all tasks have dates
      tasksWithAssignments: snapshots.reduce((sum, s) => sum + Math.min(s.taskCount, s.resourceCount * 3), 0),
      tasksUpdatedRecently: snapshots.reduce((sum, s) => sum + Math.max(0, s.taskCount - s.overdueTasks), 0),
      hasBudgetData: projectsWithBudget > 0,
      hasResourceData: projectsWithResources > 0,
    });

    // 2. Get historical accuracy
    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'cross-project-intelligence-v1',
      'portfolio',
    );

    // 3. Check Claude availability
    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping portfolio analysis');
      return null;
    }

    // 4. Build prompt and call Claude
    const prompt = this.buildPortfolioPrompt(input.indicators);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getPortfolioSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for portfolio analysis:', err);
      return null;
    }

    // 5. Track cost
    await agentCostTracker.record({
      agentId: 'cross-project-intelligence-v1',
      projectId: 'portfolio',
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    // 6. Parse and validate
    let parsed: PortfolioAnalysisResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = PortfolioAnalysisResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse portfolio analysis response:', err);
      return null;
    }

    // 7. Compute confidence
    const confidence = confidenceCalculator.compute({
      dataQuality,
      historicalAccuracy,
      modelCertainty: parsed.modelCertainty,
    });

    // 8. Map response
    return {
      hasPortfolioIssue: parsed.hasPortfolioIssue,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      insights: parsed.insights,
      warnings: parsed.warnings,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getPortfolioSystemPrompt(): string {
    return `You are an expert portfolio management strategist. Your role is to analyze cross-project patterns, identify systemic risks, and recommend strategic actions across a portfolio of projects.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based. Focus on patterns that span multiple projects — not individual project issues (those are handled by other agents).

Your response must include:
1. hasPortfolioIssue: Whether there are significant portfolio-level concerns (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis of cross-project patterns
4. insights: Strategic observations about the portfolio (e.g., common patterns, systemic issues)
5. warnings: Early warnings that require attention (e.g., resource contention across projects, cascading delays)
6. recommendations: Actionable portfolio-level recommendations
7. modelCertainty: Your confidence (0-100)
8. suggestedActions: Concrete actions (send_notification or create_change_request)

For actions, use these types:
- send_notification: Escalate a cross-project concern to portfolio management
- create_change_request: Recommend a formal portfolio-level change (e.g., resource reallocation, project reprioritization)`;
  }

  private buildPortfolioPrompt(
    indicators: PortfolioAnalysisInput['indicators'],
  ): string {
    const projectSummaries = indicators.projectSnapshots.map(s =>
      `- **${s.projectName}** (${s.status}, ${s.priority}): health ${s.healthScore}%, completion ${s.completionRate}%, budget ${s.budgetUtilization}%${s.CPI !== null ? `, CPI ${s.CPI.toFixed(2)}` : ''}${s.SPI !== null ? `, SPI ${s.SPI.toFixed(2)}` : ''}, ${s.overdueTasks} overdue tasks, ${s.daysRemaining}d remaining${s.overAllocatedResources > 0 ? `, ${s.overAllocatedResources} over-allocated resources` : ''}`
    ).join('\n');

    const atRiskSection = indicators.atRiskProjects.length > 0
      ? `\n## At-Risk Projects\n\n${indicators.atRiskProjects.map(p => `- **${p.projectName}**: health ${p.healthScore}%, risk ${p.riskLevel}`).join('\n')}`
      : '';

    const budgetSection = indicators.budgetDeficitProjects.length > 0
      ? `\n## Budget Deficit Projects\n\n${indicators.budgetDeficitProjects.map(p => `- **${p.projectName}**: CPI ${p.CPI?.toFixed(2) ?? 'N/A'}`).join('\n')}`
      : '';

    const bottleneckSection = indicators.resourceBottlenecks.length > 0
      ? `\n## Resource Bottlenecks\n\n${indicators.resourceBottlenecks.map(b => `- **${b.projectName}**: ${b.overAllocatedCount} over-allocated resource(s)`).join('\n')}`
      : '';

    return `## Portfolio Overview

**Total Projects**: ${indicators.totalProjects}
**Active/Planning Projects**: ${indicators.activeProjects}
**Common Risks**: ${indicators.commonRisks.length > 0 ? indicators.commonRisks.join('; ') : 'none identified'}

## Project Health Summary

${projectSummaries}
${atRiskSection}${budgetSection}${bottleneckSection}

## Instructions

Analyze the portfolio data above. Focus on cross-project patterns:
1. Are multiple projects failing for similar reasons (common root causes)?
2. Are shared resources creating bottlenecks across projects?
3. Is the portfolio balanced in terms of risk distribution?
4. Are there cascading risks where one project's delay could impact others?
5. Should any projects be reprioritized, paused, or given additional resources?
6. Are there opportunities to transfer lessons from successful projects to struggling ones?

Respond with valid JSON matching the portfolio analysis schema.`;
  }

  // -------------------------------------------------------------------------
  // Risk Escalation
  // -------------------------------------------------------------------------

  async generateRiskEscalation(input: RiskEscalationInput): Promise<RiskEscalationResult | null> {
    // 1. Compute data quality — based on number of projects with compound risks
    const compoundProjects = input.indicators.compoundRiskProjects;
    const totalFlags = Object.values(input.indicators.flagDistribution).reduce((s, v) => s + v, 0);

    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: totalFlags * 10, // approximate — more flags = more data points
      tasksWithDates: totalFlags * 8,
      tasksWithAssignments: totalFlags * 6,
      tasksUpdatedRecently: totalFlags * 5,
      hasBudgetData: input.indicators.flagDistribution.budgetOverrun > 0,
      hasResourceData: input.indicators.flagDistribution.resourceBottleneck > 0,
    });

    // 2. Get historical accuracy
    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'risk-escalation-v1',
      'portfolio',
    );

    // 3. Check Claude availability
    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping risk escalation');
      return null;
    }

    // 4. Build prompt and call Claude
    const prompt = this.buildRiskEscalationPrompt(input.indicators);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getRiskEscalationSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for risk escalation:', err);
      return null;
    }

    // 5. Track cost
    await agentCostTracker.record({
      agentId: 'risk-escalation-v1',
      projectId: 'portfolio',
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    // 6. Parse and validate
    let parsed: RiskEscalationResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = RiskEscalationResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse risk escalation response:', err);
      return null;
    }

    // 7. Compute confidence
    const confidence = confidenceCalculator.compute({
      dataQuality,
      historicalAccuracy,
      modelCertainty: parsed.modelCertainty,
    });

    // 8. Map response
    return {
      hasCompoundRisk: parsed.hasCompoundRisk,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      escalations: parsed.escalations,
      compoundRisks: parsed.compoundRisks,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getRiskEscalationSystemPrompt(): string {
    return `You are an expert risk management analyst specializing in compound risk detection across project portfolios. Your role is to identify situations where multiple risk factors converge on the same project, creating risks greater than the sum of their parts.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based.

Your response must include:
1. hasCompoundRisk: Whether there are genuine compound risks requiring escalation (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis of the compound risk interactions
4. escalations: Specific escalation messages for management attention
5. compoundRisks: Description of each compound risk (e.g., "Project X: schedule delay + budget overrun = potential project failure")
6. recommendations: Actionable recommendations to address compound risks
7. modelCertainty: Your confidence (0-100)
8. suggestedActions: Concrete actions (send_notification or create_change_request)

Key principles:
- A project flagged by 2 agents is concerning; 3+ is critical
- Schedule delay + budget overrun often indicates systemic issues, not just isolated problems
- Resource bottlenecks + schedule delays suggest the delay will worsen without intervention
- Scope creep + budget overrun is a leading indicator of project failure
- Focus on interactions between risk factors, not just listing them`;
  }

  private buildRiskEscalationPrompt(
    indicators: RiskEscalationInput['indicators'],
  ): string {
    const projectDetails = indicators.compoundRiskProjects.map(p => {
      const flags: string[] = [];
      if (p.agentFlags.scheduleDelay) flags.push('Schedule Delay');
      if (p.agentFlags.budgetOverrun) flags.push('Budget Overrun');
      if (p.agentFlags.scopeCreep) flags.push('Scope Creep');
      if (p.agentFlags.resourceBottleneck) flags.push('Resource Bottleneck');
      if (p.agentFlags.meetingOverdue) flags.push('Meeting Items Overdue');

      const detailLines = Object.entries(p.details)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join('\n');

      return `### ${p.projectName} (${p.projectId.slice(0, 8)})
**Flags (${flags.length}):** ${flags.join(' + ')}
${detailLines ? `**Details:**\n${detailLines}` : ''}`;
    }).join('\n\n');

    return `## Scan Summary

**Total Projects Scanned**: ${indicators.totalProjects}
**Projects with Compound Risks**: ${indicators.compoundRiskProjects.length}
**Maximum Flags on Single Project**: ${indicators.maxFlagsOnSingleProject}

## Flag Distribution Across Portfolio

- Schedule Delays: ${indicators.flagDistribution.scheduleDelay} project(s)
- Budget Overruns: ${indicators.flagDistribution.budgetOverrun} project(s)
- Scope Creep: ${indicators.flagDistribution.scopeCreep} project(s)
- Resource Bottlenecks: ${indicators.flagDistribution.resourceBottleneck} project(s)
- Meeting Items Overdue: ${indicators.flagDistribution.meetingOverdue} project(s)

## Compound Risk Projects

${projectDetails}

## Instructions

Analyze the compound risk data above. Consider:
1. Which risk factor combinations are most dangerous for each project?
2. Are there cascading effects where one project's issues could impact others?
3. Which projects need immediate executive attention?
4. What intervention would have the highest leverage across multiple risk factors?
5. Are the compound risks symptomatic of organizational issues (e.g., chronic under-staffing)?

Respond with valid JSON matching the risk escalation schema.`;
  }

  // -------------------------------------------------------------------------
  // Stakeholder Report
  // -------------------------------------------------------------------------

  async generateStakeholderReport(input: StakeholderReportInput): Promise<StakeholderReportResult | null> {
    const snapshot = input.snapshot;

    // 1. Compute data quality from snapshot metrics
    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: snapshot.totalTasks,
      tasksWithDates: snapshot.totalTasks, // assume all tasks have dates if they have end dates for milestones
      tasksWithAssignments: Math.round(snapshot.totalTasks * 0.7), // approximate
      tasksUpdatedRecently: snapshot.completedTasks + snapshot.inProgressTasks,
      hasBudgetData: snapshot.budgetUtilization > 0,
      hasResourceData: snapshot.inProgressTasks > 0,
    });

    // 2. Get historical accuracy
    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'stakeholder-communication-v1',
      input.projectId,
    );

    // 3. Check Claude availability
    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping stakeholder report');
      return null;
    }

    // 4. Build prompt and call Claude
    const prompt = this.buildStakeholderPrompt(snapshot);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getStakeholderSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for stakeholder report:', err);
      return null;
    }

    // 5. Track cost
    await agentCostTracker.record({
      agentId: 'stakeholder-communication-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    // 6. Parse and validate
    let parsed: StakeholderReportResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = StakeholderReportResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse stakeholder report response:', err);
      return null;
    }

    // 7. Compute confidence
    const confidence = confidenceCalculator.compute({
      dataQuality,
      historicalAccuracy,
      modelCertainty: parsed.modelCertainty,
    });

    // 8. Map response
    return {
      overallStatus: parsed.overallStatus,
      executiveSummary: parsed.executiveSummary,
      keyHighlights: parsed.keyHighlights,
      risksAndConcerns: parsed.risksAndConcerns,
      upcomingMilestones: parsed.upcomingMilestones,
      recommendedActions: parsed.recommendedActions,
      reasoning: parsed.reasoning,
      modelCertainty: parsed.modelCertainty,
      confidence,
    };
  }

  private getStakeholderSystemPrompt(): string {
    return `You are an expert project management communication specialist. Your role is to generate clear, concise stakeholder status reports from project data.

You must respond with valid JSON matching the requested schema. Be professional, factual, and actionable.

Your response must include:
1. overallStatus: on_track, at_risk, off_track, or critical
2. executiveSummary: A 2-3 sentence executive summary suitable for senior stakeholders
3. keyHighlights: 2-5 key accomplishments or positive developments
4. risksAndConcerns: 0-5 risks or concerns requiring attention
5. upcomingMilestones: Summary of upcoming deadlines and milestones
6. recommendedActions: 1-4 recommended next steps for the project manager
7. reasoning: Your analysis chain-of-thought (internal, not shown to stakeholders)
8. modelCertainty: Your confidence in the assessment (0-100)

Guidelines:
- Use clear, non-technical language suitable for executive stakeholders
- Focus on outcomes and impact, not technical details
- Be honest about risks but frame them constructively with recommended mitigations
- Highlight progress and wins to maintain stakeholder confidence
- Keep the executive summary under 100 words`;
  }

  private buildStakeholderPrompt(
    snapshot: StakeholderReportInput['snapshot'],
  ): string {
    const milestonesSection = snapshot.upcomingMilestones.length > 0
      ? `\n## Upcoming Milestones (Next 14 Days)\n\n${snapshot.upcomingMilestones.map(m =>
          `- **${m.name}**: due in ${m.daysUntil} day(s) (${m.endDate})`
        ).join('\n')}`
      : '\n## Upcoming Milestones\n\nNo milestones due in the next 14 days.';

    const recentSection = snapshot.recentlyCompleted.length > 0
      ? `\n## Recently Completed (Last 7 Days)\n\n${snapshot.recentlyCompleted.map(t =>
          `- **${t.name}** (completed ${t.completedDate})`
        ).join('\n')}`
      : '';

    const riskSection = snapshot.riskIndicators.length > 0
      ? `\n## Risk Indicators\n\n${snapshot.riskIndicators.map(r => `- ${r}`).join('\n')}`
      : '\n## Risk Indicators\n\nNo significant risk indicators detected.';

    return `## Project Status Snapshot

**Project**: ${snapshot.projectName} (${snapshot.status})
**Completion**: ${snapshot.completionRate}% (${snapshot.completedTasks}/${snapshot.totalTasks} tasks)
**In Progress**: ${snapshot.inProgressTasks} task(s)
**Overdue**: ${snapshot.overdueTasks} task(s)
**Days Remaining**: ${snapshot.daysRemaining}

## Budget & Performance

- **Budget Utilization**: ${snapshot.budgetUtilization}%
${snapshot.CPI !== null ? `- **Cost Performance Index (CPI)**: ${snapshot.CPI} ${snapshot.CPI < 1 ? '(over budget)' : '(under/on budget)'}` : '- **CPI**: N/A (no budget data)'}
${snapshot.SPI !== null ? `- **Schedule Performance Index (SPI)**: ${snapshot.SPI} ${snapshot.SPI < 1 ? '(behind schedule)' : '(on/ahead of schedule)'}` : '- **SPI**: N/A'}
${milestonesSection}${recentSection}${riskSection}

## Instructions

Generate a stakeholder status report based on the data above. Consider:
1. What is the overall project health? Is it on track, at risk, or off track?
2. What are the key highlights stakeholders should know about?
3. What risks need attention and how should they be mitigated?
4. What are the recommended next steps?

Respond with valid JSON matching the stakeholder report schema.`;
  }

  // -------------------------------------------------------------------------
  // Hygiene Analysis
  // -------------------------------------------------------------------------

  async generateHygieneAnalysis(input: HygieneAnalysisInput): Promise<HygieneAnalysisResult | null> {
    const project = await projectService.findById(input.projectId);
    if (!project) return null;

    const ind = input.indicators;
    const totalIssues = ind.staleTasks.length + ind.missingDateTasks.length + ind.unassignedTasks.length +
      ind.missingEstimateTasks.length + ind.abandonedSprints.length + ind.zeroProgressTasks.length;

    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: totalIssues > 0 ? totalIssues * 3 : 10,
      tasksWithDates: Math.max(1, totalIssues * 2),
      tasksWithAssignments: Math.max(1, totalIssues),
      tasksUpdatedRecently: Math.max(1, totalIssues),
      hasBudgetData: false,
      hasResourceData: false,
    });

    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'project-hygiene-v1', input.projectId,
    );

    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping hygiene analysis');
      return null;
    }

    const prompt = this.buildHygienePrompt(project, ind);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getHygieneSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for hygiene analysis:', err);
      return null;
    }

    await agentCostTracker.record({
      agentId: 'project-hygiene-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    let parsed: HygieneAnalysisResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = HygieneAnalysisResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse hygiene analysis response:', err);
      return null;
    }

    const confidence = confidenceCalculator.compute({
      dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
    });

    return {
      hasHygieneIssues: parsed.hasHygieneIssues,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      issues: parsed.issues,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getHygieneSystemPrompt(): string {
    return `You are an expert project management hygiene analyst. Your role is to identify data quality issues, stale work items, and organizational debt in project management systems.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based.

Your response must include:
1. hasHygieneIssues: Whether there are actionable hygiene issues (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis
4. issues: List of identified hygiene issues
5. recommendations: Actionable recommendations to improve project data quality
6. modelCertainty: Your confidence (0-100)
7. suggestedActions: Concrete actions (send_notification only — hygiene is advisory)

For actions, use:
- send_notification: Notify project manager about hygiene issues requiring attention`;
  }

  private buildHygienePrompt(
    project: Project,
    indicators: HygieneAnalysisInput['indicators'],
  ): string {
    const staleSection = indicators.staleTasks.length > 0
      ? `\n## Stale Tasks (not updated in 14+ days)\n\n${indicators.staleTasks.slice(0, 10).map(t =>
          `- **${t.taskName}** (${t.status}): ${t.daysSinceUpdate} days since last update`
        ).join('\n')}`
      : '';

    const missingDatesSection = indicators.missingDateTasks.length > 0
      ? `\n## Tasks Missing Dates\n\n${indicators.missingDateTasks.slice(0, 10).map(t =>
          `- **${t.taskName}**`
        ).join('\n')}`
      : '';

    const unassignedSection = indicators.unassignedTasks.length > 0
      ? `\n## Unassigned Tasks\n\n${indicators.unassignedTasks.slice(0, 10).map(t =>
          `- **${t.taskName}**`
        ).join('\n')}`
      : '';

    const missingEstSection = indicators.missingEstimateTasks.length > 0
      ? `\n## Tasks Missing Estimates\n\n${indicators.missingEstimateTasks.slice(0, 10).map(t =>
          `- **${t.taskName}**`
        ).join('\n')}`
      : '';

    const sprintSection = indicators.abandonedSprints.length > 0
      ? `\n## Abandoned Sprints (past end date, not completed)\n\n${indicators.abandonedSprints.map(s =>
          `- **${s.sprintName}**: ended ${s.endDate}`
        ).join('\n')}`
      : '';

    const zeroProgressSection = indicators.zeroProgressTasks.length > 0
      ? `\n## Zero-Progress Tasks (in_progress but 0% for 7+ days)\n\n${indicators.zeroProgressTasks.slice(0, 10).map(t =>
          `- **${t.taskName}**: ${t.daysSinceUpdate} days since update`
        ).join('\n')}`
      : '';

    return `## Project Context

**Project**: ${project.name} (${project.status})

## Hygiene Summary

- **Stale tasks**: ${indicators.staleTasks.length}
- **Missing date tasks**: ${indicators.missingDateTasks.length}
- **Unassigned tasks**: ${indicators.unassignedTasks.length}
- **Missing estimate tasks**: ${indicators.missingEstimateTasks.length}
- **Abandoned sprints**: ${indicators.abandonedSprints.length}
- **Zero-progress tasks**: ${indicators.zeroProgressTasks.length}
${staleSection}${missingDatesSection}${unassignedSection}${missingEstSection}${sprintSection}${zeroProgressSection}

## Instructions

Analyze the hygiene data above. Consider:
1. Which issues are most impactful to project tracking accuracy?
2. Are stale tasks genuinely abandoned or just not being updated?
3. Do missing dates/estimates make schedule forecasting unreliable?
4. Should abandoned sprints be closed or reworked?
5. Are zero-progress tasks blocked or forgotten?

Respond with valid JSON matching the hygiene analysis schema.`;
  }

  // -------------------------------------------------------------------------
  // Dependency Analysis
  // -------------------------------------------------------------------------

  async generateDependencyAnalysis(input: DependencyAnalysisInput): Promise<DependencyAnalysisResult | null> {
    const project = await projectService.findById(input.projectId);
    if (!project) return null;

    const ind = input.indicators;
    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: ind.totalTasks,
      tasksWithDates: Math.round(ind.totalTasks * 0.8),
      tasksWithAssignments: Math.round(ind.totalTasks * 0.6),
      tasksUpdatedRecently: Math.round(ind.totalTasks * 0.5),
      hasBudgetData: false,
      hasResourceData: false,
    });

    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'dependency-risk-v1', input.projectId,
    );

    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping dependency analysis');
      return null;
    }

    const prompt = this.buildDependencyPrompt(project, ind);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getDependencySystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for dependency analysis:', err);
      return null;
    }

    await agentCostTracker.record({
      agentId: 'dependency-risk-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    let parsed: DependencyAnalysisResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = DependencyAnalysisResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse dependency analysis response:', err);
      return null;
    }

    const confidence = confidenceCalculator.compute({
      dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
    });

    return {
      hasDependencyRisk: parsed.hasDependencyRisk,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      risks: parsed.risks,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getDependencySystemPrompt(): string {
    return `You are an expert project schedule analyst specializing in dependency management and critical chain analysis. Your role is to identify dependency risks that could cascade into schedule failures.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based.

Your response must include:
1. hasDependencyRisk: Whether there are significant dependency risks (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis
4. risks: List of identified dependency risks
5. recommendations: Actionable recommendations to mitigate dependency risks
6. modelCertainty: Your confidence (0-100)
7. suggestedActions: Concrete actions (send_notification or update_dependency)

For actions, use:
- send_notification: Notify about dependency risks
- update_dependency: Recommend breaking or restructuring a dependency`;
  }

  private buildDependencyPrompt(
    project: Project,
    indicators: DependencyAnalysisInput['indicators'],
  ): string {
    const blockedSection = indicators.blockedChains.length > 0
      ? `\n## Blocked Chains\n\n${indicators.blockedChains.slice(0, 10).map(c =>
          `- **Blocked by "${c.blockedByTaskName}"**: ${c.chainTaskNames.join(' -> ')} (${c.reason})`
        ).join('\n')}`
      : '';

    const bottleneckSection = indicators.bottleneckTasks.length > 0
      ? `\n## Bottleneck Tasks (3+ dependents)\n\n${indicators.bottleneckTasks.slice(0, 10).map(t =>
          `- **${t.taskName}**: ${t.dependentCount} task(s) depend on this`
        ).join('\n')}`
      : '';

    const longChainSection = indicators.longChains.length > 0
      ? `\n## Long Dependency Chains (depth > 5)\n\n${indicators.longChains.slice(0, 5).map(c =>
          `- Depth ${c.depth}: ${c.taskNames.join(' -> ')}`
        ).join('\n')}`
      : '';

    return `## Project Context

**Project**: ${project.name} (${project.status})
**Total Tasks**: ${indicators.totalTasks}
**Total Dependencies**: ${indicators.totalDependencies}
${blockedSection}${bottleneckSection}${longChainSection}

## Instructions

Analyze the dependency data above. Consider:
1. Can blocked chains be unblocked by reprioritizing the blocking task?
2. Are bottleneck tasks adequately resourced and monitored?
3. Should long chains be broken by parallelizing work?
4. What is the cascading impact if a bottleneck task slips?
5. Are there circular dependency risks?

Respond with valid JSON matching the dependency analysis schema.`;
  }

  // -------------------------------------------------------------------------
  // Lessons Extraction
  // -------------------------------------------------------------------------

  async generateLessonsExtraction(input: LessonsExtractionInput): Promise<LessonsExtractionResult | null> {
    const pd = input.projectData;

    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: pd.totalTasks,
      tasksWithDates: pd.totalTasks,
      tasksWithAssignments: Math.round(pd.totalTasks * 0.7),
      tasksUpdatedRecently: pd.completedTasks,
      hasBudgetData: pd.budgetVariance !== null,
      hasResourceData: true,
    });

    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'lessons-learned-v1', input.projectId,
    );

    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping lessons extraction');
      return null;
    }

    const prompt = this.buildLessonsPrompt(pd);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getLessonsSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for lessons extraction:', err);
      return null;
    }

    await agentCostTracker.record({
      agentId: 'lessons-learned-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    let parsed: LessonsExtractionResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = LessonsExtractionResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse lessons extraction response:', err);
      return null;
    }

    const confidence = confidenceCalculator.compute({
      dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
    });

    return {
      hasLessons: parsed.hasLessons,
      reasoning: parsed.reasoning,
      lessons: parsed.lessons,
      modelCertainty: parsed.modelCertainty,
      confidence,
    };
  }

  private getLessonsSystemPrompt(): string {
    return `You are an expert project management retrospective facilitator. Your role is to extract actionable lessons learned from project data to improve future project execution.

You must respond with valid JSON matching the requested schema. Be specific, actionable, and forward-looking.

Your response must include:
1. hasLessons: Whether there are valuable lessons to extract (true/false)
2. reasoning: Your analysis chain-of-thought
3. lessons: Array of structured lessons, each with category, title, description, impact (low/medium/high), and recommendation
4. modelCertainty: Your confidence (0-100)

Lesson categories should be: scheduling, budgeting, resource_management, risk_management, scope_management, communication, quality, process`;
  }

  private buildLessonsPrompt(pd: LessonsExtractionInput['projectData']): string {
    return `## Project Data

**Project**: ${pd.projectName} (${pd.status})
**Completion Rate**: ${pd.completionRate}%
**Total Tasks**: ${pd.totalTasks} (${pd.completedTasks} completed, ${pd.overdueTasks} overdue)
**Duration**: ${pd.durationDays} days
**Budget Variance**: ${pd.budgetVariance !== null ? `$${pd.budgetVariance.toFixed(0)}` : 'N/A'}
**Existing Lessons**: ${pd.existingLessonsCount}

## Instructions

Based on the project data above, extract lessons learned. Consider:
1. Was the project delivered on time? If not, what scheduling lessons can be drawn?
2. Was the budget met? What cost management lessons apply?
3. Were there many overdue tasks? What does this say about estimation accuracy?
4. What went well that should be replicated in future projects?
5. What process improvements would have helped?
6. Avoid duplicating existing lessons — focus on new insights.

Respond with valid JSON matching the lessons extraction schema.`;
  }

  // -------------------------------------------------------------------------
  // Predictive Alert
  // -------------------------------------------------------------------------

  async generatePredictiveAlert(input: PredictiveAlertInput): Promise<PredictiveAlertResult | null> {
    const project = await projectService.findById(input.projectId);
    if (!project) return null;

    const ind = input.indicators;
    const dataQuality = confidenceCalculator.computeDataQuality({
      totalTasks: 20,
      tasksWithDates: 18,
      tasksWithAssignments: 15,
      tasksUpdatedRecently: 10,
      hasBudgetData: !!project.budgetAllocated,
      hasResourceData: true,
    });

    const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
      'predictive-alerting-v1', input.projectId,
    );

    if (!claudeService.isAvailable()) {
      console.warn('[ReasoningEngine] Claude API unavailable — skipping predictive alert');
      return null;
    }

    const prompt = this.buildPredictivePrompt(project, ind);
    let result: CompletionResult;
    try {
      result = await claudeService.complete({
        systemPrompt: this.getPredictiveSystemPrompt(),
        userMessage: prompt,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch (err) {
      console.error('[ReasoningEngine] Claude call failed for predictive alert:', err);
      return null;
    }

    await agentCostTracker.record({
      agentId: 'predictive-alerting-v1',
      projectId: input.projectId,
      scanId: input.scanId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
      model: result.model,
      latencyMs: result.latencyMs,
    });

    let parsed: PredictiveAlertResponse;
    try {
      const raw = JSON.parse(stripJsonFences(result.content));
      parsed = PredictiveAlertResponseSchema.parse(raw);
    } catch (err) {
      console.error('[ReasoningEngine] Failed to parse predictive alert response:', err);
      return null;
    }

    const confidence = confidenceCalculator.compute({
      dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
    });

    return {
      hasWarning: parsed.hasWarning,
      severity: parsed.severity,
      reasoning: parsed.reasoning,
      warnings: parsed.warnings,
      predictions: parsed.predictions,
      recommendations: parsed.recommendations,
      modelCertainty: parsed.modelCertainty,
      confidence,
      suggestedActions: parsed.suggestedActions.map(a => ({
        actionType: a.actionType as ActionType,
        targetEntityType: a.targetEntityType,
        targetEntityId: a.targetEntityId,
        oldValue: {},
        newValue: { description: a.description },
        reasoning: a.reasoning,
      })),
    };
  }

  private getPredictiveSystemPrompt(): string {
    return `You are an expert project forecasting analyst specializing in early warning systems. Your role is to detect patterns that predict project problems before they become critical.

You must respond with valid JSON matching the requested schema. Be specific and evidence-based.

Your response must include:
1. hasWarning: Whether there are genuine early warnings (true/false)
2. severity: low, medium, high, or critical
3. reasoning: Your full chain-of-thought analysis
4. warnings: Early warning indicators detected
5. predictions: What is likely to happen if current trends continue
6. recommendations: Proactive actions to prevent predicted problems
7. modelCertainty: Your confidence (0-100)
8. suggestedActions: Concrete actions (send_notification or create_change_request)

Key principles:
- Focus on leading indicators, not lagging ones
- Velocity decline is a strong predictor of future delays
- Progress-vs-time imbalance indicates schedule risk
- Multiple agent flags on a project indicate systemic issues`;
  }

  private buildPredictivePrompt(
    project: Project,
    indicators: PredictiveAlertInput['indicators'],
  ): string {
    const velocitySection = indicators.velocityTrend
      ? `\n## Velocity Trend\n\n- **Current velocity**: ${indicators.velocityTrend.current.toFixed(1)} points/sprint\n- **Historical average**: ${indicators.velocityTrend.historical.toFixed(1)} points/sprint\n- **Decline**: ${indicators.velocityTrend.declinePercent.toFixed(1)}%`
      : '\n## Velocity Trend\n\nInsufficient sprint data to compute velocity trend.';

    const similarSection = indicators.similarProjectComparison
      ? `\n## Similar Project Comparison\n\n- **Sample size**: ${indicators.similarProjectComparison.sampleSize} project(s)\n- **Average completion rate**: ${indicators.similarProjectComparison.avgCompletionRate.toFixed(1)}%\n- **Average budget variance**: $${indicators.similarProjectComparison.avgBudgetVariance.toFixed(0)}`
      : '';

    return `## Project Context

**Project**: ${project.name} (${project.status})

## Progress Trajectory

- **Completion rate**: ${indicators.progressTrajectory.completionRate.toFixed(1)}%
- **Time elapsed**: ${indicators.progressTrajectory.timeElapsedPercent.toFixed(1)}%
- **Behind schedule by**: ${indicators.progressTrajectory.behindPercent.toFixed(1)}%
${velocitySection}

## Risk Accumulation

- **Agent flags in last 30 days**: ${indicators.riskAccumulation}
${similarSection}

## Instructions

Analyze the predictive indicators above. Consider:
1. Is the velocity trend declining? If so, what does this predict?
2. Is progress keeping pace with elapsed time?
3. Are multiple agent flags converging on this project?
4. How does this project compare to similar completed projects?
5. What is the probability of project success if current trends continue?

Respond with valid JSON matching the predictive alert schema.`;
  }

  // -------------------------------------------------------------------------
  // Context Assembly
  // -------------------------------------------------------------------------

  private async assembleContext(input: ReasoningInput): Promise<ScheduleContext | null> {
    try {
      const [project, schedule, tasks, criticalPath] = await Promise.all([
        projectService.findById(input.projectId),
        scheduleService.findById(input.scheduleId),
        scheduleService.findTasksByScheduleId(input.scheduleId),
        criticalPathService.calculateCriticalPath(input.scheduleId),
      ]);

      if (!project || !schedule) return null;

      // Get resource workload if project has resources
      let workload: ResourceWorkload[] = [];
      try {
        workload = await resourceService.computeWorkload(input.projectId);
      } catch {
        // Resource data optional
      }

      return { project, schedule, tasks, criticalPath, workload };
    } catch (err) {
      console.error('[ReasoningEngine] Context assembly failed:', err);
      return null;
    }
  }

  private computeDataQualityFromContext(ctx: ScheduleContext): number {
    const now = Date.now();
    const input: DataQualityInput = {
      totalTasks: ctx.tasks.length,
      tasksWithDates: ctx.tasks.filter(t => t.startDate || t.endDate).length,
      tasksWithAssignments: ctx.tasks.filter(t => t.assignedTo).length,
      tasksUpdatedRecently: ctx.tasks.filter(t => {
        const updated = new Date(t.updatedAt ?? t.createdAt).getTime();
        return (now - updated) < FOURTEEN_DAYS_MS;
      }).length,
      hasBudgetData: !!ctx.project.budgetAllocated,
      hasResourceData: ctx.workload.length > 0,
    };
    return confidenceCalculator.computeDataQuality(input);
  }

  // -------------------------------------------------------------------------
  // Prompt Construction
  // -------------------------------------------------------------------------

  private getSystemPrompt(): string {
    return `You are an expert project management AI agent. Your role is to analyze schedule delays, identify root causes, and propose concrete recovery actions.

You must respond with valid JSON matching the requested schema. Be specific — reference actual task IDs and names. Be conservative — prefer lower-risk recovery options.

Your response must include:
1. rootCause: A clear analysis of why the delays occurred
2. impactAnalysis: What happens if no action is taken
3. modelCertainty: Your confidence (0-100) in the analysis based on data quality and problem clarity
4. reasoning: Your full chain-of-thought analysis (this will be shown to the project manager)
5. options: 1-3 ranked recovery options, each with concrete actions

For actions, use these types:
- update_task_dates: Change start/end dates of a task
- reassign_resource: Change who is assigned to a task
- update_dependency: Change task dependency relationships
- update_progress: Update task completion percentage
- send_notification: Send a notification to the project owner

Each action must specify the exact field, old value, and new value. Dates should be in YYYY-MM-DD format.`;
  }

  private buildPrompt(ctx: ScheduleContext, delays: DelayContext[]): string {
    const project = ctx.project;
    const schedule = ctx.schedule;

    // Build task summary
    const taskSummaries = ctx.tasks.map(t => {
      const criticalPathInfo = ctx.criticalPath.tasks.find(cp => cp.taskId === t.id);
      return {
        id: t.id,
        name: t.name,
        status: t.status,
        priority: t.priority,
        startDate: t.startDate,
        endDate: t.endDate,
        assignedTo: t.assignedTo ?? 'Unassigned',
        progress: t.progressPercentage ?? 0,
        estimatedDays: t.estimatedDays,
        dependency: t.dependency,
        dependencies: t.dependencies.map(d => ({ id: d.dependencyId, type: d.dependencyType, lag: d.lagDays })),
        isCritical: criticalPathInfo?.isCritical ?? false,
        totalFloat: criticalPathInfo?.totalFloat ?? 0,
      };
    });

    // Build resource summary
    const resourceSummaries = ctx.workload.map(w => ({
      name: w.resourceName,
      role: w.role,
      utilization: `${Math.round(w.averageUtilization)}%`,
      overAllocated: w.isOverAllocated,
    }));

    return `## Project Context

**Project**: ${project.name} (${project.status})
**Schedule**: ${schedule.name}
**Schedule Period**: ${schedule.startDate} to ${schedule.endDate}
**Critical Path Duration**: ${ctx.criticalPath.projectDuration} days
**Critical Path Tasks**: ${ctx.criticalPath.criticalPathTaskIds.length}

## Current Delays

${delays.map(d => `- **${d.taskName}** (${d.taskId}): ${d.delayDays} days behind, ${d.currentProgress}% complete, critical path: ${d.isOnCriticalPath ? 'YES' : 'no'}, expected end: ${d.expectedEndDate}, estimated end: ${d.estimatedEndDate}`).join('\n')}

## All Tasks

\`\`\`json
${JSON.stringify(taskSummaries, null, 2)}
\`\`\`

## Resources

\`\`\`json
${JSON.stringify(resourceSummaries, null, 2)}
\`\`\`

## Instructions

Analyze the delays above. Consider:
1. Are these delays connected? Is there a common root cause?
2. Which tasks are on the critical path and have zero float?
3. Can resources be rebalanced to accelerate critical tasks?
4. What is the minimum change needed to recover the schedule?

Respond with valid JSON matching the recovery plan schema.`;
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ScheduleContext {
  project: Project;
  schedule: Schedule;
  tasks: Task[];
  criticalPath: CriticalPathResult;
  workload: ResourceWorkload[];
}

export const reasoningEngine = new ReasoningEngine();
