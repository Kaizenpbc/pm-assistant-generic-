import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerReportTools(server: McpServer) {
  server.tool('get-burndown', 'Get burndown chart data for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/burndown/${scheduleId}`))
  );

  server.tool('get-network-diagram', 'Get network diagram data for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/network-diagram/${scheduleId}`))
  );

  server.tool('export-project', 'Export project data', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }) =>
    jsonResult(await api.get(`/exports/projects/${projectId}/export`))
  );

  server.tool('list-report-templates', 'List report builder templates', {}, async () =>
    jsonResult(await api.get('/report-builder/templates'))
  );

  server.tool('run-report', 'Generate a report from a template', {
    templateId: z.string().describe('Report template ID'),
  }, async ({ templateId }) =>
    jsonResult(await api.post(`/report-builder/templates/${templateId}/generate`))
  );
}
