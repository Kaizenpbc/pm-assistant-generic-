import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerAdminTools(server: McpServer) {
  server.tool('search', 'Search projects and tasks by keyword', {
    query: z.string().describe('Search query'),
  }, async ({ query }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/search?q=${encodeURIComponent(query)}`))
  );

  server.tool('get-audit-trail', 'Get audit trail for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/audit/${projectId}`))
  );

  server.tool('trigger-agent', 'Trigger the AI agent to scan and act on a project', {
    projectId: z.string().optional().describe('Project ID (optional, scans all if omitted)'),
  }, async (params, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post('/agent/trigger', params))
  );

  server.tool('list-notifications', 'List notifications', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get('/notifications'))
  );

  server.tool('mark-notifications-read', 'Mark all notifications as read', {}, async (_args, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post('/notifications/mark-all-read'))
  );
}
