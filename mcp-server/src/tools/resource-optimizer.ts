import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerResourceOptimizerTools(server: McpServer) {
  server.tool('get-resource-availability', 'Get availability blocks for a resource (vacations, holidays, reduced hours)', {
    resourceId: z.string().describe('Resource ID'),
  }, async ({ resourceId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/resources/${resourceId}/availability`))
  );

  server.tool('set-resource-availability', 'Set an availability block for a resource (vacation, holiday, reduced hours)', {
    resourceId: z.string().describe('Resource ID'),
    dateFrom: z.string().describe('Start date (YYYY-MM-DD)'),
    dateTo: z.string().describe('End date (YYYY-MM-DD)'),
    type: z.enum(['vacation', 'holiday', 'sick', 'training', 'reduced']).describe('Availability type'),
    hoursAvailable: z.number().optional().describe('Hours available per day (for reduced type)'),
    note: z.string().optional().describe('Note'),
  }, async ({ resourceId, ...data }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/resources/${resourceId}/availability`, data))
  );

  server.tool('forecast-resource-bottlenecks', 'Predict resource bottlenecks and capacity forecast for a project', {
    projectId: z.string().describe('Project ID'),
    weeksAhead: z.number().optional().describe('Weeks to forecast (default 8, max 52)'),
  }, async ({ projectId, weeksAhead }, extra) => {
    const qs = weeksAhead ? `?weeksAhead=${weeksAhead}` : '';
    return jsonResult(await getApiClientFromExtra(extra).get(`/resource-optimizer/${projectId}/forecast${qs}`));
  });

  server.tool('find-skill-match', 'Find the best-matched resources for a task based on skills and availability', {
    taskId: z.string().describe('Task ID'),
    scheduleId: z.string().describe('Schedule ID'),
  }, async (params, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post('/resource-optimizer/skill-match', params))
  );
}
