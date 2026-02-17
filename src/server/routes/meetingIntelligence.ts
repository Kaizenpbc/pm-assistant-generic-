import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { MeetingIntelligenceService } from '../services/MeetingIntelligenceService';
import {
  AnalyzeRequestSchema,
  ApplyRequestSchema,
} from '../schemas/meetingSchemas';
import { analysisIdParam, projectIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess, verifyScheduleAccess } from '../middleware/authorize';

export async function meetingIntelligenceRoutes(fastify: FastifyInstance) {
  const service = new MeetingIntelligenceService();

  // ---------------------------------------------------------------------------
  // POST /analyze — Analyze a meeting transcript
  // ---------------------------------------------------------------------------

  fastify.post('/analyze', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AnalyzeRequestSchema.parse(request.body);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(parsed.projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });
      const schedule = await verifyScheduleAccess(parsed.scheduleId, userId);
      if (!schedule) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });

      const analysis = await service.analyzeTranscript(
        parsed.transcript,
        parsed.projectId,
        parsed.scheduleId,
        userId,
      );

      return reply.send({ data: analysis });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Meeting transcript analysis failed');
      return reply.status(500).send({ error: 'Failed to analyze meeting transcript' });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:analysisId/apply — Apply selected task changes from an analysis
  // ---------------------------------------------------------------------------

  fastify.post('/:analysisId/apply', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { analysisId } = analysisIdParam.parse(request.params);
      const parsed = ApplyRequestSchema.parse(request.body);
      const userId = request.user.userId;

      const result = await service.applyChanges(
        analysisId,
        parsed.selectedItems,
        userId,
      );

      return reply.send({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to apply meeting changes');
      return reply.status(500).send({ error: 'Failed to apply meeting changes' });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /project/:projectId/history — List analyses for a project
  // ---------------------------------------------------------------------------

  fastify.get('/project/:projectId/history', { preHandler: [authMiddleware] }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const project = await verifyProjectAccess(projectId, request.user.userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });
      const analyses = service.getProjectHistory(projectId);
      return reply.send({ data: analyses });
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: err.issues.map(e => e.message).join(', ') });
      fastify.log.error({ err }, 'Failed to fetch meeting analysis history');
      return reply.status(500).send({ error: 'Failed to fetch meeting analysis history' });
    }
  });
}
