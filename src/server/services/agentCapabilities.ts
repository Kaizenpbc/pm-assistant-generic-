import { z } from 'zod';
import { agentRegistry } from './AgentRegistryService';
import { AutoRescheduleService } from './AutoRescheduleService';
import { EVMForecastService } from './EVMForecastService';
import { MonteCarloService } from './MonteCarloService';
import { MeetingIntelligenceService } from './MeetingIntelligenceService';
import { LessonsLearnedService } from './LessonsLearnedService';
import { RagService } from './RagService';

// Register RAG agent capability (side-effect import)
import './ragAgentCapability';

// Lazily instantiate services to avoid circular dependency issues
let rescheduleService: AutoRescheduleService;
let evmForecastService: EVMForecastService;
let monteCarloService: MonteCarloService;
let meetingIntelligenceService: MeetingIntelligenceService;
let lessonsLearnedService: LessonsLearnedService;
let ragService: RagService;

function getRescheduleService() {
  if (!rescheduleService) rescheduleService = new AutoRescheduleService();
  return rescheduleService;
}
function getEvmForecastService() {
  if (!evmForecastService) evmForecastService = new EVMForecastService();
  return evmForecastService;
}
function getMonteCarloService() {
  if (!monteCarloService) monteCarloService = new MonteCarloService();
  return monteCarloService;
}
function getMeetingIntelligenceService() {
  if (!meetingIntelligenceService) meetingIntelligenceService = new MeetingIntelligenceService();
  return meetingIntelligenceService;
}
function getLessonsLearnedService() {
  if (!lessonsLearnedService) lessonsLearnedService = new LessonsLearnedService();
  return lessonsLearnedService;
}
function getRagService() {
  if (!ragService) ragService = new RagService();
  return ragService;
}

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
    const svc = getRescheduleService();
    const delays = await svc.detectDelays(input.scheduleId);
    const thresholdDays = input.thresholdDays ?? 3;
    const significant = delays.filter(
      (d: any) => d.delayDays >= thresholdDays || d.isOnCriticalPath,
    );
    if (significant.length === 0) {
      return { delays: significant };
    }
    const proposal = await svc.generateProposal(input.scheduleId, undefined, 'agent');
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
    const svc = getEvmForecastService();
    const forecast = await svc.generateForecast(input.projectId);
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
    const svc = getMonteCarloService();
    const result = await svc.runSimulation(input.scheduleId, input.config);
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
    const svc = getMeetingIntelligenceService();
    const analyses = await svc.getProjectHistory(input.projectId);

    // Enrich with related lessons via RAG if available
    let relatedLessons: any[] | undefined;
    const rag = getRagService();
    if (rag.isAvailable() && analyses.length > 0) {
      try {
        const latestSummary = analyses[0].summary;
        const llService = getLessonsLearnedService();
        relatedLessons = await llService.findSimilarLessons(latestSummary, 3);
      } catch {
        // RAG enrichment is optional
      }
    }

    return { analyses, relatedLessons };
  },
});
