import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerAIInsightTools(server: McpServer) {
  server.tool('get-project-health', 'Get AI health score for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/predictions/project/${projectId}/health`))
  );

  server.tool('get-project-risks', 'Get AI risk assessment for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/predictions/project/${projectId}/risks`))
  );

  server.tool('get-budget-forecast', 'Get AI budget forecast for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/predictions/project/${projectId}/budget`))
  );

  server.tool('get-alerts', 'Get proactive alerts across all projects', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get('/alerts'))
  );

  server.tool('get-analytics-summary', 'Get portfolio-level analytics summary', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get('/analytics/summary'))
  );

  server.tool('get-portfolio-overview', 'Get full portfolio overview across all projects', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get('/portfolio'))
  );

  server.tool('natural-language-query', 'Ask a question about your projects in natural language', {
    query: z.string().describe('Your question (e.g. "Which projects are behind schedule?")'),
  }, async ({ query }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post('/nl-query', { query }))
  );

  server.tool('get-predictions-dashboard', 'Get portfolio predictions dashboard', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get('/predictions/dashboard'))
  );

  server.tool('run-monte-carlo', 'Run Monte Carlo simulation for schedule risk', {
    scheduleId: z.string().describe('Schedule ID'),
    iterations: z.number().optional().describe('Number of iterations (default 1000)'),
  }, async ({ scheduleId, ...params }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/monte-carlo/${scheduleId}/simulate`, params))
  );

  server.tool('get-evm-forecast', 'Get Earned Value Management forecast', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/evm-forecast/${projectId}`))
  );
}
