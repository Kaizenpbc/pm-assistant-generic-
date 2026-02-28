import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerCustomFieldTools(server: McpServer) {
  server.tool('list-custom-fields', 'List custom field definitions for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }) =>
    jsonResult(await api.get(`/custom-fields/project/${projectId}`))
  );

  server.tool('create-custom-field', 'Create a custom field definition', {
    projectId: z.string().describe('Project ID'),
    name: z.string().describe('Field name'),
    type: z.enum(['text', 'number', 'date', 'select', 'multiselect', 'checkbox']).describe('Field type'),
    options: z.array(z.string()).optional().describe('Options for select/multiselect fields'),
    required: z.boolean().optional().describe('Whether the field is required'),
  }, async ({ projectId, ...data }) =>
    jsonResult(await api.post(`/custom-fields/project/${projectId}`, data))
  );

  server.tool('set-custom-field-values', 'Set custom field values on an entity', {
    entityType: z.string().describe('Entity type (e.g. "task", "project")'),
    entityId: z.string().describe('Entity ID'),
    values: z.record(z.unknown()).describe('Field values as key-value pairs'),
  }, async ({ entityType, entityId, values }) =>
    jsonResult(await api.post(`/custom-fields/values/${entityType}/${entityId}`, { values }))
  );
}
