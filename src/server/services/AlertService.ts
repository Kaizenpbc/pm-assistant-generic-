import { config } from '../config';
import { redisService } from './RedisService';
import { emailService } from './EmailService';
import { metricsService } from './MetricsService';
import { degradationHandler } from './agents/DegradationHandler';
import { aiBudgetService } from './AIBudgetService';
import { notificationService } from './NotificationService';
import { databaseService } from '../database/connection';
import logger from '../utils/logger';

type AlertType =
  | 'error_rate_high'
  | 'ai_budget_warning'
  | 'ai_budget_critical'
  | 'circuit_breaker_open'
  | 'db_latency_high'
  | 'db_connection_lost';

interface Alert {
  type: AlertType;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
}

class AlertService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  start(): void {
    if (!config.ALERT_ENABLED) return;
    if (this.checkInterval) return;

    logger.info('[AlertService] Starting alert monitoring');
    // Run first check after 60s (let system stabilize)
    setTimeout(() => this.runChecks(), 60_000);
    this.checkInterval = setInterval(() => this.runChecks(), AlertService.CHECK_INTERVAL_MS);
    if (this.checkInterval.unref) this.checkInterval.unref();
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async runChecks(): Promise<void> {
    try {
      await Promise.allSettled([
        this.checkErrorRate(),
        this.checkAIBudget(),
        this.checkCircuitBreakers(),
        this.checkDatabaseHealth(),
      ]);
    } catch (err) {
      logger.error('[AlertService] Check cycle failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async checkErrorRate(): Promise<void> {
    const snapshot = metricsService.getSnapshot();
    if (snapshot.requests.total < 100) return; // Not enough data

    const errorRate = (snapshot.errors.total5xx / snapshot.requests.total) * 100;
    if (errorRate >= 10) {
      await this.fire({
        type: 'error_rate_high',
        severity: 'critical',
        title: 'High Error Rate',
        message: `Server error rate is ${errorRate.toFixed(1)}% (${snapshot.errors.total5xx} of ${snapshot.requests.total} requests). P95 latency: ${snapshot.latency.p95Ms}ms.`,
      });
    }
  }

  private async checkAIBudget(): Promise<void> {
    try {
      // Get admin users to check global budget
      const rows = await databaseService.query(
        "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1"
      );
      if (rows.length === 0) return;

      const adminId = (rows[0] as any).id;
      const usage = await aiBudgetService.getMonthlyUsage(adminId);

      if (usage.percentUsed >= 95) {
        await this.fire({
          type: 'ai_budget_critical',
          severity: 'critical',
          title: 'AI Budget Critical',
          message: `AI token budget is ${usage.percentUsed}% used (${usage.totalTokens.toLocaleString()} of ${usage.budget.toLocaleString()} tokens). Only ${usage.remaining.toLocaleString()} tokens remaining this month.`,
        });
      } else if (usage.percentUsed >= 80) {
        await this.fire({
          type: 'ai_budget_warning',
          severity: 'warning',
          title: 'AI Budget Warning',
          message: `AI token budget is ${usage.percentUsed}% used (${usage.totalTokens.toLocaleString()} of ${usage.budget.toLocaleString()} tokens). ${usage.remaining.toLocaleString()} tokens remaining this month.`,
        });
      }
    } catch {
      // Non-critical — budget check may fail if no AI usage
    }
  }

  private async checkCircuitBreakers(): Promise<void> {
    const health = await degradationHandler.getHealthStatus();
    const openBreakers = Object.entries(health.circuitBreakers)
      .filter(([, b]) => b.state === 'open')
      .map(([name, b]) => `${name} (${b.consecutiveFailures} failures)`);

    if (openBreakers.length > 0) {
      await this.fire({
        type: 'circuit_breaker_open',
        severity: 'critical',
        title: 'Circuit Breaker Open',
        message: `${openBreakers.length} circuit breaker(s) are open: ${openBreakers.join(', ')}. Recommended scan scope: ${health.recommendedScope}.`,
      });
    }
  }

  private async checkDatabaseHealth(): Promise<void> {
    const health = await degradationHandler.checkDatabaseHealth();

    if (!health.healthy) {
      await this.fire({
        type: 'db_connection_lost',
        severity: 'critical',
        title: 'Database Connection Lost',
        message: 'Database health check failed. The application may be unable to serve requests.',
      });
    } else if (health.latencyMs > 2000) {
      await this.fire({
        type: 'db_latency_high',
        severity: 'warning',
        title: 'High Database Latency',
        message: `Database latency is ${health.latencyMs}ms (threshold: 2000ms). Performance may be degraded.`,
      });
    }
  }

  private async fire(alert: Alert): Promise<void> {
    // Cooldown check via Redis
    const cooldownKey = `alert:cooldown:${alert.type}`;
    if (redisService.isConnected()) {
      const existing = await redisService.get(cooldownKey);
      if (existing) return; // Already alerted within cooldown window
      await redisService.set(cooldownKey, '1', config.ALERT_COOLDOWN_MINUTES * 60);
    }

    logger.warn(`[AlertService] ALERT: ${alert.title} — ${alert.message}`);

    // Send email alert
    if (config.ALERT_EMAIL) {
      emailService.sendNotificationEmail(
        config.ALERT_EMAIL,
        `[${alert.severity.toUpperCase()}] ${alert.title}`,
        alert.title,
        alert.message,
        `${config.APP_URL}/admin`,
        'View Admin Panel',
      ).catch(err => logger.error('[AlertService] Email alert failed', {
        error: err instanceof Error ? err.message : String(err),
      }));
    }

    // Send webhook alert
    if (config.ALERT_WEBHOOK_URL) {
      fetch(config.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: new Date().toISOString(),
          source: 'pm-assistant',
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(err => logger.error('[AlertService] Webhook alert failed', {
        error: err instanceof Error ? err.message : String(err),
      }));
    }

    // Create in-app notification for admin users
    try {
      const admins = await databaseService.query(
        "SELECT id FROM users WHERE role = 'admin' AND is_active = 1"
      );
      for (const admin of admins as any[]) {
        notificationService.create({
          userId: admin.id,
          type: 'system_alert',
          severity: alert.severity === 'critical' ? 'high' : 'medium',
          title: alert.title,
          message: alert.message,
        }).catch(() => {}); // Fire-and-forget
      }
    } catch {
      // Non-critical
    }
  }
}

export const alertService = new AlertService();
