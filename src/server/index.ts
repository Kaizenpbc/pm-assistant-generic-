import 'dotenv/config';
import Fastify from 'fastify';
import { config } from './config';
import { registerPlugins } from './plugins';
import { registerRoutes } from './routes';
import { databaseService } from './database/connection';
import { runMigrations } from './database/migrationRunner';
import { runAllTenantMigrations } from './database/tenantMigrationRunner';
import './services/agentCapabilities';
import { redisService } from './services/RedisService';
import { metricsService } from './services/MetricsService';
import { serviceContainer } from './container';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug'
  }
});

async function start() {
  try {
    console.log('Initializing Kovarti PM Assistant...');

    console.log('Testing database connection...');
    const isConnected = await databaseService.testConnection();
    if (!isConnected) {
      console.log('Database connection failed - running in offline mode');
    } else {
      console.log('Database connection successful');
      await runMigrations();

      // Run pending tenant migrations if multi-tenant is enabled
      if (config.MULTI_TENANT_ENABLED) {
        console.log('Running tenant migrations...');
        await runAllTenantMigrations();
      }
    }

    // Connect to Redis (optional — graceful degradation if unavailable)
    if (config.REDIS_URL) {
      console.log('Connecting to Redis...');
      redisService.connect(config.REDIS_URL);
      // Load persisted metrics from Redis
      await metricsService.loadFromRedis();
    }

    // Register service container for DI
    fastify.decorate('services', serviceContainer);

    console.log('Registering plugins...');
    await registerPlugins(fastify);
    console.log('Plugins registered');

    console.log('Registering routes...');
    await registerRoutes(fastify);
    console.log('Routes registered');

    console.log('Starting server...');
    await fastify.listen({
      port: config.PORT,
      host: config.HOST
    });

    console.log(`Kovarti PM Assistant running on http://${config.HOST}:${config.PORT}`);
    console.log(`API Documentation: http://${config.HOST}:${config.PORT}/documentation`);
    console.log(`Health Check: http://${config.HOST}:${config.PORT}/health`);

    // Start Redis metrics sync if connected
    if (redisService.isConnected()) {
      metricsService.startRedisSync();
    }

    console.log('Cron jobs managed externally via systemd timers (see /etc/systemd/system/pm-cron-*.timer)');

  } catch (err) {
    console.error('Failed to start server:', err);
    fastify.log.error(err);
    process.exit(1);
  }
}

// Crash-safety: log and exit on uncaught errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — shutting down:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — shutting down:', reason);
  process.exit(1);
});

async function gracefulShutdown(signal: string) {
  console.log(`${signal} received — shutting down server...`);
  // Force exit after 30s if graceful shutdown hangs (e.g. long AI call)
  const forceTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out after 30s — forcing exit');
    process.exit(1);
  }, 30_000);
  forceTimer.unref();

  metricsService.stopRedisSync();
  await fastify.close();
  await redisService.disconnect();
  await databaseService.close();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

start();
