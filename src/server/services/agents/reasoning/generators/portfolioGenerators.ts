import { claudeService, CompletionResult } from '../../../claudeService';
import { agentCostTracker } from '../../AgentCostTracker';
import { confidenceCalculator } from '../../ConfidenceCalculator';
import { stripJsonFences, mapSuggestedActions } from '../helpers';
import logger from '../../../../utils/logger';
import {
  PortfolioAnalysisResponseSchema, PortfolioAnalysisResponse,
  RiskEscalationResponseSchema, RiskEscalationResponse,
} from '../zodSchemas';
import {
  getPortfolioSystemPrompt, buildPortfolioPrompt,
  getRiskEscalationSystemPrompt, buildRiskEscalationPrompt,
} from '../prompts';
import type {
  PortfolioAnalysisInput, PortfolioAnalysisResult,
  RiskEscalationInput, RiskEscalationResult,
} from '../types';

// ---------------------------------------------------------------------------
// Portfolio Analysis
// ---------------------------------------------------------------------------

export async function generatePortfolioAnalysisImpl(input: PortfolioAnalysisInput): Promise<PortfolioAnalysisResult | null> {
  const snapshots = input.indicators.projectSnapshots;
  const projectsWithBudget = snapshots.filter(s => s.budgetUtilization > 0).length;
  const projectsWithTasks = snapshots.filter(s => s.taskCount > 0).length;
  const projectsWithResources = snapshots.filter(s => s.resourceCount > 0).length;

  const dataQuality = confidenceCalculator.computeDataQuality({
    totalTasks: snapshots.reduce((sum, s) => sum + s.taskCount, 0),
    tasksWithDates: snapshots.reduce((sum, s) => sum + s.taskCount, 0),
    tasksWithAssignments: snapshots.reduce((sum, s) => sum + Math.min(s.taskCount, s.resourceCount * 3), 0),
    tasksUpdatedRecently: snapshots.reduce((sum, s) => sum + Math.max(0, s.taskCount - s.overdueTasks), 0),
    hasBudgetData: projectsWithBudget > 0,
    hasResourceData: projectsWithResources > 0,
  });

  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
    'cross-project-intelligence-v1',
    'portfolio',
  );

  if (!claudeService.isAvailable()) {
    logger.warn('[ReasoningEngine] Claude API unavailable — skipping portfolio analysis');
    return null;
  }

  const prompt = buildPortfolioPrompt(input.indicators);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getPortfolioSystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error('[ReasoningEngine] Claude call failed for portfolio analysis:', err);
    return null;
  }

  await agentCostTracker.record({
    agentId: 'cross-project-intelligence-v1',
    projectId: 'portfolio',
    scanId: input.scanId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
    model: result.model,
    latencyMs: result.latencyMs,
  });

  let parsed: PortfolioAnalysisResponse;
  try {
    const raw = JSON.parse(stripJsonFences(result.content));
    parsed = PortfolioAnalysisResponseSchema.parse(raw);
  } catch (err) {
    logger.error('[ReasoningEngine] Failed to parse portfolio analysis response:', err);
    return null;
  }

  const confidence = confidenceCalculator.compute({
    dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
  });

  return {
    hasPortfolioIssue: parsed.hasPortfolioIssue,
    severity: parsed.severity,
    reasoning: parsed.reasoning,
    insights: parsed.insights,
    warnings: parsed.warnings,
    recommendations: parsed.recommendations,
    modelCertainty: parsed.modelCertainty,
    confidence,
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}

// ---------------------------------------------------------------------------
// Risk Escalation
// ---------------------------------------------------------------------------

export async function generateRiskEscalationImpl(input: RiskEscalationInput): Promise<RiskEscalationResult | null> {
  const compoundProjects = input.indicators.compoundRiskProjects;
  const totalFlags = Object.values(input.indicators.flagDistribution).reduce((s, v) => s + v, 0);

  const dataQuality = confidenceCalculator.computeDataQuality({
    totalTasks: totalFlags * 10,
    tasksWithDates: totalFlags * 8,
    tasksWithAssignments: totalFlags * 6,
    tasksUpdatedRecently: totalFlags * 5,
    hasBudgetData: input.indicators.flagDistribution.budgetOverrun > 0,
    hasResourceData: input.indicators.flagDistribution.resourceBottleneck > 0,
  });

  const historicalAccuracy = await confidenceCalculator.computeHistoricalAccuracy(
    'risk-escalation-v1',
    'portfolio',
  );

  if (!claudeService.isAvailable()) {
    logger.warn('[ReasoningEngine] Claude API unavailable — skipping risk escalation');
    return null;
  }

  const prompt = buildRiskEscalationPrompt(input.indicators);
  let result: CompletionResult;
  try {
    result = await claudeService.complete({
      systemPrompt: getRiskEscalationSystemPrompt(),
      userMessage: prompt,
      responseFormat: 'json',
      maxTokens: 4096,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error('[ReasoningEngine] Claude call failed for risk escalation:', err);
    return null;
  }

  await agentCostTracker.record({
    agentId: 'risk-escalation-v1',
    projectId: 'portfolio',
    scanId: input.scanId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    estimatedCostUsd: agentCostTracker.estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
    model: result.model,
    latencyMs: result.latencyMs,
  });

  let parsed: RiskEscalationResponse;
  try {
    const raw = JSON.parse(stripJsonFences(result.content));
    parsed = RiskEscalationResponseSchema.parse(raw);
  } catch (err) {
    logger.error('[ReasoningEngine] Failed to parse risk escalation response:', err);
    return null;
  }

  const confidence = confidenceCalculator.compute({
    dataQuality, historicalAccuracy, modelCertainty: parsed.modelCertainty,
  });

  return {
    hasCompoundRisk: parsed.hasCompoundRisk,
    severity: parsed.severity,
    reasoning: parsed.reasoning,
    escalations: parsed.escalations,
    compoundRisks: parsed.compoundRisks,
    recommendations: parsed.recommendations,
    modelCertainty: parsed.modelCertainty,
    confidence,
    suggestedActions: mapSuggestedActions(parsed.suggestedActions),
  };
}
