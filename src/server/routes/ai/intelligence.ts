import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnomalyDetectionService } from '../../services/anomalyDetectionService';
import { CrossProjectIntelligenceService } from '../../services/crossProjectIntelligenceService';
import { WhatIfScenarioService } from '../../services/whatIfScenarioService';
import { AIScenarioRequestSchema } from '../../schemas/phase5Schemas';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { requireFeature } from '../../middleware/requireTier';
import { userService } from '../../services/UserService';

export async function intelligenceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const anomalyService = new AnomalyDetectionService(fastify);
  const crossProjectService = new CrossProjectIntelligenceService(fastify);
  const scenarioService = new WhatIfScenarioService(fastify);

  // Helper: check if request user is on trial tier
  async function isTrialUser(request: FastifyRequest): Promise<boolean> {
    if (request.user!.role === 'admin') return false;
    const user = await userService.findById(request.user!.userId);
    return !!(user && user.subscriptionTier === 'trial');
  }

  // Anomaly Detection
  // Trial users get sample data with an upgrade prompt.
  fastify.get('/anomalies', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (await isTrialUser(request)) {
        return reply.send({ data: generateSampleAnomalies(), aiPowered: false, sample: true });
      }
      const userId = request.user!.userId;
      const report = await anomalyService.detectPortfolioAnomalies(userId);
      return reply.send({ data: report, aiPowered: report.aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Portfolio anomaly detection failed');
      return reply.status(500).send({ error: 'Failed to detect anomalies' });
    }
  });

  fastify.get('/anomalies/project/:projectId', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (await isTrialUser(request)) {
        return reply.send({ data: generateSampleAnomalies(), aiPowered: false, sample: true });
      }
      const { projectId } = request.params as { projectId: string };
      const userId = request.user!.userId;
      const report = await anomalyService.detectProjectAnomalies(projectId, userId);
      return reply.send({ data: report, aiPowered: report.aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Project anomaly detection failed');
      return reply.status(500).send({ error: 'Failed to detect project anomalies' });
    }
  });

  // Cross-Project Intelligence
  // Trial users get sample data with an upgrade prompt.
  fastify.get('/cross-project', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (await isTrialUser(request)) {
        return reply.send({ data: generateSampleCrossProject(), aiPowered: false, sample: true });
      }
      const userId = request.user!.userId;
      const { insight, aiPowered } = await crossProjectService.analyzePortfolio(userId);
      return reply.send({ data: insight, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Cross-project analysis failed');
      return reply.status(500).send({ error: 'Failed to analyze cross-project intelligence' });
    }
  });

  fastify.get('/cross-project/similar/:projectId', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (await isTrialUser(request)) {
        return reply.send({ data: [], aiPowered: false, sample: true });
      }
      const { projectId } = request.params as { projectId: string };
      const userId = request.user!.userId;
      const { similar, aiPowered } = await crossProjectService.findSimilarProjects(projectId, userId);
      return reply.send({ data: similar, aiPowered });
    } catch (err) {
      fastify.log.error({ err }, 'Similar projects search failed');
      return reply.status(500).send({ error: 'Failed to find similar projects' });
    }
  });

  // What-If Scenarios
  fastify.post('/scenarios', {
    preHandler: [requireScope('write'), requireFeature('cross_project_intelligence')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AIScenarioRequestSchema.parse(request.body);
      const userId = request.user!.userId;
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

function generateSampleAnomalies() {
  return {
    anomalies: [
      { type: 'schedule_drift', projectId: 'demo-1', projectName: 'ERP Migration', severity: 'high', title: 'Schedule Slipping', description: 'Project is 12 days behind baseline schedule.', recommendation: 'Review critical path tasks and consider adding resources.' },
      { type: 'budget_overrun', projectId: 'demo-2', projectName: 'Mobile App v2', severity: 'medium', title: 'Budget Trending Over', description: 'Current burn rate projects 15% over budget at completion.', recommendation: 'Review scope and identify cost reduction opportunities.' },
      { type: 'resource_conflict', projectId: 'demo-3', projectName: 'Data Platform', severity: 'low', title: 'Resource Over-allocation', description: 'Senior developer allocated at 140% across projects.', recommendation: 'Rebalance workload or defer non-critical tasks.' },
    ],
    summary: 'Portfolio shows 1 high-severity anomaly requiring attention. Overall health is stable with minor resource concerns.',
    overallHealthTrend: 'stable',
    scannedProjects: 5,
  };
}

function generateSampleCrossProject() {
  return {
    resourceConflicts: [
      { description: 'Senior Developer over-allocated across ERP Migration and Mobile App v2 (140%)', severity: 'medium' },
      { description: 'QA Lead assigned to 3 projects with overlapping test phases', severity: 'low' },
    ],
    portfolioRiskHeatMap: [
      { projectId: 'demo-1', projectName: 'ERP Migration', healthScore: 62, riskLevel: 'medium', budgetUtilization: 78, progress: 55 },
      { projectId: 'demo-2', projectName: 'Mobile App v2', healthScore: 81, riskLevel: 'low', budgetUtilization: 45, progress: 72 },
      { projectId: 'demo-3', projectName: 'Data Platform', healthScore: 45, riskLevel: 'high', budgetUtilization: 92, progress: 38 },
      { projectId: 'demo-4', projectName: 'Website Redesign', healthScore: 90, riskLevel: 'low', budgetUtilization: 30, progress: 85 },
    ],
    budgetReallocation: {
      surplusCandidates: [
        { projectId: 'demo-4', projectName: 'Website Redesign', surplus: 35000 },
      ],
      deficitCandidates: [
        { projectId: 'demo-3', projectName: 'Data Platform', deficit: 28000 },
      ],
      recommendations: [
        'Consider reallocating $28K from Website Redesign surplus to Data Platform deficit.',
        'Review Data Platform scope to identify potential cost reductions.',
      ],
    },
    summary: 'Portfolio of 4 projects shows generally healthy status. Data Platform is the primary concern with high risk and 92% budget utilization at only 38% progress.',
  };
}
