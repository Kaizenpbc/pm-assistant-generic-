import { FastifyInstance } from 'fastify';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { userRoutes } from './routes/users';
import { scheduleRoutes } from './routes/schedules';

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(projectRoutes, { prefix: '/api/v1/projects' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  await fastify.register(scheduleRoutes, { prefix: '/api/v1/schedules' });
}
