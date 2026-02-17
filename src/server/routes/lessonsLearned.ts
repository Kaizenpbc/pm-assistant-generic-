import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LessonsLearnedService } from '../services/LessonsLearnedService';
import { authMiddleware } from '../middleware/auth';

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
      const { projectId } = request.params as { projectId: string };
      const userId = (request as any).userId || undefined;
      const lessons = await service.extractLessons(projectId, userId);
      return reply.send({ lessons });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to extract lessons');
      const message = err instanceof Error ? err.message : 'Failed to extract lessons';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /relevant — Find relevant lessons by projectType and/or category
  fastify.get('/relevant', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { projectType, category } = request.query as { projectType?: string; category?: string };
      const lessons = await service.findRelevantLessons(projectType, category);
      return reply.send({ lessons });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to find relevant lessons');
      return reply.status(500).send({ error: 'Failed to find relevant lessons' });
    }
  });

  // POST /patterns — Detect cross-project patterns
  fastify.post('/patterns', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId || undefined;
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
      const { riskDescription, projectType } = request.body as { riskDescription: string; projectType: string };
      if (!riskDescription || !projectType) {
        return reply.status(400).send({ error: 'riskDescription and projectType are required' });
      }
      const userId = (request as any).userId || undefined;
      const suggestions = await service.suggestMitigations(riskDescription, projectType, userId);
      return reply.send({ suggestions });
    } catch (err) {
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
      const body = request.body as {
        projectId: string;
        projectName: string;
        projectType: string;
        category: string;
        title: string;
        description: string;
        impact: string;
        recommendation: string;
        confidence?: number;
      };
      if (!body.projectId || !body.title || !body.description || !body.recommendation) {
        return reply.status(400).send({ error: 'projectId, title, description, and recommendation are required' });
      }
      const lesson = await service.addLesson({
        projectId: body.projectId,
        projectName: body.projectName || '',
        projectType: body.projectType || 'other',
        category: (body.category as any) || 'quality',
        title: body.title,
        description: body.description,
        impact: (body.impact as any) || 'neutral',
        recommendation: body.recommendation,
        confidence: body.confidence,
      });
      return reply.status(201).send({ lesson });
    } catch (err) {
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
