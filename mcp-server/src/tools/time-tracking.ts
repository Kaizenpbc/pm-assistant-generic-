import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerTimeTrackingTools(server: McpServer) {
  server.tool('log-time', 'Log a time entry for a task', {
    taskId: z.string().describe('Task ID'),
    hours: z.number().describe('Hours worked'),
    date: z.string().describe('Date (YYYY-MM-DD)'),
    description: z.string().optional().describe('Description of work done'),
  }, async (params) =>
    jsonResult(await api.post('/time-entries', params))
  );

  server.tool('get-time-entries', 'Get time entries for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }) =>
    jsonResult(await api.get(`/time-entries/project/${projectId}`))
  );

  server.tool('get-timesheet', 'Get weekly timesheet', {
    startDate: z.string().optional().describe('Week start date (YYYY-MM-DD)'),
  }, async ({ startDate }) => {
    const qs = startDate ? `?startDate=${startDate}` : '';
    return jsonResult(await api.get(`/time-entries/timesheet${qs}`));
  });

  server.tool('get-actual-vs-estimated', 'Get actual vs estimated hours for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/time-entries/actual-vs-estimated/${scheduleId}`))
  );
}
