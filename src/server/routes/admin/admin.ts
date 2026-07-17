import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import os from 'os';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { databaseService } from '../../database/connection';
import { userService } from '../../services/UserService';
import { auditLedgerService } from '../../services/AuditLedgerService';
import { redisService } from '../../services/RedisService';
import { config } from '../../config';

const statusSchema = z.object({
  active: z.boolean(),
});

function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  if (!user || user.role !== 'admin') {
    reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    return false;
  }
  return true;
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/v1/admin/users
  fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const query = request.query as { limit?: string; offset?: string };
      const limit = Math.min(Math.max(parseInt(query.limit || '100', 10) || 100, 1), 500);
      const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);

      const rows = await databaseService.queryControlPlane(
        `SELECT
          u.id, u.username, u.email, u.full_name, u.role, u.is_active,
          u.created_at, u.last_login_at, u.subscription_tier,
          u.email_verified,
          u.login_verification_token IS NOT NULL AS has_pending_login,
          u.login_verification_expires,
          COUNT(DISTINCT p.id) AS project_count
        FROM users u
        LEFT JOIN projects p ON p.created_by = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return { users: rows };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /api/v1/admin/users/:id/status
  fastify.patch('/users/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const requestingUser = request.user!;
    const { id } = request.params as { id: string };

    if (id === requestingUser.userId) {
      return reply.status(400).send({ error: 'Bad request', message: 'Cannot deactivate your own account' });
    }

    const result = statusSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Bad request', message: 'active (boolean) required' });
    }

    try {
      const updated = await userService.update(id, { isActive: result.data.active });
      if (!updated) {
        return reply.status(404).send({ error: 'Not found', message: 'User not found' });
      }
      return { message: 'User status updated', isActive: updated.isActive };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/admin/users/:id/reset-password
  fastify.post('/users/:id/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };

    try {
      const user = await userService.findById(id);
      if (!user) {
        return reply.status(404).send({ error: 'Not found', message: 'User not found' });
      }

      const resetToken = crypto.randomUUID();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await userService.update(id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      });

      return { message: 'Password reset token generated', resetToken };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/admin/users/:id/clear-login-token
  fastify.post('/users/:id/clear-login-token', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };

    try {
      const user = await userService.findById(id);
      if (!user) {
        return reply.status(404).send({ error: 'Not found', message: 'User not found' });
      }

      await userService.update(id, {
        loginVerificationToken: null,
        loginVerificationExpires: null,
      });

      return { message: 'Login verification token cleared' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/admin/stats
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const rows = await databaseService.queryControlPlane(
        `SELECT
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM users WHERE is_active = 1) AS active_users,
          (SELECT COUNT(*) FROM projects) AS total_projects,
          (SELECT COUNT(*) FROM ai_usage_log) AS total_ai_calls,
          (SELECT COALESCE(SUM(cost_estimate), 0) FROM ai_usage_log) AS total_ai_cost,
          (SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM ai_usage_log) AS total_tokens`
      );
      return { stats: rows[0] ?? {} };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/admin/audit — cross-project audit trail (admin only)
  fastify.get('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const q = request.query as {
        limit?: string; offset?: string;
        action?: string; entityType?: string; since?: string;
      };
      const result = await auditLedgerService.getEntries({
        limit: Math.min(Number(q.limit) || 100, 500),
        offset: Math.max(Number(q.offset) || 0, 0),
        action: q.action || undefined,
        entityType: q.entityType || undefined,
        since: q.since || undefined,
      });
      return { entries: result.entries, total: result.total };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/admin/ai-usage
  fastify.get('/ai-usage', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const q = request.query as { since?: string };
      const sinceClause = q.since ? 'AND a.created_at >= ?' : '';
      const sinceParams = q.since ? [q.since] : [];

      // Per-user breakdown
      const rows = await databaseService.queryControlPlane(
        `SELECT
          u.username, u.email, u.full_name,
          COUNT(a.id) AS call_count,
          COALESCE(SUM(a.input_tokens + a.output_tokens), 0) AS total_tokens,
          COALESCE(SUM(a.cost_estimate), 0) AS total_cost,
          MAX(a.created_at) AS last_used
        FROM users u
        LEFT JOIN ai_usage_log a ON a.user_id = u.id ${sinceClause}
        GROUP BY u.id
        ORDER BY total_cost DESC`,
        sinceParams
      );

      // Summary totals (respecting same filter)
      const summaryRows = await databaseService.queryControlPlane(
        `SELECT
          COUNT(*) AS total_calls,
          COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
          COALESCE(SUM(cost_estimate), 0) AS total_cost
        FROM ai_usage_log ${q.since ? 'WHERE created_at >= ?' : ''}`,
        sinceParams
      );

      // Daily trend (last 30 days)
      const dailyRows = await databaseService.queryControlPlane(
        `SELECT
          DATE(created_at) AS day,
          COUNT(*) AS calls,
          COALESCE(SUM(cost_estimate), 0) AS cost
        FROM ai_usage_log
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day`
      );

      return {
        usage: rows,
        summary: summaryRows[0] ?? { total_calls: 0, total_tokens: 0, total_cost: 0 },
        dailyTrend: dailyRows,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/admin/config — System configuration overview
  fastify.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      // Feature flags
      const features = [
        { key: 'AI_ENABLED', label: 'AI / Claude', enabled: config.AI_ENABLED, detail: config.AI_ENABLED ? config.AI_MODEL : undefined },
        { key: 'AI_FALLBACK_ENABLED', label: 'AI Fallback', enabled: config.AI_FALLBACK_ENABLED, detail: config.AI_FALLBACK_ENABLED ? config.AI_FALLBACK_MODEL : undefined },
        { key: 'AGENT_ENABLED', label: 'Autonomous Agents', enabled: config.AGENT_ENABLED },
        { key: 'EMBEDDING_ENABLED', label: 'Embeddings / RAG', enabled: config.EMBEDDING_ENABLED, detail: config.EMBEDDING_ENABLED ? config.EMBEDDING_MODEL : undefined },
        { key: 'MULTI_TENANT_ENABLED', label: 'Multi-Tenant', enabled: config.MULTI_TENANT_ENABLED },
        { key: 'METRICS_ENABLED', label: 'Metrics Collection', enabled: config.METRICS_ENABLED },
        { key: 'ALERT_ENABLED', label: 'Alerting', enabled: config.ALERT_ENABLED, detail: config.ALERT_ENABLED ? (config.ALERT_EMAIL || 'No email set') : undefined },
      ];

      // Service connectivity
      const services = [
        { key: 'redis', label: 'Redis', connected: redisService.isConnected(), detail: config.REDIS_URL ? 'Configured' : 'Not configured (in-memory fallback)' },
        { key: 'email', label: 'Email (Resend)', connected: !!config.RESEND_API_KEY, detail: config.RESEND_API_KEY ? `From: ${config.RESEND_FROM_EMAIL}` : 'RESEND_API_KEY not set' },
        { key: 'stripe', label: 'Stripe Billing', connected: !!config.STRIPE_SECRET_KEY, detail: config.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured' },
        { key: 'anthropic', label: 'Anthropic API', connected: !!config.ANTHROPIC_API_KEY, detail: config.ANTHROPIC_API_KEY ? 'Key set' : 'Key not set' },
        { key: 'openai', label: 'OpenAI (Embeddings)', connected: !!config.OPENAI_API_KEY, detail: config.OPENAI_API_KEY ? 'Key set' : 'Key not set' },
      ];

      // Database connectivity check
      let dbConnected = false;
      let dbVersion = '';
      try {
        const vRows = await databaseService.queryControlPlane<{ version: string }>(`SELECT VERSION() as version`);
        dbConnected = true;
        dbVersion = vRows[0]?.version || '';
      } catch { /* */ }

      // Migration count
      let migrationCount = 0;
      try {
        const mRows = await databaseService.queryControlPlane<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM _migrations`);
        migrationCount = Number(mRows[0]?.cnt || 0);
      } catch { /* table may not exist */ }

      // Agent counts
      let agentTotal = 0, agentEnabled = 0;
      try {
        const aRows = await databaseService.queryControlPlane<{ total: number; enabled: number }>(
          `SELECT COUNT(*) as total, SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled FROM agents`
        );
        agentTotal = Number(aRows[0]?.total || 0);
        agentEnabled = Number(aRows[0]?.enabled || 0);
      } catch { /* */ }

      // Environment info
      const environment = {
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()} (${os.arch()})`,
        env: config.NODE_ENV,
        port: config.PORT,
        appUrl: config.APP_URL,
        corsOrigin: config.CORS_ORIGIN,
        logLevel: config.LOG_LEVEL,
        dbHost: config.DB_HOST,
        dbName: config.DB_NAME,
        dbConnected,
        dbVersion,
        dbPoolSize: config.DB_CONNECTION_LIMIT,
        migrationCount,
      };

      // AI configuration
      const aiConfig = {
        model: config.AI_MODEL,
        fallbackModel: config.AI_FALLBACK_MODEL,
        temperature: config.AI_TEMPERATURE,
        maxTokens: config.AI_MAX_TOKENS,
        monthlyTokenBudget: config.AI_MONTHLY_TOKEN_BUDGET,
        pricingInput: config.AI_PRICING_INPUT,
        pricingOutput: config.AI_PRICING_OUTPUT,
      };

      // Agent configuration
      const agentConfig = {
        cronSchedule: config.AGENT_CRON_SCHEDULE,
        delayThresholdDays: config.AGENT_DELAY_THRESHOLD_DAYS,
        budgetCpiThreshold: config.AGENT_BUDGET_CPI_THRESHOLD,
        budgetOverrunThreshold: config.AGENT_BUDGET_OVERRUN_THRESHOLD,
        mcConfidenceLevel: config.AGENT_MC_CONFIDENCE_LEVEL,
        overdueScanMinutes: config.AGENT_OVERDUE_SCAN_MINUTES,
        totalAgents: agentTotal,
        enabledAgents: agentEnabled,
      };

      // Upload / storage config
      const storageConfig = {
        uploadDir: config.UPLOAD_DIR,
        maxUploadSizeMB: config.MAX_UPLOAD_SIZE_MB,
      };

      return {
        features,
        services,
        environment,
        aiConfig,
        agentConfig,
        storageConfig,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
