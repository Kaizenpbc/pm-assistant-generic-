import type { PortfolioAnalysisInput, RiskEscalationInput, StakeholderReportInput } from '../types';

// ---------------------------------------------------------------------------
// Portfolio Analysis Prompts
// ---------------------------------------------------------------------------

export function getPortfolioSystemPrompt(): string {
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

export function buildPortfolioPrompt(
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

// ---------------------------------------------------------------------------
// Risk Escalation Prompts
// ---------------------------------------------------------------------------

export function getRiskEscalationSystemPrompt(): string {
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

export function buildRiskEscalationPrompt(
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

// ---------------------------------------------------------------------------
// Stakeholder Report Prompts
// ---------------------------------------------------------------------------

export function getStakeholderSystemPrompt(): string {
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

export function buildStakeholderPrompt(
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
