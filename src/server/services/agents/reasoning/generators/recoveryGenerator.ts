import { claudeService, CompletionResult } from '../../../claudeService';
import { scheduleService, Task, Schedule } from '../../../ScheduleService';
import { resourceService, ResourceWorkload } from '../../../ResourceService';
import { CriticalPathService, CriticalPathResult } from '../../../CriticalPathService';
import { projectService, Project } from '../../../ProjectService';
import { agentCostTracker } from '../../AgentCostTracker';
import { confidenceCalculator, DataQualityInput } from '../../ConfidenceCalculator';
import { stripJsonFences } from '../helpers';
import { RecoveryResponseSchema, RecoveryResponse } from '../zodSchemas';
import { getRecoverySystemPrompt, buildRecoveryPrompt } from '../prompts';
import logger from '../../../../utils/logger';
import type { ReasoningInput, RecoveryPlan, DelayContext } from '../types';

const criticalPathService = new CriticalPathService();
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

interface ScheduleContext {
  project: Project;
  schedule: Schedule;
  tasks: Task[];
  criticalPath: CriticalPathResult;
  workload: ResourceWorkload[];
}

async function assembleContext(input: ReasoningInput): Promise<ScheduleContext | null> {
  try {
    const [project, schedule, tasks, criticalPath] = await Promise.all([
      projectService.findById(input.projectId),
      scheduleService.findById(input.scheduleId),
      scheduleService.findTasksByScheduleId(input.scheduleId),
      criticalPathService.calculateCriticalPath(input.scheduleId),
    ]);

    if (!project || !schedule) return null;

    let workload: ResourceWorkload[] = [];
    try {
      workload = await resourceService.computeWorkload(input.projectId);
    } catch {
      // Resource data optional
    }

    return { project, schedule, tasks, criticalPath, workload };
  } catch (err) {
    logger.error('[ReasoningEngine] Context assembly failed:', err);
    return null;
  }
}

function computeDataQualityFromContext(ctx: ScheduleContext): number {
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

export async function generateRecoveryPlanImpl(input: ReasoningInput): Promise<RecoveryPlan | null> {
  // 1. Assemble context
  const ctx = await assembleContext(input);
  if (!ctx) return null;

  // 2. Compute data quality
  const dataQuality = computeDataQualityFromContext(ctx);

  // 3. Get historical accuracy
  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
    'schedule-recovery-v1',
    input.projectId,
  );

  // 4. Check Claude availability
  if (!claudeService.isAvailable()) {
    logger.warn('[ReasoningEngine] Claude API unavailable — skipping recovery plan');
    return null;
  }

  // 5. Build prompt and call Claude
  const prompt = buildRecoveryPrompt(ctx, input.delays);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getRecoverySystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error('[ReasoningEngine] Claude call failed for recovery plan:', err);
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

  // 7. Parse and validate
  let parsed: RecoveryResponse;
  try {
    const raw = JSON.parse(stripJsonFences(result.content));
    parsed = RecoveryResponseSchema.parse(raw);
  } catch (err) {
    logger.error('[ReasoningEngine] Failed to parse recovery plan response:', err);
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
    rootCause: parsed.rootCause,
    impactAnalysis: parsed.impactAnalysis,
    reasoning: parsed.reasoning,
    modelCertainty: parsed.modelCertainty,
    confidence,
    options: parsed.options.map(opt => ({
      rank: opt.rank,
      title: opt.title,
      description: opt.description,
      riskAssessment: opt.riskAssessment,
      estimatedImpact: opt.estimatedImpact,
      actions: opt.actions.map(a => ({
        actionType: a.actionType,
        targetEntityType: 'task',
        targetEntityId: a.targetTaskId,
        targetEntityName: a.targetTaskName,
        oldValue: { [a.field]: a.oldValue },
        newValue: { [a.field]: a.newValue },
        reasoning: a.reasoning,
      })),
    })),
  };
}
