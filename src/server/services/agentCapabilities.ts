import { z } from 'zod';
import { agentRegistry } from './AgentRegistryService';
import { autoRescheduleService } from './AutoRescheduleService';
import { evmForecastService } from './EVMForecastService';
import { monteCarloService } from './MonteCarloService';
import { meetingIntelligenceService } from './MeetingIntelligenceService';
import { lessonsLearnedService } from './LessonsLearnedService';
import { ragService } from './RagService';

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
