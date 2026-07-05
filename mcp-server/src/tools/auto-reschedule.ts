import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerAutoRescheduleTools(server: McpServer) {
  // --- Schedule-specific delay detection & reschedule proposal ---

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

  // --- Unified agent proposal management ---
  // These tools work with proposals from ALL 16 agents (budget, risk, hygiene, etc.),
  // not just the auto-reschedule agent.

  server.tool('list-proposals', 'List agent proposals (all types: budget, risk, schedule, hygiene, etc.)', {
    projectId: z.string().optional().describe('Filter by project ID'),
    status: z.enum(['pending', 'approved', 'rejected', 'executed', 'expired']).optional().describe('Filter by status'),
    agentId: z.string().optional().describe('Filter by agent ID'),
    limit: z.number().int().positive().max(100).optional().describe('Max results (default 50)'),
  }, async (params, extra) => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.status) query.set('status', params.status);
    if (params.agentId) query.set('agentId', params.agentId);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return jsonResult(await getApiClientFromExtra(extra).get(`/agent/proposals${qs ? `?${qs}` : ''}`));
  });

  server.tool('get-proposal', 'Get full details of an agent proposal including recommended actions', {
    proposalId: z.string().describe('Proposal ID'),
  }, async ({ proposalId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/agent/proposals/${proposalId}`))
  );

  server.tool('accept-proposal', 'Approve an agent proposal', {
    proposalId: z.string().describe('Proposal ID'),
    comment: z.string().optional().describe('Optional approval comment'),
  }, async ({ proposalId, comment }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/agent/proposals/${proposalId}/approve`, { comment }))
  );

  server.tool('reject-proposal', 'Reject an agent proposal', {
    proposalId: z.string().describe('Proposal ID'),
    reason: z.string().optional().describe('Reason for rejection'),
  }, async ({ proposalId, reason }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/agent/proposals/${proposalId}/reject`, { reason }))
  );
}
