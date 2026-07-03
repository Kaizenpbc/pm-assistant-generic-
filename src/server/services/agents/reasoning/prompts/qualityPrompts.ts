import type { Project } from '../../../ProjectService';
import type { Task } from '../../../ScheduleService';
import type { ScopeAnalysisInput, HygieneAnalysisInput, LessonsExtractionInput } from '../types';

// ---------------------------------------------------------------------------
// Scope Analysis Prompts
// ---------------------------------------------------------------------------

export function getScopeSystemPrompt(): string {
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

export function buildScopePrompt(
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

// ---------------------------------------------------------------------------
// Hygiene Analysis Prompts
// ---------------------------------------------------------------------------

export function getHygieneSystemPrompt(): string {
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

export function buildHygienePrompt(
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

// ---------------------------------------------------------------------------
// Lessons Extraction Prompts
// ---------------------------------------------------------------------------

export function getLessonsSystemPrompt(): string {
  return `You are an expert project management retrospective facilitator. Your role is to extract actionable lessons learned from project data to improve future project execution.

You must respond with valid JSON matching the requested schema. Be specific, actionable, and forward-looking.

Your response must include:
1. hasLessons: Whether there are valuable lessons to extract (true/false)
2. reasoning: Your analysis chain-of-thought
3. lessons: Array of structured lessons, each with category, title, description, impact (low/medium/high), and recommendation
4. modelCertainty: Your confidence (0-100)

Lesson categories should be: scheduling, budgeting, resource_management, risk_management, scope_management, communication, quality, process`;
}

export function buildLessonsPrompt(pd: LessonsExtractionInput['projectData']): string {
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
