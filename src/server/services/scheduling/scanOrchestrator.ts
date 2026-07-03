import { config } from '../../config';
import { agentRegistry } from '../AgentRegistryService';
import '../agentCapabilities';
import { notificationService } from '../NotificationService';
import { projectService } from '../ProjectService';
import { scheduleService } from '../ScheduleService';
import { AgentActivityLogService } from '../AgentActivityLogService';
import { webhookService } from '../WebhookService';
import { killSwitchService } from '../agents/KillSwitchService';
import { ProjectAgentResults } from '../agents/RiskEscalationAgent';
import {
  runBudgetBurnRateAgent,
  runMonteCarloConfidenceAgent,
  runMeetingFollowUpAgent,
  runScopeCreepAgent,
} from './registryAgentRunners';
import {
  runBudgetIntelligenceAgent,
  runResourceOptimizationAgent,
  runStakeholderCommunicationAgent,
  runProjectHygieneAgent,
  runDependencyRiskAgent,
  runLessonsLearnedAgent,
  runPredictiveAlertingAgent,
} from './projectAgentRunners';
import {
  runCrossProjectIntelligenceAgent,
  runRiskEscalationAgent,
} from './portfolioAgentRunners';

export interface ScanStats {
  projectsScanned: number;
  schedulesScanned: number;
  delaysDetected: number;
  proposalsGenerated: number;
  notificationsSent: number;
  budgetAlertsCreated: number;
  mcAlertsCreated: number;
  meetingAlertsCreated: number;
  scopeCreepAlertsCreated: number;
  budgetProposalsCreated: number;
  resourceProposalsCreated: number;
  portfolioProposalsCreated: number;
  riskEscalationsCreated: number;
  stakeholderReportsCreated: number;
  hygieneAlertsCreated: number;
  dependencyRiskAlertsCreated: number;
  lessonsExtracted: number;
  predictiveAlertsCreated: number;
}

function emptyStats(): ScanStats {
  return {
    projectsScanned: 0, schedulesScanned: 0, delaysDetected: 0,
    proposalsGenerated: 0, notificationsSent: 0, budgetAlertsCreated: 0,
    mcAlertsCreated: 0, meetingAlertsCreated: 0, scopeCreepAlertsCreated: 0,
    budgetProposalsCreated: 0, resourceProposalsCreated: 0, portfolioProposalsCreated: 0,
    riskEscalationsCreated: 0, stakeholderReportsCreated: 0,
    hygieneAlertsCreated: 0, dependencyRiskAlertsCreated: 0, lessonsExtracted: 0,
    predictiveAlertsCreated: 0,
  };
}

export async function runScanImpl(activityLog: AgentActivityLogService): Promise<ScanStats> {
  console.log('[Agent] Starting scan...');

  const ksStatus = killSwitchService.getStatus();
  if (!ksStatus.globalEnabled) {
    console.log('[Agent] Scan aborted — global kill switch is active');
    return emptyStats();
  }

  const stats = emptyStats();
  const projectAgentFlags = new Map<string, { name: string; flags: ProjectAgentResults['agentFlags']; details: Record<string, string> }>();
  const thresholdDays = config.AGENT_DELAY_THRESHOLD_DAYS;

  const allProjects = await projectService.findAll();
  const projects = allProjects.filter(
    (p) => p.status === 'active' || p.status === 'planning',
  );

  console.log(`[Agent] Found ${projects.length} active/planning projects`);

  for (const project of projects) {
    stats.projectsScanned++;

    projectAgentFlags.set(project.id, {
      name: project.name,
      flags: { scheduleDelay: false, budgetOverrun: false, scopeCreep: false, resourceBottleneck: false, meetingOverdue: false },
      details: {},
    });

    const schedules = await scheduleService.findByProjectId(project.id);

    // --- Agent 1: Auto-Reschedule ---
    for (const schedule of schedules) {
      stats.schedulesScanned++;

      try {
        const ctx = { actorId: 'system' as const, actorType: 'system' as const, source: 'system' as const, projectId: project.id };
        const result = await agentRegistry.invoke('auto-reschedule-v1', { scheduleId: schedule.id, thresholdDays }, ctx);

        if (!result.success) {
          throw new Error(result.error || 'Auto-reschedule agent failed');
        }

        const { delays: significant, proposal } = result.output;
        stats.delaysDetected += significant.length;

        if (significant.length === 0) {
          await activityLog.log({
            projectId: project.id,
            agentName: 'auto_reschedule',
            result: 'skipped',
            summary: `No significant delays in "${schedule.name}" (threshold: ${thresholdDays}d)`,
            details: { scheduleId: schedule.id, scheduleName: schedule.name, thresholdDays },
          });
          continue;
        }

        console.log(
          `[Agent] ${project.name} / ${schedule.name}: ${significant.length} significant delay(s)`,
        );

        stats.proposalsGenerated++;

        const pFlags = projectAgentFlags.get(project.id);
        if (pFlags) {
          pFlags.flags.scheduleDelay = true;
          pFlags.details.scheduleDelay = `${significant.length} delay(s) in "${schedule.name}"`;
        }

        const notifyUserId = project.projectManagerId || project.createdBy;

        await notificationService.create({
          userId: notifyUserId,
          type: 'reschedule_proposal',
          severity: significant.some((d: any) => d.severity === 'critical')
            ? 'critical'
            : significant.some((d: any) => d.severity === 'high')
              ? 'high'
              : 'medium',
          title: `Auto-Reschedule: ${significant.length} delay(s) in "${schedule.name}"`,
          message: `${proposal.proposedChanges.length} date change(s) proposed. Impact: ${proposal.estimatedImpact.daysChange} day(s). Review the proposal to approve or reject.`,
          projectId: project.id,
          scheduleId: schedule.id,
          linkType: 'proposal',
          linkId: proposal.id,
        });
        stats.notificationsSent++;

        await activityLog.log({
          projectId: project.id,
          agentName: 'auto_reschedule',
          result: 'alert_created',
          summary: `${significant.length} significant delay(s) in "${schedule.name}". ${proposal.proposedChanges.length} change(s) proposed.`,
          details: { scheduleId: schedule.id, scheduleName: schedule.name, significantDelays: significant.length, proposedChanges: proposal.proposedChanges.length, daysImpact: proposal.estimatedImpact.daysChange },
        });
      } catch (error) {
        console.error(
          `[Agent] Error processing schedule ${schedule.id} (${schedule.name}):`,
          error,
        );
        await activityLog.log({
          projectId: project.id,
          agentName: 'auto_reschedule',
          result: 'error',
          summary: `Error processing schedule "${schedule.name}": ${error instanceof Error ? error.message : String(error)}`,
          details: { scheduleId: schedule.id, scheduleName: schedule.name },
        }).catch(() => {});
      }
    }

    // --- Agent 2: Budget Burn-Rate ---
    try {
      const budgetAlerts = await runBudgetBurnRateAgent(project, activityLog);
      stats.budgetAlertsCreated += budgetAlerts;
      if (budgetAlerts > 0) {
        const pFlags = projectAgentFlags.get(project.id);
        if (pFlags) { pFlags.flags.budgetOverrun = true; pFlags.details.budgetBurnRate = 'Budget alert triggered'; }
      }
    } catch (error) {
      console.error(`[Agent:Budget] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'budget',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 3: Monte Carlo Confidence ---
    try {
      const mcAlerts = await runMonteCarloConfidenceAgent(project, schedules, activityLog);
      stats.mcAlertsCreated += mcAlerts;
    } catch (error) {
      console.error(`[Agent:MonteCarlo] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'monte_carlo',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 4: Meeting Follow-Up ---
    try {
      const meetingAlerts = await runMeetingFollowUpAgent(project, activityLog);
      stats.meetingAlertsCreated += meetingAlerts;
      if (meetingAlerts > 0) {
        const pFlags = projectAgentFlags.get(project.id);
        if (pFlags) { pFlags.flags.meetingOverdue = true; pFlags.details.meetingOverdue = `${meetingAlerts} meeting alert(s)`; }
      }
    } catch (error) {
      console.error(`[Agent:Meeting] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'meeting',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 5: Scope Creep Detection ---
    try {
      const scopeAlerts = await runScopeCreepAgent(project, activityLog);
      stats.scopeCreepAlertsCreated += scopeAlerts;
      if (scopeAlerts > 0) {
        const pFlags = projectAgentFlags.get(project.id);
        if (pFlags) { pFlags.flags.scopeCreep = true; pFlags.details.scopeCreep = 'Scope creep detected'; }
      }
    } catch (error) {
      console.error(`[Agent:ScopeCreep] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'scope_creep',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 6: Budget Intelligence ---
    try {
      const budgetProposals = await runBudgetIntelligenceAgent(project, activityLog);
      stats.budgetProposalsCreated += budgetProposals;
      if (budgetProposals > 0) {
        const pFlags = projectAgentFlags.get(project.id);
        if (pFlags) { pFlags.flags.budgetOverrun = true; pFlags.details.budgetIntelligence = 'Budget intelligence proposal created'; }
      }
    } catch (error) {
      console.error(`[Agent:BudgetIntelligence] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'budget_intelligence',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 7: Resource Optimization ---
    try {
      const resourceProposals = await runResourceOptimizationAgent(project, activityLog);
      stats.resourceProposalsCreated += resourceProposals;
      if (resourceProposals > 0) {
        const pFlags = projectAgentFlags.get(project.id);
        if (pFlags) { pFlags.flags.resourceBottleneck = true; pFlags.details.resourceOptimization = 'Resource optimization proposal created'; }
      }
    } catch (error) {
      console.error(`[Agent:ResourceOptimization] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'resource_optimization',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 10: Stakeholder Communication ---
    try {
      const stakeholderReports = await runStakeholderCommunicationAgent(project, activityLog);
      stats.stakeholderReportsCreated += stakeholderReports;
    } catch (error) {
      console.error(`[Agent:StakeholderCommunication] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'stakeholder_communication',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 11: Project Hygiene ---
    try {
      const hygieneAlerts = await runProjectHygieneAgent(project, activityLog);
      stats.hygieneAlertsCreated += hygieneAlerts;
    } catch (error) {
      console.error(`[Agent:ProjectHygiene] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'project_hygiene',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 12: Dependency Risk ---
    try {
      const dependencyAlerts = await runDependencyRiskAgent(project, activityLog);
      stats.dependencyRiskAlertsCreated += dependencyAlerts;
    } catch (error) {
      console.error(`[Agent:DependencyRisk] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'dependency_risk',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 13: Lessons Learned ---
    try {
      const lessons = await runLessonsLearnedAgent(project, activityLog);
      stats.lessonsExtracted += lessons;
    } catch (error) {
      console.error(`[Agent:LessonsLearned] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'lessons_learned',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }

    // --- Agent 14: Predictive Alerting ---
    try {
      const predictiveAlerts = await runPredictiveAlertingAgent(project, activityLog);
      stats.predictiveAlertsCreated += predictiveAlerts;
    } catch (error) {
      console.error(`[Agent:PredictiveAlerting] Error for project ${project.id} (${project.name}):`, error);
      await activityLog.log({
        projectId: project.id,
        agentName: 'predictive_alerting',
        result: 'error',
        summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => {});
    }
  }

  // --- Agent 8: Cross-Project Intelligence (portfolio-level) ---
  try {
    const portfolioProposals = await runCrossProjectIntelligenceAgent(projects, activityLog);
    stats.portfolioProposalsCreated += portfolioProposals;
  } catch (error) {
    console.error('[Agent:CrossProjectIntelligence] Error:', error);
    await activityLog.log({
      projectId: 'portfolio',
      agentName: 'cross_project_intelligence',
      result: 'error',
      summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
    }).catch(() => {});
  }

  // --- Agent 9: Risk Escalation (runs last) ---
  try {
    const riskEscalations = await runRiskEscalationAgent(projects, projectAgentFlags, activityLog);
    stats.riskEscalationsCreated += riskEscalations;
  } catch (error) {
    console.error('[Agent:RiskEscalation] Error:', error);
    await activityLog.log({
      projectId: 'portfolio',
      agentName: 'risk_escalation',
      result: 'error',
      summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
    }).catch(() => {});
  }

  console.log('[Agent] Scan complete:', stats);
  webhookService.dispatch('agent.scan_completed', { stats }, undefined);
  return stats;
}
