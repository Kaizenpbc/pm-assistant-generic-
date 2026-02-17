import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { LessonsLearnedService } from '../services/LessonsLearnedService';
import { projectIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

const mitigationsBodySchema = z.object({
  riskDescription: z.string().min(1, 'riskDescription is required'),
  projectType: z.string().min(1, 'projectType is required'),
});

const addLessonBodySchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  projectName: z.string().default(''),
  projectType: z.string().default('other'),
  category: z.enum(['schedule', 'budget', 'resource', 'risk', 'technical', 'communication', 'stakeholder', 'quality']).default('quality'),
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  impact: z.enum(['positive', 'negative', 'neutral']).default('neutral'),
  recommendation: z.string().min(1, 'recommendation is required'),
  confidence: z.number().min(0).max(100).optional(),
});

export async function lessonsLearnedRoutes(fastify: FastifyInstance) {
  const service = new LessonsLearnedService();

  // GET /knowledge-base — Aggregated knowledge base overview
  fastify.get('/knowledge-base', { preHandler: [authMiddleware] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const overview = await service.getKnowledgeBase();
      return reply.send({ data: overview });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get knowledge base');
      return reply.status(500).send({ error: 'Failed to retrieve knowledge base' });
    }
  });

  // POST /extract/:projectId — Extract lessons from a project
  fastify.post('/extract/:projectId', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });
      const lessons = await service.extractLessons(projectId, userId);
      return reply.send({ lessons });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to extract lessons');
      return reply.status(500).send({ error: 'Failed to extract lessons' });
    }
  });

  // GET /relevant — Find relevant lessons by projectType and/or category
  fastify.get('/relevant', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const querySchema = z.object({ projectType: z.string().optional(), category: z.string().optional() });
      const { projectType, category } = querySchema.parse(request.query);
      const lessons = await service.findRelevantLessons(projectType, category);
      return reply.send({ lessons });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to find relevant lessons');
      return reply.status(500).send({ error: 'Failed to find relevant lessons' });
    }
  });

  // POST /patterns — Detect cross-project patterns
  fastify.post('/patterns', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;
      const patterns = await service.detectPatterns(userId);
      return reply.send({ patterns });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to detect patterns');
      return reply.status(500).send({ error: 'Failed to detect patterns' });
    }
  });

  // POST /mitigations — Suggest mitigations for a risk
  fastify.post('/mitigations', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { riskDescription, projectType } = mitigationsBodySchema.parse(request.body);
      const userId = request.user.userId;
      const suggestions = await service.suggestMitigations(riskDescription, projectType, userId);
      return reply.send({ suggestions });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to suggest mitigations');
      return reply.status(500).send({ error: 'Failed to suggest mitigations' });
    }
  });

  // POST / — Add a lesson manually
  fastify.post('/', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const body = addLessonBodySchema.parse(request.body);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(body.projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
      const lesson = await service.addLesson({
        projectId: body.projectId,
        projectName: body.projectName,
        projectType: body.projectType,
        category: body.category,
        title: body.title,
        description: body.description,
        impact: body.impact,
        recommendation: body.recommendation,
        confidence: body.confidence,
      });
      return reply.status(201).send({ lesson });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to add lesson');
      return reply.status(500).send({ error: 'Failed to add lesson' });
    }
  });

  // POST /seed — Seed initial lessons from existing project data
  fastify.post('/seed', { preHandler: [authMiddleware] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const seeded = await service.seedFromProjects();
      return reply.send({ seeded });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to seed lessons');
      return reply.status(500).send({ error: 'Failed to seed lessons' });
    }
  });
}
