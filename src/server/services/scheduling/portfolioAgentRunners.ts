import { AgentActivityLogService } from '../AgentActivityLogService';
import { crossProjectIntelligenceAgent } from '../agents/CrossProjectIntelligenceAgent';
import { riskEscalationAgent, ProjectAgentResults } from '../agents/RiskEscalationAgent';
import type { Project } from '../ProjectService';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Agent 8 — Cross-Project Intelligence (portfolio-level)
// ---------------------------------------------------------------------------

export async function runCrossProjectIntelligenceAgent(
  projects: Project[],
  activityLog: AgentActivityLogService,
): Promise<number> {
  if (projects.length < 2) {
    await activityLog.log({
      projectId: 'portfolio',
      agentName: 'cross_project_intelligence',
      result: 'skipped',
      summary: `Only ${projects.length} active project(s) — cross-project analysis requires at least 2`,
    });
    return 0;
  }

  const notifyUserId = projects[0].projectManagerId || projects[0].createdBy;

  const result = await crossProjectIntelligenceAgent.run({
    userId: notifyUserId,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: 'portfolio',
      agentName: 'cross_project_intelligence',
      result: 'skipped',
      summary: result.skipReason || 'No significant cross-project patterns',
      details: result.indicators ? { totalProjects: result.indicators.totalProjects, activeProjects: result.indicators.activeProjects, atRisk: result.indicators.atRiskProjects.length, budgetDeficit: result.indicators.budgetDeficitProjects.length } : undefined,
    });
    return 0;
  }

  logger.info(`[Agent:CrossProjectIntelligence] Portfolio proposal created (${result.indicators?.atRiskProjects.length} at-risk, ${result.indicators?.budgetDeficitProjects.length} budget deficit)`);

  await activityLog.log({
    projectId: 'portfolio',
    agentName: 'cross_project_intelligence',
    result: 'alert_created',
    summary: `Portfolio intelligence — ${result.indicators?.atRiskProjects.length} at-risk, ${result.indicators?.budgetDeficitProjects.length} budget deficit, proposal created`,
    details: result.indicators ? { totalProjects: result.indicators.totalProjects, activeProjects: result.indicators.activeProjects, atRisk: result.indicators.atRiskProjects.length, budgetDeficit: result.indicators.budgetDeficitProjects.length, commonRisks: result.indicators.commonRisks, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Agent 9 — Risk Escalation (runs last)
// ---------------------------------------------------------------------------

export async function runRiskEscalationAgent(
  projects: Project[],
  projectAgentFlags: Map<string, { name: string; flags: ProjectAgentResults['agentFlags']; details: Record<string, string> }>,
  activityLog: AgentActivityLogService,
): Promise<number> {
  const projectResults: ProjectAgentResults[] = [];
  for (const [projectId, data] of projectAgentFlags) {
    const hasAnyFlag = Object.values(data.flags).some(Boolean);
    if (hasAnyFlag) {
      projectResults.push({
        projectId,
        projectName: data.name,
        agentFlags: data.flags,
        details: data.details,
      });
    }
  }

  if (projectResults.length === 0) {
    await activityLog.log({
      projectId: 'portfolio',
      agentName: 'risk_escalation',
      result: 'skipped',
      summary: 'No projects flagged by any agent in this scan cycle',
    });
    return 0;
  }

  const notifyUserId = projects[0].projectManagerId || projects[0].createdBy;

  const result = await riskEscalationAgent.run({
    userId: notifyUserId,
    projectResults,
  });

  if (result.skipped) {
    await activityLog.log({
      projectId: 'portfolio',
      agentName: 'risk_escalation',
      result: 'skipped',
      summary: result.skipReason || 'No compound risks detected',
      details: result.indicators ? { totalProjects: result.indicators.totalProjects, compoundRiskProjects: result.indicators.compoundRiskProjects.length, maxFlags: result.indicators.maxFlagsOnSingleProject } : undefined,
    });
    return 0;
  }

  logger.info(`[Agent:RiskEscalation] Escalation proposal created (${result.indicators?.compoundRiskProjects.length} compound risk project(s))`);

  await activityLog.log({
    projectId: 'portfolio',
    agentName: 'risk_escalation',
    result: 'alert_created',
    summary: `Compound risks escalated — ${result.indicators?.compoundRiskProjects.length} project(s) with multiple agent flags`,
    details: result.indicators ? { totalProjects: result.indicators.totalProjects, compoundRiskProjects: result.indicators.compoundRiskProjects.length, maxFlags: result.indicators.maxFlagsOnSingleProject, flagDistribution: result.indicators.flagDistribution, proposalId: result.proposal?.id } : undefined,
  });

  return 1;
}
