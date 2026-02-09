import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PredictiveIntelligenceService } from '../services/predictiveIntelligence';

export async function predictionRoutes(fastify: FastifyInstance) {
  const service = new PredictiveIntelligenceService(fastify);

  // GET /dashboard — Portfolio predictions
  fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId || undefined;
      const { predictions, aiPowered } = await service.getDashboardPredictions(userId);
      return reply.send({ data: predictions, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Dashboard predictions failed');
      return reply.status(500).send({ error: 'Failed to generate dashboard predictions' });
    }
  });

  // GET /project/:projectId/risks — Full risk assessment
  fastify.get('/project/:projectId/risks', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params;
      const userId = (request as any).userId || undefined;
      const { assessment, aiPowered } = await service.assessProjectRisks(projectId, userId);
      return reply.send({ data: assessment, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Risk assessment failed');
      return reply.status(500).send({ error: 'Failed to generate risk assessment' });
    }
  });

  // GET /project/:projectId/weather — Weather impact analysis
  fastify.get('/project/:projectId/weather', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params;
      const userId = (request as any).userId || undefined;
      const { impact, aiPowered } = await service.analyzeWeatherImpact(projectId, userId);
      return reply.send({ data: impact, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Weather impact analysis failed');
      return reply.status(500).send({ error: 'Failed to analyze weather impact' });
    }
  });

  // GET /project/:projectId/budget — Budget forecast with EVM
  fastify.get('/project/:projectId/budget', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params;
      const userId = (request as any).userId || undefined;
      const { forecast, aiPowered } = await service.forecastBudget(projectId, userId);
      return reply.send({ data: forecast, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Budget forecast failed');
      return reply.status(500).send({ error: 'Failed to generate budget forecast' });
    }
  });

  // GET /project/:projectId/health — Composite health score
  fastify.get('/project/:projectId/health', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params;
      const userId = (request as any).userId || undefined;
      const result = await service.getProjectHealthScore(projectId, userId);
      return reply.send({ data: result });
    } catch (err) {
      fastify.log.error({ err }, 'Health score calculation failed');
      return reply.status(500).send({ error: 'Failed to calculate health score' });
    }
  });
}
