import { claudeService, CompletionResult } from '../../../claudeService';
import { projectService } from '../../../ProjectService';
import { agentCostTracker } from '../../AgentCostTracker';
import { confidenceCalculator } from '../../ConfidenceCalculator';
import { stripJsonFences, mapSuggestedActions } from '../helpers';
import {
  HygieneAnalysisResponseSchema, HygieneAnalysisResponse,
  LessonsExtractionResponseSchema, LessonsExtractionResponse,
  PredictiveAlertResponseSchema, PredictiveAlertResponse,
  StakeholderReportResponseSchema, StakeholderReportResponse,
} from '../zodSchemas';
import {
  getHygieneSystemPrompt, buildHygienePrompt,
  getLessonsSystemPrompt, buildLessonsPrompt,
  getPredictiveSystemPrompt, buildPredictivePrompt,
  getStakeholderSystemPrompt, buildStakeholderPrompt,
} from '../prompts';
import type {
  HygieneAnalysisInput, HygieneAnalysisResult,
  LessonsExtractionInput, LessonsExtractionResult,
  PredictiveAlertInput, PredictiveAlertResult,
  StakeholderReportInput, StakeholderReportResult,
} from '../types';

// ---------------------------------------------------------------------------
// Hygiene Analysis
// ---------------------------------------------------------------------------

export async function generateHygieneAnalysisImpl(input: HygieneAnalysisInput): Promise<HygieneAnalysisResult | null> {
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

  const prompt = buildHygienePrompt(project, ind);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getHygieneSystemPrompt(),
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
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}

// ---------------------------------------------------------------------------
// Lessons Extraction
// ---------------------------------------------------------------------------

export async function generateLessonsExtractionImpl(input: LessonsExtractionInput): Promise<LessonsExtractionResult | null> {
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

  const prompt = buildLessonsPrompt(pd);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getLessonsSystemPrompt(),
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

// ---------------------------------------------------------------------------
// Predictive Alert
// ---------------------------------------------------------------------------

export async function generatePredictiveAlertImpl(input: PredictiveAlertInput): Promise<PredictiveAlertResult | null> {
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

  const prompt = buildPredictivePrompt(project, ind);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getPredictiveSystemPrompt(),
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
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}

// ---------------------------------------------------------------------------
// Stakeholder Report
// ---------------------------------------------------------------------------

export async function generateStakeholderReportImpl(input: StakeholderReportInput): Promise<StakeholderReportResult | null> {
  const snapshot = input.snapshot;

  const dataQuality = confidenceCalculator.computeDataQuality({
    totalTasks: snapshot.totalTasks,
    tasksWithDates: snapshot.totalTasks,
    tasksWithAssignments: Math.round(snapshot.totalTasks * 0.7),
    tasksUpdatedRecently: snapshot.completedTasks + snapshot.inProgressTasks,
    hasBudgetData: snapshot.budgetUtilization > 0,
    hasResourceData: snapshot.inProgressTasks > 0,
  });

  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
    'stakeholder-communication-v1',
    input.projectId,
  );

  if (!claudeService.isAvailable()) {
    console.warn('[ReasoningEngine] Claude API unavailable — skipping stakeholder report');
    return null;
  }

  const prompt = buildStakeholderPrompt(snapshot);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getStakeholderSystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    console.error('[ReasoningEngine] Claude call failed for stakeholder report:', err);
    return null;
  }

  await agentCostTracker.record({
    agentId: 'stakeholder-communication-v1',
    projectId: input.projectId,
    scanId: input.scanId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
    model: result.model,
    latencyMs: result.latencyMs,
  });

  let parsed: StakeholderReportResponse;
  try {
    const raw = JSON.parse(stripJsonFences(result.content));
    parsed = StakeholderReportResponseSchema.parse(raw);
  } catch (err) {
    console.error('[ReasoningEngine] Failed to parse stakeholder report response:', err);
    return null;
  }

  const confidence = confidenceCalculator.compute({
    dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
  });

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
