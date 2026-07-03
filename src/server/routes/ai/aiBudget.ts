import { FastifyInstance } from 'fastify';
import { aiBudgetService } from '../../services/AIBudgetService';

export async function aiBudgetRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request) => {
    const user = (request as any).user;
    const usage = await aiBudgetService.getMonthlyUsage(user.userId);
    return usage;
  });
}
