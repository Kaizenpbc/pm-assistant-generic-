import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api, jsonResult } from '../api-client.js';

export function registerResourceTools(server: McpServer) {
  server.tool('list-resources', 'List all resources', {}, async () =>
    jsonResult(await api.get('/resources'))
  );

  server.tool('create-resource', 'Create a new resource', {
    name: z.string().describe('Resource name'),
    email: z.string().optional().describe('Email address'),
    role: z.string().optional().describe('Role/title'),
    skills: z.array(z.string()).optional().describe('List of skills'),
    maxHoursPerWeek: z.number().optional().describe('Max hours per week'),
    costRate: z.number().optional().describe('Hourly cost rate'),
  }, async (params) =>
    jsonResult(await api.post('/resources', params))
  );

  server.tool('update-resource', 'Update a resource', {
    resourceId: z.string().describe('Resource ID'),
    name: z.string().optional().describe('Resource name'),
    email: z.string().optional().describe('Email address'),
    role: z.string().optional().describe('Role/title'),
    skills: z.array(z.string()).optional().describe('List of skills'),
    maxHoursPerWeek: z.number().optional().describe('Max hours per week'),
    costRate: z.number().optional().describe('Hourly cost rate'),
  }, async ({ resourceId, ...data }) =>
    jsonResult(await api.put(`/resources/${resourceId}`, data))
  );

  server.tool('delete-resource', 'Delete a resource', {
    resourceId: z.string().describe('Resource ID'),
  }, async ({ resourceId }) =>
    jsonResult(await api.delete(`/resources/${resourceId}`))
  );

  server.tool('get-resource-workload', 'Get resource workload for a project', {
    projectId: z.string().describe('Project ID'),
  }, async ({ projectId }) =>
    jsonResult(await api.get(`/resources/workload/${projectId}`))
  );

  server.tool('get-resource-histogram', 'Get resource histogram for a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }) =>
    jsonResult(await api.get(`/resource-leveling/${scheduleId}/histogram`))
  );
}
