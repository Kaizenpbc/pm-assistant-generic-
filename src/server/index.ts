import 'dotenv/config';
import Fastify from 'fastify';
import { config } from './config';
import { registerPlugins } from './plugins';
import { registerRoutes } from './routes';
import { databaseService } from './database/connection';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug'
  }
});

async function start() {
  try {
    console.log('Initializing PM Assistant...');

    console.log('Testing database connection...');
    const isConnected = await databaseService.testConnection();
    databaseService.setConnected(isConnected);
    if (!isConnected) {
      console.log('Database connection failed - running in offline mode');
    } else {
      console.log('Database connection successful');
    }

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

    console.log(`PM Assistant running on http://${config.HOST}:${config.PORT}`);
    console.log(`API Documentation: http://${config.HOST}:${config.PORT}/documentation`);
    console.log(`Health Check: http://${config.HOST}:${config.PORT}/health`);

  } catch (err) {
    console.error('Failed to start server:', err);
    fastify.log.error(err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await fastify.close();
  await databaseService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await fastify.close();
  await databaseService.close();
  process.exit(0);
});

start();
