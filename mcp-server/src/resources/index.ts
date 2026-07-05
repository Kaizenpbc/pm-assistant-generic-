import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiClientFromExtra } from '../api-client.js';
import { type Role, isToolAllowed } from '../permissions.js';

/**
 * Register MCP resources — read-only data sources agents can access without tool calls.
 * Resources are filtered by role using the same permission system.
 */
export function registerResources(server: McpServer, role?: Role) {
  // Project summary resource — all roles
  server.resource(
    'project-summary',
    'project://{projectId}/summary',
    { description: 'Project metadata and health score' },
    async (uri, extra) => {
      const projectId = uri.pathname.split('/')[1] || uri.host;
      const api = getApiClientFromExtra(extra as Record<string, unknown>);
      try {
        const project = await api.get(`/projects/${projectId}`);
        let health: unknown = null;
        try { health = await api.get(`/projects/${projectId}/health`); } catch { /* optional */ }
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ project, health }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: err.message }),
          }],
        };
      }
    },
  );

  // Project tasks resource — all roles
  server.resource(
    'project-tasks',
    'project://{projectId}/tasks',
    { description: 'Task list with status for a project' },
    async (uri, extra) => {
      const projectId = uri.pathname.split('/')[1] || uri.host;
      const api = getApiClientFromExtra(extra as Record<string, unknown>);
      try {
        const tasks = await api.get(`/schedules/${projectId}/tasks`);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(tasks, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: err.message }),
          }],
        };
      }
    },
  );

  // Project risks — PM, Executive, Risk Manager, PMO, Admin
  if (!role || role === 'admin' || role === 'executive' || role === 'project_manager' || role === 'risk_manager' || role === 'pmo') {
    server.resource(
      'project-risks',
      'project://{projectId}/risks',
      { description: 'Active risks for a project' },
      async (uri, extra) => {
        const projectId = uri.pathname.split('/')[1] || uri.host;
        const api = getApiClientFromExtra(extra as Record<string, unknown>);
        try {
          const risks = await api.get(`/projects/${projectId}/risks`);
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(risks, null, 2),
            }],
          };
        } catch (err: any) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: err.message }),
            }],
          };
        }
      },
    );
  }

  // Project financials — Finance, PM, Executive, PMO, Admin
  if (!role || role === 'admin' || role === 'executive' || role === 'project_manager' || role === 'finance_officer' || role === 'pmo') {
    server.resource(
      'project-financials',
      'project://{projectId}/financials',
      { description: 'Budget, actuals, and forecast for a project' },
      async (uri, extra) => {
        const projectId = uri.pathname.split('/')[1] || uri.host;
        const api = getApiClientFromExtra(extra as Record<string, unknown>);
        try {
          const budget = await api.get(`/projects/${projectId}/budget-forecast`);
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(budget, null, 2),
            }],
          };
        } catch (err: any) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: err.message }),
            }],
          };
        }
      },
    );
  }

  // Project schedule — PM, Scrum Master, PMO, DevOps, Admin
  if (!role || role === 'admin' || role === 'project_manager' || role === 'scrum_master' || role === 'pmo' || role === 'devops') {
    server.resource(
      'project-schedule',
      'project://{projectId}/schedule',
      { description: 'Critical path and milestones' },
      async (uri, extra) => {
        const projectId = uri.pathname.split('/')[1] || uri.host;
        const api = getApiClientFromExtra(extra as Record<string, unknown>);
        try {
          const criticalPath = await api.get(`/schedules/${projectId}/critical-path`);
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(criticalPath, null, 2),
            }],
          };
        } catch (err: any) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: err.message }),
            }],
          };
        }
      },
    );
  }
}
