import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { lessonsLearnedService } from '../services/LessonsLearnedService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function lessonsLearnedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /knowledge-base — Aggregated knowledge base overview
  fastify.get('/knowledge-base', {
    preHandler: [requireScope('read')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const overview = await lessonsLearnedService.getKnowledgeBase();
      return reply.send({ data: overview });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get knowledge base');
      return reply.status(500).send({ error: 'Failed to retrieve knowledge base' });
    }
  });

  // POST /extract/:projectId — Extract lessons from a project
  fastify.post('/extract/:projectId', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = (request as any).user.userId;
      const lessons = await lessonsLearnedService.extractLessons(projectId, userId);
      return reply.send({ lessons });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to extract lessons');
      const message = err instanceof Error ? err.message : 'Failed to extract lessons';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /relevant — Find relevant lessons by projectType and/or category
  fastify.get('/relevant', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectType, category } = request.query as { projectType?: string; category?: string };
      const lessons = await lessonsLearnedService.findRelevantLessons(projectType, category);
      return reply.send({ lessons });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to find relevant lessons');
      return reply.status(500).send({ error: 'Failed to find relevant lessons' });
    }
  });

  // POST /patterns — Detect cross-project patterns
  fastify.post('/patterns', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.userId;
      const patterns = await lessonsLearnedService.detectPatterns(userId);
      return reply.send({ patterns });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to detect patterns');
      return reply.status(500).send({ error: 'Failed to detect patterns' });
    }
  });

  // POST /mitigations — Suggest mitigations for a risk
  fastify.post('/mitigations', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { riskDescription, projectType } = request.body as { riskDescription: string; projectType: string };
      if (!riskDescription || !projectType) {
        return reply.status(400).send({ error: 'riskDescription and projectType are required' });
      }
      const userId = (request as any).user.userId;
      const suggestions = await lessonsLearnedService.suggestMitigations(riskDescription, projectType, userId);
      return reply.send({ suggestions });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to suggest mitigations');
      return reply.status(500).send({ error: 'Failed to suggest mitigations' });
    }
  });

  // POST / — Add a lesson manually
  fastify.post('/', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
      const lesson = await lessonsLearnedService.addLesson({
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

  // POST /similar — Find semantically similar lessons via RAG
  fastify.post('/similar', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query, topK } = request.body as { query: string; topK?: number };
      if (!query) {
        return reply.status(400).send({ error: 'query is required' });
      }
      const lessons = await lessonsLearnedService.findSimilarLessons(query, topK);
      return reply.send({ lessons });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to find similar lessons');
      return reply.status(500).send({ error: 'Failed to find similar lessons' });
    }
  });

  // POST /seed — Seed initial lessons from existing project data
  fastify.post('/seed', {
    preHandler: [requireScope('write')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const seeded = await lessonsLearnedService.seedFromProjects();
      return reply.send({ seeded });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to seed lessons');
      return reply.status(500).send({ error: 'Failed to seed lessons' });
    }
  });
}
