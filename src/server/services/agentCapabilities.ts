import { z } from 'zod';
import { agentRegistry } from './AgentRegistryService';
import { AutoRescheduleService } from './AutoRescheduleService';
import { EVMForecastService } from './EVMForecastService';
import { MonteCarloService } from './MonteCarloService';
import { MeetingIntelligenceService } from './MeetingIntelligenceService';

// Lazily instantiate services to avoid circular dependency issues
let rescheduleService: AutoRescheduleService;
let evmForecastService: EVMForecastService;
let monteCarloService: MonteCarloService;
let meetingIntelligenceService: MeetingIntelligenceService;

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
  description: 'Extracts meeting history and identifies follow-up items',
  inputSchema: z.object({
    projectId: z.string(),
  }),
  outputSchema: z.object({
    analyses: z.any(),
  }),
  permissions: ['agent:meeting'],
  timeoutMs: 60000,
  handler: async (input: { projectId: string }) => {
    const svc = getMeetingIntelligenceService();
    const analyses = svc.getProjectHistory(input.projectId);
    return { analyses };
  },
});
