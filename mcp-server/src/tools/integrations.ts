import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerIntegrationTools(server: McpServer) {
  server.tool('list-integrations', 'List configured integrations', {}, async () =>
    jsonResult(await api.get('/integrations'))
  );

  server.tool('create-integration', 'Create a new integration', {
    type: z.string().describe('Integration type (e.g. jira, github, slack)'),
    name: z.string().describe('Integration name'),
    config: z.record(z.unknown()).describe('Integration configuration'),
  }, async (params) =>
    jsonResult(await api.post('/integrations', params))
  );

  server.tool('sync-integration', 'Trigger a sync for an integration', {
    integrationId: z.string().describe('Integration ID'),
  }, async ({ integrationId }) =>
    jsonResult(await api.post(`/integrations/${integrationId}/sync`))
  );
}
