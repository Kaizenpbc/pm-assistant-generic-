import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerAutoRescheduleTools(server: McpServer) {
  server.tool('detect-delays', 'Detect delayed tasks in a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/auto-reschedule/${scheduleId}/delays`))
  );

  server.tool('propose-reschedule', 'Generate AI reschedule proposal for delayed tasks', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/auto-reschedule/${scheduleId}/propose`))
  );

  server.tool('list-proposals', 'List reschedule proposals for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/auto-reschedule/${scheduleId}/proposals`))
  );

  server.tool('accept-proposal', 'Accept a reschedule proposal and apply changes', {
    proposalId: z.string().describe('Proposal ID'),
  }, async ({ proposalId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/auto-reschedule/proposals/${proposalId}/accept`))
  );

  server.tool('reject-proposal', 'Reject a reschedule proposal', {
    proposalId: z.string().describe('Proposal ID'),
  }, async ({ proposalId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/auto-reschedule/proposals/${proposalId}/reject`))
  );
}
