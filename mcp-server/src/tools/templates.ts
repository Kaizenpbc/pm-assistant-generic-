import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerTemplateTools(server: McpServer) {
  server.tool('list-templates', 'List project templates', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get('/templates'))
  );

  server.tool('apply-template', 'Create a project from a template', {
    templateId: z.string().describe('Template ID'),
    name: z.string().describe('New project name'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  }, async (params, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post('/templates/apply', params))
  );

  server.tool('list-workflows', 'List automation workflow rules', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get('/workflows'))
  );

  server.tool('create-workflow', 'Create an automation workflow rule', {
    name: z.string().describe('Workflow name'),
    trigger: z.string().describe('Trigger event (e.g. "task.status_changed")'),
    conditions: z.record(z.unknown()).optional().describe('Trigger conditions'),
    actions: z.array(z.record(z.unknown())).describe('Actions to execute'),
  }, async (params, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post('/workflows', params))
  );
}
