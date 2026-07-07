import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { riskService } from '../../services/RiskService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { PredictiveIntelligenceService } from '../../services/predictiveIntelligence';
import { lessonsLearnedService } from '../../services/LessonsLearnedService';
import { projectService } from '../../services/ProjectService';

const createRiskSchema = z.object({
  type: z.enum(['risk', 'issue']),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  category: z.enum(['schedule', 'budget', 'resource', 'technical', 'regulatory', 'stakeholder', 'weather', 'dependency', 'other']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  status: z.enum(['open', 'monitoring', 'mitigating', 'mitigated', 'closed', 'resolved']).optional(),
  triggerCondition: z.string().max(2000).optional(),
  mitigationPlan: z.string().max(5000).optional(),
  responsePlan: z.string().max(5000).optional(),
  ownerId: z.string().optional(),
  linkedTaskIds: z.array(z.string()).optional(),
});

const updateRiskSchema = createRiskSchema.partial();

const filterSchema = z.object({
  type: z.enum(['risk', 'issue']).optional(),
  status: z.enum(['open', 'monitoring', 'mitigating', 'mitigated', 'closed', 'resolved']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  source: z.enum(['manual', 'ai_detected', 'agent']).optional(),
  sort: z.enum(['risk_score', 'created_at', 'severity', 'status']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export async function riskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/v1/projects/:projectId/risks — List risks with filters
  fastify.get('/:projectId/risks', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const filters = filterSchema.parse(request.query);
      const risks = await riskService.findByProject(projectId, filters);
      return reply.send({ data: risks });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.issues });
      fastify.log.error({ err }, 'Failed to list risks');
      return reply.status(500).send({ error: 'Failed to list risks' });
    }
  });

  // GET /api/v1/projects/:projectId/risks/stats — Summary counts
  fastify.get('/:projectId/risks/stats', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const stats = await riskService.getStats(projectId);
      return reply.send({ data: stats });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get risk stats');
      return reply.status(500).send({ error: 'Failed to get risk stats' });
    }
  });

  // GET /api/v1/projects/:projectId/risks/:riskId — Get single risk
  fastify.get('/:projectId/risks/:riskId', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { riskId } = request.params as { projectId: string; riskId: string };
      const risk = await riskService.findById(riskId);
      if (!risk) return reply.status(404).send({ error: 'Risk not found' });
      return reply.send({ data: risk });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get risk');
      return reply.status(500).send({ error: 'Failed to get risk' });
    }
  });

  // POST /api/v1/projects/:projectId/risks — Create risk/issue
  fastify.post('/:projectId/risks', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const body = createRiskSchema.parse(request.body);
      const userId = request.user!.userId;
      const risk = await riskService.create({ ...body, projectId, createdBy: userId });
      return reply.status(201).send({ data: risk });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.issues });
      fastify.log.error({ err }, 'Failed to create risk');
      return reply.status(500).send({ error: 'Failed to create risk' });
    }
  });

  // PUT /api/v1/projects/:projectId/risks/:riskId — Update risk/issue
  fastify.put('/:projectId/risks/:riskId', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { riskId } = request.params as { projectId: string; riskId: string };
      const body = updateRiskSchema.parse(request.body);
      const risk = await riskService.update(riskId, body);
      if (!risk) return reply.status(404).send({ error: 'Risk not found' });
      return reply.send({ data: risk });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', details: err.issues });
      fastify.log.error({ err }, 'Failed to update risk');
      return reply.status(500).send({ error: 'Failed to update risk' });
    }
  });

  // DELETE /api/v1/projects/:projectId/risks/:riskId — Delete risk/issue
  fastify.delete('/:projectId/risks/:riskId', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { riskId } = request.params as { projectId: string; riskId: string };
      const deleted = await riskService.delete(riskId);
      if (!deleted) return reply.status(404).send({ error: 'Risk not found' });
      return reply.send({ message: 'Deleted' });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete risk');
      return reply.status(500).send({ error: 'Failed to delete risk' });
    }
  });

  // POST /api/v1/projects/:projectId/risks/ai-scan — Trigger AI risk scan & import
  fastify.post('/:projectId/risks/ai-scan', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = request.user!.userId;

      const service = new PredictiveIntelligenceService(fastify);
      const { assessment } = await service.assessProjectRisks(projectId, userId);

      const result = await riskService.importFromAIScan(projectId, assessment.risks || [], userId);
      return reply.send({ data: result, aiPowered: true });
    } catch (err) {
      fastify.log.error({ err }, 'AI risk scan failed');
      return reply.status(500).send({ error: 'AI risk scan failed' });
    }
  });

  // POST /api/v1/projects/:projectId/risks/:riskId/suggest-mitigation — AI mitigation suggestions
  fastify.post('/:projectId/risks/:riskId/suggest-mitigation', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId, riskId } = request.params as { projectId: string; riskId: string };
      const risk = await riskService.findById(riskId);
      if (!risk) return reply.status(404).send({ error: 'Risk not found' });

      const project = await projectService.findById(projectId);
      const projectType = project?.projectType || project?.category || 'other';
      const userId = request.user!.userId;

      const suggestions = await lessonsLearnedService.suggestMitigations(
        `${risk.title}: ${risk.description || ''}`,
        projectType,
        userId,
      );
      return reply.send({ data: suggestions });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to suggest mitigations');
      return reply.status(500).send({ error: 'Failed to suggest mitigations' });
    }
  });
}
