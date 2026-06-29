import { z } from 'zod';
import { agentRegistry } from './AgentRegistryService';
import { autoRescheduleService } from './AutoRescheduleService';
import { evmForecastService } from './EVMForecastService';
import { monteCarloService } from './MonteCarloService';
import { meetingIntelligenceService } from './MeetingIntelligenceService';
import { lessonsLearnedService } from './LessonsLearnedService';
import { ragService } from './RagService';
import { scheduleRecoveryAgent } from './agents/ScheduleRecoveryAgent';
import { scopeCreepAgent } from './agents/ScopeCreepAgent';
import { budgetIntelligenceAgent } from './agents/BudgetIntelligenceAgent';
import { resourceOptimizationAgent } from './agents/ResourceOptimizationAgent';
import { crossProjectIntelligenceAgent } from './agents/CrossProjectIntelligenceAgent';
import { riskEscalationAgent } from './agents/RiskEscalationAgent';

// Register RAG agent capability (side-effect import)
import './ragAgentCapability';

// --- Auto-Reschedule Agent ---
agentRegistry.register({
  id: 'auto-reschedule-v1',
  capability: 'schedule.optimize',
  version: '1.0.0',
  description: 'Detects schedule delays and generates reschedule proposals',
  inputSchema: z.object({
    scheduleId: z.string(),
    thresholdDays: z.number().optional(),
  }),
  outputSchema: z.object({
    delays: z.any(),
    proposal: z.any().optional(),
  }),
  permissions: ['agent:schedule'],
  timeoutMs: 120000,
  handler: async (input: { scheduleId: string; thresholdDays?: number }) => {
    const delays = await autoRescheduleService.detectDelays(input.scheduleId);
    const thresholdDays = input.thresholdDays ?? 3;
    const significant = delays.filter(
      (d: any) => d.delayDays >= thresholdDays || d.isOnCriticalPath,
    );
    if (significant.length === 0) {
      return { delays: significant };
    }
    const proposal = await autoRescheduleService.generateProposal(input.scheduleId, undefined, 'agent');
    return { delays: significant, proposal };
  },
});

// --- Budget Forecast Agent ---
agentRegistry.register({
  id: 'budget-forecast-v1',
  capability: 'budget.forecast',
  version: '1.0.0',
  description: 'Generates EVM budget forecast for a project',
  inputSchema: z.object({
    projectId: z.string(),
  }),
  outputSchema: z.object({
    forecast: z.any(),
  }),
  permissions: ['agent:budget'],
  timeoutMs: 90000,
  handler: async (input: { projectId: string }) => {
    const forecast = await evmForecastService.generateForecast(input.projectId);
    return { forecast };
  },
});

// --- Monte Carlo Agent ---
agentRegistry.register({
  id: 'monte-carlo-v1',
  capability: 'risk.assess',
  version: '1.0.0',
  description: 'Runs Monte Carlo simulation for schedule risk assessment',
  inputSchema: z.object({
    scheduleId: z.string(),
    config: z.object({
      iterations: z.number().optional(),
      confidenceLevels: z.array(z.number()).optional(),
      uncertaintyModel: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    result: z.any(),
  }),
  permissions: ['agent:risk'],
  timeoutMs: 120000,
  handler: async (input: { scheduleId: string; config?: any }) => {
    const result = await monteCarloService.runSimulation(input.scheduleId, input.config);
    return { result };
  },
});

// --- Meeting Follow-Up Agent ---
agentRegistry.register({
  id: 'meeting-followup-v1',
  capability: 'meeting.extract',
  version: '1.0.0',
  description: 'Extracts meeting history and identifies follow-up items, optionally enriched with related lessons',
  inputSchema: z.object({
    projectId: z.string(),
  }),
  outputSchema: z.object({
    analyses: z.any(),
    relatedLessons: z.any().optional(),
  }),
  permissions: ['agent:meeting'],
  timeoutMs: 60000,
  handler: async (input: { projectId: string }) => {
    const analyses = await meetingIntelligenceService.getProjectHistory(input.projectId);

    // Enrich with related lessons via RAG if available
    let relatedLessons: any[] | undefined;
    if (ragService.isAvailable() && analyses.length > 0) {
      try {
        const latestSummary = analyses[0].summary;
        relatedLessons = await lessonsLearnedService.findSimilarLessons(latestSummary, 3);
      } catch {
        // RAG enrichment is optional
      }
    }

    return { analyses, relatedLessons };
  },
});

// --- Schedule Recovery Agent (Agentic — reasoning + proposals) ---
agentRegistry.register({
  id: 'schedule-recovery-v1',
  capability: 'schedule.recover',
  version: '1.0.0',
  description: 'Reasons about schedule delays, identifies root causes, and proposes concrete recovery plans with actionable steps',
  inputSchema: z.object({
    projectId: z.string(),
    scheduleId: z.string(),
    delays: z.array(z.object({
      taskId: z.string(),
      taskName: z.string(),
      delayDays: z.number(),
      isOnCriticalPath: z.boolean(),
      currentProgress: z.number(),
      expectedEndDate: z.string(),
      estimatedEndDate: z.string(),
    })),
    userId: z.string(),
    scanId: z.string().optional(),
  }),
  outputSchema: z.object({
    recoveryPlan: z.any().nullable(),
    proposal: z.any().nullable(),
    skipped: z.boolean(),
    skipReason: z.string().optional(),
  }),
  permissions: ['agent:schedule'],
  timeoutMs: 180000,
  handler: async (input) => {
    const result = await scheduleRecoveryAgent.run(input);
    return {
      recoveryPlan: result.recoveryPlan,
      proposal: result.proposal,
      skipped: result.skipped,
      skipReason: result.skipReason,
    };
  },
});

// --- Scope Creep Detection Agent (Agentic — reasoning + proposals) ---
agentRegistry.register({
  id: 'scope-creep-detection-v1',
  capability: 'scope.detect',
  version: '1.0.0',
  description: 'Detects scope creep by analyzing task growth, estimate increases, and change requests against baselines',
  inputSchema: z.object({
    projectId: z.string(),
    userId: z.string(),
    scanId: z.string().optional(),
  }),
  outputSchema: z.object({
    analysis: z.any().nullable(),
    proposal: z.any().nullable(),
    indicators: z.any().nullable(),
    skipped: z.boolean(),
    skipReason: z.string().optional(),
  }),
  permissions: ['agent:scope'],
  timeoutMs: 180000,
  handler: async (input) => {
    const result = await scopeCreepAgent.run(input);
    return {
      analysis: result.analysis,
      proposal: result.proposal,
      indicators: result.indicators,
      skipped: result.skipped,
      skipReason: result.skipReason,
    };
  },
});

// --- Budget Intelligence Agent (Agentic — reasoning + proposals) ---
agentRegistry.register({
  id: 'budget-intelligence-v1',
  capability: 'budget.recover',
  version: '1.0.0',
  description: 'Analyzes budget health via EVM metrics, identifies root causes of cost deviations, and proposes corrective actions',
  inputSchema: z.object({
    projectId: z.string(),
    userId: z.string(),
    scanId: z.string().optional(),
  }),
  outputSchema: z.object({
    analysis: z.any().nullable(),
    proposal: z.any().nullable(),
    indicators: z.any().nullable(),
    skipped: z.boolean(),
    skipReason: z.string().optional(),
  }),
  permissions: ['agent:budget'],
  timeoutMs: 180000,
  handler: async (input) => {
    const result = await budgetIntelligenceAgent.run(input);
    return {
      analysis: result.analysis,
      proposal: result.proposal,
      indicators: result.indicators,
      skipped: result.skipped,
      skipReason: result.skipReason,
    };
  },
});

// --- Resource Optimization Agent (Agentic — reasoning + proposals) ---
agentRegistry.register({
  id: 'resource-optimization-v1',
  capability: 'resource.optimize',
  version: '1.0.0',
  description: 'Analyzes resource allocation imbalances, identifies over-allocated and under-utilized resources, and proposes rebalancing actions',
  inputSchema: z.object({
    projectId: z.string(),
    userId: z.string(),
    scanId: z.string().optional(),
  }),
  outputSchema: z.object({
    analysis: z.any().nullable(),
    proposal: z.any().nullable(),
    indicators: z.any().nullable(),
    skipped: z.boolean(),
    skipReason: z.string().optional(),
  }),
  permissions: ['agent:resource'],
  timeoutMs: 180000,
  handler: async (input) => {
    const result = await resourceOptimizationAgent.run(input);
    return {
      analysis: result.analysis,
      proposal: result.proposal,
      indicators: result.indicators,
      skipped: result.skipped,
      skipReason: result.skipReason,
    };
  },
});

// --- Cross-Project Intelligence Agent (Agentic — portfolio-level reasoning + proposals) ---
agentRegistry.register({
  id: 'cross-project-intelligence-v1',
  capability: 'portfolio.analyze',
  version: '1.0.0',
  description: 'Analyzes cross-project patterns, identifies systemic risks and resource conflicts, proposes portfolio-level strategic actions',
  inputSchema: z.object({
    userId: z.string(),
    scanId: z.string().optional(),
  }),
  outputSchema: z.object({
    analysis: z.any().nullable(),
    proposal: z.any().nullable(),
    indicators: z.any().nullable(),
    skipped: z.boolean(),
    skipReason: z.string().optional(),
  }),
  permissions: ['agent:portfolio'],
  timeoutMs: 300000,
  handler: async (input) => {
    const result = await crossProjectIntelligenceAgent.run(input);
    return {
      analysis: result.analysis,
      proposal: result.proposal,
      indicators: result.indicators,
      skipped: result.skipped,
      skipReason: result.skipReason,
    };
  },
});

// --- Risk Escalation Agent (Agentic — compound risk detection + escalation) ---
agentRegistry.register({
  id: 'risk-escalation-v1',
  capability: 'risk.escalate',
  version: '1.0.0',
  description: 'Detects compound risks where multiple agents flag the same project, identifies cascading effects, and escalates to management',
  inputSchema: z.object({
    userId: z.string(),
    projectResults: z.array(z.object({
      projectId: z.string(),
      projectName: z.string(),
      agentFlags: z.object({
        scheduleDelay: z.boolean(),
        budgetOverrun: z.boolean(),
        scopeCreep: z.boolean(),
        resourceBottleneck: z.boolean(),
        meetingOverdue: z.boolean(),
      }),
      details: z.record(z.string(), z.string()),
    })),
    scanId: z.string().optional(),
  }),
  outputSchema: z.object({
    analysis: z.any().nullable(),
    proposal: z.any().nullable(),
    indicators: z.any().nullable(),
    skipped: z.boolean(),
    skipReason: z.string().optional(),
  }),
  permissions: ['agent:risk'],
  timeoutMs: 180000,
  handler: async (input) => {
    const result = await riskEscalationAgent.run(input);
    return {
      analysis: result.analysis,
      proposal: result.proposal,
      indicators: result.indicators,
      skipped: result.skipped,
      skipReason: result.skipReason,
    };
  },
});
