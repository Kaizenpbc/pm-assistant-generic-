import { claudeService, CompletionResult } from '../../../claudeService';
import { scheduleService, Task } from '../../../ScheduleService';
import { projectService } from '../../../ProjectService';
import { agentCostTracker } from '../../AgentCostTracker';
import { confidenceCalculator } from '../../ConfidenceCalculator';
import { getMemoryContext, formatMemoryContextForPrompt } from '../../memoryContext';
import { stripJsonFences, mapSuggestedActions } from '../helpers';
import logger from '../../../../utils/logger';
import {
  ScopeAnalysisResponseSchema, ScopeAnalysisResponse,
  BudgetAnalysisResponseSchema, BudgetAnalysisResponse,
  ResourceAnalysisResponseSchema, ResourceAnalysisResponse,
  DependencyAnalysisResponseSchema, DependencyAnalysisResponse,
} from '../zodSchemas';
import {
  getScopeSystemPrompt, buildScopePrompt,
  getBudgetSystemPrompt, buildBudgetPrompt,
  getResourceSystemPrompt, buildResourcePrompt,
  getDependencySystemPrompt, buildDependencyPrompt,
} from '../prompts';
import type {
  ScopeAnalysisInput, ScopeAnalysisResult,
  BudgetAnalysisInput, BudgetAnalysisResult,
  ResourceAnalysisInput, ResourceAnalysisResult,
  DependencyAnalysisInput, DependencyAnalysisResult,
} from '../types';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

async function getProjectTasksContext(projectId: string) {
  const project = await projectService.findById(projectId);
  if (!project) return null;

  const schedules = await scheduleService.findByProjectId(projectId);
  const allTasks = await scheduleService.findTasksByScheduleIds(schedules.map(s => s.id));
  return { project, allTasks };
}

function computeProjectDataQuality(allTasks: Task[], project: { budgetAllocated?: number | null }, hasResourceData: boolean) {
  const now = Date.now();
  return confidenceCalculator.computeDataQuality({
    totalTasks: allTasks.length,
    tasksWithDates: allTasks.filter(t => t.startDate || t.endDate).length,
    tasksWithAssignments: allTasks.filter(t => t.assignedTo).length,
    tasksUpdatedRecently: allTasks.filter(t => {
      const updated = new Date(t.updatedAt ?? t.createdAt).getTime();
      return (now - updated) < FOURTEEN_DAYS_MS;
    }).length,
    hasBudgetData: !!project.budgetAllocated,
    hasResourceData,
  });
}

// ---------------------------------------------------------------------------
// Scope Analysis
// ---------------------------------------------------------------------------

export async function generateScopeAnalysisImpl(input: ScopeAnalysisInput): Promise<ScopeAnalysisResult | null> {
  const ctx = await getProjectTasksContext(input.projectId);
  if (!ctx) return null;

  const dataQuality = computeProjectDataQuality(ctx.allTasks, ctx.project, false);
  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy('scope-creep-detection-v1', input.projectId);

  if (!claudeService.isAvailable()) {
    logger.warn('[ReasoningEngine] Claude API unavailable — skipping scope analysis');
    return null;
  }

  const memoryCtx = await getMemoryContext('scope-creep-detection-v1', input.projectId);
  const memoryPrompt = formatMemoryContextForPrompt(memoryCtx);
  const prompt = buildScopePrompt(ctx.project, input.indicators, ctx.allTasks)
    + (memoryPrompt ? `\n\n${memoryPrompt}` : '');
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getScopeSystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error('[ReasoningEngine] Claude call failed for scope analysis:', err);
    return null;
  }

  await agentCostTracker.record({
    agentId: 'scope-creep-detection-v1',
    projectId: input.projectId,
    scanId: input.scanId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
    model: result.model,
    latencyMs: result.latencyMs,
  });

  let parsed: ScopeAnalysisResponse;
  try {
    const raw = JSON.parse(stripJsonFences(result.content));
    parsed = ScopeAnalysisResponseSchema.parse(raw);
  } catch (err) {
    logger.error('[ReasoningEngine] Failed to parse scope analysis response:', err);
    return null;
  }

  const confidence = confidenceCalculator.compute({
    dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
  });

  return {
    hasScopeCreep: parsed.hasScopeCreep,
    severity: parsed.severity,
    reasoning: parsed.reasoning,
    rootCauses: parsed.rootCauses,
    recommendations: parsed.recommendations,
    modelCertainty: parsed.modelCertainty,
    confidence,
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}

// ---------------------------------------------------------------------------
// Budget Analysis
// ---------------------------------------------------------------------------

export async function generateBudgetAnalysisImpl(input: BudgetAnalysisInput): Promise<BudgetAnalysisResult | null> {
  const ctx = await getProjectTasksContext(input.projectId);
  if (!ctx) return null;

  const dataQuality = computeProjectDataQuality(ctx.allTasks, ctx.project, false);
  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy('budget-intelligence-v1', input.projectId);

  if (!claudeService.isAvailable()) {
    logger.warn('[ReasoningEngine] Claude API unavailable — skipping budget analysis');
    return null;
  }

  const budgetMemoryCtx = await getMemoryContext('budget-intelligence-v1', input.projectId);
  const budgetMemoryPrompt = formatMemoryContextForPrompt(budgetMemoryCtx);
  const prompt = buildBudgetPrompt(ctx.project, input.indicators, ctx.allTasks)
    + (budgetMemoryPrompt ? `\n\n${budgetMemoryPrompt}` : '');
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getBudgetSystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error('[ReasoningEngine] Claude call failed for budget analysis:', err);
    return null;
  }

  await agentCostTracker.record({
    agentId: 'budget-intelligence-v1',
    projectId: input.projectId,
    scanId: input.scanId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
    model: result.model,
    latencyMs: result.latencyMs,
  });

  let parsed: BudgetAnalysisResponse;
  try {
    const raw = JSON.parse(stripJsonFences(result.content));
    parsed = BudgetAnalysisResponseSchema.parse(raw);
  } catch (err) {
    logger.error('[ReasoningEngine] Failed to parse budget analysis response:', err);
    return null;
  }

  const confidence = confidenceCalculator.compute({
    dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
  });

  return {
    hasBudgetIssue: parsed.hasBudgetIssue,
    severity: parsed.severity,
    reasoning: parsed.reasoning,
    rootCauses: parsed.rootCauses,
    recommendations: parsed.recommendations,
    modelCertainty: parsed.modelCertainty,
    confidence,
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}

// ---------------------------------------------------------------------------
// Resource Analysis
// ---------------------------------------------------------------------------

export async function generateResourceAnalysisImpl(input: ResourceAnalysisInput): Promise<ResourceAnalysisResult | null> {
  const ctx = await getProjectTasksContext(input.projectId);
  if (!ctx) return null;

  const dataQuality = computeProjectDataQuality(ctx.allTasks, ctx.project, input.indicators.totalResources > 0);
  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy('resource-optimization-v1', input.projectId);

  if (!claudeService.isAvailable()) {
    logger.warn('[ReasoningEngine] Claude API unavailable — skipping resource analysis');
    return null;
  }

  const prompt = buildResourcePrompt(ctx.project, input.indicators, ctx.allTasks);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getResourceSystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error('[ReasoningEngine] Claude call failed for resource analysis:', err);
    return null;
  }

  await agentCostTracker.record({
    agentId: 'resource-optimization-v1',
    projectId: input.projectId,
    scanId: input.scanId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
    model: result.model,
    latencyMs: result.latencyMs,
  });

  let parsed: ResourceAnalysisResponse;
  try {
    const raw = JSON.parse(stripJsonFences(result.content));
    parsed = ResourceAnalysisResponseSchema.parse(raw);
  } catch (err) {
    logger.error('[ReasoningEngine] Failed to parse resource analysis response:', err);
    return null;
  }

  const confidence = confidenceCalculator.compute({
    dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
  });

  return {
    hasResourceIssue: parsed.hasResourceIssue,
    severity: parsed.severity,
    reasoning: parsed.reasoning,
    rootCauses: parsed.rootCauses,
    recommendations: parsed.recommendations,
    modelCertainty: parsed.modelCertainty,
    confidence,
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}

// ---------------------------------------------------------------------------
// Dependency Analysis
// ---------------------------------------------------------------------------

export async function generateDependencyAnalysisImpl(input: DependencyAnalysisInput): Promise<DependencyAnalysisResult | null> {
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

  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy('dependency-risk-v1', input.projectId);

  if (!claudeService.isAvailable()) {
    logger.warn('[ReasoningEngine] Claude API unavailable — skipping dependency analysis');
    return null;
  }

  const prompt = buildDependencyPrompt(project, ind);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getDependencySystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error('[ReasoningEngine] Claude call failed for dependency analysis:', err);
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
    logger.error('[ReasoningEngine] Failed to parse dependency analysis response:', err);
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
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}
