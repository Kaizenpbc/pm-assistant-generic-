import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerScheduleTools(server: McpServer) {
  server.tool('list-schedules', 'List schedules for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }) =>
    jsonResult(await api.get(`/schedules/project/${projectId}`))
  );

  server.tool('create-schedule', 'Create a new schedule', {
    projectId: z.string().describe('Project ID'),
    name: z.string().describe('Schedule name'),
    description: z.string().optional().describe('Description'),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
  }, async (params) =>
    jsonResult(await api.post('/schedules', params))
  );

  server.tool('update-schedule', 'Update a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
    name: z.string().optional().describe('Schedule name'),
    description: z.string().optional().describe('Description'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  }, async ({ scheduleId, ...data }) =>
    jsonResult(await api.put(`/schedules/${scheduleId}`, data))
  );

  server.tool('delete-schedule', 'Delete a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.delete(`/schedules/${scheduleId}`))
  );

  server.tool('get-critical-path', 'Get critical path analysis for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/schedules/${scheduleId}/critical-path`))
  );

  server.tool('list-baselines', 'List baselines for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/schedules/${scheduleId}/baselines`))
  );
}
