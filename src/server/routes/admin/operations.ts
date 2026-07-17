import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { execSync } from 'child_process';
import os from 'os';
import { authMiddleware } from '../../middleware/auth';
import { databaseService } from '../../database/connection';
import { metricsService } from '../../services/MetricsService';
import { redisService } from '../../services/RedisService';
import { config } from '../../config';

function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  const user = request.user!;
  if (!user || user.role !== 'admin') {
    reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    return false;
  }
  return true;
}

interface Warning {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  advice: string;
}

function computeWarnings(data: {
  memoryPercent: number;
  poolActive: number;
  poolTotal: number;
  p99Ms: number;
  errorRate5xx: number;
  aiBudgetPercent: number;
  redisConnected: boolean;
  diskPercent: number | null;
  swapPercent: number | null;
}): Warning[] {
  const warnings: Warning[] = [];

  // Memory
  if (data.memoryPercent > 90) {
    warnings.push({ severity: 'critical', title: 'High Memory Usage', message: `Memory at ${data.memoryPercent.toFixed(0)}%`, advice: 'Restart service or increase VM memory' });
  } else if (data.memoryPercent > 80) {
    warnings.push({ severity: 'warning', title: 'Elevated Memory Usage', message: `Memory at ${data.memoryPercent.toFixed(0)}%`, advice: 'Monitor closely; consider restart if trending up' });
  }

  // DB Pool
  const poolPercent = data.poolTotal > 0 ? (data.poolActive / data.poolTotal) * 100 : 0;
  if (poolPercent > 90) {
    warnings.push({ severity: 'critical', title: 'DB Pool Exhaustion', message: `${data.poolActive}/${data.poolTotal} connections in use`, advice: 'Increase pool size or check connection leaks' });
  } else if (poolPercent > 70) {
    warnings.push({ severity: 'warning', title: 'DB Pool High', message: `${data.poolActive}/${data.poolTotal} connections in use`, advice: 'Monitor for connection leaks' });
  }

  // API latency
  if (data.p99Ms > 5000) {
    warnings.push({ severity: 'critical', title: 'Very High Latency', message: `API p99 at ${data.p99Ms}ms`, advice: 'Review slow queries and heavy endpoints' });
  } else if (data.p99Ms > 2000) {
    warnings.push({ severity: 'warning', title: 'High Latency', message: `API p99 at ${data.p99Ms}ms`, advice: 'Check for slow queries or upstream timeouts' });
  }

  // 5xx error rate
  if (data.errorRate5xx > 10) {
    warnings.push({ severity: 'critical', title: 'High Error Rate', message: `5xx rate at ${data.errorRate5xx.toFixed(1)}%`, advice: 'Check logs for recurring errors' });
  } else if (data.errorRate5xx > 5) {
    warnings.push({ severity: 'warning', title: 'Elevated Error Rate', message: `5xx rate at ${data.errorRate5xx.toFixed(1)}%`, advice: 'Investigate recent 5xx errors in logs' });
  }

  // AI budget
  if (data.aiBudgetPercent > 95) {
    warnings.push({ severity: 'critical', title: 'AI Budget Near Limit', message: `${data.aiBudgetPercent.toFixed(0)}% of monthly budget used`, advice: 'Reduce AI features or increase budget' });
  } else if (data.aiBudgetPercent > 80) {
    warnings.push({ severity: 'warning', title: 'AI Budget Warning', message: `${data.aiBudgetPercent.toFixed(0)}% of monthly budget used`, advice: 'Monitor AI usage; consider throttling non-critical calls' });
  }

  // Redis
  if (!data.redisConnected) {
    warnings.push({ severity: 'warning', title: 'Redis Disconnected', message: 'Redis is not connected', advice: 'Restart Redis or check connectivity' });
  }

  // Disk
  if (data.diskPercent !== null) {
    if (data.diskPercent > 90) {
      warnings.push({ severity: 'critical', title: 'Disk Nearly Full', message: `Disk at ${data.diskPercent.toFixed(0)}%`, advice: 'Clean logs/temp files or expand storage' });
    } else if (data.diskPercent > 80) {
      warnings.push({ severity: 'warning', title: 'Disk Usage High', message: `Disk at ${data.diskPercent.toFixed(0)}%`, advice: 'Plan disk cleanup soon' });
    }
  }

  // Swap
  if (data.swapPercent !== null) {
    if (data.swapPercent > 80) {
      warnings.push({ severity: 'critical', title: 'Swap Usage Critical', message: `Swap at ${data.swapPercent.toFixed(0)}%`, advice: 'Server is under heavy memory pressure — consider adding RAM or reducing load' });
    } else if (data.swapPercent > 50) {
      warnings.push({ severity: 'warning', title: 'Swap Usage Elevated', message: `Swap at ${data.swapPercent.toFixed(0)}%`, advice: 'Monitor memory usage; performance may degrade' });
    }
  }

  return warnings;
}

function getDiskUsage(): { usedGB: number; totalGB: number; percentUsed: number } | null {
  try {
    const output = execSync('df / --output=used,size 2>/dev/null || true', { encoding: 'utf8', timeout: 3000 });
    const lines = output.trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].trim().split(/\s+/);
    if (parts.length < 2) return null;
    const usedKB = parseInt(parts[0], 10);
    const totalKB = parseInt(parts[1], 10);
    if (isNaN(usedKB) || isNaN(totalKB) || totalKB === 0) return null;
    return {
      usedGB: Math.round((usedKB / 1048576) * 100) / 100,
      totalGB: Math.round((totalKB / 1048576) * 100) / 100,
      percentUsed: Math.round((usedKB / totalKB) * 100 * 10) / 10,
    };
  } catch {
    return null;
  }
}

function getSwapUsage(): { usedMB: number; totalMB: number; percentUsed: number } | null {
  try {
    const output = execSync('free -b 2>/dev/null | grep -i swap || true', { encoding: 'utf8', timeout: 3000 });
    const parts = output.trim().split(/\s+/);
    if (parts.length < 3) return null;
    const totalBytes = parseInt(parts[1], 10);
    const usedBytes = parseInt(parts[2], 10);
    if (isNaN(totalBytes) || isNaN(usedBytes) || totalBytes === 0) return null;
    return {
      usedMB: Math.round(usedBytes / 1048576),
      totalMB: Math.round(totalBytes / 1048576),
      percentUsed: Math.round((usedBytes / totalBytes) * 100 * 10) / 10,
    };
  } catch {
    return null;
  }
}

async function getRedisMemory(): Promise<number | null> {
  const client = redisService.getClient();
  if (!client) return null;
  try {
    const info = await client.info('memory');
    const match = info.match(/used_memory:(\d+)/);
    if (match) return Math.round(parseInt(match[1], 10) / 1048576 * 100) / 100;
    return null;
  } catch {
    return null;
  }
}

async function getAiBudgetInfo(): Promise<{ totalRequests: number; inputTokens: number; outputTokens: number; costThisMonth: number; monthlyBudget: number; budgetUsedPercent: number }> {
  const pricingInput = config.AI_PRICING_INPUT;
  const pricingOutput = config.AI_PRICING_OUTPUT;
  // Budget in dollars: derive from token budget and pricing (tokens / 1M * price per M)
  const monthlyBudget = (config.AI_MONTHLY_TOKEN_BUDGET / 1_000_000) * ((pricingInput + pricingOutput) / 2);

  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const rows = await databaseService.queryControlPlane<{ total_requests: number; total_input: number; total_output: number }>(
      `SELECT COUNT(*) as total_requests, COALESCE(SUM(input_tokens), 0) as total_input, COALESCE(SUM(output_tokens), 0) as total_output FROM ai_usage_log WHERE created_at >= ?`,
      [monthStart]
    );
    const row = rows[0] || { total_requests: 0, total_input: 0, total_output: 0 };
    const cost = (Number(row.total_input) / 1_000_000) * pricingInput + (Number(row.total_output) / 1_000_000) * pricingOutput;
    return {
      totalRequests: Number(row.total_requests),
      inputTokens: Number(row.total_input),
      outputTokens: Number(row.total_output),
      costThisMonth: Math.round(cost * 10000) / 10000,
      monthlyBudget,
      budgetUsedPercent: monthlyBudget > 0 ? Math.round((cost / monthlyBudget) * 100 * 10) / 10 : 0,
    };
  } catch {
    return { totalRequests: 0, inputTokens: 0, outputTokens: 0, costThisMonth: 0, monthlyBudget, budgetUsedPercent: 0 };
  }
}

async function getTenantStats(): Promise<any[]> {
  // Check Redis cache first
  if (redisService.isConnected()) {
    const cached = await redisService.get('ops:tenant_stats');
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }
  }

  const tenants: any[] = [];

  if (config.MULTI_TENANT_ENABLED) {
    try {
      const orgs = await databaseService.queryControlPlane<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM organizations WHERE is_active = 1`
      );
      for (const org of orgs) {
        const userRows = await databaseService.queryControlPlane<{ total: number; active: number }>(
          `SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM users WHERE organization_id = ?`,
          [org.id]
        );
        tenants.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          totalUsers: Number(userRows[0]?.total || 0),
          activeUsers: Number(userRows[0]?.active || 0),
          apiRequestsToday: 0,
          apiRequestsWeek: 0,
          aiTokensThisMonth: 0,
          aiCostThisMonth: 0,
          projectCount: 0,
          taskCount: 0,
          storageRows: 0,
          lastActive: null,
        });
      }
    } catch { /* multi-tenant queries may fail if not set up */ }
  } else {
    // Single-tenant mode — return one row for the default instance
    try {
      const userRows = await databaseService.queryControlPlane<{ total: number; active: number }>(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM users`
      );
      const projRows = await databaseService.queryControlPlane<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM projects`
      );
      const taskRows = await databaseService.queryControlPlane<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM tasks`
      );
      const ai = await getAiBudgetInfo();
      tenants.push({
        id: 'default',
        name: 'Default Instance',
        slug: 'default',
        totalUsers: Number(userRows[0]?.total || 0),
        activeUsers: Number(userRows[0]?.active || 0),
        apiRequestsToday: 0,
        apiRequestsWeek: 0,
        aiTokensThisMonth: ai.inputTokens + ai.outputTokens,
        aiCostThisMonth: ai.costThisMonth,
        projectCount: Number(projRows[0]?.cnt || 0),
        taskCount: Number(taskRows[0]?.cnt || 0),
        storageRows: 0,
        lastActive: null,
      });
    } catch { /* ignore */ }
  }

  // Cache for 30s
  if (redisService.isConnected()) {
    redisService.set('ops:tenant_stats', JSON.stringify(tenants), 30).catch(() => {});
  }

  return tenants;
}

export async function operationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;

    try {
      // System metrics (sync)
      const mem = process.memoryUsage();
      const heapUsedMB = Math.round(mem.heapUsed / 1048576 * 100) / 100;
      const heapTotalMB = Math.round(mem.heapTotal / 1048576 * 100) / 100;
      const rssMB = Math.round(mem.rss / 1048576 * 100) / 100;
      const memoryPercent = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100 * 10) / 10 : 0;

      // OS-level memory
      const osTotalMB = Math.round(os.totalmem() / 1048576);
      const osFreeMB = Math.round(os.freemem() / 1048576);
      const osUsedMB = osTotalMB - osFreeMB;
      const osMemoryPercent = Math.round((osUsedMB / osTotalMB) * 100 * 10) / 10;

      // Swap
      const swap = getSwapUsage();

      const cpuUsage = process.cpuUsage();
      const uptimeMs = process.uptime() * 1000000; // microseconds
      const userPercent = uptimeMs > 0 ? Math.round((cpuUsage.user / uptimeMs) * 100 * 10) / 10 : 0;
      const systemPercent = uptimeMs > 0 ? Math.round((cpuUsage.system / uptimeMs) * 100 * 10) / 10 : 0;

      // DB pool info
      const pool = databaseService.getPool();
      let poolActive = 0, poolIdle = 0, poolTotal = 10, poolWaiting = 0;
      if (pool) {
        const p = pool.pool;
        poolActive = (p as any)?._allConnections?.length || 0;
        poolIdle = (p as any)?._freeConnections?.length || 0;
        poolWaiting = (p as any)?._connectionQueue?.length || 0;
        poolTotal = 10;
      }

      // Metrics snapshot
      const metrics = metricsService.getSnapshot();
      const totalReqs = metrics.requests.total;
      const errorRate5xx = totalReqs > 0 ? (metrics.errors.total5xx / totalReqs) * 100 : 0;

      // Async data
      const [redisMemory, aiBudget, disk, tenants] = await Promise.all([
        getRedisMemory(),
        getAiBudgetInfo(),
        Promise.resolve(getDiskUsage()),
        getTenantStats(),
      ]);

      // Compute warnings
      const warnings = computeWarnings({
        memoryPercent: osMemoryPercent,
        poolActive,
        poolTotal,
        p99Ms: metrics.latency.p99Ms,
        errorRate5xx,
        aiBudgetPercent: aiBudget.budgetUsedPercent,
        redisConnected: redisService.isConnected(),
        diskPercent: disk?.percentUsed ?? null,
        swapPercent: swap?.percentUsed ?? null,
      });

      // Summary aggregates — query directly, don't rely on tenants array
      let totalTenants = 0;
      let totalUsers = 0;
      try {
        if (config.MULTI_TENANT_ENABLED) {
          const orgRows = await databaseService.queryControlPlane<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM organizations WHERE is_active = 1`);
          totalTenants = Number(orgRows[0]?.cnt || 0);
        } else {
          totalTenants = 1;
        }
        const userRows = await databaseService.queryControlPlane<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM users WHERE is_active = 1`);
        totalUsers = Number(userRows[0]?.cnt || 0);
      } catch { /* fall back to tenant-derived counts */
        totalTenants = tenants.length || (config.MULTI_TENANT_ENABLED ? 0 : 1);
        totalUsers = tenants.reduce((sum, t) => sum + t.totalUsers, 0);
      }
      const availableRAM = osFreeMB;
      const estimatedHeadroom = Math.max(0, Math.floor(availableRAM / 15));

      return {
        system: {
          uptime: Math.floor(process.uptime()),
          memory: {
            heapUsedMB, heapTotalMB, rssMB, percentUsed: memoryPercent,
            osTotalMB, osUsedMB, osAvailableMB: osFreeMB, osPercent: osMemoryPercent,
          },
          swap,
          cpu: { userPercent, systemPercent },
          db: {
            poolActive,
            poolIdle,
            poolTotal,
            poolWaiting,
            latencyP50: metrics.latency.p50Ms,
            latencyP95: metrics.latency.p95Ms,
            latencyP99: metrics.latency.p99Ms,
            totalQueries: metrics.db.totalQueries,
          },
          redis: { connected: redisService.isConnected(), memoryUsedMB: redisMemory },
          api: {
            totalRequests: totalReqs,
            activeRequests: metrics.requests.activeRequests,
            p50Ms: metrics.latency.p50Ms,
            p95Ms: metrics.latency.p95Ms,
            p99Ms: metrics.latency.p99Ms,
            errorRate5xx: Math.round(errorRate5xx * 10) / 10,
          },
          ai: aiBudget,
          disk,
        },
        summary: { totalTenants, totalUsers, estimatedHeadroom },
        warnings,
        tenants,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
