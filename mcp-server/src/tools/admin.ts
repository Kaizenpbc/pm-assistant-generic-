import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerAdminTools(server: McpServer) {
  server.tool('search', 'Search projects and tasks by keyword', {
    query: z.string().describe('Search query'),
  }, async ({ query }) =>
    jsonResult(await api.get(`/search?q=${encodeURIComponent(query)}`))
  );

  server.tool('get-audit-trail', 'Get audit trail for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }) =>
    jsonResult(await api.get(`/audit/${projectId}`))
  );

  server.tool('trigger-agent', 'Trigger the AI agent to scan and act on a project', {
    projectId: z.string().optional().describe('Project ID (optional, scans all if omitted)'),
  }, async (params) =>
    jsonResult(await api.post('/agent/trigger', params))
  );

  server.tool('list-notifications', 'List notifications', {}, async () =>
    jsonResult(await api.get('/notifications'))
  );

  server.tool('mark-notifications-read', 'Mark all notifications as read', {}, async () =>
    jsonResult(await api.post('/notifications/mark-all-read'))
  );
}
