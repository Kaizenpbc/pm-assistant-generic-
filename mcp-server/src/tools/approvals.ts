import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerApprovalTools(server: McpServer) {
  server.tool('list-change-requests', 'List change requests for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/approvals/change-requests/${projectId}`))
  );

  server.tool('create-change-request', 'Create a change request', {
    projectId: z.string().describe('Project ID'),
    title: z.string().describe('Change request title'),
    description: z.string().describe('Description of the change'),
    impact: z.string().optional().describe('Impact assessment'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority'),
  }, async ({ projectId, ...data }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/approvals/change-requests/${projectId}`, data))
  );

  server.tool('submit-for-approval', 'Submit a change request for approval', {
    changeRequestId: z.string().describe('Change request ID'),
  }, async ({ changeRequestId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/approvals/change-requests/${changeRequestId}/submit`))
  );

  server.tool('act-on-approval', 'Approve or reject a change request', {
    changeRequestId: z.string().describe('Change request ID'),
    action: z.enum(['approve', 'reject']).describe('Action to take'),
    comments: z.string().optional().describe('Comments'),
  }, async ({ changeRequestId, ...data }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/approvals/change-requests/${changeRequestId}/action`, data))
  );
}
