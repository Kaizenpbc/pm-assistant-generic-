import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerIntakeTools(server: McpServer) {
  server.tool('list-intake-forms', 'List intake forms', {}, async () =>
    jsonResult(await api.get('/intake/forms'))
  );

  server.tool('submit-intake-form', 'Submit an intake form', {
    formId: z.string().describe('Form ID'),
    data: z.record(z.unknown()).describe('Form field values as key-value pairs'),
  }, async ({ formId, data }) =>
    jsonResult(await api.post(`/intake/forms/${formId}/submit`, data))
  );

  server.tool('list-intake-submissions', 'List intake form submissions', {}, async () =>
    jsonResult(await api.get('/intake/submissions'))
  );

  server.tool('review-submission', 'Review an intake form submission', {
    submissionId: z.string().describe('Submission ID'),
    action: z.enum(['approve', 'reject']).describe('Review action'),
    comments: z.string().optional().describe('Review comments'),
  }, async ({ submissionId, ...data }) =>
    jsonResult(await api.post(`/intake/submissions/${submissionId}/review`, data))
  );
}
