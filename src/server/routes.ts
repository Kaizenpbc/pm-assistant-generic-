import { FastifyInstance } from 'fastify';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { userRoutes } from './routes/users';
import { scheduleRoutes } from './routes/schedules';
import { aiChatRoutes } from './routes/aiChat';
import { aiSchedulingRoutes } from './routes/aiScheduling';
import { alertRoutes } from './routes/alerts';
import { predictionRoutes } from './routes/predictions';
import { aiReportRoutes } from './routes/aiReports';
import { learningRoutes } from './routes/learning';
import { intelligenceRoutes } from './routes/intelligence';

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(projectRoutes, { prefix: '/api/v1/projects' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  await fastify.register(scheduleRoutes, { prefix: '/api/v1/schedules' });
  await fastify.register(aiChatRoutes, { prefix: '/api/v1/ai-chat' });
  await fastify.register(aiSchedulingRoutes, { prefix: '/api/v1/ai-scheduling' });
  await fastify.register(alertRoutes, { prefix: '/api/v1/alerts' });
  await fastify.register(predictionRoutes, { prefix: '/api/v1/predictions' });
  await fastify.register(aiReportRoutes, { prefix: '/api/v1/ai-reports' });
  await fastify.register(learningRoutes, { prefix: '/api/v1/learning' });
  await fastify.register(intelligenceRoutes, { prefix: '/api/v1/intelligence' });
}
