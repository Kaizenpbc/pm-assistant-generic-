#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { registerProjectTools } from './tools/projects.js';
import { registerScheduleTools } from './tools/schedules.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerSprintTools } from './tools/sprints.js';
import { registerResourceTools } from './tools/resources.js';
import { registerTimeTrackingTools } from './tools/time-tracking.js';
import { registerApprovalTools } from './tools/approvals.js';
import { registerReportTools } from './tools/reports.js';
import { registerAIInsightTools } from './tools/ai-insights.js';
import { registerAutoRescheduleTools } from './tools/auto-reschedule.js';
import { registerIntakeTools } from './tools/intake.js';
import { registerCustomFieldTools } from './tools/custom-fields.js';
import { registerIntegrationTools } from './tools/integrations.js';
import { registerAdminTools } from './tools/admin.js';
import { registerTemplateTools } from './tools/templates.js';

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'pm-assistant',
    version: '2.1.0',
  });

  // Register all tool groups
  registerProjectTools(server);
  registerScheduleTools(server);
  registerTaskTools(server);
  registerSprintTools(server);
  registerResourceTools(server);
  registerTimeTrackingTools(server);
  registerApprovalTools(server);
  registerReportTools(server);
  registerAIInsightTools(server);
  registerAutoRescheduleTools(server);
  registerIntakeTools(server);
  registerCustomFieldTools(server);
  registerIntegrationTools(server);
  registerAdminTools(server);
  registerTemplateTools(server);

  return server;
}

async function startStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttp() {
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Only handle /mcp endpoint
    if (req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    if (req.method === 'POST') {
      // Check for existing session
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        // Existing session — route to its transport
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        return;
      }

      // New session — create server + transport
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      // Clean up on close
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
      };

      await server.connect(transport);

      // Handle the initialize request (which sets the session ID)
      await transport.handleRequest(req, res);

      // Store the session after handleRequest sets the sessionId
      if (transport.sessionId) {
        sessions.set(transport.sessionId, { server, transport });
      }
      return;
    }

    if (req.method === 'GET') {
      // SSE stream for server-initiated messages
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
      return;
    }

    if (req.method === 'DELETE') {
      // Session termination
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        sessions.delete(sessionId);
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  });

  const port = parseInt(process.env.PM_PORT || '3100', 10);
  httpServer.listen(port, () => {
    console.error(`PM Assistant MCP server (HTTP) listening on http://localhost:${port}/mcp`);
  });
}

async function main() {
  const transport = process.env.PM_TRANSPORT || 'stdio';

  if (transport === 'http') {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
