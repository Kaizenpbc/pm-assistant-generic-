import type { Project } from '../../../ProjectService';
import type { Task } from '../../../ScheduleService';
import type { BudgetAnalysisInput, ResourceAnalysisInput } from '../types';

// ---------------------------------------------------------------------------
// Budget Analysis Prompts
// ---------------------------------------------------------------------------

export function getBudgetSystemPrompt(): string {
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

export function buildBudgetPrompt(
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

// ---------------------------------------------------------------------------
// Resource Analysis Prompts
// ---------------------------------------------------------------------------

export function getResourceSystemPrompt(): string {
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

export function buildResourcePrompt(
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
