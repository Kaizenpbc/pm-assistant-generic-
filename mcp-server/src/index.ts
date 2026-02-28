#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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
    version: '2.2.0',
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
  // Dynamic imports for Express + OAuth (only needed in HTTP mode)
  const express = (await import('express')).default;
  const { mcpAuthRouter } = await import('@modelcontextprotocol/sdk/server/auth/router.js');
  const { requireBearerAuth } = await import('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default ?? bcryptModule;
  const { PmOAuthProvider } = await import('./oauth/provider.js');
  const { query } = await import('./db.js');

  const provider = new PmOAuthProvider();

  const baseUrl = process.env.PM_BASE_URL || 'https://pm.kpbc.ca';
  const issuerUrl = new URL(baseUrl);
  const resourceServerUrl = new URL('/mcp', baseUrl);

  const app = express();

  // CORS headers for all responses
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Trust reverse proxy (LiteSpeed) for X-Forwarded-For
  app.set('trust proxy', 1);

  // Request logging
  app.use((req, _res, next) => {
    console.error(`[MCP HTTP] ${req.method} ${req.url} from ${req.headers.origin || 'no-origin'}`);
    next();
  });

  // POST /authorize/submit — MUST be mounted BEFORE mcpAuthRouter
  // so the SDK's /authorize handler doesn't capture /authorize/submit
  app.post('/authorize/submit', express.urlencoded({ extended: false }), async (req, res) => {
    try {
      const { username, password, client_id, redirect_uri, code_challenge, state, scope } = req.body;

      if (!username || !password || !client_id || !redirect_uri || !code_challenge) {
        res.status(400).type('html').send('<h1>Missing required fields</h1>');
        return;
      }

      // Validate credentials against users table
      interface UserRow { id: string; username: string; password_hash: string }
      const users = await query<UserRow & import('mysql2/promise').RowDataPacket>(
        'SELECT id, username, password_hash FROM users WHERE username = ? AND is_active = 1',
        [username],
      );

      if (users.length === 0) {
        // Re-render login with error
        const { renderAuthorizePage } = await import('./oauth/authorizePage.js');
        res.status(401).type('html').send(renderAuthorizePage({
          clientId: client_id,
          redirectUri: redirect_uri,
          state,
          codeChallenge: code_challenge,
          scope,
          error: 'Invalid username or password.',
        }));
        return;
      }

      const user = users[0];
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        const { renderAuthorizePage } = await import('./oauth/authorizePage.js');
        res.status(401).type('html').send(renderAuthorizePage({
          clientId: client_id,
          redirectUri: redirect_uri,
          state,
          codeChallenge: code_challenge,
          scope,
          error: 'Invalid username or password.',
        }));
        return;
      }

      // Issue authorization code
      const code = randomUUID();
      await query(
        `INSERT INTO oauth_auth_codes (code, client_id, user_id, redirect_uri, code_challenge, scope, state, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
        [code, client_id, user.id, redirect_uri, code_challenge, scope || null, state || null],
      );

      // Redirect back to Claude's callback
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);
      res.redirect(302, redirectUrl.toString());
    } catch (err) {
      console.error('[OAuth] /authorize/submit error:', err);
      res.status(500).type('html').send('<h1>Internal server error</h1>');
    }
  });

  // Mount OAuth auth router (handles /.well-known/*, /authorize, /token, /register, /revoke)
  app.use(mcpAuthRouter({
    provider,
    issuerUrl,
    baseUrl: issuerUrl,
    resourceServerUrl,
    resourceName: 'PM Assistant MCP',
  }));

  // Bearer auth for MCP endpoint
  const bearerAuth = requireBearerAuth({ verifier: provider });

  // Session management
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

  // MCP endpoint with auth
  app.post('/mcp', bearerAuth, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        return;
      }

      // New session
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
      };

      await server.connect(transport);
      await transport.handleRequest(req, res);

      if (transport.sessionId) {
        sessions.set(transport.sessionId, { server, transport });
      }
    } catch (err) {
      console.error('[MCP] POST /mcp error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.get('/mcp', bearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: 'Invalid or missing session ID' });
  });

  app.delete('/mcp', bearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      sessions.delete(sessionId);
      return;
    }
    res.status(400).json({ error: 'Invalid or missing session ID' });
  });

  const port = parseInt(process.env.PM_PORT || '3100', 10);
  app.listen(port, () => {
    console.error(`PM Assistant MCP server (HTTP+OAuth) listening on http://localhost:${port}`);
    console.error(`  MCP endpoint: /mcp`);
    console.error(`  OAuth metadata: /.well-known/oauth-authorization-server`);
    console.error(`  Resource metadata: /.well-known/oauth-protected-resource/mcp`);
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
