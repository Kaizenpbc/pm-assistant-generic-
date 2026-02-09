import { FastifyInstance } from 'fastify';
import { AIContextBuilder, ProjectContext } from './aiContextBuilder';
import { claudeService, PromptTemplate } from './claudeService';
import { logAIUsage } from './aiUsageLogger';
import { computeEVMMetrics, computeDeterministicRiskScore } from './predictiveIntelligence';
import type { AIScenarioRequest, AIScenarioResult } from '../schemas/phase5Schemas';
import { AIScenarioResultSchema } from '../schemas/phase5Schemas';

// ---------------------------------------------------------------------------
// Prompt Template
// ---------------------------------------------------------------------------

const scenarioPrompt = new PromptTemplate(
  `You are a project scenario modeling analyst for a project management system. A project manager is asking "What if...?" — model the cascading effects of the proposed change.

Current project state:
{{projectData}}

EVM metrics:
{{evmMetrics}}

Scenario description: {{scenario}}
Applied numeric parameters: {{parameters}}

Deterministic baseline impact:
{{baselineImpact}}

Analyze the cascading effects on schedule, budget, resources, and risk. Consider:
- Downstream task dependencies
- Resource reallocation needs
- Risk profile changes
- External factors (weather, supply chain, regulatory) relevant to the project type and location

Return a JSON object matching the schema with schedule/budget/resource/risk impacts, affected tasks, recommendations, and confidence (0.5-0.9).`,
  '1.0.0',
);

// ---------------------------------------------------------------------------
// Helper: compute metrics from ProjectContext
// ---------------------------------------------------------------------------

function computeMetricsFromContext(ctx: ProjectContext): {
  completionRate: number;
  scheduleVariance: number;
  budgetUtilization: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  daysElapsed: number;
  daysRemaining: number;
} {
  const allTasks = ctx.schedules.flatMap(s => s.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const now = new Date();
  const overdueTasks = allTasks.filter(
    t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now,
  ).length;

  const startDate = ctx.project.startDate ? new Date(ctx.project.startDate) : now;
  const endDate = ctx.project.endDate
    ? new Date(ctx.project.endDate)
    : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = Math.max(0, now.getTime() - startDate.getTime());
  const daysElapsed = Math.round(elapsed / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, Math.round((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const expectedPercent = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
  const scheduleVariance = completionRate - expectedPercent;

  const budgetAllocated = ctx.project.budgetAllocated || 0;
  const budgetSpent = ctx.project.budgetSpent || 0;
  const budgetUtilization = budgetAllocated > 0 ? (budgetSpent / budgetAllocated) * 100 : 0;

  return { completionRate, scheduleVariance, budgetUtilization, totalTasks, completedTasks, overdueTasks, daysElapsed, daysRemaining };
}

// ---------------------------------------------------------------------------
// WhatIfScenarioService
// ---------------------------------------------------------------------------

export class WhatIfScenarioService {
  private contextBuilder: AIContextBuilder;
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.contextBuilder = new AIContextBuilder(fastify);
  }

  async modelScenario(
    request: AIScenarioRequest,
    userId?: string,
  ): Promise<{ result: AIScenarioResult; aiPowered: boolean }> {
    const context = await this.contextBuilder.buildProjectContext(request.projectId);
    const metrics = computeMetricsFromContext(context);
    const { project } = context;

    const budgetAllocated = project.budgetAllocated || 0;
    const budgetSpent = project.budgetSpent || 0;
    const totalDays = metrics.daysElapsed + metrics.daysRemaining;

    const evm = computeEVMMetrics(
      budgetAllocated,
      budgetSpent,
      metrics.completionRate,
      metrics.daysElapsed,
      totalDays,
    );
    const { score: currentRiskScore } = computeDeterministicRiskScore(metrics, metrics.budgetUtilization);

    // Apply numeric parameters deterministically
    const params = request.parameters || {};
    let projectedBudget = budgetAllocated;
    let projectedDays = totalDays;
    // No team tracking in generic version — default to 1
    const currentWorkers = 1;
    let projectedWorkers = currentWorkers;
    let projectedRiskScore = currentRiskScore;

    if (params.budgetChangePct !== undefined) {
      projectedBudget = budgetAllocated * (1 + params.budgetChangePct / 100);
    }
    if (params.daysExtension !== undefined) {
      projectedDays = totalDays + params.daysExtension;
    }
    if (params.workerChange !== undefined) {
      projectedWorkers = Math.max(1, projectedWorkers + params.workerChange);
    }
    if (params.scopeChangePct !== undefined) {
      // More scope = more risk, more budget need
      projectedBudget *= (1 + Math.abs(params.scopeChangePct) / 200);
      projectedRiskScore = Math.min(100, currentRiskScore + Math.abs(params.scopeChangePct) * 0.3);
    }

    // Budget change adjusts risk
    if (params.budgetChangePct !== undefined && params.budgetChangePct < 0) {
      projectedRiskScore = Math.min(100, currentRiskScore + Math.abs(params.budgetChangePct) * 0.5);
    } else if (params.budgetChangePct !== undefined && params.budgetChangePct > 0) {
      projectedRiskScore = Math.max(0, currentRiskScore - params.budgetChangePct * 0.2);
    }

    // Timeline extension reduces risk, contraction increases
    if (params.daysExtension !== undefined && params.daysExtension > 0) {
      projectedRiskScore = Math.max(0, projectedRiskScore - params.daysExtension * 0.3);
    } else if (params.daysExtension !== undefined && params.daysExtension < 0) {
      projectedRiskScore = Math.min(100, projectedRiskScore + Math.abs(params.daysExtension) * 0.5);
    }

    projectedRiskScore = Math.round(projectedRiskScore);

    const budgetChangePct = budgetAllocated > 0
      ? parseFloat(((projectedBudget - budgetAllocated) / budgetAllocated * 100).toFixed(1))
      : 0;
    const scheduleChangePct = totalDays > 0
      ? parseFloat(((projectedDays - totalDays) / totalDays * 100).toFixed(1))
      : 0;

    // Collect non-completed tasks for affected tasks list
    const allTasks = context.schedules.flatMap(s => s.tasks);
    const activeTasks = allTasks.filter(t => t.status !== 'completed');

    const fallbackResult: AIScenarioResult = {
      scheduleImpact: {
        originalDays: totalDays,
        projectedDays,
        changePct: scheduleChangePct,
        explanation: scheduleChangePct !== 0
          ? `Timeline changes by ${scheduleChangePct > 0 ? '+' : ''}${scheduleChangePct}% (${totalDays} \u2192 ${projectedDays} days).`
          : 'No direct schedule impact from the proposed change.',
      },
      budgetImpact: {
        originalBudget: budgetAllocated,
        projectedBudget: Math.round(projectedBudget),
        changePct: budgetChangePct,
        explanation: budgetChangePct !== 0
          ? `Budget changes by ${budgetChangePct > 0 ? '+' : ''}${budgetChangePct}% ($${budgetAllocated.toLocaleString()} \u2192 $${Math.round(projectedBudget).toLocaleString()}).`
          : 'No direct budget impact from the proposed change.',
      },
      resourceImpact: {
        currentWorkers,
        projectedWorkers,
        explanation: projectedWorkers !== currentWorkers
          ? `Team size changes from ${currentWorkers} to ${projectedWorkers}.`
          : 'No direct resource impact from the proposed change.',
      },
      riskImpact: {
        currentRiskScore,
        projectedRiskScore,
        newRisks: this.inferNewRisks(params),
        explanation: `Risk score moves from ${currentRiskScore} to ${projectedRiskScore}.`,
      },
      affectedTasks: activeTasks
        .slice(0, 5)
        .map(t => ({
          taskName: t.name,
          impact: 'May be affected by the proposed change.',
          severity: 'medium' as const,
        })),
      recommendations: this.buildRecommendations(params, budgetChangePct, scheduleChangePct),
      confidence: 0.3,
    };

    if (!claudeService.isAvailable()) {
      return { result: fallbackResult, aiPowered: false };
    }

    // Claude enhancement
    try {
      const projectPrompt = this.contextBuilder.toPromptString(context);
      const evmStr = Object.entries(evm).map(([k, v]) => `${k}: ${v}`).join('\n');

      const systemPrompt = scenarioPrompt.render({
        projectData: projectPrompt,
        evmMetrics: evmStr,
        scenario: request.scenario,
        parameters: JSON.stringify(params),
        baselineImpact: JSON.stringify({
          scheduleChangePct,
          budgetChangePct,
          projectedRiskScore,
          projectedWorkers,
        }),
      });

      const result = await claudeService.completeWithJsonSchema({
        systemPrompt,
        userMessage: `Model this scenario: "${request.scenario}". Return the impact analysis JSON.`,
        schema: AIScenarioResultSchema,
        temperature: 0.4,
      });

      logAIUsage(this.fastify, {
        userId,
        feature: 'what_if_scenario',
        model: 'claude',
        usage: result.usage,
        latencyMs: result.latencyMs,
        success: true,
        requestContext: { projectId: request.projectId },
      });

      return { result: result.data, aiPowered: true };
    } catch (err) {
      this.fastify.log.warn({ err }, 'AI scenario modeling failed, using deterministic fallback');
      return { result: fallbackResult, aiPowered: false };
    }
  }

  private inferNewRisks(params: AIScenarioRequest['parameters']): string[] {
    const risks: string[] = [];
    if (!params) return risks;
    if (params.budgetChangePct !== undefined && params.budgetChangePct < -10) {
      risks.push('Budget reduction may force scope cuts or quality compromises.');
    }
    if (params.workerChange !== undefined && params.workerChange < 0) {
      risks.push('Reduced workforce increases schedule pressure on remaining team.');
    }
    if (params.daysExtension !== undefined && params.daysExtension < 0) {
      risks.push('Compressed timeline increases risk of quality issues and burnout.');
    }
    if (params.scopeChangePct !== undefined && params.scopeChangePct > 10) {
      risks.push('Scope increase without proportional budget/time increase creates delivery risk.');
    }
    return risks;
  }

  private buildRecommendations(
    params: AIScenarioRequest['parameters'],
    budgetChangePct: number,
    scheduleChangePct: number,
  ): string[] {
    const recs: string[] = [];
    if (!params) {
      recs.push('No numeric parameters provided. Consider adding budget, timeline, or resource changes for quantitative analysis.');
      return recs;
    }
    if (budgetChangePct < -15) {
      recs.push('Significant budget reduction. Prioritize critical path tasks and consider phased delivery.');
    }
    if (scheduleChangePct < -10) {
      recs.push('Timeline compression detected. Identify parallelizable tasks and consider adding resources.');
    }
    if (scheduleChangePct > 20) {
      recs.push('Extended timeline provides buffer. Use this to improve quality and address backlog.');
    }
    if (recs.length === 0) {
      recs.push('The proposed changes appear manageable. Monitor key metrics closely during implementation.');
    }
    return recs;
  }
}
