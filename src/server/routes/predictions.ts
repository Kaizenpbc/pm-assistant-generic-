import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PredictiveIntelligenceService } from '../services/predictiveIntelligence';
import { sCurveService } from '../services/SCurveService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function predictionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const service = new PredictiveIntelligenceService(fastify);

  // GET /dashboard — Portfolio predictions
  fastify.get('/dashboard', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.userId;
      const { predictions, aiPowered } = await service.getDashboardPredictions(userId);
      return reply.send({ data: predictions, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Dashboard predictions failed');
      return reply.status(500).send({ error: 'Failed to generate dashboard predictions' });
    }
  });

  // GET /project/:projectId/risks — Full risk assessment
  fastify.get('/project/:projectId/risks', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = (request as any).user.userId;
      const { assessment, aiPowered } = await service.assessProjectRisks(projectId, userId);
      return reply.send({ data: assessment, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Risk assessment failed');
      return reply.status(500).send({ error: 'Failed to generate risk assessment' });
    }
  });

  // GET /project/:projectId/weather — Weather impact analysis
  fastify.get('/project/:projectId/weather', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = (request as any).user.userId;
      const { impact, aiPowered } = await service.analyzeWeatherImpact(projectId, userId);
      return reply.send({ data: impact, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Weather impact analysis failed');
      return reply.status(500).send({ error: 'Failed to analyze weather impact' });
    }
  });

  // GET /project/:projectId/budget — Budget forecast with EVM
  fastify.get('/project/:projectId/budget', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = (request as any).user.userId;
      const { forecast, aiPowered } = await service.forecastBudget(projectId, userId);
      return reply.send({ data: forecast, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Budget forecast failed');
      return reply.status(500).send({ error: 'Failed to generate budget forecast' });
    }
  });

  // GET /project/:projectId/health — Composite health score
  fastify.get('/project/:projectId/health', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = (request as any).user.userId;
      const result = await service.getProjectHealthScore(projectId, userId);
      return reply.send({ data: result });
    } catch (err) {
      fastify.log.error({ err }, 'Health score calculation failed');
      return reply.status(500).send({ error: 'Failed to calculate health score' });
    }
  });

  // GET /project/:projectId/evm/s-curve — S-Curve data
  fastify.get('/project/:projectId/evm/s-curve', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const data = await sCurveService.computeSCurveData(projectId);
      return reply.send({ data });
    } catch (err) {
      fastify.log.error({ err }, 'S-Curve computation failed');
      return reply.status(500).send({ error: 'Failed to compute S-Curve data' });
    }
  });
}
