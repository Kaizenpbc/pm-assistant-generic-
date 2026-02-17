import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnomalyDetectionService } from '../services/anomalyDetectionService';
import { CrossProjectIntelligenceService } from '../services/crossProjectIntelligenceService';
import { WhatIfScenarioService } from '../services/whatIfScenarioService';
import { AIScenarioRequestSchema } from '../schemas/phase5Schemas';
import { authMiddleware } from '../middleware/auth';

export async function intelligenceRoutes(fastify: FastifyInstance) {
  const anomalyService = new AnomalyDetectionService(fastify);
  const crossProjectService = new CrossProjectIntelligenceService(fastify);
  const scenarioService = new WhatIfScenarioService(fastify);

  // Anomaly Detection
  fastify.get('/anomalies', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId || undefined;
      const report = await anomalyService.detectPortfolioAnomalies(userId);
      return reply.send({ data: report, aiPowered: report.aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Portfolio anomaly detection failed');
      return reply.status(500).send({ error: 'Failed to detect anomalies' });
    }
  });

  fastify.get('/anomalies/project/:projectId', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = request.user.userId || undefined;
      const report = await anomalyService.detectProjectAnomalies(projectId, userId);
      return reply.send({ data: report, aiPowered: report.aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Project anomaly detection failed');
      return reply.status(500).send({ error: 'Failed to detect project anomalies' });
    }
  });

  // Cross-Project Intelligence
  fastify.get('/cross-project', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId || undefined;
      const { insight, aiPowered } = await crossProjectService.analyzePortfolio(userId);
      return reply.send({ data: insight, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Cross-project analysis failed');
      return reply.status(500).send({ error: 'Failed to analyze cross-project intelligence' });
    }
  });

  fastify.get('/cross-project/similar/:projectId', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = request.user.userId || undefined;
      const { similar, aiPowered } = await crossProjectService.findSimilarProjects(projectId, userId);
      return reply.send({ data: similar, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Similar projects search failed');
      return reply.status(500).send({ error: 'Failed to find similar projects' });
    }
  });

  // What-If Scenarios
  fastify.post('/scenarios', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AIScenarioRequestSchema.parse(request.body);
      const userId = request.user.userId || undefined;
      const { result, aiPowered } = await scenarioService.modelScenario(parsed, userId);
      return reply.send({ data: result, aiPowered });
    } catch (err) {
      if (err instanceof Error && err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid scenario request data' });
      }
      fastify.log.error({ err }, 'Scenario modeling failed');
      return reply.status(500).send({ error: 'Failed to model scenario' });
    }
  });
}
