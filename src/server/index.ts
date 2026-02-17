import 'dotenv/config';
import Fastify from 'fastify';
import { config } from './config';
import { registerPlugins } from './plugins';
import { registerRoutes } from './routes';
import { databaseService } from './database/connection';
import { createServiceLogger } from './utils/logger';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  // In production, only trust a single proxy hop (e.g. load balancer).
  // In dev/test, trust all proxies for convenience.
  trustProxy: config.NODE_ENV === 'production' ? 1 : true,
  bodyLimit: 10 * 1024 * 1024, // 10MB body limit enforced at stream level
});

// ---------------------------------------------------------------------------
// Graceful shutdown with request draining
// ---------------------------------------------------------------------------

const DRAIN_TIMEOUT_MS = 10_000; // wait up to 10s for in-flight requests
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  fastify.log.info(`Received ${signal} — starting graceful shutdown...`);

  // Stop accepting new connections, drain existing ones.
  // DB pool is closed via Fastify's onClose hook (registered in plugins.ts),
  // which ensures it stays open while in-flight requests drain.
  try {
    const drainTimer = setTimeout(() => {
      fastify.log.warn('Drain timeout reached, forcing shutdown');
      process.exit(1);
    }, DRAIN_TIMEOUT_MS);

    await fastify.close(); // triggers onClose hooks including DB pool close
    clearTimeout(drainTimer);
    fastify.log.info('Server closed, all connections drained');
  } catch (err) {
    fastify.log.error({ err }, 'Error during server close');
  }

  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors — log and exit
process.on('uncaughtException', (err) => {
  fastify.log.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  fastify.log.fatal({ err: reason }, 'Unhandled rejection — shutting down');
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  try {
    fastify.log.info('Initializing PM Assistant...');

    fastify.log.info('Testing database connection...');
    const isConnected = await databaseService.testConnection();
    if (!isConnected) {
      fastify.log.warn('Database connection failed — running in offline mode');
    } else {
      fastify.log.info('Database connection successful');
    }

    fastify.log.info('Registering plugins...');
    await registerPlugins(fastify);
    fastify.log.info('Plugins registered');

    fastify.log.info('Registering routes...');
    await registerRoutes(fastify);
    fastify.log.info('Routes registered');

    fastify.log.info('Starting server...');
    await fastify.listen({
      port: config.PORT,
      host: config.HOST,
    });

    fastify.log.info(`PM Assistant running on http://${config.HOST}:${config.PORT}`);
    fastify.log.info(`API Documentation: http://${config.HOST}:${config.PORT}/documentation`);
    fastify.log.info(`Health Check: http://${config.HOST}:${config.PORT}/health`);
  } catch (err) {
    fastify.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
