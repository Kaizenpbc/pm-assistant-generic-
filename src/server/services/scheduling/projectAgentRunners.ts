import { AgentActivityLogService } from '../AgentActivityLogService';
import { budgetIntelligenceAgent } from '../agents/BudgetIntelligenceAgent';
import { resourceOptimizationAgent } from '../agents/ResourceOptimizationAgent';
import { stakeholderCommunicationAgent } from '../agents/StakeholderCommunicationAgent';
import { projectHygieneAgent } from '../agents/ProjectHygieneAgent';
import { dependencyRiskAgent } from '../agents/DependencyRiskAgent';
import { lessonsLearnedAgent } from '../agents/LessonsLearnedAgent';
import { predictiveAlertingAgent } from '../agents/PredictiveAlertingAgent';
import type { Project } from '../ProjectService';

// ---------------------------------------------------------------------------
// Agent 6 — Budget Intelligence
// ---------------------------------------------------------------------------

export async function runBudgetIntelligenceAgent(
  project: Project,
  activityLog: AgentActivityLogService,
): Promise<number> {
  if (!project.budgetAllocated) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'budget_intelligence',
      result: 'skipped',
      summary: 'No budget allocated for this project',
    });
    return 0;
  }

  const notifyUserId = project.projectManagerId || project.createdBy;

  const result = await budgetIntelligenceAgent.run({
    projectId: project.id,
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'budget_intelligence',
      result: 'skipped',
      summary: result.skipReason || 'No significant budget issues',
      details: result.indicators ? { CPI: result.indicators.CPI, SPI: result.indicators.SPI, VAC: result.indicators.VAC } : undefined,
    });
    return 0;
  }

  console.log(`[Agent:BudgetIntelligence] Proposal created for "${project.name}"`);

  await activityLog.log({
    projectId: project.id,
    agentName: 'budget_intelligence',
    result: 'alert_created',
    summary: `Budget issue detected — proposal created (CPI: ${result.indicators?.CPI?.toFixed(2)}, VAC: $${result.indicators?.VAC?.toFixed(0)})`,
    details: result.indicators ? { CPI: result.indicators.CPI, SPI: result.indicators.SPI, VAC: result.indicators.VAC, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Agent 7 — Resource Optimization
// ---------------------------------------------------------------------------

export async function runResourceOptimizationAgent(
  project: Project,
  activityLog: AgentActivityLogService,
): Promise<number> {
  const notifyUserId = project.projectManagerId || project.createdBy;

  const result = await resourceOptimizationAgent.run({
    projectId: project.id,
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'resource_optimization',
      result: 'skipped',
      summary: result.skipReason || 'No significant resource imbalances',
      details: result.indicators ? { totalResources: result.indicators.totalResources, overAllocated: result.indicators.overAllocatedResources.length, underUtilized: result.indicators.underUtilizedResources.length } : undefined,
    });
    return 0;
  }

  console.log(`[Agent:ResourceOptimization] Proposal created for "${project.name}"`);

  await activityLog.log({
    projectId: project.id,
    agentName: 'resource_optimization',
    result: 'alert_created',
    summary: `Resource imbalance detected — proposal created (${result.indicators?.overAllocatedResources.length} over-allocated, ${result.indicators?.underUtilizedResources.length} under-utilized)`,
    details: result.indicators ? { totalResources: result.indicators.totalResources, overAllocated: result.indicators.overAllocatedResources.length, underUtilized: result.indicators.underUtilizedResources.length, bottleneckRoles: result.indicators.bottleneckRoles, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Agent 10 — Stakeholder Communication
// ---------------------------------------------------------------------------

export async function runStakeholderCommunicationAgent(
  project: Project,
  activityLog: AgentActivityLogService,
): Promise<number> {
  const notifyUserId = project.projectManagerId || project.createdBy;

  const result = await stakeholderCommunicationAgent.run({
    projectId: project.id,
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'stakeholder_communication',
      result: 'skipped',
      summary: result.skipReason || 'No stakeholder report generated',
      details: result.snapshot ? { totalTasks: result.snapshot.totalTasks, completionRate: result.snapshot.completionRate } : undefined,
    });
    return 0;
  }

  console.log(`[Agent:StakeholderCommunication] Report created for "${project.name}" — status: ${result.analysis?.overallStatus}`);

  await activityLog.log({
    projectId: project.id,
    agentName: 'stakeholder_communication',
    result: 'alert_created',
    summary: `Stakeholder report created — ${result.analysis?.overallStatus}, ${result.analysis?.keyHighlights.length} highlight(s), ${result.analysis?.risksAndConcerns.length} risk(s)`,
    details: result.snapshot ? { totalTasks: result.snapshot.totalTasks, completionRate: result.snapshot.completionRate, overdueTasks: result.snapshot.overdueTasks, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Agent 11 — Project Hygiene
// ---------------------------------------------------------------------------

export async function runProjectHygieneAgent(
  project: Project,
  activityLog: AgentActivityLogService,
): Promise<number> {
  const notifyUserId = project.projectManagerId || project.createdBy;

  const result = await projectHygieneAgent.run({
    projectId: project.id,
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'project_hygiene',
      result: 'skipped',
      summary: result.skipReason || 'No significant hygiene issues',
      details: result.indicators ? { staleTasks: result.indicators.staleTasks.length, missingDates: result.indicators.missingDateTasks.length, abandonedSprints: result.indicators.abandonedSprints.length, zeroProgress: result.indicators.zeroProgressTasks.length } : undefined,
    });
    return 0;
  }

  console.log(`[Agent:ProjectHygiene] Proposal created for "${project.name}"`);

  await activityLog.log({
    projectId: project.id,
    agentName: 'project_hygiene',
    result: 'alert_created',
    summary: `Hygiene issues detected — ${result.indicators?.staleTasks.length} stale, ${result.indicators?.missingDateTasks.length} missing dates, ${result.indicators?.abandonedSprints.length} abandoned sprints`,
    details: result.indicators ? { staleTasks: result.indicators.staleTasks.length, missingDates: result.indicators.missingDateTasks.length, unassigned: result.indicators.unassignedTasks.length, missingEstimates: result.indicators.missingEstimateTasks.length, abandonedSprints: result.indicators.abandonedSprints.length, zeroProgress: result.indicators.zeroProgressTasks.length, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Agent 12 — Dependency Risk
// ---------------------------------------------------------------------------

export async function runDependencyRiskAgent(
  project: Project,
  activityLog: AgentActivityLogService,
): Promise<number> {
  const notifyUserId = project.projectManagerId || project.createdBy;

  const result = await dependencyRiskAgent.run({
    projectId: project.id,
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'dependency_risk',
      result: 'skipped',
      summary: result.skipReason || 'No significant dependency risks',
      details: result.indicators ? { blockedChains: result.indicators.blockedChains.length, bottlenecks: result.indicators.bottleneckTasks.length, longChains: result.indicators.longChains.length } : undefined,
    });
    return 0;
  }

  console.log(`[Agent:DependencyRisk] Proposal created for "${project.name}"`);

  await activityLog.log({
    projectId: project.id,
    agentName: 'dependency_risk',
    result: 'alert_created',
    summary: `Dependency risks detected — ${result.indicators?.blockedChains.length} blocked chain(s), ${result.indicators?.bottleneckTasks.length} bottleneck(s), ${result.indicators?.longChains.length} long chain(s)`,
    details: result.indicators ? { blockedChains: result.indicators.blockedChains.length, bottlenecks: result.indicators.bottleneckTasks.length, longChains: result.indicators.longChains.length, totalDeps: result.indicators.totalDependencies, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Agent 13 — Lessons Learned
// ---------------------------------------------------------------------------

export async function runLessonsLearnedAgent(
  project: Project,
  activityLog: AgentActivityLogService,
): Promise<number> {
  const notifyUserId = project.projectManagerId || project.createdBy;

  const result = await lessonsLearnedAgent.run({
    projectId: project.id,
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'lessons_learned',
      result: 'skipped',
      summary: result.skipReason || 'No lessons extracted',
    });
    return 0;
  }

  console.log(`[Agent:LessonsLearned] ${result.lessonsExtracted} lesson(s) extracted for "${project.name}"`);

  await activityLog.log({
    projectId: project.id,
    agentName: 'lessons_learned',
    result: 'alert_created',
    summary: `${result.lessonsExtracted} lesson(s) extracted and stored`,
    details: { lessonsExtracted: result.lessonsExtracted, proposalId: result.proposal?.id },
  });

  return result.lessonsExtracted;
}

// ---------------------------------------------------------------------------
// Agent 14 — Predictive Alerting
// ---------------------------------------------------------------------------

export async function runPredictiveAlertingAgent(
  project: Project,
  activityLog: AgentActivityLogService,
): Promise<number> {
  const notifyUserId = project.projectManagerId || project.createdBy;

  const result = await predictiveAlertingAgent.run({
    projectId: project.id,
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: project.id,
      agentName: 'predictive_alerting',
      result: 'skipped',
      summary: result.skipReason || 'No predictive warnings',
      details: result.indicators ? { velocityDecline: result.indicators.velocityTrend?.declinePercent ?? 0, behindSchedule: result.indicators.progressTrajectory.behindPercent, riskAccumulation: result.indicators.riskAccumulation } : undefined,
    });
    return 0;
  }

  console.log(`[Agent:PredictiveAlerting] Warning created for "${project.name}" — severity: ${result.analysis?.severity}`);

  await activityLog.log({
    projectId: project.id,
    agentName: 'predictive_alerting',
    result: 'alert_created',
    summary: `Predictive warning — velocity decline ${result.indicators?.velocityTrend?.declinePercent ?? 0}%, behind schedule ${result.indicators?.progressTrajectory.behindPercent}%, ${result.indicators?.riskAccumulation} risk flags`,
    details: result.indicators ? { velocityDecline: result.indicators.velocityTrend?.declinePercent ?? 0, behindSchedule: result.indicators.progressTrajectory.behindPercent, riskAccumulation: result.indicators.riskAccumulation, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}
