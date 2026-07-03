import type { Project } from '../../../ProjectService';
import type { Task, Schedule } from '../../../ScheduleService';
import type { ResourceWorkload } from '../../../ResourceService';
import type { CriticalPathResult } from '../../../CriticalPathService';
import type { DelayContext, DependencyAnalysisInput, PredictiveAlertInput } from '../types';

// ---------------------------------------------------------------------------
// Schedule Recovery Prompts
// ---------------------------------------------------------------------------

interface ScheduleContext {
  project: Project;
  schedule: Schedule;
  tasks: Task[];
  criticalPath: CriticalPathResult;
  workload: ResourceWorkload[];
}

export function getRecoverySystemPrompt(): string {
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

export function buildRecoveryPrompt(ctx: ScheduleContext, delays: DelayContext[]): string {
  const project = ctx.project;
  const schedule = ctx.schedule;

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

// ---------------------------------------------------------------------------
// Dependency Analysis Prompts
// ---------------------------------------------------------------------------

export function getDependencySystemPrompt(): string {
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

export function buildDependencyPrompt(
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

// ---------------------------------------------------------------------------
// Predictive Alert Prompts
// ---------------------------------------------------------------------------

export function getPredictiveSystemPrompt(): string {
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

export function buildPredictivePrompt(
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
