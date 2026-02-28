import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerAutoRescheduleTools(server: McpServer) {
  server.tool('detect-delays', 'Detect delayed tasks in a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/auto-reschedule/${scheduleId}/delays`))
  );

  server.tool('propose-reschedule', 'Generate AI reschedule proposal for delayed tasks', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.post(`/auto-reschedule/${scheduleId}/propose`))
  );

  server.tool('list-proposals', 'List reschedule proposals for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/auto-reschedule/${scheduleId}/proposals`))
  );

  server.tool('accept-proposal', 'Accept a reschedule proposal and apply changes', {
    proposalId: z.string().describe('Proposal ID'),
  }, async ({ proposalId }) =>
    jsonResult(await api.post(`/auto-reschedule/proposals/${proposalId}/accept`))
  );

  server.tool('reject-proposal', 'Reject a reschedule proposal', {
    proposalId: z.string().describe('Proposal ID'),
  }, async ({ proposalId }) =>
    jsonResult(await api.post(`/auto-reschedule/proposals/${proposalId}/reject`))
  );
}
