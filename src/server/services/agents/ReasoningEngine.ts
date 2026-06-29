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
      const raw = JSON.parse(result.content);
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
      const raw = JSON.parse(result.content);
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
